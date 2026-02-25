create extension if not exists "pgcrypto";

create table if not exists public.parent_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  birth_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(parent_id, child_id)
);

create table if not exists public.device_pairings (
  id uuid primary key default gen_random_uuid(),
  family_link_id uuid not null references public.family_links(id) on delete cascade,
  pair_token text not null unique,
  child_device_id text,
  parent_public_key text,
  paired_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  provider text not null default 'revenuecat',
  product_id text,
  entitlement_id text,
  status text not null default 'inactive',
  trial_ends_at timestamptz,
  renews_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
