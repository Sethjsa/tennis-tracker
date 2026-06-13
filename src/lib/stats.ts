import type { SavedMatch } from "./types";

export interface PlayerCount {
  name: string;
  count: number;
}

export interface DiaryStats {
  totalMatches: number;
  totalSets: number;
  totalGames: number;
  totalTiebreaks: number;
  totalMinutes: number;
  totalHours: number;
  straightSets: number;
  deciders: number; // went the distance
  topPlayers: PlayerCount[];
  bySurface: PlayerCount[];
  byRound: PlayerCount[];
  byTournament: PlayerCount[];
  byCountry: PlayerCount[];
  avgMinutes: number | null;
  avgRating: number | null;
  topTenSeen: number; // distinct matches featuring a top-10 player
  finalsSeen: number;
  distinctTournaments: number;
  distinctCountries: number;
  longestMatch: SavedMatch | null;
}

function tally(items: (string | null | undefined)[]): PlayerCount[] {
  const map = new Map<string, number>();
  for (const it of items) {
    if (!it) continue;
    map.set(it, (map.get(it) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeStats(matches: SavedMatch[]): DiaryStats {
  const totalMatches = matches.length;
  let totalSets = 0;
  let totalGames = 0;
  let totalTiebreaks = 0;
  let totalMinutes = 0;
  let minutesCount = 0;
  let straightSets = 0;
  let deciders = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let topTenSeen = 0;
  let finalsSeen = 0;
  let longestMatch: SavedMatch | null = null;

  const players: string[] = [];
  const countries: string[] = [];

  for (const m of matches) {
    totalSets += m.sets_total ?? 0;
    totalGames += m.games_total ?? 0;
    totalTiebreaks += m.tiebreaks_total ?? 0;
    if (m.minutes != null) {
      totalMinutes += m.minutes;
      minutesCount += 1;
      if (!longestMatch || (longestMatch.minutes ?? 0) < m.minutes) longestMatch = m;
    }
    if (m.straight_sets) straightSets += 1;
    if (m.went_distance) deciders += 1;
    if (m.rating != null) {
      ratingSum += m.rating;
      ratingCount += 1;
    }
    const topW = m.winner_rank != null && m.winner_rank <= 10;
    const topL = m.loser_rank != null && m.loser_rank <= 10;
    if (topW || topL) topTenSeen += 1;
    if (m.round === "F") finalsSeen += 1;

    players.push(m.player1, m.player2);
    countries.push(m.winner_ioc ?? null as any, m.loser_ioc ?? null as any);
  }

  const byTournament = tally(
    matches.map((m) => (m.year ? `${m.tournament} ${m.year}` : m.tournament)),
  );

  return {
    totalMatches,
    totalSets,
    totalGames,
    totalTiebreaks,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    straightSets,
    deciders,
    topPlayers: tally(players).slice(0, 5),
    bySurface: tally(matches.map((m) => m.surface)),
    byRound: tally(matches.map((m) => m.round)),
    byTournament,
    byCountry: tally(countries).slice(0, 8),
    avgMinutes: minutesCount ? Math.round(totalMinutes / minutesCount) : null,
    avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    topTenSeen,
    finalsSeen,
    distinctTournaments: byTournament.length,
    distinctCountries: new Set(countries.filter(Boolean)).size,
    longestMatch,
  };
}
