create table if not exists public.login_security_pins (
  user_id text primary key,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.login_security_pins enable row level security;

create policy if not exists "login_security_pins_select_owner"
on public.login_security_pins
for select
using (auth.uid()::text = user_id);

create policy if not exists "login_security_pins_insert_owner"
on public.login_security_pins
for insert
with check (auth.uid()::text = user_id);

create policy if not exists "login_security_pins_update_owner"
on public.login_security_pins
for update
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);

create policy if not exists "login_security_pins_delete_owner"
on public.login_security_pins
for delete
using (auth.uid()::text = user_id);
