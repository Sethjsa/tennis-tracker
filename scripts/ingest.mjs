#!/usr/bin/env node
// Ingest Jeff Sackmann's open ATP/WTA match data (singles + doubles) into
// Supabase `tour_matches`.   npm run ingest
//
// Configure via INGEST_TOURS / INGEST_YEARS in .env.local. Re-running is safe.
// Note on coverage: Sackmann has ATP doubles only 2000-2020 and no WTA doubles;
// missing files are skipped automatically.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function parseYears(spec) {
  const out = new Set();
  for (const part of (spec || "2021-2026").split(",")) {
    const t = part.trim();
    const m = t.match(/^(\d{4})-(\d{4})$/);
    if (m) for (let y = +m[1]; y <= +m[2]; y++) out.add(y);
    else if (/^\d{4}$/.test(t)) out.add(+t);
  }
  return [...out].sort();
}
const TOURS = (process.env.INGEST_TOURS || "atp,wta").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const YEARS = parseYears(process.env.INGEST_YEARS);

const RAW = {
  atp: "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/",
  wta: "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/",
};

function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const toInt = (v) => { if (v == null || v === "") return null; const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const toNum = (v) => { if (v == null || v === "") return null; const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; };
const toDate = (v) => (!v || v.length < 8 ? null : `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`);

// Estimate a per-match date from the tournament start date + round.
function estDate(iso, round, level) {
  if (!iso) return null;
  const slam = level === "G";
  const off = (slam
    ? { Q1: -3, Q2: -2, Q3: -1, R128: 0, R64: 1, R32: 3, R16: 5, QF: 7, SF: 9, F: 13, RR: 3, BR: 11 }
    : { Q1: -2, Q2: -1, Q3: 0, R128: 0, R64: 1, R32: 1, R16: 2, QF: 3, SF: 4, F: 5, RR: 1, BR: 4 }
  )[round] ?? 0;
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
}

// --- exact per-match dates from tennis-data.co.uk (singles only) ------------
// Names differ between sources ("Alex De Minaur" vs "De Minaur A."), so we key
// on first-initial + surname and try two surname variants (full join + last word)
// to bridge inconsistent tokenisation of compound surnames.
const normAlpha = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
function nameKeyVariants(initialChar, surnameTokens) {
  if (!surnameTokens.length) return [];
  const full = normAlpha(surnameTokens.join(""));
  const last = normAlpha(surnameTokens[surnameTokens.length - 1].split("-").pop());
  return [...new Set([initialChar + "|" + full, initialChar + "|" + last])].filter((k) => k.length > 2);
}
const sackNameKeys = (name) => {
  const t = (name || "").trim().split(/\s+/);
  if (t.length < 2) return [];
  return nameKeyVariants(normAlpha(t[0])[0] || "", t.slice(1));
};
const tdNameKeys = (name) => {
  const t = (name || "").trim().split(/\s+/);
  if (t.length < 2) return [];
  return nameKeyVariants(normAlpha(t[t.length - 1])[0] || "", t.slice(0, -1));
};
// Set-score signature, e.g. "6-4,5-7,7-6", used to disambiguate which meeting
// between a pair this is (two matches between the same players almost never share
// a score). From a Sackmann score string, or from tennis-data W1/L1.. columns.
function sackScoreSig(score) {
  const sets = [];
  for (const tok of (score || "").trim().split(/\s+/)) {
    const m = tok.match(/^(\d{1,2})-(\d{1,2})/);
    if (m) sets.push(`${+m[1]}-${+m[2]}`);
  }
  return sets.join(",");
}
function tdScoreSig(r) {
  const sets = [];
  for (let i = 1; i <= 5; i++) {
    const w = r["W" + i], l = r["L" + i];
    if (w != null && l != null && w !== "" && l !== "") sets.push(`${parseInt(w, 10)}-${parseInt(l, 10)}`);
  }
  return sets.join(",");
}

const TD = {
  atp: (y) => [`http://www.tennis-data.co.uk/${y}/${y}.xlsx`, `http://www.tennis-data.co.uk/${y}/${y}.xls`],
  wta: (y) => [`http://www.tennis-data.co.uk/${y}w/${y}.xlsx`, `http://www.tennis-data.co.uk/${y}w/${y}.xls`],
};
async function fetchDateMap(tour, year) {
  const map = new Map();
  let buf = null;
  for (const url of TD[tour](year)) {
    try {
      const res = await fetch(url);
      if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
    } catch { /* try next */ }
  }
  if (!buf) return map;
  let rows;
  try {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  } catch { return map; }
  for (const r of rows) {
    if (!r.Date || !r.Winner || !r.Loser) continue;
    const d = new Date(new Date(r.Date).getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
    const info = { date: d, series: r.Series || r.Tier || null, court: r.Court || null, sig: tdScoreSig(r) };
    // A pair can meet at several events in a year, so keep ALL candidates per key.
    for (const wk of tdNameKeys(r.Winner))
      for (const lk of tdNameKeys(r.Loser)) {
        const k = wk + "#" + lk;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(info);
      }
  }
  return map;
}
// Match a Sackmann row to a tennis-data row by player names AND set scores, so the
// same pair's meetings at different events (e.g. Olympics vs Canada Masters a week
// later) aren't confused. Falls back to a tight date window only when the score is
// unusable (walkover/empty).
function lookupTd(map, winnerName, loserName, tourneyDateISO, score) {
  const sig = sackScoreSig(score);
  const base = tourneyDateISO ? Date.parse(tourneyDateISO) : null;
  const inWindow = (info) => base == null || (() => { const diff = (Date.parse(info.date) - base) / 86400000; return diff >= -4 && diff <= 24; })();

  const candidates = [];
  for (const wk of sackNameKeys(winnerName))
    for (const lk of sackNameKeys(loserName)) {
      const arr = map.get(wk + "#" + lk);
      if (arr) candidates.push(...arr);
    }
  if (!candidates.length) return null;

  // Prefer an exact score match (definitive).
  if (sig) {
    const exact = candidates.filter((c) => c.sig === sig);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      let best = exact[0], bestDiff = Infinity;
      for (const c of exact) { const diff = base == null ? 0 : Math.abs((Date.parse(c.date) - base) / 86400000); if (diff < bestDiff) { bestDiff = diff; best = c; } }
      return best;
    }
    return null; // had a real score but no scoreline matched -> don't guess
  }
  // No usable score (walkover): accept a single in-window candidate only.
  const windowed = candidates.filter(inWindow);
  return windowed.length === 1 ? windowed[0] : null;
}

// Serve-stat columns are identical across singles/doubles; CSV uses mixed case.
const SERVE = [
  ["w_ace", "w_ace"], ["w_df", "w_df"], ["w_svpt", "w_svpt"], ["w_1stIn", "w_1stin"],
  ["w_1stWon", "w_1stwon"], ["w_2ndWon", "w_2ndwon"], ["w_SvGms", "w_svgms"],
  ["w_bpSaved", "w_bpsaved"], ["w_bpFaced", "w_bpfaced"],
  ["l_ace", "l_ace"], ["l_df", "l_df"], ["l_svpt", "l_svpt"], ["l_1stIn", "l_1stin"],
  ["l_1stWon", "l_1stwon"], ["l_2ndWon", "l_2ndwon"], ["l_SvGms", "l_svgms"],
  ["l_bpSaved", "l_bpsaved"], ["l_bpFaced", "l_bpfaced"],
];

function mapRow(get, tour, year, isDoubles, dateMap) {
  const level = get("tourney_level");
  const tdate = toDate(get("tourney_date"));
  const round = get("round") || null;
  const wName = isDoubles ? get("winner1_name") : get("winner_name");
  const lName = isDoubles ? get("loser1_name") : get("loser_name");
  const td = isDoubles || !dateMap ? null : lookupTd(dateMap, wName, lName, tdate, get("score"));
  const base = {
    tour, year, is_doubles: isDoubles,
    tourney_id: get("tourney_id") || null,
    tourney_name: get("tourney_name") || "Unknown",
    surface: get("surface") || null,
    draw_size: toInt(get("draw_size")),
    tourney_level: level || null,
    series: td?.series ?? null,
    court: td?.court ?? null,
    tourney_date: tdate,
    est_date: estDate(tdate, round, level),
    match_date: td?.date ?? null,
    date_exact: !!td?.date,
    match_num: toInt(get("match_num")),
    round,
    best_of: toInt(get("best_of")),
    minutes: toInt(get("minutes")),
    score: get("score") || null,
    winner_seed: toInt(get("winner_seed")),
    winner_entry: get("winner_entry") || null,
    loser_seed: toInt(get("loser_seed")),
    loser_entry: get("loser_entry") || null,
  };
  for (const [csv, col] of SERVE) base[col] = toInt(get(csv));

  if (isDoubles) {
    Object.assign(base, {
      winner1_name: get("winner1_name"), winner1_ioc: get("winner1_ioc") || null,
      winner1_age: toNum(get("winner1_age")), winner1_ht: toInt(get("winner1_ht")),
      winner1_hand: get("winner1_hand") || null, winner1_rank: toInt(get("winner1_rank")),
      winner1_rank_points: toInt(get("winner1_rank_points")),
      winner2_name: get("winner2_name") || null, winner2_ioc: get("winner2_ioc") || null,
      winner2_age: toNum(get("winner2_age")), winner2_ht: toInt(get("winner2_ht")),
      winner2_hand: get("winner2_hand") || null, winner2_rank: toInt(get("winner2_rank")),
      winner2_rank_points: toInt(get("winner2_rank_points")),
      loser1_name: get("loser1_name"), loser1_ioc: get("loser1_ioc") || null,
      loser1_age: toNum(get("loser1_age")), loser1_ht: toInt(get("loser1_ht")),
      loser1_hand: get("loser1_hand") || null, loser1_rank: toInt(get("loser1_rank")),
      loser1_rank_points: toInt(get("loser1_rank_points")),
      loser2_name: get("loser2_name") || null, loser2_ioc: get("loser2_ioc") || null,
      loser2_age: toNum(get("loser2_age")), loser2_ht: toInt(get("loser2_ht")),
      loser2_hand: get("loser2_hand") || null, loser2_rank: toInt(get("loser2_rank")),
      loser2_rank_points: toInt(get("loser2_rank_points")),
    });
  } else {
    Object.assign(base, {
      winner1_name: get("winner_name"), winner1_ioc: get("winner_ioc") || null,
      winner1_age: toNum(get("winner_age")), winner1_ht: toInt(get("winner_ht")),
      winner1_hand: get("winner_hand") || null, winner1_rank: toInt(get("winner_rank")),
      winner1_rank_points: toInt(get("winner_rank_points")),
      winner2_name: null, winner2_ioc: null, winner2_age: null, winner2_ht: null,
      winner2_hand: null, winner2_rank: null, winner2_rank_points: null,
      loser1_name: get("loser_name"), loser1_ioc: get("loser_ioc") || null,
      loser1_age: toNum(get("loser_age")), loser1_ht: toInt(get("loser_ht")),
      loser1_hand: get("loser_hand") || null, loser1_rank: toInt(get("loser_rank")),
      loser1_rank_points: toInt(get("loser_rank_points")),
      loser2_name: null, loser2_ioc: null, loser2_age: null, loser2_ht: null,
      loser2_hand: null, loser2_rank: null, loser2_rank_points: null,
    });
  }
  return base;
}

async function ingestFile(tour, year, isDoubles) {
  const fname = isDoubles
    ? `${tour}_matches_doubles_${year}.csv`
    : `${tour}_matches_${year}.csv`;
  const label = `  ${tour.toUpperCase()} ${isDoubles ? "doubles" : "singles"} ${year} … `;
  process.stdout.write(label);
  let res;
  try { res = await fetch(RAW[tour] + fname); } catch (e) { console.log(`fetch error (skipped)`); return 0; }
  if (!res.ok) { console.log(res.status === 404 ? "no file (skipped)" : `HTTP ${res.status}`); return 0; }

  const rows = parseCSV(await res.text());
  if (rows.length < 2) { console.log("empty"); return 0; }
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  // Exact dates from tennis-data.co.uk (singles only).
  const dateMap = isDoubles ? null : await fetchDateMap(tour, year);

  const records = [];
  let exactN = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.length) continue;
    const get = (name) => (idx[name] != null ? row[idx[name]] : undefined);
    const w1 = isDoubles ? get("winner1_name") : get("winner_name");
    const l1 = isDoubles ? get("loser1_name") : get("loser_name");
    if (!w1 || !l1) continue;
    const rec = mapRow(get, tour, year, isDoubles, dateMap);
    if (rec.date_exact) exactN++;
    records.push(rec);
  }

  // Series/court only matched on ~85% of matches; apply each tournament's most
  // common value to all its matches so a tournament has one consistent series.
  if (!isDoubles) {
    const mode = (id, field) => {
      const counts = new Map();
      for (const r of records) if (r.tourney_id === id && r[field]) counts.set(r[field], (counts.get(r[field]) ?? 0) + 1);
      let best = null, bestN = 0;
      for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
      return best;
    };
    const seriesById = new Map(), courtById = new Map();
    for (const r of records) {
      if (!seriesById.has(r.tourney_id)) seriesById.set(r.tourney_id, mode(r.tourney_id, "series"));
      if (!courtById.has(r.tourney_id)) courtById.set(r.tourney_id, mode(r.tourney_id, "court"));
    }
    for (const r of records) {
      r.series = seriesById.get(r.tourney_id) ?? r.series;
      r.court = courtById.get(r.tourney_id) ?? r.court;
    }
  }

  // De-dupe within file on the conflict key so no upsert batch hits a key twice.
  const byKey = new Map();
  for (const rec of records) byKey.set(`${rec.tourney_id}|${rec.match_num}`, rec);
  const deduped = [...byKey.values()];

  let written = 0;
  const CHUNK = 500;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("tour_matches")
      .upsert(chunk, { onConflict: "tour,year,is_doubles,tourney_id,match_num" });
    if (error) { console.log(`\n    ! ${error.message}`); break; }
    written += chunk.length;
  }
  const datePct = records.length ? Math.round((100 * exactN) / records.length) : 0;
  console.log(`${written} matches${isDoubles ? "" : ` (${datePct}% exact dates)`}`);
  return written;
}

(async () => {
  console.log(`Ingesting tours=[${TOURS}] years=[${YEARS[0]}..${YEARS.at(-1)}] (singles + doubles)`);
  let total = 0;
  for (const tour of TOURS) {
    if (!RAW[tour]) { console.log(`  unknown tour "${tour}" (skipped)`); continue; }
    for (const year of YEARS) {
      total += await ingestFile(tour, year, false);
      total += await ingestFile(tour, year, true);
    }
  }
  console.log(`Done. ${total} matches upserted.`);
  process.exit(0);
})();
