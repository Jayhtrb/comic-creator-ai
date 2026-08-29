-- ComicForge AI — initial schema
-- Run this in your own Supabase project: SQL Editor -> New query -> paste -> Run.
-- Safe to run once. Every table gets GRANTs + RLS + owner-scoped policies.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- series
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.series to authenticated;
grant all on public.series to service_role;
alter table public.series enable row level security;

create policy "series_own" on public.series
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- characters
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid references public.series(id) on delete set null,
  name text not null,
  description text,
  -- storage paths in the private `character-refs` bucket (1-3 refs per character)
  reference_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.characters to authenticated;
grant all on public.characters to service_role;
alter table public.characters enable row level security;

create policy "characters_own" on public.characters
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists characters_user_idx on public.characters (user_id, created_at desc);

-- link table: which characters appear in a series
create table if not exists public.series_characters (
  series_id uuid not null references public.series(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  primary key (series_id, character_id)
);

grant select, insert, delete on public.series_characters to authenticated;
grant all on public.series_characters to service_role;
alter table public.series_characters enable row level security;

create policy "series_characters_own" on public.series_characters
  for all to authenticated
  using (exists (select 1 from public.series s where s.id = series_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.series s where s.id = series_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------------- comics
create table if not exists public.comics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid references public.series(id) on delete set null,
  title text,
  story_prompt text not null,
  style_choice text not null,
  num_pages integer not null default 1 check (num_pages between 1 and 8),
  layout_preset text,
  status text not null default 'generating' check (status in ('generating','complete','failed')),
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.comics to authenticated;
grant select on public.comics to anon;          -- only public rows, per policy below
grant all on public.comics to service_role;
alter table public.comics enable row level security;

create policy "comics_own" on public.comics
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comics_public_read" on public.comics
  for select to anon using (is_public = true);

create index if not exists comics_user_idx on public.comics (user_id, created_at desc);

-- ---------------------------------------------------------------- panels
-- One row per generated panel (one image per panel, bubbles kept as JSON).
create table if not exists public.panels (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references public.comics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null,
  panel_index integer not null,
  camera text,
  image_prompt text,
  image_path text,                 -- path in the private `comic-panels` bucket
  bubbles jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','drawing','ready','failed')),
  created_at timestamptz not null default now(),
  unique (comic_id, page_number, panel_index)
);

grant select, insert, update, delete on public.panels to authenticated;
grant select on public.panels to anon;
grant all on public.panels to service_role;
alter table public.panels enable row level security;

create policy "panels_own" on public.panels
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "panels_public_read" on public.panels
  for select to anon
  using (exists (select 1 from public.comics c where c.id = comic_id and c.is_public));

create index if not exists panels_comic_idx on public.panels (comic_id, page_number, panel_index);

-- ---------------------------------------------------------------- prompt history
create table if not exists public.prompt_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  style text,
  comic_id uuid references public.comics(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.prompt_history to authenticated;
grant all on public.prompt_history to service_role;
alter table public.prompt_history enable row level security;

create policy "prompt_history_own" on public.prompt_history
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- roles (future moderation)
do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_read_own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------- storage buckets
insert into storage.buckets (id, name, public)
values ('character-refs', 'character-refs', false), ('comic-panels', 'comic-panels', false)
on conflict (id) do nothing;

-- Objects are stored under `<user_id>/...` so ownership is the first path segment.
create policy "refs_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'character-refs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "refs_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'character-refs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "refs_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'character-refs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "panels_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'comic-panels' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "panels_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'comic-panels' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "panels_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'comic-panels' and (storage.foldername(name))[1] = auth.uid()::text);
