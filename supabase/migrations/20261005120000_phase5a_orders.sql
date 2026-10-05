-- =============================================================================
-- RN Frontyard Coffee — Phase 5A/5A.1: real customer orders
--
-- STATUS: PREPARED FOR REVIEW. NOT APPLIED to the cloud Supabase project.
-- Tested only against a local, throwaway database. See docs/phase-5-supabase-orders.md.
--
-- Creates:
--   types     order_type, order_status, payment_method
--   tables    admin_users, store_settings, delivery_areas,
--             orders, order_items, order_status_history
--   functions is_admin(), is_valid_status_transition(),
--             create_order()          -- service role only (our Next.js server)
--             update_order_status()   -- signed-in admins only
--             get_order_tracking()    -- service role only (server hashes the token)
--   RLS       enabled on every table; customers never read/write tables directly
--
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
  'ready',             -- ready to serve / ready for pickup / ready for the rider
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

-- True when the signed-in user is an admin. SECURITY DEFINER so policies and
-- functions can call it without anyone being able to read admin_users.
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

  -- SHA-256 (hex) of the customer's tracking token. The raw token is given to
  -- the customer once and never stored, so a database leak can't be used to
  -- open anyone's tracking page.
  tracking_token_hash text not null unique check (tracking_token_hash ~ '^[0-9a-f]{64}$'),

  -- Idempotency: one key per checkout attempt, sent by the browser. A retry with
  -- the same key and the same order returns the existing order; the same key
  -- with a different order is rejected (request_fingerprint differs).
  client_request_id   uuid not null unique,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),

  order_type     public.order_type not null,
  status         public.order_status not null default 'received',

  customer_name  text not null check (char_length(btrim(customer_name)) between 1 and 60),
  customer_phone text check (customer_phone ~ '^09[0-9]{9}$'),   -- stored as 09171234567
  table_number   smallint check (table_number between 1 and 99),

  -- Delivery. The area name and the fee actually charged are stored on the order,
  -- so an old order never changes if the area is renamed or its fee is edited.
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

comment on table public.orders is 'Customer QR orders. Created only through create_order(); status changed only through update_order_status().';

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
-- 7. Status rules and history
-- -----------------------------------------------------------------------------

-- Allowed status changes. completed and cancelled are final.
--   received   → confirmed | cancelled
--   confirmed  → preparing | cancelled
--   preparing  → ready | cancelled            (+ out_for_delivery for delivery)
--   ready      → completed | cancelled        (dine in / take out)
--   ready      → out_for_delivery | cancelled (delivery)
--   out_for_delivery → completed
create function public.is_valid_status_transition(
  p_type public.order_type,
  p_from public.order_status,
  p_to   public.order_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'received'  then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('preparing', 'cancelled')
    when 'preparing' then p_to in ('ready', 'cancelled')
                          or (p_type = 'delivery' and p_to = 'out_for_delivery')
    when 'ready'     then p_to = 'cancelled'
                          or (p_type <> 'delivery' and p_to = 'completed')
                          or (p_type = 'delivery' and p_to = 'out_for_delivery')
    when 'out_for_delivery' then p_to = 'completed'
    else false
  end;
$$;

-- Enforced on every update, whoever makes it (admin function, service role or
-- a manual SQL edit), so an impossible jump like completed → preparing can't
-- be saved by any path.
create function public.enforce_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not public.is_valid_status_transition(old.order_type, old.status, new.status) then
    raise exception 'invalid_status_transition';
  end if;
  return new;
end;
$$;

create trigger orders_enforce_status_transition
  before update of status on public.orders
  for each row execute function public.enforce_status_transition();

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,            -- null for the first entry
  to_status   public.order_status not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid references auth.users (id) on delete set null  -- admin who changed it; null for the customer
);

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

-- Written only by this trigger, so the history can never drift from orders.status.
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
--    Called only by our Next.js server with the service role, after it has
--    rebuilt every item and price from the menu (the browser sends ids only).
--    The database then re-checks everything it can verify on its own: item
--    arithmetic, subtotal, delivery rules and fee, and that the total equals
--    the total the customer was shown (expected_total).
--
--    p_order: {client_request_id, tracking_token_hash, expected_total,
--              order_type, customer_name, customer_phone, table_number,
--              delivery_area_id, delivery_address, delivery_landmark,
--              delivery_instructions, payment_method, notes}
--    p_items: [{product_key, product_name, category_name, size_name, base_price,
--               options:[{group,name,price_delta}], addons:[{key,name,price}],
--               unit_price, quantity, notes}]
--
--    Returns the order id, number and total, and is_new = false when the same
--    request was already saved (safe retry).
--    Errors are raised with a short code as the message (e.g.
--    'delivery_below_minimum') so the server can explain them to the customer.
-- -----------------------------------------------------------------------------

create function public.create_order(p_order jsonb, p_items jsonb)
returns table (order_id uuid, order_number text, total numeric, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_settings    public.store_settings%rowtype;
  v_area        public.delivery_areas%rowtype;
  v_existing    record;
  v_request     uuid;
  v_token_hash  text;
  v_fingerprint text;
  v_expected    numeric;
  v_conflict    text;
  v_type        public.order_type;
  v_item        jsonb;
  v_line        integer := 0;
  v_qty         integer;
  v_base        numeric(10,2);
  v_unit        numeric(10,2);
  v_extras      numeric(10,2);
  v_subtotal    numeric(10,2) := 0;
  v_fee         numeric(10,2) := 0;
  v_order       public.orders%rowtype;
begin
  if jsonb_typeof(p_order) is distinct from 'object' then
    raise exception 'invalid_order';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too_many_items';
  end if;

  v_request    := nullif(p_order ->> 'client_request_id', '')::uuid;
  v_token_hash := p_order ->> 'tracking_token_hash';
  v_expected   := (p_order ->> 'expected_total')::numeric;
  if v_request is null or v_token_hash is null or v_token_hash !~ '^[0-9a-f]{64}$' or v_expected is null then
    raise exception 'invalid_order';
  end if;

  -- Fingerprint of everything the customer chose (not the key/token), used to
  -- make sure a retried key carries exactly the same order.
  v_fingerprint := encode(
    sha256(convert_to(jsonb_build_array(p_order - 'client_request_id' - 'tracking_token_hash', p_items)::text, 'UTF8')),
    'hex'
  );

  -- Safe retry: same key already saved?
  select o.id, o.order_number, o.total, o.request_fingerprint, o.tracking_token_hash
    into v_existing
    from public.orders o
    where o.client_request_id = v_request;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint or v_existing.tracking_token_hash <> v_token_hash then
      raise exception 'idempotency_key_reused';
    end if;
    return query select v_existing.id, v_existing.order_number, v_existing.total, false;
    return;
  end if;

  select * into v_settings from public.store_settings where id;
  if not found or not v_settings.ordering_enabled then
    raise exception 'ordering_closed';
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

  -- The customer must be charged exactly what they saw.
  if v_expected <> v_subtotal + v_fee then
    raise exception 'total_changed';
  end if;

  begin
    insert into public.orders (
      tracking_token_hash, client_request_id, request_fingerprint,
      order_type, customer_name, customer_phone, table_number,
      delivery_area_id, delivery_area_name, delivery_address, delivery_landmark, delivery_instructions,
      payment_method, notes, subtotal, delivery_fee, total
    ) values (
      v_token_hash,
      v_request,
      v_fingerprint,
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
    -- A parallel call with the same key committed first: the unique index made
    -- this insert wait for it, so that order is visible now. Both calls carry
    -- the same key AND the same token hash, so either unique index can be the
    -- one that trips. Same payload → return it; different payload → reject.
    get stacked diagnostics v_conflict = constraint_name;
    if v_conflict is null or v_conflict not in ('orders_client_request_id_key', 'orders_tracking_token_hash_key') then
      raise;
    end if;
    select o.id, o.order_number, o.total, o.request_fingerprint, o.tracking_token_hash
      into v_existing
      from public.orders o
      where o.client_request_id = v_request;
    if not found
       or v_existing.request_fingerprint <> v_fingerprint
       or v_existing.tracking_token_hash <> v_token_hash then
      raise exception 'idempotency_key_reused';
    end if;
    return query select v_existing.id, v_existing.order_number, v_existing.total, false;
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

  return query select v_order.id, v_order.order_number, v_order.total, true;
end;
$$;


-- -----------------------------------------------------------------------------
-- 9. update_order_status(): the only way to change an order's status.
--
--    Signed-in admins only. Locks the order row, checks the order still has the
--    status the admin was looking at (so two staff can't overwrite each other),
--    checks the change is allowed, updates it; the trigger writes the history
--    row with the admin's user id. All in one transaction.
-- -----------------------------------------------------------------------------

create function public.update_order_status(
  p_order_id    uuid,
  p_from_status public.order_status,
  p_to_status   public.order_status
)
returns table (order_id uuid, order_number text, status public.order_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> p_from_status then
    raise exception 'status_changed';
  end if;
  if not public.is_valid_status_transition(v_order.order_type, v_order.status, p_to_status) then
    raise exception 'invalid_status_transition';
  end if;

  update public.orders o set status = p_to_status where o.id = p_order_id
    returning * into v_order;

  return query select v_order.id, v_order.order_number, v_order.status, v_order.updated_at;
end;
$$;


-- -----------------------------------------------------------------------------
-- 10. get_order_tracking(): the customer's tracking page data.
--
--     Our server hashes the raw token and calls this with the hash (service
--     role only). Returns a safe summary: no phone, address, landmark,
--     delivery instructions or full name.
-- -----------------------------------------------------------------------------

create function public.get_order_tracking(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number',        o.order_number,
    'customer_first_name', split_part(btrim(o.customer_name), ' ', 1),
    'order_type',          o.order_type,
    'status',              o.status,
    'table_number',        o.table_number,
    'payment_method',      o.payment_method,
    'subtotal',            o.subtotal,
    'delivery_fee',        o.delivery_fee,
    'total',               o.total,
    'created_at',          o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', i.product_name, 'size', i.size_name, 'options', i.options,
               'addons', i.addons, 'quantity', i.quantity, 'notes', i.notes,
               'line_total', i.line_total
             ) order by i.line_number)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.changed_at) order by h.changed_at, h.id)
      from public.order_status_history h where h.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.tracking_token_hash = p_token_hash;
$$;


-- -----------------------------------------------------------------------------
-- 11. Row Level Security + privileges
--
--  Customers (anon role) get NO direct access to order tables, and can't call
--  the order functions: everything goes through our server.
--  Admins (signed in + listed in admin_users) can read orders and change status
--  only through update_order_status(). Nobody can delete orders via the API.
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
revoke insert, update, delete, truncate on public.admin_users, public.orders, public.order_items, public.order_status_history from authenticated;
revoke insert, update, delete, truncate on public.store_settings, public.delivery_areas from anon;

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

-- orders / items / history: admins read. No insert, update or delete policies:
-- writes happen only inside create_order(), update_order_status() and triggers.
create policy "orders: admins read"
  on public.orders for select to authenticated
  using ((select public.is_admin()));
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

revoke all on function public.get_order_tracking(text) from public, anon, authenticated;
grant execute on function public.get_order_tracking(text) to service_role;

revoke all on function public.update_order_status(uuid, public.order_status, public.order_status) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, public.order_status) to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

revoke all on function public.is_valid_status_transition(public.order_type, public.order_status, public.order_status) from public;
grant execute on function public.is_valid_status_transition(public.order_type, public.order_status, public.order_status) to anon, authenticated, service_role;

revoke all on function public.log_order_status_change() from public, anon, authenticated;
revoke all on function public.enforce_status_transition() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
