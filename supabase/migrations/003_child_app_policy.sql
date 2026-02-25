-- Tabela para sincronizar política de apps entre dispositivos
create table if not exists public.child_app_policy (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  package_name text not null,
  allowed boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(device_id, package_name)
);

create index if not exists idx_child_app_policy_device
  on public.child_app_policy(device_id);
