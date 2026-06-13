-- Tennis Diary — database schema (v2: singles + doubles, full stat columns)
-- Run this in the Supabase SQL editor. It DROPS and recreates the tables, so the
-- shared tennis-data cache is rebuilt by `npm run ingest` and any test diary
-- entries are cleared. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Shared tennis-data cache (Jeff Sackmann's open ATP/WTA data).
--    Read by everyone; written only via the service-role key (ingest script).
--    Player slots: 1 = always present; 2 = doubles partner (null for singles).
-- ---------------------------------------------------------------------------
drop table if exists public.tour_matches cascade;
create table public.tour_matches (
  id            bigint generated always as identity primary key,
  tour          text not null,                 -- 'atp' | 'wta'
  year          int  not null,
  is_doubles    boolean not null default false,
  tourney_id    text,
  tourney_name  text not null,
  surface       text,
  draw_size     int,
  tourney_level text,                           -- G(rand slam) M(asters) A(tp500/250) F(inals) D(avis) etc.
  tourney_date  date,
  est_date      date,                           -- estimated per-match date (round-derived)
  match_num     int,
  round         text,
  best_of       int,
  minutes       int,
  score         text,

  -- winning side
  winner1_name text not null, winner1_ioc text, winner1_age numeric, winner1_ht int,
  winner1_hand text, winner1_rank int, winner1_rank_points int,
  winner2_name text, winner2_ioc text, winner2_age numeric, winner2_ht int,
  winner2_hand text, winner2_rank int, winner2_rank_points int,
  winner_seed int, winner_entry text,

  -- losing side
  loser1_name text not null, loser1_ioc text, loser1_age numeric, loser1_ht int,
  loser1_hand text, loser1_rank int, loser1_rank_points int,
  loser2_name text, loser2_ioc text, loser2_age numeric, loser2_ht int,
  loser2_hand text, loser2_rank int, loser2_rank_points int,
  loser_seed int, loser_entry text,

  -- serve stats (per side)
  w_ace int, w_df int, w_svpt int, w_1stin int, w_1stwon int, w_2ndwon int,
  w_svgms int, w_bpsaved int, w_bpfaced int,
  l_ace int, l_df int, l_svpt int, l_1stin int, l_1stwon int, l_2ndwon int,
  l_svgms int, l_bpsaved int, l_bpfaced int,

  unique (tour, year, is_doubles, tourney_id, match_num)
);

create index tour_matches_name_idx on public.tour_matches (lower(tourney_name));
create index tour_matches_year_idx on public.tour_matches (year);

alter table public.tour_matches enable row level security;
create policy "tour_matches readable by all"
  on public.tour_matches for select using (true);
-- No write policy => only the service-role key (ingest) can write.

-- Search distinct tournament instances (tournament + year) by name.
create or replace function public.search_tournaments(q text, yr int default null)
returns table (
  tour text, tourney_name text, year int, surface text,
  tourney_date date, match_count bigint,
  has_singles boolean, has_doubles boolean
)
language sql stable as $$
  select tour, tourney_name, year,
         max(surface)      as surface,
         min(tourney_date) as tourney_date,
         count(*)          as match_count,
         bool_or(not is_doubles) as has_singles,
         bool_or(is_doubles)     as has_doubles
  from public.tour_matches
  where (q is null or q = '' or tourney_name ilike '%' || q || '%')
    and (yr is null or year = yr)
  group by tour, tourney_name, year
  order by tourney_date desc nulls last, tourney_name
  limit 60;
$$;

-- ---------------------------------------------------------------------------
-- 2. Per-user diary. Private (RLS). The full match snapshot + derived stats
--    are stored as JSONB so every available stat is preserved per entry.
-- ---------------------------------------------------------------------------
drop table if exists public.saved_matches cascade;
create table public.saved_matches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  source_match_id bigint,
  tour            text,
  is_doubles      boolean default false,
  tournament      text not null,
  year            int,
  surface         text,
  round           text,
  rating          int check (rating between 1 and 5),
  match           jsonb not null      -- full TourMatch + computed breakdown
);

create index saved_matches_user_idx on public.saved_matches (user_id);
create unique index saved_matches_user_source_uniq
  on public.saved_matches (user_id, source_match_id);

alter table public.saved_matches enable row level security;
create policy "own rows: select" on public.saved_matches
  for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.saved_matches
  for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.saved_matches
  for update using (auth.uid() = user_id);
create policy "own rows: delete" on public.saved_matches
  for delete using (auth.uid() = user_id);
