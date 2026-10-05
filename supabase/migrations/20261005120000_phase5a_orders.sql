-- =============================================================================
-- RN Frontyard Coffee — Phase 5A: real customer orders
--
-- STATUS: PREPARED FOR REVIEW. NOT APPLIED to any database.
-- Do not run until Phase 5B is approved. See docs/phase-5-supabase-orders.md.
--
-- Creates:
--   types     order_type, order_status, payment_method
--   tables    admin_users, store_settings, delivery_areas,
--             orders, order_items, order_status_history
--   functions is_admin(), create_order(), get_order_tracking(),
--             set_updated_at(), log_order_status_change()
--   RLS       enabled on every table; customers never read/write tables directly
-- Money is numeric(10,2) pesos. Whole-peso prices today, centavos possible later.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Types
-- -----------------------------------------------------------------------------

create type public.order_type as enum ('dine_in', 'take_out', 'delivery');

create type public.order_status as enum (
  'received',          -- customer placed the order
  'confirmed',         -- shop accepted it
  'preparing',
  'ready',             -- ready to serve / ready for pickup / ready for rider
  'out_for_delivery',  -- delivery orders only
  'completed',
  'cancelled'
);

create type public.payment_method as enum ('cash', 'gcash', 'counter');


-- -----------------------------------------------------------------------------
-- 2. Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Admin users (Bam and staff). Rows are added by hand in the Supabase
--    dashboard / SQL editor after the person signs up; never from the app.
-- -----------------------------------------------------------------------------

create table public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at   timestamptz not null default now()
);

comment on table public.admin_users is 'Signed-in users allowed to manage orders and settings.';

-- True when the signed-in user is an admin. SECURITY DEFINER so RLS policies can
-- call it without granting anyone read access to admin_users.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;


-- -----------------------------------------------------------------------------
-- 4. Store + delivery settings (future admin "Settings" page).
--    The app keeps using src/data/store-settings.ts until the admin can edit these.
-- -----------------------------------------------------------------------------

create table public.store_settings (
  id                 boolean primary key default true check (id),  -- exactly one row
  ordering_enabled   boolean not null default true,
  delivery_enabled   boolean not null default true,
  delivery_min_order numeric(10,2) not null default 300 check (delivery_min_order >= 0),
  free_delivery_from numeric(10,2) check (free_delivery_from is null or free_delivery_from >= 0), -- null = never free
  updated_at         timestamptz not null default now()
);

comment on table public.store_settings is 'Single-row store configuration (id is always true).';

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

create table public.delivery_areas (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),  -- matches the app's area ids, e.g. 'lourdes'
  name       text not null unique check (char_length(name) between 1 and 60),
  fee        numeric(10,2) not null check (fee >= 0),       -- normal fee before the free-delivery rule
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.delivery_areas is 'Barangays/areas served by delivery, each with its own fee.';

create trigger delivery_areas_set_updated_at
  before update on public.delivery_areas
  for each row execute function public.set_updated_at();

-- Current rules (same as src/data/store-settings.ts).
insert into public.store_settings (id, ordering_enabled, delivery_enabled, delivery_min_order, free_delivery_from)
values (true, true, true, 300, 500);

insert into public.delivery_areas (id, name, fee, is_active, sort_order) values
  ('lourdes',    'Lourdes',    50, true, 1),
  ('salapungan', 'Salapungan', 50, true, 2),
  ('batasan',    'Batasan',    70, true, 3),
  ('magumbali',  'Magumbali',  70, true, 4),
  ('mandili',    'Mandili',    70, true, 5);


-- -----------------------------------------------------------------------------
-- 5. Orders
-- -----------------------------------------------------------------------------

create table public.orders (
  id             uuid primary key default gen_random_uuid(),

  -- Human-readable number. order_seq comes from an identity sequence, which
  -- hands out each value exactly once even when many orders arrive at the same
  -- moment (no duplicates). A failed insert can skip a number (gap); that is
  -- normal and harmless. order_number is derived from it and can't be edited.
  order_seq      bigint generated always as identity (start with 1) unique,
  order_number   text generated always as (
                   'RN-' || case when order_seq < 10000 then lpad(order_seq::text, 4, '0') else order_seq::text end
                 ) stored unique,

  -- Secret, unguessable id given only to the customer who placed the order.
  -- It is the key to their tracking page; it is never listed anywhere.
  tracking_token uuid not null unique default gen_random_uuid(),

  -- Random id the browser sends with each checkout attempt. If the same attempt
  -- arrives twice (double tap, network retry), the existing order is returned
  -- instead of creating a duplicate.
  client_request_id uuid unique,

  order_type     public.order_type not null,
  status         public.order_status not null default 'received',

  customer_name  text not null check (char_length(btrim(customer_name)) between 1 and 60),
  customer_phone text check (customer_phone ~ '^09[0-9]{9}$'),   -- stored as 09171234567
  table_number   smallint check (table_number between 1 and 99),

  -- Delivery. The area name is copied so old orders keep it if an area is renamed.
  delivery_area_id      text references public.delivery_areas (id) on update cascade on delete restrict,
  delivery_area_name    text,
  delivery_address      text check (char_length(delivery_address) <= 160),
  delivery_landmark     text check (char_length(delivery_landmark) <= 120),
  delivery_instructions text check (char_length(delivery_instructions) <= 200),

  payment_method public.payment_method not null,
  notes          text not null default '' check (char_length(notes) <= 200),  -- order special instructions

  subtotal       numeric(10,2) not null check (subtotal >= 0),
  delivery_fee   numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total          numeric(10,2) not null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint orders_total_is_sum           check (total = subtotal + delivery_fee),
  constraint orders_dine_in_needs_table    check (order_type <> 'dine_in' or table_number is not null),
  constraint orders_phone_unless_dine_in   check (order_type = 'dine_in' or customer_phone is not null),
  constraint orders_delivery_needs_address check (
    order_type <> 'delivery' or (
      delivery_area_id is not null and delivery_area_name is not null
      and delivery_address is not null and delivery_landmark is not null
    )
  ),
  constraint orders_fee_only_for_delivery  check (order_type = 'delivery' or delivery_fee = 0),
  constraint orders_out_for_delivery_type  check (status <> 'out_for_delivery' or order_type = 'delivery')
);

comment on table public.orders is 'Customer QR orders. Created only through create_order().';

create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_created_idx on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 6. Order items: a snapshot of what was bought, independent of the live menu.
-- -----------------------------------------------------------------------------

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  line_number   smallint not null check (line_number >= 1),

  product_key   text not null,   -- menu product id when ordered, e.g. 'spanish-latte'
  product_name  text not null,   -- name when ordered
  category_name text,            -- category when ordered, e.g. 'Coffee'
  size_name     text,            -- e.g. '22oz', 'Duo'; null when the item has no sizes
  base_price    numeric(10,2) not null check (base_price >= 0),  -- size price or single price

  -- [{"group": "Temperature", "name": "Iced", "price_delta": 0}]
  options       jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  -- [{"key": "addon-extra-shot", "name": "Extra Shot", "price": 15}]
  addons        jsonb not null default '[]'::jsonb check (jsonb_typeof(addons) = 'array'),

  unit_price    numeric(10,2) not null check (unit_price >= 0),  -- base + options + add-ons
  quantity      integer not null check (quantity between 1 and 20),
  notes         text not null default '' check (char_length(notes) <= 140),
  line_total    numeric(10,2) not null,
  created_at    timestamptz not null default now(),

  constraint order_items_line_unique  unique (order_id, line_number),
  constraint order_items_total_is_qty check (line_total = unit_price * quantity)
);

comment on table public.order_items is 'Snapshot of each ordered item; never re-read from the live menu.';


-- -----------------------------------------------------------------------------
-- 7. Status history (customer timeline + admin audit trail).
--    Written only by the trigger below, so it can never drift from orders.status.
-- -----------------------------------------------------------------------------

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,            -- null for the first entry
  to_status   public.order_status not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid references auth.users (id) on delete set null  -- admin who changed it; null for the customer
);

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

create function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();


-- -----------------------------------------------------------------------------
-- 8. create_order(): the only way an order is created.
--
--    Runs as ONE transaction: the order, every item and the first 'received'
--    history row are saved together, or (on any error) nothing is saved.
--
--    Called only by our Next.js server (service role), after it has re-priced
--    every item from the menu. The database re-checks what it can verify on
--    its own: item arithmetic, subtotal, delivery rules and fee, totals.
--
--    p_order: {client_request_id, order_type, customer_name, customer_phone, table_number,
--              delivery_area_id, delivery_address, delivery_landmark,
--              delivery_instructions, payment_method, notes}
--    p_items: [{product_key, product_name, category_name, size_name, base_price,
--               options:[{group,name,price_delta}], addons:[{key,name,price}],
--               unit_price, quantity, notes}]
--
--    Errors are raised with a short code in the message (e.g. 'delivery_below_minimum')
--    so the server can show the customer a clear explanation.
-- -----------------------------------------------------------------------------

create function public.create_order(p_order jsonb, p_items jsonb)
returns table (order_id uuid, order_number text, tracking_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_settings  public.store_settings%rowtype;
  v_area      public.delivery_areas%rowtype;
  v_request   uuid;
  v_conflict  text;
  v_type      public.order_type;
  v_item      jsonb;
  v_line      integer := 0;
  v_qty       integer;
  v_base      numeric(10,2);
  v_unit      numeric(10,2);
  v_extras    numeric(10,2);
  v_subtotal  numeric(10,2) := 0;
  v_fee       numeric(10,2) := 0;
  v_order     public.orders%rowtype;
begin
  select * into v_settings from public.store_settings where id;
  if not found or not v_settings.ordering_enabled then
    raise exception 'ordering_closed';
  end if;

  if jsonb_typeof(p_order) is distinct from 'object' then
    raise exception 'invalid_order';
  end if;

  -- Same checkout attempt already saved? Return that order instead of a duplicate.
  v_request := nullif(p_order ->> 'client_request_id', '')::uuid;
  if v_request is not null then
    return query
      select o.id, o.order_number, o.tracking_token from public.orders o where o.client_request_id = v_request;
    if found then
      return;
    end if;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;

  v_type := (p_order ->> 'order_type')::public.order_type;

  -- Check each item's arithmetic and add up the subtotal.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty  := (v_item ->> 'quantity')::integer;
    v_base := (v_item ->> 'base_price')::numeric;
    v_unit := (v_item ->> 'unit_price')::numeric;
    if v_qty is null or v_base is null or v_unit is null then
      raise exception 'invalid_item';
    end if;

    -- unit_price must equal base price + option price changes + add-on prices.
    select coalesce(sum((o ->> 'price_delta')::numeric), 0) into v_extras
      from jsonb_array_elements(coalesce(v_item -> 'options', '[]'::jsonb)) as o;
    v_base := v_base + v_extras;
    select coalesce(sum((a ->> 'price')::numeric), 0) into v_extras
      from jsonb_array_elements(coalesce(v_item -> 'addons', '[]'::jsonb)) as a;

    if v_unit <> v_base + v_extras then
      raise exception 'item_price_mismatch';
    end if;
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- Delivery rules, using the settings stored in the database.
  if v_type = 'delivery' then
    if not v_settings.delivery_enabled then
      raise exception 'delivery_unavailable';
    end if;
    if v_subtotal < v_settings.delivery_min_order then
      raise exception 'delivery_below_minimum';
    end if;
    select * into v_area
      from public.delivery_areas
      where id = p_order ->> 'delivery_area_id' and is_active;
    if not found then
      raise exception 'delivery_area_invalid';
    end if;
    v_fee := case
      when v_settings.free_delivery_from is not null and v_subtotal >= v_settings.free_delivery_from then 0
      else v_area.fee
    end;
  end if;

  begin
  insert into public.orders (
    client_request_id, order_type, customer_name, customer_phone, table_number,
    delivery_area_id, delivery_area_name, delivery_address, delivery_landmark, delivery_instructions,
    payment_method, notes, subtotal, delivery_fee, total
  ) values (
    v_request,
    v_type,
    btrim(p_order ->> 'customer_name'),
    nullif(btrim(p_order ->> 'customer_phone'), ''),
    case when v_type = 'dine_in' then (p_order ->> 'table_number')::smallint end,
    case when v_type = 'delivery' then v_area.id end,
    case when v_type = 'delivery' then v_area.name end,
    case when v_type = 'delivery' then nullif(btrim(p_order ->> 'delivery_address'), '') end,
    case when v_type = 'delivery' then nullif(btrim(p_order ->> 'delivery_landmark'), '') end,
    case when v_type = 'delivery' then nullif(btrim(p_order ->> 'delivery_instructions'), '') end,
    (p_order ->> 'payment_method')::public.payment_method,
    coalesce(btrim(p_order ->> 'notes'), ''),
    v_subtotal,
    v_fee,
    v_subtotal + v_fee
  )
  returning * into v_order;
  exception when unique_violation then
    -- A parallel call with the same client_request_id committed first: the
    -- unique index made this insert wait for it, so its order is visible now.
    get stacked diagnostics v_conflict = constraint_name;
    if v_request is null or v_conflict is distinct from 'orders_client_request_id_key' then
      raise;
    end if;
    return query
      select o.id, o.order_number, o.tracking_token from public.orders o where o.client_request_id = v_request;
    return;
  end;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line := v_line + 1;
    insert into public.order_items (
      order_id, line_number, product_key, product_name, category_name, size_name,
      base_price, options, addons, unit_price, quantity, notes, line_total
    ) values (
      v_order.id,
      v_line,
      v_item ->> 'product_key',
      v_item ->> 'product_name',
      v_item ->> 'category_name',
      nullif(v_item ->> 'size_name', ''),
      (v_item ->> 'base_price')::numeric,
      coalesce(v_item -> 'options', '[]'::jsonb),
      coalesce(v_item -> 'addons', '[]'::jsonb),
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'quantity')::integer,
      coalesce(btrim(v_item ->> 'notes'), ''),
      (v_item ->> 'unit_price')::numeric * (v_item ->> 'quantity')::integer
    );
  end loop;

  return query select v_order.id, v_order.order_number, v_order.tracking_token;
end;
$$;


-- -----------------------------------------------------------------------------
-- 9. get_order_tracking(): what a customer sees on their tracking page.
--    Needs the secret tracking token; returns no phone number or address.
-- -----------------------------------------------------------------------------

create function public.get_order_tracking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number',       o.order_number,
    'order_type',         o.order_type,
    'status',             o.status,
    'customer_first_name', split_part(o.customer_name, ' ', 1),
    'table_number',       o.table_number,
    'delivery_area_name', o.delivery_area_name,
    'payment_method',     o.payment_method,
    'subtotal',           o.subtotal,
    'delivery_fee',       o.delivery_fee,
    'total',              o.total,
    'created_at',         o.created_at,
    'updated_at',         o.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', i.product_name, 'size', i.size_name, 'options', i.options,
               'addons', i.addons, 'quantity', i.quantity, 'notes', i.notes,
               'line_total', i.line_total
             ) order by i.line_number)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.changed_at) order by h.changed_at, h.id)
      from public.order_status_history h where h.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.tracking_token = p_token;
$$;


-- -----------------------------------------------------------------------------
-- 10. Row Level Security + privileges
--
--  Customers (anon role) get NO direct access to order tables. They can only:
--    - place an order through our server (create_order, service role only)
--    - read one order with its secret token (get_order_tracking)
--    - read active delivery areas and store settings (checkout needs them)
--  Admins (signed in + listed in admin_users) can read all orders and change
--  only the status column. Nobody can delete orders through the API.
-- -----------------------------------------------------------------------------

alter table public.admin_users          enable row level security;
alter table public.store_settings       enable row level security;
alter table public.delivery_areas       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;

-- Supabase grants anon/authenticated full table privileges by default; narrow
-- them so a missing policy is never the only thing standing in the way.
revoke all on public.admin_users, public.orders, public.order_items, public.order_status_history from anon;
revoke insert, update, delete on public.admin_users, public.orders, public.order_items, public.order_status_history from authenticated;
grant update (status) on public.orders to authenticated;               -- admins: status only (RLS below)
revoke insert, update, delete on public.store_settings, public.delivery_areas from anon;

-- admin_users: an admin can see the admin list; anyone signed in can see their own row.
create policy "admin_users: read own row or as admin"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- store_settings: everyone reads; admins update.
create policy "store_settings: public read"
  on public.store_settings for select to anon, authenticated
  using (true);
create policy "store_settings: admins update"
  on public.store_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- delivery_areas: everyone reads active areas; admins read all and manage them.
create policy "delivery_areas: read active or as admin"
  on public.delivery_areas for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "delivery_areas: admins insert"
  on public.delivery_areas for insert to authenticated
  with check ((select public.is_admin()));
create policy "delivery_areas: admins update"
  on public.delivery_areas for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "delivery_areas: admins delete"
  on public.delivery_areas for delete to authenticated
  using ((select public.is_admin()));

-- orders: admins read all and update status. No insert/delete policies at all.
create policy "orders: admins read"
  on public.orders for select to authenticated
  using ((select public.is_admin()));
create policy "orders: admins update status"
  on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- order_items / order_status_history: admins read only (writes happen in
-- create_order() and the status trigger).
create policy "order_items: admins read"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));
create policy "order_status_history: admins read"
  on public.order_status_history for select to authenticated
  using ((select public.is_admin()));

-- Function privileges. Supabase lets anon/authenticated execute new functions
-- by default, so set every one explicitly.
revoke all on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;

revoke all on function public.get_order_tracking(uuid) from public;
grant execute on function public.get_order_tracking(uuid) to anon, authenticated, service_role;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

revoke all on function public.log_order_status_change() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
