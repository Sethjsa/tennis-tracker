"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import {
  computeStats, tallyDimension, matchesPerYear, tournamentsPerYear,
  type Count, type Dim,
} from "@/lib/stats";
import { roundLabel, sideLabel, effectiveDate, formatDay } from "@/lib/score";
import type { SavedMatch } from "@/lib/types";
import Detail, { type Focus } from "./Detail";
import ManualAddForm from "./ManualAddForm";

export default function Dashboard({ refreshKey = 0 }: { refreshKey?: number }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [all, setAll] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [localKey, setLocalKey] = useState(0);

  const [fYear, setFYear] = useState("");
  const [fTour, setFTour] = useState<"all" | "atp" | "wta">("all");
  const [fType, setFType] = useState<"all" | "singles" | "doubles">("all");
  const [stack, setStack] = useState<Focus[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    supabase.from("saved_matches").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setAll((data ?? []) as SavedMatch[]); setLoading(false); });
  }, [supabase]);
  useEffect(() => { load(); }, [load, refreshKey, localKey]);

  const matches = useMemo(
    () => all.filter((m) =>
      (fYear === "" || String(m.year) === fYear) &&
      (fTour === "all" || m.tour === fTour) &&
      (fType === "all" || (fType === "doubles" ? m.is_doubles : !m.is_doubles))),
    [all, fYear, fTour, fType],
  );

  const stats = useMemo(() => computeStats(matches), [matches]);
  const years = useMemo(() => [...new Set(all.map((m) => m.year).filter(Boolean))].sort((a, b) => (b as number) - (a as number)), [all]);

  const push = (f: Focus) => setStack((s) => [...s, f]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const openRanking = (dim: Dim, title: string) => push({ kind: "ranking", dim, title });

  async function remove(id: string) {
    await supabase.from("saved_matches").delete().eq("id", id);
    setAll((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (all.length === 0)
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">No matches logged yet. Use <strong>Log a match</strong>, or add one manually.</p>
        <button onClick={() => setShowManual(true)} className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm">+ Add manually</button>
        {showManual && <ManualAddForm onSaved={() => setLocalKey((k) => k + 1)} onClose={() => setShowManual(false)} />}
      </div>
    );

  const visibleMatches = showAllMatches ? matches : matches.slice(0, 12);

  return (
    <div className="space-y-7">
      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={fYear} onChange={setFYear} options={[["", "All years"], ...years.map((y) => [String(y), String(y)] as [string, string])]} />
        <Select value={fTour} onChange={(v) => setFTour(v as any)} options={[["all", "ATP + WTA"], ["atp", "ATP"], ["wta", "WTA"]]} />
        <Select value={fType} onChange={(v) => setFType(v as any)} options={[["all", "Singles + doubles"], ["singles", "Singles"], ["doubles", "Doubles"]]} />
        <span className="text-neutral-400">{matches.length} matches</span>
        <button onClick={() => setShowManual(true)} className="ml-auto rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800">+ Add manually</button>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-neutral-500">No matches match these filters.</p>
      ) : (
        <>
          {/* headline numbers */}
          <Section title="Overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Matches" value={stats.totalMatches} sub={`${stats.singles} singles · ${stats.doubles} doubles`} onClick={() => openRanking("year", "Matches by year")} />
              <Stat label="Days attended" value={stats.distinctDays} />
              <Stat label="Hours watched" value={stats.totalHours} sub={stats.avgMinutes ? `avg ${stats.avgMinutes} min` : undefined} />
              <Stat label="Players seen" value={stats.distinctPlayers} onClick={() => openRanking("player", "Players seen")} />
              <Stat label="Tournaments" value={stats.distinctTournaments} onClick={() => openRanking("tournament", "Tournaments")} />
              <Stat label="Countries" value={stats.distinctCountries} onClick={() => openRanking("country", "Countries seen")} />
              <Stat label="Finals seen" value={stats.finalsSeen} onClick={() => push({ kind: "list", dim: "round", value: "F" })} />
              <Stat label="Top-10 players seen" value={stats.topTenSeen} />
            </div>
          </Section>

          {/* charts */}
          <Section title="Over time">
            <div className="grid gap-4 sm:grid-cols-2">
              <BarChart title="Matches per year" data={matchesPerYear(matches)} />
              <BarChart title="Tournaments per year" data={tournamentsPerYear(matches)} />
            </div>
          </Section>

          {/* match-shape stats */}
          <Section title="The tennis">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Sets" value={stats.totalSets} sub={`${stats.totalGames} games`} />
              <Stat label="Tiebreaks" value={stats.totalTiebreaks} />
              <Stat label="Bagels 🥯" value={stats.bagels} sub="6–0 sets" />
              <Stat label="Breadsticks 🥖" value={stats.breadsticks} sub="6–1 sets" />
              <Stat label="Service breaks" value={stats.totalBreaks} sub={stats.avgBreaks != null ? `avg ${stats.avgBreaks}/match` : undefined} />
              <Stat label="Aces seen" value={stats.totalAces} sub={`${stats.totalDoubleFaults} double faults`} />
              <Stat label="Upsets" value={stats.upsets} sub="lower-ranked won" />
              <Stat label="Walkovers / retds" value={`${stats.walkovers} / ${stats.retirements}`} />
              <Stat label="Straight sets" value={stats.straightSets} />
              <Stat label="Deciding-set epics" value={stats.deciders} />
              <Stat label="Avg rating" value={stats.avgRating ?? "—"} />
              <Stat label="Avg player age" value={stats.avgPlayerAge ?? "—"} />
            </div>
          </Section>

          {/* breakdowns */}
          <Section title="Breakdowns">
            <div className="grid gap-4 sm:grid-cols-2">
              <DimPanel title="Most-watched players" dim="player" matches={matches} onRanking={openRanking} onDrill={push} />
              <DimPanel title="Tournaments" dim="tournament" matches={matches} onRanking={openRanking} onDrill={push} />
              <DimPanel title="By surface" dim="surface" matches={matches} onRanking={openRanking} onDrill={push} />
              <DimPanel title="By round" dim="round" matches={matches} onRanking={openRanking} onDrill={push} labeller={roundLabel} />
              <DimPanel title="By category" dim="series" matches={matches} onRanking={openRanking} onDrill={push} />
              <DimPanel title="By country" dim="country" matches={matches} onRanking={openRanking} onDrill={push} />
            </div>
          </Section>

          {/* highlights */}
          <Section title="Highlights">
            <div className="grid gap-3 sm:grid-cols-2">
              <Highlight label="Most popular tournament" value={stats.mostPopularTournament} onClick={stats.mostPopularTournament ? () => push({ kind: "list", dim: "tournament", value: stats.mostPopularTournament! }) : undefined} />
              <Highlight label="Most-viewed round" value={stats.mostViewedRound ? roundLabel(stats.mostViewedRound) : null} onClick={() => openRanking("round", "Matches by round")} />
              <Highlight label="Most common category" value={stats.mostCommonSeries} onClick={() => openRanking("series", "Matches by category")} />
              <Highlight label="Most common surface" value={stats.mostCommonSurface} onClick={() => openRanking("surface", "Matches by surface")} />
              <Highlight label="Highest-ranked seen (ATP/WTA rank)" value={stats.bestRankSeen ? `${stats.bestRankSeen.name} (#${stats.bestRankSeen.rank})` : null} onClick={stats.bestRankSeen ? () => push({ kind: "list", dim: "player", value: stats.bestRankSeen!.name }) : undefined} />
              <Highlight label="Highest-ranked seen (by points)" value={stats.bestPointsSeen ? `${stats.bestPointsSeen.name} (${stats.bestPointsSeen.points.toLocaleString()} pts)` : null} onClick={stats.bestPointsSeen ? () => push({ kind: "list", dim: "player", value: stats.bestPointsSeen!.name }) : undefined} />
              {stats.avgRankGap != null && <Highlight label="Avg ranking-points gap" value={stats.avgRankGap.toLocaleString()} />}
              {stats.longestMatch && <Highlight label="Longest match" value={`${stats.longestMatch.match.minutes} min — ${sideLabel(stats.longestMatch.match, "w")}`} onClick={() => push({ kind: "match", id: stats.longestMatch!.id })} />}
              {stats.biggestUpset && <Highlight label="Biggest upset" value={`${sideLabel(stats.biggestUpset.match, "w")} def. ${sideLabel(stats.biggestUpset.match, "l")}`} onClick={() => push({ kind: "match", id: stats.biggestUpset!.id })} />}
            </div>
          </Section>

          {/* matches */}
          <Section title={`Your matches (${matches.length})`}>
            <div className="space-y-2">
              {visibleMatches.map((sm) => (
                <div key={sm.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5">
                  <button onClick={() => push({ kind: "match", id: sm.id })} className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{sideLabel(sm.match, "w")} <span className="text-neutral-400">def.</span> {sideLabel(sm.match, "l")}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {sm.tournament} {sm.year} · {roundLabel(sm.round)}
                      {effectiveDate(sm.match) ? ` · ${sm.match.date_exact ? "" : "~"}${formatDay(effectiveDate(sm.match))}` : ""} · {sm.match.score}
                      {sm.match.is_doubles ? " · doubles" : ""}{sm.rating ? ` · ${"★".repeat(sm.rating)}` : ""}
                    </div>
                  </button>
                  <button onClick={() => remove(sm.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950">Remove</button>
                </div>
              ))}
            </div>
            {matches.length > 12 && (
              <button onClick={() => setShowAllMatches((v) => !v)} className="mt-3 text-sm text-green-600 hover:underline">
                {showAllMatches ? "Show fewer" : `Show all ${matches.length}`}
              </button>
            )}
          </Section>
        </>
      )}

      {stack.length > 0 && (
        <Detail focus={stack[stack.length - 1]} matches={matches} onDrill={push} onBack={pop} onClose={() => setStack([])} canBack={stack.length > 1} />
      )}
      {showManual && <ManualAddForm onSaved={() => setLocalKey((k) => k + 1)} onClose={() => setShowManual(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Stat({ label, value, sub, onClick }: { label: string; value: number | string; sub?: string; onClick?: () => void }) {
  return (
    <button disabled={!onClick} onClick={onClick}
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-left ${onClick ? "hover:border-green-500" : ""}`}>
      <div className="text-2xl font-bold tabular-nums">{value}{onClick && <span className="ml-1 text-xs text-neutral-300">›</span>}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-400">{sub}</div>}
    </button>
  );
}

function Highlight({ label, value, onClick }: { label: string; value: string | null; onClick?: () => void }) {
  if (!value) return null;
  return (
    <button disabled={!onClick} onClick={onClick}
      className={`rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-left ${onClick ? "hover:border-green-500" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-0.5 font-medium">{value}{onClick && <span className="ml-1 text-neutral-300">›</span>}</div>
    </button>
  );
}

function DimPanel({ title, dim, matches, onRanking, onDrill, labeller }: {
  title: string; dim: Dim; matches: SavedMatch[];
  onRanking: (dim: Dim, title: string) => void; onDrill: (f: Focus) => void; labeller?: (s: string) => string;
}) {
  const data = tallyDimension(matches, dim);
  const top = data.slice(0, 6);
  const max = Math.max(1, ...top.map((d) => d.count));
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => onRanking(dim, title)} className="text-sm font-semibold hover:text-green-600">{title} ›</button>
        <span className="text-xs text-neutral-400">{data.length}</span>
      </div>
      {top.length === 0 ? <p className="text-xs text-neutral-400">No data</p> : (
        <div className="space-y-1.5">
          {top.map((d) => (
            <button key={d.name} onClick={() => onDrill({ kind: "list", dim, value: d.name })}
              className="flex w-full items-center gap-2 text-sm hover:opacity-80">
              <span className="w-28 shrink-0 truncate text-left" title={d.name}>{labeller ? labeller(d.name) : d.name}</span>
              <span className="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                <span className="block h-full rounded bg-green-500" style={{ width: `${(d.count / max) * 100}%` }} />
              </span>
              <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">{d.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BarChart({ title, data }: { title: string; data: Count[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      {data.length === 0 ? <p className="text-xs text-neutral-400">No data</p> : (
        <div className="flex h-40 items-end gap-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex flex-1 flex-col items-center gap-1" title={`${d.name}: ${d.count}`}>
              <span className="text-[10px] tabular-nums text-neutral-400">{d.count}</span>
              <div className="w-full rounded-t bg-green-500" style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }} />
              <span className="text-[10px] text-neutral-400">{d.name.slice(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
