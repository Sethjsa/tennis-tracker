// Derive set/game/tiebreak counts from a Sackmann-style score string.
// Examples: "6-4 5-7 7-6(4)", "6-7(4) 6-5 RET", "7-6(5) 6-3", "6-3 6-2".
// The winner's games are listed first in each set.

export interface ScoreBreakdown {
  setsTotal: number;
  gamesTotal: number;
  tiebreaksTotal: number;
  winnerSets: number;
  loserSets: number;
  straightSets: boolean; // loser won no sets
  wentDistance: boolean; // match reached a deciding set
}

const SET_RE = /^(\d{1,2})-(\d{1,2})(\(\d+\))?$/;

export function parseScore(
  score: string | null | undefined,
  bestOf: number | null | undefined,
): ScoreBreakdown {
  const empty: ScoreBreakdown = {
    setsTotal: 0,
    gamesTotal: 0,
    tiebreaksTotal: 0,
    winnerSets: 0,
    loserSets: 0,
    straightSets: false,
    wentDistance: false,
  };
  if (!score) return empty;

  let setsTotal = 0;
  let gamesTotal = 0;
  let tiebreaksTotal = 0;
  let winnerSets = 0;
  let loserSets = 0;

  for (const token of score.trim().split(/\s+/)) {
    const m = token.match(SET_RE);
    if (!m) continue; // skip RET, W/O, DEF, [10-8] match tiebreaks, etc.
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    setsTotal += 1;
    gamesTotal += a + b;
    if (m[3]) tiebreaksTotal += 1; // had a "(n)" tiebreak marker
    if (a > b) winnerSets += 1;
    else if (b > a) loserSets += 1;
  }

  const decider = bestOf && bestOf > 0 ? Math.ceil(bestOf / 2) + Math.floor(bestOf / 2) : 0;
  const wentDistance =
    setsTotal > 0 && (decider ? setsTotal >= decider : winnerSets > 0 && loserSets > 0);

  return {
    setsTotal,
    gamesTotal,
    tiebreaksTotal,
    winnerSets,
    loserSets,
    straightSets: setsTotal > 0 && loserSets === 0,
    wentDistance,
  };
}

// Order rounds from earliest to final for display.
const ROUND_ORDER: Record<string, number> = {
  Q1: 0, Q2: 1, Q3: 2,
  RR: 3, BR: 3,
  R128: 4, R64: 5, R32: 6, R16: 7,
  QF: 8, SF: 9, F: 10,
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
    default: return round ?? "—";
  }
}
