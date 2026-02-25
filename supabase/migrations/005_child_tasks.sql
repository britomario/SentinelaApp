-- Tarefas criadas pelos pais com recompensa em moedas
create table if not exists public.child_tasks (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  title text not null,
  reward_coins int not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_child_tasks_device
  on public.child_tasks(device_id);
