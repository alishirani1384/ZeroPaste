-- ZeroPaste: ciphertext-only clip sync (E2E envelopes)
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  vault_salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  platform text not null,
  wrapped_vault_key text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.clips (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  kind text,
  byte_size integer,
  ciphertext text not null,
  nonce text not null,
  wrapped_key text not null,
  storage_path text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists clips_user_updated_idx on public.clips (user_id, updated_at desc);
create index if not exists clips_user_deleted_idx on public.clips (user_id, deleted_at);

create table if not exists public.pinboards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ciphertext text not null,
  nonce text not null,
  wrapped_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.clips enable row level security;
alter table public.pinboards enable row level security;

create policy profiles_self on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy devices_owner on public.devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy clips_owner on public.clips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy pinboards_owner on public.pinboards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('clip-blobs', 'clip-blobs', false)
on conflict (id) do nothing;
