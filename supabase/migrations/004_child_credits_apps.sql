-- Apps que a criança pode resgatar com tokens (créditos)
create table if not exists public.child_credits_apps (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  package_name text not null,
  display_name text not null,
  icon_uri text,
  daily_limit_minutes int default 60,
  created_at timestamptz not null default now(),
  unique(device_id, package_name)
);

create index if not exists idx_child_credits_apps_device
  on public.child_credits_apps(device_id);
