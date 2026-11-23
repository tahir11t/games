-- Applied to Supabase project "game" (dfpgfflaqakouxbbybfc) on 2026-11-23.

-- Cloud save: one row per player (anonymous or linked auth user)
create table public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  save_version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.player_saves enable row level security;

create policy "own save select" on public.player_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own save insert" on public.player_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own save update" on public.player_saves
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Analytics events (PRD section 9). Write-only for clients.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64),
  params jsonb not null default '{}'::jsonb check (pg_column_size(params) < 4096),
  session_id text,
  app_version text,
  locale text,
  created_at timestamptz not null default now()
);
create index analytics_events_name_created_idx on public.analytics_events (name, created_at);
create index analytics_events_user_idx on public.analytics_events (user_id);
alter table public.analytics_events enable row level security;

create policy "insert own events" on public.analytics_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
