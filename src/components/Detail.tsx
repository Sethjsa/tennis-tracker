"use client";

import { tallyDimension, matchesFor, type Dim } from "@/lib/stats";
import { sideLabel, roundLabel, effectiveDate, formatDay, winnerPlayers, loserPlayers } from "@/lib/score";
import type { SavedMatch } from "@/lib/types";
import MatchDetail from "./MatchDetail";

export type Focus =
  | { kind: "ranking"; dim: Dim; title: string }
  | { kind: "list"; dim: Dim; value: string }
  | { kind: "match"; id: string };

// Which dimensions are themselves drillable from a ranking row.
const DRILLABLE: Dim[] = ["player", "tournament", "surface", "round", "country", "series", "year", "court"];

const DIM_TITLE: Record<Dim, string> = {
  player: "Player", tournament: "Tournament", surface: "Surface", round: "Round",
  country: "Country", series: "Category", year: "Year", court: "Court",
};

export default function Detail({
  focus, matches, onDrill, onBack, onClose, canBack,
}: {
  focus: Focus;
  matches: SavedMatch[];
  onDrill: (f: Focus) => void;
  onBack: () => void;
  onClose: () => void;
  canBack: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          {canBack ? (
            <button onClick={onBack} className="text-sm text-neutral-500 hover:underline">← Back</button>
          ) : <span />}
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800">✕ Close</button>
        </div>
        {focus.kind === "ranking" && <Ranking focus={focus} matches={matches} onDrill={onDrill} />}
        {focus.kind === "list" && <ListView focus={focus} matches={matches} onDrill={onDrill} />}
        {focus.kind === "match" && <MatchView id={focus.id} matches={matches} />}
      </div>
    </div>
  );
}

function Ranking({ focus, matches, onDrill }: { focus: Extract<Focus, { kind: "ranking" }>; matches: SavedMatch[]; onDrill: (f: Focus) => void }) {
  const rows = tallyDimension(matches, focus.dim);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const drillable = DRILLABLE.includes(focus.dim);
  return (
    <div>
      <h3 className="mb-1 text-lg font-bold">{focus.title}</h3>
      <p className="mb-3 text-xs text-neutral-500">{rows.length} total · click a row to drill in</p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <button key={r.name} disabled={!drillable}
            onClick={() => drillable && onDrill({ kind: "list", dim: focus.dim, value: r.name })}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${drillable ? "hover:bg-neutral-100 dark:hover:bg-neutral-800" : ""}`}>
            <span className="w-5 shrink-0 text-right text-neutral-400">{i + 1}</span>
            <span className="w-40 shrink-0 truncate">{focus.dim === "round" ? roundLabel(r.name) : r.name}</span>
            <span className="h-3 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
              <span className="block h-full rounded bg-green-500" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-neutral-500">{r.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ListView({ focus, matches, onDrill }: { focus: Extract<Focus, { kind: "list" }>; matches: SavedMatch[]; onDrill: (f: Focus) => void }) {
  const list = matchesFor(matches, focus.dim, focus.value)
    .sort((a, b) => (effectiveDate(b.match) ?? "").localeCompare(effectiveDate(a.match) ?? ""));

  // Context-specific summary chips.
  let extra: { label: string; value: string }[] = [];
  if (focus.dim === "player") {
    const wins = list.filter((m) => winnerPlayers(m.match).includes(focus.value)).length;
    const losses = list.filter((m) => loserPlayers(m.match).includes(focus.value)).length;
    extra = [
      { label: "Watched", value: `${list.length}` },
      { label: "As winner / loser", value: `${wins} / ${losses}` },
      { label: "Tournaments", value: `${new Set(list.map((m) => m.match.tourney_name)).size}` },
    ];
  } else if (focus.dim === "tournament") {
    extra = [
      { label: "Matches", value: `${list.length}` },
      { label: "Years attended", value: [...new Set(list.map((m) => m.year))].sort().join(", ") },
    ];
  } else {
    extra = [{ label: "Matches", value: `${list.length}` }];
  }

  const title = focus.dim === "round" ? roundLabel(focus.value) : focus.value;
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-neutral-400">{DIM_TITLE[focus.dim]}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="my-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {extra.map((e) => (
          <div key={e.label}><span className="text-neutral-400">{e.label}: </span><span className="font-medium">{e.value}</span></div>
        ))}
      </div>
      <div className="space-y-1">
        {list.map((sm) => (
          <button key={sm.id} onClick={() => onDrill({ kind: "match", id: sm.id })}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left text-sm hover:border-green-500">
            <div className="min-w-0">
              <div className="truncate font-medium">{sideLabel(sm.match, "w")} <span className="text-neutral-400">def.</span> {sideLabel(sm.match, "l")}</div>
              <div className="truncate text-xs text-neutral-500">
                {sm.match.tourney_name} {sm.year} · {roundLabel(sm.round)}
                {effectiveDate(sm.match) ? ` · ${sm.match.date_exact ? "" : "~"}${formatDay(effectiveDate(sm.match))}` : ""} · {sm.match.score}
              </div>
            </div>
            <span className="shrink-0 text-neutral-300">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchView({ id, matches }: { id: string; matches: SavedMatch[] }) {
  const sm = matches.find((m) => m.id === id);
  if (!sm) return <p className="text-sm text-neutral-500">Match not found.</p>;
  return <MatchDetail sm={sm} />;
}
