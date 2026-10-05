-- Minimal stand-in for what Supabase provides before our migration runs, so the
-- migration can be tested on a plain local PostgreSQL. Mirrors Supabase:
--   roles      anon, authenticated (RLS applies), service_role (BYPASSRLS)
--   auth       auth.users table and auth.uid(), which reads the request's JWT
--              claims the same way Supabase/PostgREST sets them per request
--   defaults   Supabase's permissive default grants on the public schema, so
--              the tests prove the migration narrows them
-- TEST USE ONLY. Never run against the real Supabase project.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
