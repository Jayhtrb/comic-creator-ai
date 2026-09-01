-- Comic Crafter AI — named character reference sets
-- Run this in the Supabase SQL editor to enable saving named casts.

create table if not exists public.character_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  character_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.character_sets to authenticated;
grant all on public.character_sets to service_role;

alter table public.character_sets enable row level security;

drop policy if exists "Owners manage their character sets" on public.character_sets;
create policy "Owners manage their character sets"
on public.character_sets
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists character_sets_user_id_idx on public.character_sets (user_id);
