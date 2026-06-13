"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { computeStats, type PlayerCount } from "@/lib/stats";
import { roundLabel } from "@/lib/score";
import type { SavedMatch } from "@/lib/types";

export default function StatsView() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("saved_matches")
      .select("*")
      .order("match_date", { ascending: false })
      .then(({ data }) => {
        setMatches((data ?? []) as SavedMatch[]);
        setLoading(false);
      });
  }, [supabase]);

  const stats = useMemo(() => computeStats(matches), [matches]);

  async function remove(id: string) {
    await supabase.from("saved_matches").delete().eq("id", id);
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (matches.length === 0)
    return (
      <p className="text-sm text-neutral-500">
        No matches logged yet. Go log some and your stats will appear here.
      </p>
    );

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Matches" value={stats.totalMatches} />
        <Stat label="Hours watched" value={stats.totalHours} />
        <Stat label="Sets" value={stats.totalSets} />
        <Stat label="Games" value={stats.totalGames} />
        <Stat label="Tiebreaks" value={stats.totalTiebreaks} />
        <Stat label="Finals seen" value={stats.finalsSeen} />
        <Stat label="Top-10 players seen" value={stats.topTenSeen} />
        <Stat label="Tournaments" value={stats.distinctTournaments} />
        <Stat label="Countries" value={stats.distinctCountries} />
        <Stat label="Straight-set wins" value={stats.straightSets} />
        <Stat label="Deciding-set epics" value={stats.deciders} />
        <Stat label="Avg rating" value={stats.avgRating ?? "—"} />
      </section>

      {stats.avgMinutes != null && (
        <p className="text-sm text-neutral-500">
          Average match: <strong>{stats.avgMinutes} min</strong>
          {stats.longestMatch && (
            <>
              {" · "}Longest:{" "}
              <strong>
                {stats.longestMatch.minutes} min
              </strong>{" "}
              ({stats.longestMatch.player1} def. {stats.longestMatch.player2},{" "}
              {stats.longestMatch.tournament} {stats.longestMatch.year})
            </>
          )}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Bars title="Most-watched players" data={stats.topPlayers} />
        <Bars title="By surface" data={stats.bySurface} />
        <Bars title="By round" data={stats.byRound} labeller={roundLabel} />
        <Bars title="By tournament" data={stats.byTournament.slice(0, 6)} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your matches ({matches.length})
        </h3>
        <div className="space-y-2">
          {matches.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {m.player1} <span className="text-neutral-400">def.</span> {m.player2}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {m.tournament} {m.year} · {roundLabel(m.round)} · {m.score}
                  {m.rating ? ` · ${"★".repeat(m.rating)}` : ""}
                </div>
              </div>
              <button
                onClick={() => remove(m.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function Bars({
  title,
  data,
  labeller,
}: {
  title: string;
  data: PlayerCount[];
  labeller?: (s: string) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-neutral-400">No data</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate" title={d.name}>
                {labeller ? labeller(d.name) : d.name}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded bg-green-500"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">
                {d.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
