import type { TourMatch } from "./types";

// Per-match derived facts, computed from the score string + serve/rank columns.
export interface MatchFacts {
  setsTotal: number;
  gamesTotal: number;
  tiebreaksTotal: number;
  bagels: number; // 6-0 sets
  breadsticks: number; // 6-1 sets
  winnerSets: number;
  loserSets: number;
  straightSets: boolean;
  wentDistance: boolean;
  walkover: boolean;
  retired: boolean;
  breaksTotal: number | null; // service breaks in the match (needs serve stats)
  acesTotal: number | null;
  dfTotal: number | null;
  upset: boolean; // worse-ranked side won
  rankGap: number | null; // |winner rank points - loser rank points|
}

const SET_RE = /^(\d{1,2})-(\d{1,2})(\(\d+\))?$/;
const MATCH_TB_RE = /^[\[(](\d+)-(\d+)[\])]$/; // doubles match tiebreak e.g. (10-6) or [10-8]

export function deriveFacts(m: TourMatch): MatchFacts {
  const score = m.score ?? "";
  const walkover = /w\/?o|walkover/i.test(score) || score.trim() === "";
  const retired = /\bret\b|\bdef\b/i.test(score);

  let setsTotal = 0, gamesTotal = 0, tiebreaksTotal = 0, bagels = 0, breadsticks = 0;
  let winnerSets = 0, loserSets = 0;

  for (const token of score.trim().split(/\s+/)) {
    const s = token.match(SET_RE);
    if (s) {
      const a = +s[1], b = +s[2];
      setsTotal++; gamesTotal += a + b;
      if (s[3]) tiebreaksTotal++;
      const hi = Math.max(a, b), lo = Math.min(a, b);
      if (hi === 6 && lo === 0) bagels++;
      if (hi === 6 && lo === 1) breadsticks++;
      if (a > b) winnerSets++; else if (b > a) loserSets++;
      continue;
    }
    const tb = token.match(MATCH_TB_RE);
    if (tb) { setsTotal++; tiebreaksTotal++; winnerSets++; } // super-tiebreak: winner takes it
  }

  const decider = m.best_of ? m.best_of : 0;
  const wentDistance = setsTotal > 0 && (decider ? setsTotal >= decider : winnerSets > 0 && loserSets > 0);

  // Service breaks = break points faced minus saved, both sides.
  let breaksTotal: number | null = null;
  if (m.w_bpfaced != null && m.l_bpfaced != null) {
    breaksTotal = (m.w_bpfaced - (m.w_bpsaved ?? 0)) + (m.l_bpfaced - (m.l_bpsaved ?? 0));
  }
  const acesTotal = m.w_ace != null || m.l_ace != null ? (m.w_ace ?? 0) + (m.l_ace ?? 0) : null;
  const dfTotal = m.w_df != null || m.l_df != null ? (m.w_df ?? 0) + (m.l_df ?? 0) : null;

  // Upset: winner ranked worse (higher number) than loser.
  let upset = false;
  if (m.winner1_rank != null && m.loser1_rank != null) upset = m.winner1_rank > m.loser1_rank;
  else if (m.winner_seed != null && m.loser_seed != null) upset = m.winner_seed > m.loser_seed;

  const wp = (m.winner1_rank_points ?? 0) + (m.winner2_rank_points ?? 0);
  const lp = (m.loser1_rank_points ?? 0) + (m.loser2_rank_points ?? 0);
  const rankGap = m.winner1_rank_points != null && m.loser1_rank_points != null ? Math.abs(wp - lp) : null;

  return {
    setsTotal, gamesTotal, tiebreaksTotal, bagels, breadsticks,
    winnerSets, loserSets,
    straightSets: setsTotal > 0 && loserSets === 0,
    wentDistance, walkover, retired,
    breaksTotal, acesTotal, dfTotal, upset, rankGap,
  };
}

// Best available date for a match: exact (tennis-data) > estimated > tournament start.
export function effectiveDate(m: TourMatch): string | null {
  return m.match_date ?? m.est_date ?? m.tourney_date ?? null;
}
export function formatDay(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Players on each side (1 or 2 per side), for individual player counting.
export function winnerPlayers(m: TourMatch): string[] {
  return [m.winner1_name, m.winner2_name].filter(Boolean) as string[];
}
export function loserPlayers(m: TourMatch): string[] {
  return [m.loser1_name, m.loser2_name].filter(Boolean) as string[];
}
export function allPlayers(m: TourMatch): string[] {
  return [...winnerPlayers(m), ...loserPlayers(m)];
}
export function sideLabel(m: TourMatch, side: "w" | "l"): string {
  return side === "w" ? winnerPlayers(m).join(" / ") : loserPlayers(m).join(" / ");
}

const ROUND_ORDER: Record<string, number> = {
  Q1: 0, Q2: 1, Q3: 2, RR: 3, BR: 3,
  R128: 4, R64: 5, R32: 6, R16: 7, QF: 8, SF: 9, F: 10,
};
export function roundRank(round: string | null | undefined): number {
  if (!round) return 99;
  return ROUND_ORDER[round] ?? 50;
}
export function roundLabel(round: string | null | undefined): string {
  switch (round) {
    case "F": return "Final";
    case "SF": return "Semifinal";
    case "QF": return "Quarterfinal";
    case "R16": return "Round of 16";
    case "R32": return "Round of 32";
    case "R64": return "Round of 64";
    case "R128": return "Round of 128";
    case "RR": return "Round Robin";
    case "BR": return "Bronze / Playoff";
    case "Q1": return "Qualifying R1";
    case "Q2": return "Qualifying R2";
    case "Q3": return "Qualifying R3";
    default: return round ?? "—";
  }
}
