-- =============================================================================
-- RN Frontyard Coffee — additive migration: staff add items to an existing order
--
-- ADDITIVE ONLY: adds two nullable/defaulted columns to order_items, one new
-- table, three new functions and one new trigger. Changes no existing column,
-- function, policy or data. Apply manually in the Supabase SQL Editor after
-- 20261006090000_menu_availability_and_realtime.sql. Tested locally first.
--
-- A customer at Table 5 asks for one more rice: staff add "Extra Rice ×1" to
-- the SAME order (same RN number, same table). The new line gets its own price
-- snapshot; earlier lines are never touched. Subtotal, delivery fee and total
-- are updated in the same transaction, and order_adjustments keeps an audit
-- trail ("Extra Rice ×1 added by Bam", amount, old and new total, time).
--
-- Prices: like create_order(), add_order_item() is called only by our Next.js
-- server with the service role, after the server has checked the staff
-- session and rebuilt the item and its price from the menu. Signed-in staff
-- cannot call it directly, so a browser can never submit its own price.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. order_items: who added each line
-- -----------------------------------------------------------------------------

alter table public.order_items
  add column source   text not null default 'customer' check (source in ('customer', 'staff')),
  add column added_by uuid references auth.users (id) on delete set null;

comment on column public.order_items.source is 'customer = placed at checkout; staff = added later by staff (see order_adjustments).';
comment on column public.order_items.added_by is 'Admin who added this line (staff lines only).';


-- -----------------------------------------------------------------------------
-- 2. order_adjustments: audit trail of items added after checkout
-- -----------------------------------------------------------------------------

create table public.order_adjustments (
  id              bigint generated always as identity primary key,
  order_id        uuid not null references public.orders (id) on delete cascade,
  order_item_id   uuid not null unique references public.order_items (id) on delete cascade,
  request_id      uuid not null unique,      -- one per "Add" tap: a retry or double tap can't add twice
  kind            text not null default 'item_added' check (kind = 'item_added'),
  description     text not null check (char_length(description) between 1 and 200),  -- e.g. 'Extra Rice ×1'
  amount          numeric(10,2) not null check (amount >= 0),   -- what the order total went up by
  previous_total  numeric(10,2) not null,
  new_total       numeric(10,2) not null,
  added_by        uuid references auth.users (id) on delete set null,
  added_by_name   text not null,                                -- admin display name at the time
  created_at      timestamptz not null default now(),
  -- Kitchen saw it: set by "Got it" on the kitchen screen, or automatically
  -- when the order moves to its next status.
  acknowledged_at timestamptz
);

comment on table public.order_adjustments is 'Items staff added to an order after checkout. Written only by add_order_item().';

create index order_adjustments_order_idx on public.order_adjustments (order_id, created_at);


-- -----------------------------------------------------------------------------
-- 3. add_order_item(): the only way to add a line to an existing order
--
--    One transaction: lock the order, check it is still open, append the line
--    with its own price snapshot, update subtotal / delivery fee / total, write
--    the audit row. Called by our server only (service role), which passes the
--    signed-in admin's id after verifying the session; the id is re-checked here.
--
--    Open = received, confirmed, preparing or ready (for delivery: before it is
--    out for delivery). Completed, cancelled and dispatched orders refuse.
--
--    p_item: {product_key, product_name, category_name, size_name, base_price,
--             options:[{group,name,price_delta}], addons:[{key,name,price}],
--             unit_price, quantity, notes}
--
--    Delivery fee: if the new subtotal reaches the free-delivery amount, the fee
--    drops to 0; otherwise the fee charged at checkout is kept (never raised).
--
--    Same p_request_id again (double tap / retry) → returns the first result
--    with is_new = false and adds nothing.
-- -----------------------------------------------------------------------------

create function public.add_order_item(
  p_order_id   uuid,
  p_request_id uuid,
  p_admin_id   uuid,
  p_item       jsonb
)
returns table (
  order_id         uuid,
  order_number     text,
  table_number     smallint,
  order_item_id    uuid,
  description      text,
  added_amount     numeric,
  previous_total   numeric,
  new_subtotal     numeric,
  new_delivery_fee numeric,
  new_total        numeric,
  is_new           boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin_name text;
  v_order      public.orders%rowtype;
  v_existing   public.order_adjustments%rowtype;
  v_settings   public.store_settings%rowtype;
  v_qty        integer;
  v_base       numeric;
  v_unit       numeric;
  v_extras     numeric;
  v_line_total numeric(10,2);
  v_line       smallint;
  v_lines      integer;
  v_subtotal   numeric(10,2);
  v_fee        numeric(10,2);
  v_previous   numeric(10,2);
  v_name       text;
  v_size       text;
  v_desc       text;
  v_item_id    uuid;
begin
  if p_order_id is null or p_request_id is null or p_admin_id is null or jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'invalid_item';
  end if;

  select a.display_name into v_admin_name from public.admin_users a where a.user_id = p_admin_id;
  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Lock the order first: parallel adds to one order run one after another, so
  -- a double tap's second call sees the first call's audit row below.
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  select * into v_existing from public.order_adjustments a where a.request_id = p_request_id;
  if found then
    if v_existing.order_id <> p_order_id then
      raise exception 'idempotency_key_reused';
    end if;
    return query select v_order.id, v_order.order_number, v_order.table_number, v_existing.order_item_id,
      v_existing.description, v_existing.amount, v_existing.previous_total,
      v_order.subtotal, v_order.delivery_fee, v_order.total, false;
    return;
  end if;

  if v_order.status not in ('received', 'confirmed', 'preparing', 'ready') then
    raise exception 'order_closed';
  end if;

  -- Re-check the item's arithmetic (the server built it from the menu).
  v_name := btrim(p_item ->> 'product_name');
  v_size := nullif(btrim(p_item ->> 'size_name'), '');
  v_qty  := (p_item ->> 'quantity')::integer;
  v_base := (p_item ->> 'base_price')::numeric;
  v_unit := (p_item ->> 'unit_price')::numeric;
  if v_name is null or char_length(v_name) not between 1 and 80
     or coalesce(btrim(p_item ->> 'product_key'), '') = ''
     or v_qty is null or v_qty not between 1 and 20
     or v_base is null or v_base < 0 or v_unit is null
     or char_length(coalesce(p_item ->> 'notes', '')) > 140
     or jsonb_typeof(coalesce(p_item -> 'options', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_item -> 'addons', '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_item';
  end if;
  select coalesce(sum((o ->> 'price_delta')::numeric), 0) into v_extras
    from jsonb_array_elements(coalesce(p_item -> 'options', '[]'::jsonb)) as o;
  v_base := v_base + v_extras;
  select coalesce(sum((a ->> 'price')::numeric), 0) into v_extras
    from jsonb_array_elements(coalesce(p_item -> 'addons', '[]'::jsonb)) as a;
  if v_unit <> v_base + v_extras then
    raise exception 'item_price_mismatch';
  end if;

  select count(*), coalesce(max(i.line_number), 0) + 1 into v_lines, v_line
    from public.order_items i where i.order_id = p_order_id;
  if v_lines >= 50 then
    raise exception 'too_many_items';
  end if;

  v_line_total := v_unit * v_qty;
  insert into public.order_items (
    order_id, line_number, product_key, product_name, category_name, size_name,
    base_price, options, addons, unit_price, quantity, notes, line_total, source, added_by
  ) values (
    p_order_id,
    v_line,
    btrim(p_item ->> 'product_key'),
    v_name,
    nullif(btrim(p_item ->> 'category_name'), ''),
    v_size,
    (p_item ->> 'base_price')::numeric,
    coalesce(p_item -> 'options', '[]'::jsonb),
    coalesce(p_item -> 'addons', '[]'::jsonb),
    v_unit,
    v_qty,
    coalesce(btrim(p_item ->> 'notes'), ''),
    v_line_total,
    'staff',
    p_admin_id
  )
  returning id into v_item_id;

  -- New totals. Delivery: free once the subtotal reaches the free-delivery
  -- amount; otherwise keep the fee charged at checkout.
  v_subtotal := v_order.subtotal + v_line_total;
  v_fee := v_order.delivery_fee;
  if v_order.order_type = 'delivery' then
    select * into v_settings from public.store_settings where id;
    if found and v_settings.free_delivery_from is not null and v_subtotal >= v_settings.free_delivery_from then
      v_fee := 0;
    end if;
  end if;

  v_previous := v_order.total;
  update public.orders o
     set subtotal = v_subtotal, delivery_fee = v_fee, total = v_subtotal + v_fee
   where o.id = p_order_id
   returning * into v_order;

  -- amount = value of the added line; new_total - previous_total is what is
  -- left to collect (smaller than amount only if delivery just became free).
  v_desc := v_name || coalesce(' (' || v_size || ')', '') || ' ×' || v_qty;
  insert into public.order_adjustments (
    order_id, order_item_id, request_id, description, amount, previous_total, new_total, added_by, added_by_name
  ) values (
    p_order_id, v_item_id, p_request_id, v_desc, v_line_total, v_previous, v_order.total, p_admin_id, v_admin_name
  );

  return query select v_order.id, v_order.order_number, v_order.table_number, v_item_id, v_desc,
    v_line_total, v_previous, v_order.subtotal, v_order.delivery_fee, v_order.total, true;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Kitchen acknowledgement of added items
--
--    The kitchen screen marks newly added items "NEW / ADDED" until the kitchen
--    taps "Got it" (acknowledge_order_additions) or the order moves to its next
--    status (trigger below). Changes nothing but acknowledged_at.
-- -----------------------------------------------------------------------------

create function public.acknowledge_order_additions(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.order_adjustments a
     set acknowledged_at = now()
   where a.order_id = p_order_id and a.acknowledged_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.acknowledge_additions_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    update public.order_adjustments
       set acknowledged_at = now()
     where order_id = new.id and acknowledged_at is null;
  end if;
  return null;
end;
$$;

create trigger orders_acknowledge_additions
  after update of status on public.orders
  for each row execute function public.acknowledge_additions_on_status_change();


-- -----------------------------------------------------------------------------
-- 5. Row Level Security + privileges (same model as the other order tables)
--
--  Customers (anon) get nothing. Signed-in admins can read the audit trail.
--  Nobody writes through the API: rows are written only by add_order_item(),
--  acknowledge_order_additions() and the trigger above.
-- -----------------------------------------------------------------------------

alter table public.order_adjustments enable row level security;

revoke all on public.order_adjustments from anon;
revoke insert, update, delete, truncate on public.order_adjustments from authenticated;
grant select on public.order_adjustments to authenticated;   -- filtered by RLS
grant all on public.order_adjustments to service_role;

create policy "order_adjustments: admins read"
  on public.order_adjustments for select to authenticated
  using ((select public.is_admin()));

-- Only our server (service role) may add items: it prices them from the menu.
revoke all on function public.add_order_item(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.add_order_item(uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.acknowledge_order_additions(uuid) from public, anon;
grant execute on function public.acknowledge_order_additions(uuid) to authenticated;

revoke all on function public.acknowledge_additions_on_status_change() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. Realtime: kitchen screens see "Got it" from other screens right away.
--    (Adding an item already updates the orders row, which is published.)
--    Realtime respects RLS, so only admins receive these events.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_adjustments'
     ) then
    alter publication supabase_realtime add table public.order_adjustments;
  end if;
end;
$$;
