create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;

  return value::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger lead_tables_set_updated_at
before update on public.lead_tables
for each row execute function public.set_updated_at();

create trigger table_permissions_set_updated_at
before update on public.table_permissions
for each row execute function public.set_updated_at();

create trigger table_services_set_updated_at
before update on public.table_services
for each row execute function public.set_updated_at();

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger saved_filters_set_updated_at
before update on public.saved_filters
for each row execute function public.set_updated_at();

create or replace function public.normalize_lead_fields()
returns trigger
language plpgsql
as $$
begin
  if new.business_name is not null then
    new.business_name = btrim(new.business_name);
  end if;

  if new.contact is not null then
    new.contact = nullif(btrim(new.contact), '');
  end if;

  if new.website_url is not null then
    new.website_url = nullif(btrim(new.website_url), '');
  end if;

  if new.notes is not null then
    new.notes = nullif(btrim(new.notes), '');
  end if;

  if new.source_detail is not null then
    new.source_detail = nullif(btrim(new.source_detail), '');
  end if;

  if new.dnc_reason is not null then
    new.dnc_reason = nullif(btrim(new.dnc_reason), '');
  end if;

  if new.lost_reason is not null then
    new.lost_reason = nullif(btrim(new.lost_reason), '');
  end if;

  if new.website_url is null then
    new.domain = null;
  else
    new.domain = lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(new.website_url, '^https?://', '', 'i'),
          '^www\\.',
          '',
          'i'
        ),
        '/.*$',
        ''
      )
    );
  end if;

  if new.stage = 'Contacted' and (new.next_followup_at is null or new.contact is null) then
    raise exception 'Contacted stage requires next_followup_at and contact';
  end if;

  return new;
end;
$$;

create trigger leads_normalize_fields
before insert or update on public.leads
for each row execute function public.normalize_lead_fields();

create or replace function public.touch_stage_changed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.stage_changed_at = coalesce(new.stage_changed_at, now());
    return new;
  end if;

  if new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  end if;

  return new;
end;
$$;

create trigger leads_stage_changed_at
before insert or update on public.leads
for each row execute function public.touch_stage_changed_at();

create or replace function public.enforce_lead_service_same_table()
returns trigger
language plpgsql
as $$
declare
  lead_table uuid;
  service_table uuid;
begin
  select table_id into lead_table from public.leads where id = new.lead_id;
  select table_id into service_table from public.table_services where id = new.service_id;

  if lead_table is null or service_table is null then
    raise exception 'Invalid lead_id or service_id';
  end if;

  if lead_table <> service_table then
    raise exception 'Service must belong to the same table as the lead';
  end if;

  return new;
end;
$$;

create trigger lead_services_same_table
before insert or update on public.lead_services
for each row execute function public.enforce_lead_service_same_table();

create or replace function public.audit_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.audit_events (
      org_id,
      table_id,
      lead_id,
      actor_user_id,
      event_type,
      meta
    ) values (
      new.org_id,
      new.table_id,
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'stage_changed',
      jsonb_build_object('old_stage', old.stage, 'new_stage', new.stage)
    );
  end if;

  if new.owner_id is distinct from old.owner_id then
    insert into public.audit_events (
      org_id,
      table_id,
      lead_id,
      actor_user_id,
      event_type,
      meta
    ) values (
      new.org_id,
      new.table_id,
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'owner_changed',
      jsonb_build_object('old_owner_id', old.owner_id, 'new_owner_id', new.owner_id)
    );
  end if;

  if new.next_followup_at is distinct from old.next_followup_at
     or new.followup_window is distinct from old.followup_window then
    insert into public.audit_events (
      org_id,
      table_id,
      lead_id,
      actor_user_id,
      event_type,
      meta
    ) values (
      new.org_id,
      new.table_id,
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'followup_changed',
      jsonb_build_object(
        'old_next_followup_at', old.next_followup_at,
        'new_next_followup_at', new.next_followup_at,
        'old_followup_window', old.followup_window,
        'new_followup_window', new.followup_window
      )
    );
  end if;

  if new.do_not_contact is distinct from old.do_not_contact
     or new.dnc_reason is distinct from old.dnc_reason then
    insert into public.audit_events (
      org_id,
      table_id,
      lead_id,
      actor_user_id,
      event_type,
      meta
    ) values (
      new.org_id,
      new.table_id,
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'dnc_changed',
      jsonb_build_object(
        'old_do_not_contact', old.do_not_contact,
        'new_do_not_contact', new.do_not_contact,
        'old_dnc_reason', old.dnc_reason,
        'new_dnc_reason', new.dnc_reason
      )
    );
  end if;

  if new.is_archived is distinct from old.is_archived then
    insert into public.audit_events (
      org_id,
      table_id,
      lead_id,
      actor_user_id,
      event_type,
      meta
    ) values (
      new.org_id,
      new.table_id,
      new.id,
      coalesce(new.updated_by, auth.uid()),
      'archived',
      jsonb_build_object(
        'old_is_archived', old.is_archived,
        'new_is_archived', new.is_archived
      )
    );
  end if;

  return new;
end;
$$;

create trigger leads_audit_changes
after update on public.leads
for each row execute function public.audit_lead_changes();

create or replace function public.audit_lead_services_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row record;
  selected_lead_id uuid;
  selected_service_id uuid;
  action_name text;
begin
  selected_lead_id := case when tg_op = 'DELETE' then old.lead_id else new.lead_id end;
  selected_service_id := case when tg_op = 'DELETE' then old.service_id else new.service_id end;
  action_name := case when tg_op = 'DELETE' then 'removed' else 'added' end;

  select id, org_id, table_id into lead_row
  from public.leads
  where id = selected_lead_id;

  if lead_row.id is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_events (
    org_id,
    table_id,
    lead_id,
    actor_user_id,
    event_type,
    meta
  ) values (
    lead_row.org_id,
    lead_row.table_id,
    lead_row.id,
    auth.uid(),
    'services_changed',
    jsonb_build_object(
      'action', action_name,
      'service_id', selected_service_id
    )
  );

  return coalesce(new, old);
end;
$$;

create trigger lead_services_audit_changes
after insert or delete on public.lead_services
for each row execute function public.audit_lead_services_changes();
