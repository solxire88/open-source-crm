-- Ensure API roles can access objects in public schema.
-- RLS policies remain the primary authorization layer.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Keep future migrations/tables/functions accessible without manual grants.
alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated, service_role;

alter default privileges in schema public
grant execute on functions to anon, authenticated, service_role;
