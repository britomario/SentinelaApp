-- Go-Live / Pilot: tables used by API (location, DNS, family state, premium, pairing)
-- Run via: supabase db push (or execute in Supabase SQL editor)

create table if not exists public.child_location_state (
  child_id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  timestamp bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.child_dns_policy (
  child_id text primary key,
  provider text,
  profile_id text,
  dot_host text,
  doh_url text,
  policy_tags text[] default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.family_children (
  parent_id text not null,
  child_id text not null,
  alias text,
  status text default 'active',
  updated_at timestamptz not null default now(),
  primary key (parent_id, child_id)
);

create table if not exists public.family_premium_state (
  parent_id text primary key,
  active boolean not null default false,
  source text not null default 'revenuecat',
  entitlement_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.family_pairing_state (
  parent_id text primary key,
  latest_token_status text default 'unknown',
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_children_parent
  on public.family_children(parent_id);

create index if not exists idx_family_children_child
  on public.family_children(child_id);

alter table public.child_location_state enable row level security;
alter table public.child_dns_policy enable row level security;
alter table public.family_children enable row level security;
alter table public.family_premium_state enable row level security;
alter table public.family_pairing_state enable row level security;

create policy if not exists "child_location_state_select_family"
on public.child_location_state
for select
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_location_state.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
);

create policy if not exists "child_location_state_insert_family"
on public.child_location_state
for insert
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_location_state.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
);

create policy if not exists "child_location_state_update_family"
on public.child_location_state
for update
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_location_state.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
)
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_location_state.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
);

create policy if not exists "child_dns_policy_select_family"
on public.child_dns_policy
for select
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_dns_policy.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
);

create policy if not exists "child_dns_policy_insert_family"
on public.child_dns_policy
for insert
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_dns_policy.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
);

create policy if not exists "child_dns_policy_update_family"
on public.child_dns_policy
for update
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_dns_policy.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
)
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.family_children fc
    where fc.child_id = child_dns_policy.child_id
      and fc.status = 'active'
      and (fc.parent_id = auth.uid()::text or fc.child_id = auth.uid()::text)
  )
);

create policy if not exists "family_children_select_family"
on public.family_children
for select
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
  or child_id = auth.uid()::text
);

create policy if not exists "family_children_insert_parent"
on public.family_children
for insert
with check (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_children_update_parent"
on public.family_children
for update
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
)
with check (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_children_delete_parent"
on public.family_children
for delete
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_premium_state_select_owner"
on public.family_premium_state
for select
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_premium_state_upsert_owner"
on public.family_premium_state
for insert
with check (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_premium_state_update_owner"
on public.family_premium_state
for update
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
)
with check (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_pairing_state_select_owner"
on public.family_pairing_state
for select
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_pairing_state_upsert_owner"
on public.family_pairing_state
for insert
with check (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);

create policy if not exists "family_pairing_state_update_owner"
on public.family_pairing_state
for update
using (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
)
with check (
  auth.role() = 'service_role'
  or parent_id = auth.uid()::text
);
