-- v1.1 global leaderboard: one best score per player per board.
-- Scores are capped per board so a tampered client can't post absurd values.
create table public.leaderboard (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board text not null check (board in ('survival', 'tower', 'stars')),
  score int not null check (
    score >= 0 and score <= case board when 'survival' then 1000 when 'tower' then 40 else 210 end
  ),
  name text not null check (char_length(name) between 1 and 20),
  country text check (country ~ '^[A-Z]{2}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, board)
);
create index leaderboard_board_score_idx on public.leaderboard (board, score desc, updated_at);
alter table public.leaderboard enable row level security;

-- Everyone can read the ranking; players write only their own rows.
create policy "leaderboard readable" on public.leaderboard
  for select to anon, authenticated using (true);
create policy "own score insert" on public.leaderboard
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own score update" on public.leaderboard
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A best score never goes down, even if an old client posts a lower one.
create function public.leaderboard_keep_best() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.score < old.score then new.score := old.score; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger leaderboard_keep_best before update on public.leaderboard
  for each row execute function public.leaderboard_keep_best();
