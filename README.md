# 🎾 Tennis Diary

A "Letterboxd for tennis" — log the professional matches you've watched and get rich
viewing stats. Search a tournament, pick the rounds you attended, check the matches you
saw, rate them, and build a private archive.

- **Frontend:** Next.js (App Router) + Tailwind, desktop-first and responsive — deploys free on Vercel.
- **Auth + database:** Supabase (free tier) with row-level security, so each user's diary is private.
- **Tennis data:** [Jeff Sackmann's open ATP/WTA datasets](https://github.com/JeffSackmann/tennis_atp) —
  free, openly licensed, no API key or rate limits. Ingested once into your own database and reused for every lookup.

## What the data gives you (and what it doesn't)

Sackmann's data includes players, tournament, year, **surface**, round, full scores,
best-of, **match duration (minutes)**, player countries, and **player rankings at match time**.
That powers every stat below, including "top-10 players seen" and "countries witnessed".

Two honest limitations:

- It's organized by **tournament → round**, not by calendar day/court — so you pick the
  **rounds** you attended rather than a session. Surface and duration are pre-filled from the
  data but stay editable per match.
- The **current season lags** by a few weeks (it's updated after events finish). Fine for a
  diary of matches you've already watched.

---

## Setup

### 1. Create a Supabase project (free)

1. Go to <https://app.supabase.com> → **New project**.
2. Open **SQL Editor** → **New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**.
   This creates the tables, the per-user privacy policies, and the tournament-search function.
3. In **Project Settings → API**, copy your **Project URL**, **anon public** key, and **service_role** key.

> Auth note: by default Supabase requires email confirmation. For solo use you can turn it off
> under **Authentication → Providers → Email → "Confirm email" = off**, so you can sign in immediately.

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with the three keys from step 1. `INGEST_YEARS` controls how much history
to load (e.g. `2021-2026`).

### 3. Install + load the tennis data

```bash
npm install        # already done if you're reading this in the repo
npm run ingest     # downloads Sackmann ATP/WTA CSVs into your Supabase tour_matches table
```

Re-run `npm run ingest` anytime to refresh the latest season.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and start logging.

---

## Deploy free on Vercel

1. Push this folder to a GitHub repo.
2. <https://vercel.com> → **New Project** → import the repo.
3. Add the same three Supabase env vars in **Settings → Environment Variables**
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy. (Run `npm run ingest` locally — it writes to the same shared Supabase database.)

---

## Automatic data refresh

The source datasets are updated as tournaments finish, so a scheduled
[GitHub Action](.github/workflows/refresh-data.yml) re-runs the ingest:

- **Weekly** (Mondays 06:00 UTC) it refreshes the **current + previous season** (the
  only years that change), upserting into the same Supabase database.
- **On demand**: Actions tab → *Refresh tennis data* → *Run workflow*. Pass a `years`
  value like `2010-2026` to force a full rebuild.

It needs two repo secrets (Settings → Secrets and variables → Actions):
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Project layout

```
src/
  app/
    page.tsx            Home — the log-a-match flow
    stats/page.tsx      Your stats dashboard
    login/page.tsx      Email/password auth
    auth/signout/       Sign-out route
  components/
    Diary.tsx           Search → rounds → pick & rate → save
    StatsView.tsx       Aggregated stats + your match list
  lib/
    score.ts            Derives sets/games/tiebreaks/straight-vs-deciding from a score string
    stats.ts            Aggregates a diary into stats
    supabaseServer.ts   Auth-aware server client
    supabaseBrowser.ts  Browser client
  middleware.ts         Session refresh + login gate
supabase/schema.sql     Tables, RLS policies, search function
scripts/ingest.mjs      Loads Sackmann's open data into Supabase
```

## Stats computed

Matches, hours, sets, games, tiebreaks; straight-set wins vs. deciding-set epics; most-watched
players; breakdowns by surface, round, and tournament; average duration & rating; finals seen;
top-10 players seen; distinct tournaments and countries; longest match.
