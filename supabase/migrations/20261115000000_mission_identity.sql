-- Seven Servers identities. Apply in the Supabase SQL editor when the project exists.

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  mission_specialist_id text unique not null,
  role text not null check (role in ('demo', 'specialist', 'operator', 'admin')),
  permissions text[] not null default '{}' check (permissions <@ array['judge']::text[]),
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id),
  owner_id uuid not null references public.profiles(id),
  record_hash text not null check (record_hash ~ '^[0-9a-f]{64}$'),
  parameters jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.analysis_runs enable row level security;

create policy profiles_read on public.profiles
  for select using (auth.uid() = id or public.current_role() in ('operator', 'admin'));

create policy profiles_admin_update on public.profiles
  for update using (public.current_role() = 'admin');

create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy missions_specialist on public.missions
  for all using (owner_id = auth.uid() and public.current_role() = 'specialist')
  with check (owner_id = auth.uid() and public.current_role() = 'specialist');

create policy runs_read on public.analysis_runs
  for select using (
    owner_id = auth.uid()
    or public.current_role() in ('operator', 'admin')
    or (public.current_role() = 'demo' and parameters->>'published' = 'true')
  );

create policy runs_specialist_write on public.analysis_runs
  for insert with check (owner_id = auth.uid() and public.current_role() = 'specialist');

-- Registration inserts a specialist with empty permissions. Metadata cannot choose a role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  if display_name is null then
    display_name := 'Visitor';
  end if;
  display_name := left(display_name, 80);
  insert into public.profiles (id, full_name, mission_specialist_id, role, permissions)
  values (
    new.id,
    display_name,
    'SS-MS-' || upper(substr(replace(new.id::text, '-', ''), 1, 16)),
    'specialist',
    '{}'::text[]
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Visitors cannot grant themselves judge, operator, or admin.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if public.current_role() = 'admin' then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.permissions is distinct from old.permissions
    or new.mission_specialist_id is distinct from old.mission_specialist_id
    or new.id is distinct from old.id then
    raise exception 'role and permissions are assigned by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;
