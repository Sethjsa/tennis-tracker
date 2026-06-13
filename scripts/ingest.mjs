#!/usr/bin/env node
// Ingest Jeff Sackmann's open ATP/WTA match data into Supabase `tour_matches`.
//
//   npm run ingest
//
// Configure tours/years via INGEST_TOURS / INGEST_YEARS in .env.local.
// Re-running is safe (idempotent upsert) and refreshes the latest season.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- tiny .env.local loader (no dependency) ---------------------------------
function loadEnv() {
  const file = resolve(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// --- config ------------------------------------------------------------------
function parseYears(spec) {
  const out = new Set();
  for (const part of (spec || "2021-2026").split(",")) {
    const t = part.trim();
    const m = t.match(/^(\d{4})-(\d{4})$/);
    if (m) {
      for (let y = +m[1]; y <= +m[2]; y++) out.add(y);
    } else if (/^\d{4}$/.test(t)) {
      out.add(+t);
    }
  }
  return [...out].sort();
}
const TOURS = (process.env.INGEST_TOURS || "atp,wta")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const YEARS = parseYears(process.env.INGEST_YEARS);

const REPO = {
  atp: "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_",
  wta: "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_",
};

// --- minimal CSV parser (handles quoted fields) ------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c === "\r") {
      // ignore
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const toInt = (v) => {
  if (v == null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const toDate = (v) => {
  if (!v || v.length < 8) return null;
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
};

async function ingestFile(tour, year) {
  const url = `${REPO[tour]}${year}.csv`;
  process.stdout.write(`  ${tour.toUpperCase()} ${year} … `);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(res.status === 404 ? "no file (skipped)" : `HTTP ${res.status} (skipped)`);
    return 0;
  }
  const rows = parseCSV(await res.text());
  if (rows.length < 2) { console.log("empty"); return 0; }
  const header = rows[0];
  const col = (name) => header.indexOf(name);
  const idx = {
    tourney_name: col("tourney_name"),
    surface: col("surface"),
    tourney_date: col("tourney_date"),
    match_num: col("match_num"),
    winner_name: col("winner_name"),
    loser_name: col("loser_name"),
    winner_ioc: col("winner_ioc"),
    loser_ioc: col("loser_ioc"),
    score: col("score"),
    best_of: col("best_of"),
    round: col("round"),
    minutes: col("minutes"),
    winner_rank: col("winner_rank"),
    loser_rank: col("loser_rank"),
  };

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[idx.winner_name] || !row[idx.loser_name]) continue;
    records.push({
      tour,
      year,
      tourney_name: row[idx.tourney_name] || "Unknown",
      surface: row[idx.surface] || null,
      tourney_date: toDate(row[idx.tourney_date]),
      match_num: toInt(row[idx.match_num]),
      winner_name: row[idx.winner_name],
      loser_name: row[idx.loser_name],
      winner_ioc: row[idx.winner_ioc] || null,
      loser_ioc: row[idx.loser_ioc] || null,
      score: row[idx.score] || null,
      best_of: toInt(row[idx.best_of]),
      round: row[idx.round] || null,
      minutes: toInt(row[idx.minutes]),
      winner_rank: toInt(row[idx.winner_rank]),
      loser_rank: toInt(row[idx.loser_rank]),
    });
  }

  // Two distinct events can share a name within a year, so the
  // (tour, year, tourney_name, match_num) key can collide. De-duplicate per file
  // (last wins) so a single upsert batch never targets the same key twice.
  const byKey = new Map();
  for (const rec of records) byKey.set(`${rec.tourney_name}|${rec.match_num}`, rec);
  const deduped = [...byKey.values()];
  const dropped = records.length - deduped.length;

  // Upsert in chunks on the (tour, year, tourney_name, match_num) unique key.
  let written = 0;
  const CHUNK = 500;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("tour_matches")
      .upsert(chunk, { onConflict: "tour,year,tourney_name,match_num" });
    if (error) { console.log(`\n    ! ${error.message}`); break; }
    written += chunk.length;
  }
  console.log(`${written} matches${dropped ? ` (${dropped} dup key${dropped === 1 ? "" : "s"} merged)` : ""}`);
  return written;
}

(async () => {
  console.log(`Ingesting tours=[${TOURS}] years=[${YEARS[0]}..${YEARS.at(-1)}]`);
  let total = 0;
  for (const tour of TOURS) {
    if (!REPO[tour]) { console.log(`  unknown tour "${tour}" (skipped)`); continue; }
    for (const year of YEARS) total += await ingestFile(tour, year);
  }
  console.log(`Done. ${total} matches upserted.`);
  process.exit(0);
})();
