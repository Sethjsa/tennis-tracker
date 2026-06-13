"use client";

import { deriveFacts, sideLabel, effectiveDate, formatDay, roundLabel } from "@/lib/score";
import { seriesLabel } from "@/lib/stats";
import type { SavedMatch, TourMatch } from "@/lib/types";

function pct(n: number | null, d: number | null) {
  if (!n || !d) return "—";
  return Math.round((100 * n) / d) + "%";
}

export default function MatchDetail({ sm }: { sm: SavedMatch }) {
  const m = sm.match;
  const f = deriveFacts(m);
  const date = effectiveDate(m);

  const meta: [string, string | null][] = [
    ["Tournament", `${m.tourney_name} ${m.year}`],
    ["Round", roundLabel(m.round)],
    ["Date", date ? `${m.date_exact ? "" : "~"}${formatDay(date)}` : null],
    ["Surface", m.surface],
    ["Category", seriesLabel(m)],
    ["Court", m.court],
    ["Tour", m.tour?.toUpperCase() ?? null],
    ["Format", m.best_of ? `Best of ${m.best_of}` : null],
    ["Draw size", m.draw_size ? String(m.draw_size) : null],
    ["Duration", m.minutes ? `${m.minutes} min` : null],
    ["Score", m.score],
    ["Your rating", sm.rating ? "★".repeat(sm.rating) : null],
  ];

  const facts: [string, string][] = [
    ["Sets", String(f.setsTotal)],
    ["Games", String(f.gamesTotal)],
    ["Tiebreaks", String(f.tiebreaksTotal)],
    ["Bagels (6–0)", String(f.bagels)],
    ["Breadsticks (6–1)", String(f.breadsticks)],
    ["Service breaks", f.breaksTotal != null ? String(f.breaksTotal) : "—"],
    ["Aces", f.acesTotal != null ? String(f.acesTotal) : "—"],
    ["Double faults", f.dfTotal != null ? String(f.dfTotal) : "—"],
    ["Outcome", f.straightSets ? "Straight sets" : f.wentDistance ? "Went the distance" : "—"],
    ["Upset", f.upset ? "Yes" : "No"],
  ];

  const hasServe = m.w_svpt != null || m.l_svpt != null;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-400">{roundLabel(m.round)}{m.is_doubles ? " · doubles" : ""}</div>
        <h3 className="text-xl font-bold">
          {sideLabel(m, "w")} <span className="text-neutral-400">def.</span> {sideLabel(m, "l")}
        </h3>
        <div className="text-neutral-500">{m.score}</div>
      </div>

      {/* player cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerCard m={m} side="w" />
        <PlayerCard m={m} side="l" />
      </div>

      {/* meta grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        {meta.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">{k}</div>
            <div className="font-medium">{v}</div>
          </div>
        ))}
      </div>

      {/* derived facts */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Match facts</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 py-0.5">
              <span className="text-neutral-500">{k}</span><span className="font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* serve stats */}
      {hasServe && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Serve stats</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-neutral-400">
                <th className="text-left font-normal">Winner</th>
                <th className="text-center font-normal"></th>
                <th className="text-right font-normal">Loser</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <ServeRow label="Aces" w={m.w_ace} l={m.l_ace} />
              <ServeRow label="Double faults" w={m.w_df} l={m.l_df} />
              <ServeRow label="1st serve in" w={pct(m.w_1stin, m.w_svpt)} l={pct(m.l_1stin, m.l_svpt)} raw />
              <ServeRow label="1st serve won" w={pct(m.w_1stwon, m.w_1stin)} l={pct(m.l_1stwon, m.l_1stin)} raw />
              <ServeRow label="Service games" w={m.w_svgms} l={m.l_svgms} />
              <ServeRow label="Break pts saved" w={m.w_bpfaced != null ? `${m.w_bpsaved}/${m.w_bpfaced}` : null} l={m.l_bpfaced != null ? `${m.l_bpsaved}/${m.l_bpfaced}` : null} raw />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ m, side }: { m: TourMatch; side: "w" | "l" }) {
  const w = side === "w";
  const names = w ? [m.winner1_name, m.winner2_name] : [m.loser1_name, m.loser2_name];
  const iocs = w ? [m.winner1_ioc, m.winner2_ioc] : [m.loser1_ioc, m.loser2_ioc];
  const ages = w ? [m.winner1_age, m.winner2_age] : [m.loser1_age, m.loser2_age];
  const ranks = w ? [m.winner1_rank, m.winner2_rank] : [m.loser1_rank, m.loser2_rank];
  const pts = w ? [m.winner1_rank_points, m.winner2_rank_points] : [m.loser1_rank_points, m.loser2_rank_points];
  const seed = w ? m.winner_seed : m.loser_seed;
  const entry = w ? m.winner_entry : m.loser_entry;
  return (
    <div className={`rounded-xl border p-3 ${w ? "border-green-500/60 bg-green-50/40 dark:bg-green-950/20" : "border-neutral-200 dark:border-neutral-800"}`}>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-400">{w ? "Winner" : "Loser"}{seed ? ` · seed ${seed}` : ""}{entry ? ` · ${entry}` : ""}</div>
      {names.filter(Boolean).map((n, i) => (
        <div key={i} className="text-sm">
          <span className="font-medium">{n}</span>
          <span className="text-neutral-500">
            {iocs[i] ? ` · ${iocs[i]}` : ""}
            {ranks[i] != null ? ` · #${ranks[i]}` : ""}
            {pts[i] != null ? ` (${pts[i]!.toLocaleString()} pts)` : ""}
            {ages[i] != null ? ` · ${ages[i]}y` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function ServeRow({ label, w, l, raw }: { label: string; w: any; l: any; raw?: boolean }) {
  const fmt = (v: any) => (v == null ? "—" : raw ? v : String(v));
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      <td className="py-1 text-left font-medium">{fmt(w)}</td>
      <td className="py-1 text-center text-neutral-400">{label}</td>
      <td className="py-1 text-right font-medium">{fmt(l)}</td>
    </tr>
  );
}
