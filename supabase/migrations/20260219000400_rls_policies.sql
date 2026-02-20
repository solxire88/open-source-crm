create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and p.is_disabled = false
  )
$$;

create or replace function public.can_read_table(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then exists (
      select 1
      from public.lead_tables lt
      where lt.id = p_table_id
        and lt.org_id = public.current_org_id()
    )
    else exists (
      select 1
      from public.table_permissions tp
      join public.lead_tables lt on lt.id = tp.table_id
      where tp.table_id = p_table_id
        and tp.user_id = auth.uid()
        and lt.org_id = public.current_org_id()
    )
  end
$$;

create or replace function public.can_edit_table(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then exists (
      select 1
      from public.lead_tables lt
      where lt.id = p_table_id
        and lt.org_id = public.current_org_id()
    )
    else exists (
      select 1
      from public.table_permissions tp
      join public.lead_tables lt on lt.id = tp.table_id
      where tp.table_id = p_table_id
        and tp.user_id = auth.uid()
        and tp.access_level = 'edit'
        and lt.org_id = public.current_org_id()
    )
  end
$$;

create or replace function public.can_read_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.org_id = public.current_org_id()
      and public.can_read_table(l.table_id)
  )
$$;

create or replace function public.can_edit_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.org_id = public.current_org_id()
      and public.can_edit_table(l.table_id)
  )
$$;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_read_table(uuid) to authenticated;
grant execute on function public.can_edit_table(uuid) to authenticated;
grant execute on function public.can_read_lead(uuid) to authenticated;
grant execute on function public.can_edit_lead(uuid) to authenticated;
grant execute on function public.try_uuid(text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.lead_tables enable row level security;
alter table public.table_permissions enable row level security;
alter table public.table_services enable row level security;
alter table public.leads enable row level security;
alter table public.lead_services enable row level security;
alter table public.audit_events enable row level security;
alter table public.import_batches enable row level security;
alter table public.attachments enable row level security;
alter table public.favorite_tables enable row level security;
alter table public.pinned_leads enable row level security;
alter table public.saved_filters enable row level security;

create policy organizations_select
on public.organizations
for select
using (id = public.current_org_id());

create policy organizations_update_admin
on public.organizations
for update
using (id = public.current_org_id() and public.is_admin())
with check (id = public.current_org_id() and public.is_admin());

create policy profiles_select_self_or_admin
on public.profiles
for select
using (
  org_id = public.current_org_id()
  and (user_id = auth.uid() or public.is_admin())
);

create policy profiles_insert_admin
on public.profiles
for insert
with check (
  public.is_admin()
  and org_id = public.current_org_id()
);

create policy profiles_update_self_or_admin
on public.profiles
for update
using (
  org_id = public.current_org_id()
  and (user_id = auth.uid() or public.is_admin())
)
with check (
  org_id = public.current_org_id()
  and (user_id = auth.uid() or public.is_admin())
);

create policy profiles_delete_admin
on public.profiles
for delete
using (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy lead_tables_read
on public.lead_tables
for select
using (
  org_id = public.current_org_id()
  and public.can_read_table(id)
);

create policy lead_tables_admin_insert
on public.lead_tables
for insert
with check (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy lead_tables_admin_update
on public.lead_tables
for update
using (
  org_id = public.current_org_id()
  and public.is_admin()
)
with check (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy lead_tables_admin_delete
on public.lead_tables
for delete
using (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_permissions_admin_select
on public.table_permissions
for select
using (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_permissions_admin_insert
on public.table_permissions
for insert
with check (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_permissions_admin_update
on public.table_permissions
for update
using (
  org_id = public.current_org_id()
  and public.is_admin()
)
with check (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_permissions_admin_delete
on public.table_permissions
for delete
using (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_services_read
on public.table_services
for select
using (
  org_id = public.current_org_id()
  and public.can_read_table(table_id)
);

create policy table_services_admin_insert
on public.table_services
for insert
with check (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_services_admin_update
on public.table_services
for update
using (
  org_id = public.current_org_id()
  and public.is_admin()
)
with check (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy table_services_admin_delete
on public.table_services
for delete
using (
  org_id = public.current_org_id()
  and public.is_admin()
);

create policy leads_read
on public.leads
for select
using (
  org_id = public.current_org_id()
  and public.can_read_table(table_id)
);

create policy leads_insert_edit
on public.leads
for insert
with check (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy leads_update_edit
on public.leads
for update
using (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
)
with check (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy leads_delete_edit
on public.leads
for delete
using (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy lead_services_read
on public.lead_services
for select
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and l.org_id = public.current_org_id()
      and public.can_read_table(l.table_id)
  )
);

create policy lead_services_edit_insert
on public.lead_services
for insert
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and l.org_id = public.current_org_id()
      and public.can_edit_table(l.table_id)
  )
);

create policy lead_services_edit_delete
on public.lead_services
for delete
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and l.org_id = public.current_org_id()
      and public.can_edit_table(l.table_id)
  )
);

create policy audit_events_read
on public.audit_events
for select
using (
  org_id = public.current_org_id()
  and public.can_read_table(table_id)
);

create policy audit_events_insert
on public.audit_events
for insert
with check (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy import_batches_read
on public.import_batches
for select
using (
  org_id = public.current_org_id()
  and public.can_read_table(table_id)
);

create policy import_batches_insert
on public.import_batches
for insert
with check (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy attachments_read
on public.attachments
for select
using (
  org_id = public.current_org_id()
  and public.can_read_table(table_id)
);

create policy attachments_insert
on public.attachments
for insert
with check (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy attachments_delete
on public.attachments
for delete
using (
  org_id = public.current_org_id()
  and public.can_edit_table(table_id)
);

create policy favorite_tables_user_only
on public.favorite_tables
for all
using (
  user_id = auth.uid()
  and public.can_read_table(table_id)
)
with check (
  user_id = auth.uid()
  and public.can_read_table(table_id)
);

create policy pinned_leads_user_only
on public.pinned_leads
for all
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.can_read_table(l.table_id)
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.can_read_table(l.table_id)
  )
);

create policy saved_filters_user_only
on public.saved_filters
for all
using (
  user_id = auth.uid()
  and public.can_read_table(table_id)
)
with check (
  user_id = auth.uid()
  and public.can_read_table(table_id)
);
