-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('lead_attachments', 'lead_attachments', false),
  ('org_assets', 'org_assets', false)
on conflict (id) do update
set public = excluded.public;

-- NOTE:
-- storage.objects is a Supabase-managed table. RLS is already enabled in hosted projects,
-- and migration roles are not the table owner, so ALTER TABLE can fail with 42501.
-- Do not run "alter table storage.objects enable row level security" here.

drop policy if exists lead_attachments_read on storage.objects;

create policy lead_attachments_read
on storage.objects
for select
using (
  bucket_id = 'lead_attachments'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.can_read_table(public.try_uuid(split_part(name, '/', 2)))
);

drop policy if exists lead_attachments_insert on storage.objects;

create policy lead_attachments_insert
on storage.objects
for insert
with check (
  bucket_id = 'lead_attachments'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.can_edit_table(public.try_uuid(split_part(name, '/', 2)))
);

drop policy if exists lead_attachments_update on storage.objects;

create policy lead_attachments_update
on storage.objects
for update
using (
  bucket_id = 'lead_attachments'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.can_edit_table(public.try_uuid(split_part(name, '/', 2)))
)
with check (
  bucket_id = 'lead_attachments'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.can_edit_table(public.try_uuid(split_part(name, '/', 2)))
);

drop policy if exists lead_attachments_delete on storage.objects;

create policy lead_attachments_delete
on storage.objects
for delete
using (
  bucket_id = 'lead_attachments'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.can_edit_table(public.try_uuid(split_part(name, '/', 2)))
);

drop policy if exists org_assets_read on storage.objects;

create policy org_assets_read
on storage.objects
for select
using (
  bucket_id = 'org_assets'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
);

drop policy if exists org_assets_insert_admin on storage.objects;

create policy org_assets_insert_admin
on storage.objects
for insert
with check (
  bucket_id = 'org_assets'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.is_admin()
);

drop policy if exists org_assets_update_admin on storage.objects;

create policy org_assets_update_admin
on storage.objects
for update
using (
  bucket_id = 'org_assets'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.is_admin()
)
with check (
  bucket_id = 'org_assets'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.is_admin()
);

drop policy if exists org_assets_delete_admin on storage.objects;

create policy org_assets_delete_admin
on storage.objects
for delete
using (
  bucket_id = 'org_assets'
  and public.try_uuid(split_part(name, '/', 1)) = public.current_org_id()
  and public.is_admin()
);

-- Analytics RPC
create or replace function public.analytics_snapshot(
  p_range text default '30d',
  p_table_ids uuid[] default null,
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from timestamptz;
  v_result jsonb;
begin
  if p_range = '7d' then
    v_from := now() - interval '7 day';
  elsif p_range = '30d' then
    v_from := now() - interval '30 day';
  elsif p_range = '90d' then
    v_from := now() - interval '90 day';
  else
    v_from := null;
  end if;

  with allowed_tables as (
    select lt.id
    from public.lead_tables lt
    where lt.org_id = public.current_org_id()
      and public.can_read_table(lt.id)
      and (p_table_ids is null or lt.id = any(p_table_ids))
  ),
  scoped_current as (
    select l.*
    from public.leads l
    join allowed_tables at on at.id = l.table_id
    where (p_owner_id is null or l.owner_id = p_owner_id)
  ),
  scoped_range as (
    select l.*
    from scoped_current l
    where v_from is null or l.created_at >= v_from
  )
  select jsonb_build_object(
    'leaderboard',
    jsonb_build_object(
      'wins_by_owner',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'owner_id', owner_id,
              'wins', wins
            ) order by wins desc
          ),
          '[]'::jsonb
        )
        from (
          select owner_id, count(*)::int as wins
          from scoped_range
          where stage = 'Won'
          group by owner_id
        ) s
      ),
      'win_rate',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'owner_id', owner_id,
              'won', won,
              'closed', closed,
              'win_rate',
              case when closed = 0 then 0 else round((won::numeric / closed::numeric) * 100, 2) end
            ) order by
              case when closed = 0 then 0 else round((won::numeric / closed::numeric) * 100, 2) end desc
          ),
          '[]'::jsonb
        )
        from (
          select
            owner_id,
            count(*) filter (where stage = 'Won')::int as won,
            count(*) filter (where stage in ('Won', 'Lost'))::int as closed
          from scoped_range
          group by owner_id
        ) s
      ),
      'overdue_followups_by_owner',
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'owner_id', owner_id,
              'overdue', overdue
            ) order by overdue desc
          ),
          '[]'::jsonb
        )
        from (
          select owner_id, count(*)::int as overdue
          from scoped_current
          where next_followup_at is not null
            and next_followup_at < current_date
            and stage not in ('Won', 'Lost')
            and do_not_contact = false
            and is_archived = false
          group by owner_id
        ) s
      )
    ),
    'pipeline_counts_by_stage_per_owner',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'owner_id', owner_id,
            'stage', stage,
            'count', count
          ) order by owner_id, stage
        ),
        '[]'::jsonb
      )
      from (
        select owner_id, stage, count(*)::int as count
        from scoped_current
        where is_archived = false
        group by owner_id, stage
      ) s
    ),
    'source_performance',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'source_type', source_type,
            'source_detail', source_detail,
            'total', total,
            'won', won,
            'lost', lost,
            'win_rate',
            case when closed = 0 then 0 else round((won::numeric / closed::numeric) * 100, 2) end,
            'funnel', funnel
          ) order by total desc
        ),
        '[]'::jsonb
      )
      from (
        select
          source_type,
          source_detail,
          count(*)::int as total,
          count(*) filter (where stage = 'Won')::int as won,
          count(*) filter (where stage = 'Lost')::int as lost,
          count(*) filter (where stage in ('Won', 'Lost'))::int as closed,
          jsonb_object_agg(stage, stage_count) as funnel
        from (
          select
            source_type,
            source_detail,
            stage,
            count(*)::int as stage_count
          from scoped_range
          group by source_type, source_detail, stage
        ) stage_counts
        group by source_type, source_detail
      ) source_summary
    ),
    'services_performance',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'service_id', service_id,
            'service_name', service_name,
            'total', total,
            'won', won,
            'lost', lost,
            'win_rate',
            case when closed = 0 then 0 else round((won::numeric / closed::numeric) * 100, 2) end
          ) order by total desc
        ),
        '[]'::jsonb
      )
      from (
        select
          ts.id as service_id,
          ts.name::text as service_name,
          count(*)::int as total,
          count(*) filter (where l.stage = 'Won')::int as won,
          count(*) filter (where l.stage = 'Lost')::int as lost,
          count(*) filter (where l.stage in ('Won', 'Lost'))::int as closed
        from scoped_range l
        join public.lead_services ls on ls.lead_id = l.id
        join public.table_services ts on ts.id = ls.service_id
        group by ts.id, ts.name
      ) service_summary
    ),
    'health_widgets',
    jsonb_build_object(
      'contacted_missing_followup',
      (
        select count(*)::int
        from scoped_current
        where stage = 'Contacted'
          and (next_followup_at is null or contact is null or btrim(contact) = '')
      ),
      'overdue_count',
      (
        select count(*)::int
        from scoped_current
        where next_followup_at is not null
          and next_followup_at < current_date
          and stage not in ('Won', 'Lost')
          and do_not_contact = false
          and is_archived = false
      ),
      'missing_source_count',
      (
        select count(*)::int
        from scoped_current
        where source_type = 'Unknown'
          or source_detail is null
      ),
      'dnc_count',
      (
        select count(*)::int
        from scoped_current
        where do_not_contact = true
      )
    )
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

grant execute on function public.analytics_snapshot(text, uuid[], uuid) to authenticated;
