"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { TourMatch, Tour } from "@/lib/types";

const ROUNDS = ["F", "SF", "QF", "R16", "R32", "R64", "R128", "RR", "Q1", "Q2", "Q3"];
const SURFACES = ["Hard", "Clay", "Grass", "Carpet"];

interface PInfo { name: string; ioc: string | null; rank: number | null; points: number | null }
const emptyP = (): PInfo => ({ name: "", ioc: null, rank: null, points: null });

export default function ManualAddForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [tour, setTour] = useState<Tour | "">("atp");
  const [isDoubles, setIsDoubles] = useState(false);
  const [tournament, setTournament] = useState("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [round, setRound] = useState("F");
  const [surface, setSurface] = useState("Hard");
  const [date, setDate] = useState("");
  const [score, setScore] = useState("");
  const [minutes, setMinutes] = useState("");
  const [bestOf, setBestOf] = useState("3");
  const [rating, setRating] = useState(0);
  const [w1, setW1] = useState<PInfo>(emptyP());
  const [w2, setW2] = useState<PInfo>(emptyP());
  const [l1, setL1] = useState<PInfo>(emptyP());
  const [l2, setL2] = useState<PInfo>(emptyP());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Optional: pull country + most-recent rank for a typed player from the cache.
  async function lookup(p: PInfo, set: (p: PInfo) => void) {
    if (!p.name.trim()) return;
    const q = `%${p.name.trim()}%`;
    const { data } = await supabase
      .from("tour_matches")
      .select("winner1_name,winner1_ioc,winner1_rank,winner1_rank_points,loser1_name,loser1_ioc,loser1_rank,loser1_rank_points")
      .or(`winner1_name.ilike.${q},loser1_name.ilike.${q}`)
      .order("year", { ascending: false })
      .limit(1);
    const row: any = data?.[0];
    if (!row) { setMsg(`No DB match for "${p.name}"`); return; }
    const onWin = (row.winner1_name as string)?.toLowerCase().includes(p.name.trim().toLowerCase());
    set({
      name: onWin ? row.winner1_name : row.loser1_name,
      ioc: onWin ? row.winner1_ioc : row.loser1_ioc,
      rank: onWin ? row.winner1_rank : row.loser1_rank,
      points: onWin ? row.winner1_rank_points : row.loser1_rank_points,
    });
  }

  async function save() {
    setMsg(null);
    if (!tournament.trim() || !w1.name.trim() || !l1.name.trim()) { setMsg("Tournament and at least one player per side are required."); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); setMsg("Not signed in."); return; }
    const yr = year.trim() ? parseInt(year, 10) : null;

    const match: TourMatch = {
      id: -Date.now(), tour: (tour || "atp") as Tour, year: yr ?? 0, is_doubles: isDoubles,
      tourney_id: `manual-${Date.now()}`, tourney_name: tournament.trim(), surface: surface || null,
      draw_size: null, tourney_level: null, series: null, court: null,
      tourney_date: date || null, est_date: date || null, match_date: date || null, date_exact: !!date,
      match_num: null, round, best_of: bestOf ? parseInt(bestOf, 10) : null,
      minutes: minutes ? parseInt(minutes, 10) : null, score: score || null,
      winner1_name: w1.name.trim(), winner1_ioc: w1.ioc, winner1_age: null, winner1_ht: null, winner1_hand: null,
      winner1_rank: w1.rank, winner1_rank_points: w1.points,
      winner2_name: isDoubles && w2.name.trim() ? w2.name.trim() : null, winner2_ioc: w2.ioc, winner2_age: null,
      winner2_ht: null, winner2_hand: null, winner2_rank: w2.rank, winner2_rank_points: w2.points,
      winner_seed: null, winner_entry: null,
      loser1_name: l1.name.trim(), loser1_ioc: l1.ioc, loser1_age: null, loser1_ht: null, loser1_hand: null,
      loser1_rank: l1.rank, loser1_rank_points: l1.points,
      loser2_name: isDoubles && l2.name.trim() ? l2.name.trim() : null, loser2_ioc: l2.ioc, loser2_age: null,
      loser2_ht: null, loser2_hand: null, loser2_rank: l2.rank, loser2_rank_points: l2.points,
      loser_seed: null, loser_entry: null,
      w_ace: null, w_df: null, w_svpt: null, w_1stin: null, w_1stwon: null, w_2ndwon: null,
      w_svgms: null, w_bpsaved: null, w_bpfaced: null,
      l_ace: null, l_df: null, l_svpt: null, l_1stin: null, l_1stwon: null, l_2ndwon: null,
      l_svgms: null, l_bpsaved: null, l_bpfaced: null,
    };

    const { error } = await supabase.from("saved_matches").insert({
      user_id: u.user.id, source_match_id: null, tour: match.tour, is_doubles: isDoubles,
      tournament: match.tourney_name, year: yr, surface: surface || null, round, rating: rating || null, match,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onSaved();
    onClose();
  }

  const input = "rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:border-green-500";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Add a match manually</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800">✕</button>
        </div>
        <p className="mb-4 text-xs text-neutral-500">For matches not in the database (e.g. Laver Cup doubles). Use “Look up” to pull a player’s country and latest ranking from the cache.</p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select value={tour} onChange={(e) => setTour(e.target.value as any)} className={input}>
            <option value="atp">ATP</option><option value="wta">WTA</option><option value="">Other</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-green-600" checked={isDoubles} onChange={(e) => setIsDoubles(e.target.checked)} /> Doubles</label>
          <select value={round} onChange={(e) => setRound(e.target.value)} className={input}>{ROUNDS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <input className={`${input} col-span-2`} placeholder="Tournament (e.g. Laver Cup)" value={tournament} onChange={(e) => setTournament(e.target.value)} />
          <input className={input} placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          <select value={surface} onChange={(e) => setSurface(e.target.value)} className={input}>{SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={bestOf} onChange={(e) => setBestOf(e.target.value)} className={input}><option value="3">Best of 3</option><option value="5">Best of 5</option></select>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SideEditor title="Winner" doubles={isDoubles} p1={w1} setP1={setW1} p2={w2} setP2={setW2} lookup={lookup} />
          <SideEditor title="Loser" doubles={isDoubles} p1={l1} setP1={setL1} p2={l2} setP2={setL2} lookup={lookup} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input className={`${input} col-span-2`} placeholder="Score (e.g. 6-4 3-6 10-8)" value={score} onChange={(e) => setScore(e.target.value)} />
          <input className={input} placeholder="Minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <select value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))} className={input}>
            <option value={0}>Rating</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
          </select>
        </div>

        {msg && <p className="mt-3 text-sm text-amber-600">{msg}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-5 py-2 text-sm font-medium text-white">{busy ? "Saving…" : "Save match"}</button>
        </div>
      </div>
    </div>
  );
}

function SideEditor({ title, doubles, p1, setP1, p2, setP2, lookup }: {
  title: string; doubles: boolean; p1: PInfo; setP1: (p: PInfo) => void; p2: PInfo; setP2: (p: PInfo) => void;
  lookup: (p: PInfo, set: (p: PInfo) => void) => void;
}) {
  const input = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-green-500";
  const row = (p: PInfo, set: (p: PInfo) => void, ph: string) => (
    <div className="flex gap-1">
      <input className={input} placeholder={ph} value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} />
      <button type="button" onClick={() => lookup(p, set)} className="shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Look up country & ranking">🔍</button>
    </div>
  );
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</div>
      <div className="space-y-1.5">
        {row(p1, setP1, "Player 1")}
        {p1.ioc && <div className="text-[11px] text-neutral-400">{p1.ioc}{p1.rank ? ` · #${p1.rank}` : ""}</div>}
        {doubles && row(p2, setP2, "Player 2")}
        {doubles && p2.ioc && <div className="text-[11px] text-neutral-400">{p2.ioc}{p2.rank ? ` · #${p2.rank}` : ""}</div>}
      </div>
    </div>
  );
}
