alter table public.parent_profiles enable row level security;
alter table public.child_profiles enable row level security;
alter table public.family_links enable row level security;
alter table public.device_pairings enable row level security;
alter table public.subscriptions enable row level security;

create policy if not exists "parent_profiles_select_own"
on public.parent_profiles
for select
using (auth.uid() = auth_user_id);

create policy if not exists "parent_profiles_insert_own"
on public.parent_profiles
for insert
with check (auth.uid() = auth_user_id);

create policy if not exists "family_links_select_for_parent"
on public.family_links
for select
using (
  exists (
    select 1 from public.parent_profiles p
    where p.id = family_links.parent_id
      and p.auth_user_id = auth.uid()
  )
);

create policy if not exists "child_profiles_select_via_link"
on public.child_profiles
for select
using (
  exists (
    select 1
    from public.family_links fl
    join public.parent_profiles p on p.id = fl.parent_id
    where fl.child_id = child_profiles.id
      and p.auth_user_id = auth.uid()
  )
);

create policy if not exists "device_pairings_select_via_link"
on public.device_pairings
for select
using (
  exists (
    select 1
    from public.family_links fl
    join public.parent_profiles p on p.id = fl.parent_id
    where fl.id = device_pairings.family_link_id
      and p.auth_user_id = auth.uid()
  )
);

create policy if not exists "subscriptions_select_own_parent"
on public.subscriptions
for select
using (
  exists (
    select 1 from public.parent_profiles p
    where p.id = subscriptions.parent_id
      and p.auth_user_id = auth.uid()
  )
);
