-- Tennis Diary — database schema
-- Run this in the Supabase SQL editor (https://app.supabase.com -> SQL Editor -> New query).
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Shared tennis-data cache (populated by `npm run ingest` from Jeff Sackmann's
--    open data). Read by everyone; written only via the service-role key.
-- ---------------------------------------------------------------------------
create table if not exists public.tour_matches (
  id           bigint generated always as identity primary key,
  tour         text    not null,              -- 'atp' | 'wta'
  year         int     not null,
  tourney_name text    not null,
  surface      text,                          -- Hard | Clay | Grass | Carpet
  tourney_date date,
  round        text,                          -- F, SF, QF, R16, R32, R64, R128, RR
  match_num    int,
  winner_name  text    not null,
  loser_name   text    not null,
  winner_ioc   text,                          -- 3-letter country code
  loser_ioc    text,
  score        text,
  best_of      int,
  minutes      int,
  winner_rank  int,
  loser_rank   int,
  unique (tour, year, tourney_name, match_num)
);

create index if not exists tour_matches_name_idx on public.tour_matches (lower(tourney_name));
create index if not exists tour_matches_year_idx on public.tour_matches (year);

alter table public.tour_matches enable row level security;

-- Anyone (even anonymous) may read the shared catalogue.
drop policy if exists "tour_matches readable by all" on public.tour_matches;
create policy "tour_matches readable by all"
  on public.tour_matches for select
  using (true);
-- No insert/update/delete policy => only the service-role key (used by the
-- ingest script) can write, which is exactly what we want.

-- Search distinct tournament instances (one tournament in one year) by name.
-- Powers the "concert archives"-style search box.
create or replace function public.search_tournaments(q text, yr int default null)
returns table (
  tour text,
  tourney_name text,
  year int,
  surface text,
  tourney_date date,
  match_count bigint
)
language sql
stable
as $$
  select tour, tourney_name, year,
         max(surface)      as surface,
         min(tourney_date) as tourney_date,
         count(*)          as match_count
  from public.tour_matches
  where (q is null or q = '' or tourney_name ilike '%' || q || '%')
    and (yr is null or year = yr)
  group by tour, tourney_name, year
  order by tourney_date desc nulls last, tourney_name
  limit 60;
$$;

-- ---------------------------------------------------------------------------
-- 2. Per-user diary. Private: each row is visible only to its owner.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_matches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),

  source_match_id bigint,            -- references tour_matches.id (null if manual)
  tour            text,
  player1         text not null,     -- winner
  player2         text not null,     -- loser
  winner          text not null,
  tournament      text not null,
  year            int,
  surface         text,
  round           text,
  match_date      date,
  score           text,
  best_of         int,
  minutes         int,               -- duration; editable / nullable
  winner_ioc      text,
  loser_ioc       text,
  winner_rank     int,
  loser_rank      int,

  sets_total      int,
  games_total     int,
  tiebreaks_total int,
  went_distance   boolean,           -- went to a deciding set
  straight_sets   boolean,

  rating          int check (rating between 1 and 5)
);

create index if not exists saved_matches_user_idx on public.saved_matches (user_id);

-- Prevent logging the exact same match twice. A plain (non-partial) unique index so
-- it can back the ON CONFLICT (user_id, source_match_id) upsert. NULL source_match_id
-- (manual entries) are treated as distinct, so those never collide.
create unique index if not exists saved_matches_user_source_uniq
  on public.saved_matches (user_id, source_match_id);

alter table public.saved_matches enable row level security;

drop policy if exists "own rows: select" on public.saved_matches;
create policy "own rows: select" on public.saved_matches
  for select using (auth.uid() = user_id);

drop policy if exists "own rows: insert" on public.saved_matches;
create policy "own rows: insert" on public.saved_matches
  for insert with check (auth.uid() = user_id);

drop policy if exists "own rows: update" on public.saved_matches;
create policy "own rows: update" on public.saved_matches
  for update using (auth.uid() = user_id);

drop policy if exists "own rows: delete" on public.saved_matches;
create policy "own rows: delete" on public.saved_matches
  for delete using (auth.uid() = user_id);
