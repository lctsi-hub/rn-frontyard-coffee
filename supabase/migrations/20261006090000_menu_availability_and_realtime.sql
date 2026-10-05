-- =============================================================================
-- RN Frontyard Coffee — additive migration: menu availability + live order board
--
-- ADDITIVE ONLY: creates one new table and adds `orders` to Supabase Realtime.
-- Changes no existing table, function, policy or data.
-- Apply manually in the Supabase SQL Editor (see docs). Tested locally first.
--
-- 1. menu_availability: Bam's Available / Sold out switches for products and
--    add-ons. Products themselves stay in the app code (src/data/menu-data.ts);
--    a missing row means "use the code default". Past orders are unaffected:
--    order_items keeps its own snapshot of names and prices.
-- 2. Realtime on orders: lets the admin dashboard and kitchen screen update
--    live. Realtime respects RLS, so only admins receive order events.
-- =============================================================================

create table public.menu_availability (
  item_type    text not null check (item_type in ('product', 'addon')),
  item_key     text not null check (item_key ~ '^[a-z0-9-]+$'),   -- e.g. 'spanish-latte', 'addon-extra-shot'
  is_available boolean not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null,
  primary key (item_type, item_key)
);

comment on table public.menu_availability is 'Available / Sold out switches set by admins; overrides the menu defined in code.';

create trigger menu_availability_set_updated_at
  before update on public.menu_availability
  for each row execute function public.set_updated_at();

-- Always record which admin made the change (can't be set by the client).
create function public.set_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.set_updated_by() from public, anon, authenticated;

create trigger menu_availability_set_updated_by
  before insert or update on public.menu_availability
  for each row execute function public.set_updated_by();

alter table public.menu_availability enable row level security;

-- Explicit privileges (don't rely on project defaults); RLS decides the rows.
revoke all on public.menu_availability from anon, authenticated;
grant select on public.menu_availability to anon, authenticated;
grant insert, update, delete on public.menu_availability to authenticated;
grant all on public.menu_availability to service_role;

create policy "menu_availability: public read"
  on public.menu_availability for select to anon, authenticated
  using (true);
create policy "menu_availability: admins insert"
  on public.menu_availability for insert to authenticated
  with check ((select public.is_admin()));
create policy "menu_availability: admins update"
  on public.menu_availability for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "menu_availability: admins delete"
  on public.menu_availability for delete to authenticated
  using ((select public.is_admin()));

-- Live order board: publish order changes to Supabase Realtime (admins only via RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
