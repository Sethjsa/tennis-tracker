"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { computeStats, type Count } from "@/lib/stats";
import { roundLabel, sideLabel } from "@/lib/score";
import type { SavedMatch } from "@/lib/types";

export default function Dashboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("saved_matches")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setMatches((data ?? []) as SavedMatch[]);
        setLoading(false);
      });
  }, [supabase, refreshKey]);

  const stats = useMemo(() => computeStats(matches), [matches]);

  async function remove(id: string) {
    await supabase.from("saved_matches").delete().eq("id", id);
    setMatches((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (matches.length === 0)
    return (
      <p className="text-sm text-neutral-500">
        No matches logged yet. Switch to <strong>Log a match</strong> and your dashboard will fill up here.
      </p>
    );

  return (
    <div className="space-y-8">
      {/* headline numbers */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Matches" value={stats.totalMatches} sub={`${stats.singles} singles · ${stats.doubles} doubles`} />
        <Stat label="Hours watched" value={stats.totalHours} sub={stats.avgMinutes ? `avg ${stats.avgMinutes} min` : undefined} />
        <Stat label="Sets" value={stats.totalSets} sub={`${stats.totalGames} games`} />
        <Stat label="Tiebreaks" value={stats.totalTiebreaks} />
        <Stat label="Bagels 🥯" value={stats.bagels} sub="6–0 sets" />
        <Stat label="Breadsticks 🥖" value={stats.breadsticks} sub="6–1 sets" />
        <Stat label="Service breaks" value={stats.totalBreaks} sub={stats.avgBreaks != null ? `avg ${stats.avgBreaks}/match` : undefined} />
        <Stat label="Aces seen" value={stats.totalAces} sub={`${stats.totalDoubleFaults} double faults`} />
        <Stat label="Upsets" value={stats.upsets} sub="lower-ranked won" />
        <Stat label="Finals seen" value={stats.finalsSeen} />
        <Stat label="Top-10 players seen" value={stats.topTenSeen} />
        <Stat label="Walkovers / retds" value={`${stats.walkovers} / ${stats.retirements}`} />
        <Stat label="Straight sets" value={stats.straightSets} />
        <Stat label="Deciding-set epics" value={stats.deciders} />
        <Stat label="Avg rating" value={stats.avgRating ?? "—"} />
        <Stat label="Avg player age" value={stats.avgPlayerAge ?? "—"} />
      </section>

      {/* highlights */}
      <section className="grid gap-3 sm:grid-cols-3 text-sm">
        <Highlight label="Most popular tournament" value={stats.mostPopularTournament} />
        <Highlight label="Most-viewed round" value={stats.mostViewedRound ? roundLabel(stats.mostViewedRound) : null} />
        <Highlight label="Most common surface" value={stats.mostCommonSurface} />
        <Highlight label="Distinct tournaments" value={String(stats.distinctTournaments)} />
        <Highlight label="Distinct players" value={String(stats.distinctPlayers)} />
        <Highlight label="Countries seen" value={String(stats.distinctCountries)} />
        {stats.bestRankSeen && (
          <Highlight label="Highest-ranked player seen" value={`${stats.bestRankSeen.name} (#${stats.bestRankSeen.rank})`} />
        )}
        {stats.avgRankGap != null && (
          <Highlight label="Avg ranking-points gap" value={stats.avgRankGap.toLocaleString()} />
        )}
        {stats.longestMatch && (
          <Highlight label="Longest match"
            value={`${stats.longestMatch.match.minutes} min — ${sideLabel(stats.longestMatch.match, "w")} (${stats.longestMatch.tournament} ${stats.longestMatch.year})`} />
        )}
        {stats.biggestUpset && (
          <Highlight label="Biggest upset"
            value={`${sideLabel(stats.biggestUpset.match, "w")} def. ${sideLabel(stats.biggestUpset.match, "l")}`} />
        )}
      </section>

      {/* breakdowns */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Bars title="Most-watched players" data={stats.topPlayers} />
        <Bars title="By surface" data={stats.bySurface} />
        <Bars title="By round" data={stats.byRound} labeller={roundLabel} />
        <Bars title="By tournament" data={stats.byTournament.slice(0, 6)} />
        <Bars title="By country" data={stats.byCountry} />
        <Bars title="By level" data={stats.byLevel} />
      </div>

      {/* the matches */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your matches ({matches.length})
        </h3>
        <div className="space-y-2">
          {matches.map((sm) => (
            <div key={sm.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {sideLabel(sm.match, "w")} <span className="text-neutral-400">def.</span> {sideLabel(sm.match, "l")}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {sm.tournament} {sm.year} · {roundLabel(sm.round)} · {sm.match.score}
                  {sm.match.is_doubles ? " · doubles" : ""}
                  {sm.rating ? ` · ${"★".repeat(sm.rating)}` : ""}
                </div>
              </div>
              <button onClick={() => remove(sm.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

function Highlight({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Bars({ title, data, labeller }: { title: string; data: Count[]; labeller?: (s: string) => string }) {
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
              <span className="w-28 shrink-0 truncate" title={d.name}>{labeller ? labeller(d.name) : d.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                <div className="h-full rounded bg-green-500" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
