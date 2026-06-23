-- Trailweight — Supabase schema.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own data select" on public.user_data;
drop policy if exists "own data insert" on public.user_data;
drop policy if exists "own data update" on public.user_data;

create policy "own data select" on public.user_data
  for select using (auth.uid() = user_id);
create policy "own data insert" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "own data update" on public.user_data
  for update using (auth.uid() = user_id);

-- Enable realtime so edits on one device appear on others.
alter publication supabase_realtime add table public.user_data;
