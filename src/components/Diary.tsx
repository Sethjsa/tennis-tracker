"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { roundLabel, roundRank, sideLabel, deriveFacts } from "@/lib/score";
import type { TourMatch, TournamentInstance } from "@/lib/types";

const SURFACES = ["Hard", "Clay", "Grass", "Carpet"];

function surfaceClass(s: string | null) {
  switch (s) {
    case "Hard": return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "Clay": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "Grass": return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    default: return "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  }
}

interface Selection { rating: number; surface: string | null; minutes: number | null }
type TypeFilter = "all" | "singles" | "doubles";

export default function Diary({ onSaved }: { onSaved?: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [userId, setUserId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [instances, setInstances] = useState<TournamentInstance[]>([]);
  const [searching, setSearching] = useState(false);

  const [active, setActive] = useState<TournamentInstance | null>(null);
  const [matches, setMatches] = useState<TourMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedRounds, setSelectedRounds] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<Map<number, Selection>>(new Map());
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const search = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setSearching(true);
      setActive(null);
      const yr = year.trim() ? parseInt(year.trim(), 10) : null;
      const { data, error } = await supabase.rpc("search_tournaments", {
        q: query.trim(),
        yr: Number.isFinite(yr as number) ? yr : null,
      });
      setSearching(false);
      if (error) return setToast(error.message);
      setInstances((data ?? []) as TournamentInstance[]);
    },
    [supabase, query, year],
  );

  const openInstance = useCallback(
    async (inst: TournamentInstance) => {
      setActive(inst);
      setMatches([]);
      setPicks(new Map());
      setTypeFilter("all");
      setLoadingMatches(true);

      const [{ data: rows }, { data: saved }] = await Promise.all([
        supabase.from("tour_matches").select("*").eq("tour", inst.tour)
          .eq("tourney_name", inst.tourney_name).eq("year", inst.year),
        supabase.from("saved_matches").select("source_match_id")
          .eq("tournament", inst.tourney_name).eq("year", inst.year),
      ]);

      const list = ((rows ?? []) as TourMatch[]).sort(
        (a, b) =>
          Number(a.is_doubles) - Number(b.is_doubles) ||
          roundRank(a.round) - roundRank(b.round) ||
          (a.match_num ?? 0) - (b.match_num ?? 0),
      );
      setMatches(list);
      setSelectedRounds(new Set(list.map((m) => m.round ?? "?")));
      setSavedIds(new Set((saved ?? []).map((s: any) => s.source_match_id).filter(Boolean)));
      setLoadingMatches(false);
    },
    [supabase],
  );

  const rounds = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (typeFilter === "singles" && m.is_doubles) return;
      if (typeFilter === "doubles" && !m.is_doubles) return;
      set.add(m.round ?? "?");
    });
    return [...set].sort((a, b) => roundRank(a) - roundRank(b));
  }, [matches, typeFilter]);

  const visibleMatches = useMemo(
    () =>
      matches.filter((m) => {
        if (typeFilter === "singles" && m.is_doubles) return false;
        if (typeFilter === "doubles" && !m.is_doubles) return false;
        return selectedRounds.has(m.round ?? "?");
      }),
    [matches, selectedRounds, typeFilter],
  );

  function toggleRound(r: string) {
    setSelectedRounds((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  }
  function togglePick(m: TourMatch) {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.has(m.id)) next.delete(m.id);
      else next.set(m.id, { rating: 0, surface: m.surface, minutes: m.minutes });
      return next;
    });
  }
  function updatePick(id: number, patch: Partial<Selection>) {
    setPicks((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, ...patch });
      return next;
    });
  }

  async function save() {
    if (!userId || !active || picks.size === 0) return;
    setSaving(true);
    const rows = [...picks.entries()].map(([id, sel]) => {
      const base = matches.find((x) => x.id === id)!;
      // Apply per-match edits into the stored snapshot.
      const m: TourMatch = { ...base, surface: sel.surface, minutes: sel.minutes };
      return {
        user_id: userId,
        source_match_id: m.id,
        tour: m.tour,
        is_doubles: m.is_doubles,
        tournament: m.tourney_name,
        year: m.year,
        surface: m.surface,
        round: m.round,
        rating: sel.rating || null,
        match: m,
      };
    });
    const { error } = await supabase
      .from("saved_matches")
      .upsert(rows, { onConflict: "user_id,source_match_id" });
    setSaving(false);
    if (error) return setToast(error.message);
    const savedNow = new Set(savedIds);
    picks.forEach((_, id) => savedNow.add(id));
    setSavedIds(savedNow);
    setPicks(new Map());
    setToast(`Saved ${rows.length} match${rows.length === 1 ? "" : "es"} to your diary.`);
    onSaved?.();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a tournament — e.g. Rotterdam, Wimbledon, Roland Garros"
          className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 outline-none focus:border-green-500"
        />
        <input
          value={year}
          onChange={(e) => setYear(e.target.value)}
          inputMode="numeric"
          placeholder="Year"
          className="w-full sm:w-24 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 outline-none focus:border-green-500"
        />
        <button type="submit" disabled={searching}
          className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-5 py-2 font-medium text-white">
          {searching ? "…" : "Search"}
        </button>
      </form>

      {!active && (
        <div className="space-y-2">
          {instances.length === 0 && !searching && (
            <p className="text-sm text-neutral-500">
              Search for a tournament to begin. Leave the year blank to see every edition.
            </p>
          )}
          {instances.map((inst) => (
            <button key={`${inst.tour}-${inst.tourney_name}-${inst.year}`}
              onClick={() => openInstance(inst)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-left hover:border-green-500">
              <div>
                <div className="font-medium">
                  {inst.tourney_name} <span className="text-neutral-400">{inst.year}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span className="uppercase">{inst.tour}</span>
                  {inst.surface && <span className={`rounded px-1.5 py-0.5 ${surfaceClass(inst.surface)}`}>{inst.surface}</span>}
                  <span>{inst.match_count} matches</span>
                  {inst.has_doubles && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">incl. doubles</span>}
                </div>
              </div>
              <span className="text-neutral-300">→</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-4">
          <button onClick={() => setActive(null)} className="text-sm text-neutral-500 hover:underline">
            ← Back to results
          </button>
          <div>
            <h2 className="text-lg font-semibold">
              {active.tourney_name} <span className="text-neutral-400">{active.year}</span>
            </h2>
            <p className="text-sm text-neutral-500">
              Pick the rounds you attended, then check the matches you watched.
            </p>
          </div>

          {loadingMatches ? (
            <p className="text-sm text-neutral-500">Loading matches…</p>
          ) : (
            <>
              {matches.some((m) => m.is_doubles) && (
                <div className="flex gap-1 text-sm">
                  {(["all", "singles", "doubles"] as TypeFilter[]).map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`rounded-lg px-3 py-1 capitalize ${typeFilter === t ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {rounds.map((r) => (
                  <button key={r} onClick={() => toggleRound(r)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      selectedRounds.has(r)
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "border-neutral-300 dark:border-neutral-700 text-neutral-500"
                    }`}>
                    {roundLabel(r)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {visibleMatches.map((m) => {
                  const already = savedIds.has(m.id);
                  const pick = picks.get(m.id);
                  const f = deriveFacts(m);
                  return (
                    <div key={m.id}
                      className={`rounded-xl border px-4 py-3 ${
                        pick ? "border-green-500 bg-green-50/50 dark:bg-green-950/30"
                             : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                      }`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" className="mt-1 h-5 w-5 accent-green-600"
                          checked={!!pick} disabled={already} onChange={() => togglePick(m)} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-400">
                            {roundLabel(m.round)}
                            {m.is_doubles && <span className="rounded bg-purple-100 px-1 text-purple-700 dark:bg-purple-950 dark:text-purple-300">doubles</span>}
                            {m.est_date && <span className="normal-case text-neutral-400">· ~{m.est_date}</span>}
                          </div>
                          <div className="font-medium">
                            {sideLabel(m, "w")} <span className="text-neutral-400">def.</span> {sideLabel(m, "l")}
                          </div>
                          <div className="mt-0.5 text-sm text-neutral-500">
                            {m.score || "—"}
                            {m.minutes ? ` · ${m.minutes} min` : ""}
                            {f.upset ? " · upset" : ""}
                          </div>
                          {already && <div className="mt-1 text-xs font-medium text-green-600">✓ Already in your diary</div>}

                          {pick && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <Stars value={pick.rating} onChange={(v) => updatePick(m.id, { rating: v })} />
                              <select value={pick.surface ?? ""} onChange={(e) => updatePick(m.id, { surface: e.target.value || null })}
                                className="rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm">
                                <option value="">Surface?</option>
                                {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <input type="number" min={0} placeholder="min" value={pick.minutes ?? ""}
                                onChange={(e) => updatePick(m.id, { minutes: e.target.value ? parseInt(e.target.value, 10) : null })}
                                className="w-20 rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {picks.size > 0 && (
            <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-green-500 bg-white dark:bg-neutral-900 px-4 py-3 shadow-lg">
              <span className="text-sm font-medium">{picks.size} match{picks.size === 1 ? "" : "es"} selected</span>
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-5 py-2 font-medium text-white">
                {saving ? "Saving…" : "Save to diary"}
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div onClick={() => setToast(null)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 cursor-pointer rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n === value ? 0 : n)}
          className={`text-xl leading-none ${n <= value ? "text-amber-400" : "text-neutral-300 dark:text-neutral-600"}`}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}>★</button>
      ))}
    </div>
  );
}
