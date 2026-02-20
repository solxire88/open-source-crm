create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'sales',
  theme_preference public.theme_preference not null default 'system',
  is_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_tables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_archived boolean not null default false,
  default_stage public.lead_stage not null default 'New',
  default_source_type public.source_type,
  default_source_detail text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_tables_name_unique_per_org unique (org_id, name)
);

create table public.table_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_level public.access_level not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint table_permissions_unique unique (table_id, user_id)
);

create table public.table_services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  name citext not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  business_name text not null,
  stage public.lead_stage not null default 'New',
  owner_id uuid references auth.users(id) on delete set null,
  next_followup_at date,
  followup_window public.followup_window not null default 'Anytime',
  contact text,
  website_url text,
  domain text,
  notes text,
  source_type public.source_type not null default 'Unknown',
  source_detail text,
  last_touched_at timestamptz,
  do_not_contact boolean not null default false,
  dnc_reason text,
  lost_reason text,
  is_archived boolean not null default false,
  stage_changed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contacted_requires_followup
    check (
      stage <> 'Contacted'
      or (
        next_followup_at is not null
        and contact is not null
        and btrim(contact) <> ''
      )
    )
);

create table public.lead_services (
  lead_id uuid not null references public.leads(id) on delete cascade,
  service_id uuid not null references public.table_services(id) on delete cascade,
  primary key (lead_id, service_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  filename text not null,
  source_default_type public.source_type,
  source_default_detail text,
  row_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.favorite_tables (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, table_id)
);

create table public.pinned_leads (
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lead_id)
);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid not null references public.lead_tables(id) on delete cascade,
  name text not null,
  filter_json jsonb not null default '{}'::jsonb,
  sort_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Required and recommended indexes
create unique index table_services_name_unique_ci
  on public.table_services (table_id, lower(name::text));

create index leads_table_stage_idx on public.leads (table_id, stage);
create index leads_table_owner_idx on public.leads (table_id, owner_id);
create index leads_table_next_followup_idx on public.leads (table_id, next_followup_at);
create index leads_table_dnc_idx on public.leads (table_id, do_not_contact);
create index leads_table_archived_idx on public.leads (table_id, is_archived);
create index leads_domain_idx on public.leads (domain);
create index audit_events_lead_created_idx on public.audit_events (lead_id, created_at desc);
create index table_permissions_table_user_idx on public.table_permissions (table_id, user_id);
create index lead_tables_org_archived_idx on public.lead_tables (org_id, is_archived);
create index leads_table_created_idx on public.leads (table_id, created_at desc);
create index leads_search_business_name_idx on public.leads (business_name);
create index leads_search_contact_idx on public.leads (contact);
