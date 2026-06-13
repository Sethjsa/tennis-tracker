import type { SavedMatch, TourMatch } from "./types";
import { allPlayers, deriveFacts, effectiveDate } from "./score";

export interface Count { name: string; count: number }

// Dimensions a diary can be sliced by. Drives both the dashboard lists and drilldowns.
export type Dim = "player" | "tournament" | "surface" | "round" | "country" | "series" | "year" | "court";

const LEVEL_LABEL: Record<string, string> = {
  G: "Grand Slam", M: "Masters 1000", A: "ATP/WTA Tour", F: "Tour Finals",
  D: "Davis/BJK Cup", C: "Challenger", O: "Olympics", P: "WTA Premier", PM: "WTA 1000",
};

// A tournament's category — prefer tennis-data's Series (splits ATP 250/500), else level.
export function seriesLabel(m: TourMatch): string {
  if (m.series) return m.series;
  if (m.tourney_level) return LEVEL_LABEL[m.tourney_level] ?? m.tourney_level;
  return "Other";
}

// The value(s) a match contributes to a given dimension (player & country can be many).
export function valuesOf(sm: SavedMatch, dim: Dim): string[] {
  const m = sm.match;
  switch (dim) {
    case "player": return allPlayers(m);
    case "country": return [m.winner1_ioc, m.winner2_ioc, m.loser1_ioc, m.loser2_ioc].filter(Boolean) as string[];
    case "tournament": return [m.tourney_name];          // generalised across years
    case "surface": return m.surface ? [m.surface] : [];
    case "round": return m.round ? [m.round] : [];
    case "series": return [seriesLabel(m)];
    case "court": return m.court ? [m.court] : [];
    case "year": return sm.year ? [String(sm.year)] : [];
  }
}

export function tally(items: (string | null | undefined)[]): Count[] {
  const map = new Map<string, number>();
  for (const it of items) if (it) map.set(it, (map.get(it) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function tallyDimension(matches: SavedMatch[], dim: Dim): Count[] {
  const items: string[] = [];
  for (const m of matches) items.push(...valuesOf(m, dim));
  return tally(items);
}

export function matchesFor(matches: SavedMatch[], dim: Dim, value: string): SavedMatch[] {
  return matches.filter((m) => valuesOf(m, dim).includes(value));
}

// Distinct tournaments watched per year (for the per-year chart).
export function tournamentsPerYear(matches: SavedMatch[]): Count[] {
  const byYear = new Map<string, Set<string>>();
  for (const m of matches) {
    if (!m.year) continue;
    const y = String(m.year);
    if (!byYear.has(y)) byYear.set(y, new Set());
    byYear.get(y)!.add(m.match.tourney_name);
  }
  return [...byYear.entries()].map(([name, set]) => ({ name, count: set.size })).sort((a, b) => a.name.localeCompare(b.name));
}

export function matchesPerYear(matches: SavedMatch[]): Count[] {
  return tallyDimension(matches, "year").sort((a, b) => a.name.localeCompare(b.name));
}

const ranksOf = (m: TourMatch) =>
  [
    [m.winner1_name, m.winner1_rank, m.winner1_rank_points],
    [m.winner2_name, m.winner2_rank, m.winner2_rank_points],
    [m.loser1_name, m.loser1_rank, m.loser1_rank_points],
    [m.loser2_name, m.loser2_rank, m.loser2_rank_points],
  ].filter((r) => r[0] && r[1] != null) as [string, number, number | null][];

export interface DiaryStats {
  totalMatches: number; singles: number; doubles: number;
  totalSets: number; totalGames: number; totalTiebreaks: number;
  bagels: number; breadsticks: number; walkovers: number; retirements: number;
  totalMinutes: number; totalHours: number; avgMinutes: number | null;
  totalBreaks: number; avgBreaks: number | null; totalAces: number; totalDoubleFaults: number;
  straightSets: number; deciders: number; upsets: number; finalsSeen: number; topTenSeen: number;
  avgRating: number | null; avgPlayerAge: number | null; avgRankGap: number | null;
  distinctTournaments: number; distinctCountries: number; distinctPlayers: number; distinctDays: number;
  mostPopularTournament: string | null; mostViewedRound: string | null;
  mostCommonSurface: string | null; mostCommonSeries: string | null;
  longestMatch: SavedMatch | null; biggestUpset: SavedMatch | null;
  bestRankSeen: { name: string; rank: number } | null;
  bestPointsSeen: { name: string; points: number } | null;
}

export function computeStats(matches: SavedMatch[]): DiaryStats {
  let totalSets = 0, totalGames = 0, totalTiebreaks = 0, bagels = 0, breadsticks = 0;
  let walkovers = 0, retirements = 0, totalMinutes = 0, minutesN = 0;
  let totalBreaks = 0, breaksN = 0, totalAces = 0, totalDoubleFaults = 0;
  let straightSets = 0, deciders = 0, upsets = 0, finalsSeen = 0, topTenSeen = 0;
  let ratingSum = 0, ratingN = 0, ageSum = 0, ageN = 0, gapSum = 0, gapN = 0;
  let singles = 0, doubles = 0;
  const days = new Set<string>();
  let longestMatch: SavedMatch | null = null;
  let biggestUpset: SavedMatch | null = null, biggestUpsetGap = -1;
  let bestRank: { name: string; rank: number } | null = null;
  let bestPoints: { name: string; points: number } | null = null;

  for (const sm of matches) {
    const m = sm.match;
    const f = deriveFacts(m);
    if (m.is_doubles) doubles++; else singles++;
    totalSets += f.setsTotal; totalGames += f.gamesTotal; totalTiebreaks += f.tiebreaksTotal;
    bagels += f.bagels; breadsticks += f.breadsticks;
    if (f.walkover) walkovers++;
    if (f.retired) retirements++;
    if (f.straightSets) straightSets++;
    if (f.wentDistance) deciders++;
    if (f.upset) upsets++;
    if (m.round === "F") finalsSeen++;
    if (m.minutes != null) { totalMinutes += m.minutes; minutesN++; if (!longestMatch || (longestMatch.match.minutes ?? 0) < m.minutes) longestMatch = sm; }
    if (f.breaksTotal != null) { totalBreaks += f.breaksTotal; breaksN++; }
    if (f.acesTotal != null) totalAces += f.acesTotal;
    if (f.dfTotal != null) totalDoubleFaults += f.dfTotal;
    if (sm.rating != null) { ratingSum += sm.rating; ratingN++; }
    for (const a of [m.winner1_age, m.winner2_age, m.loser1_age, m.loser2_age]) if (a != null) { ageSum += a; ageN++; }
    if (f.rankGap != null) { gapSum += f.rankGap; gapN++; if (f.upset && f.rankGap > biggestUpsetGap) { biggestUpsetGap = f.rankGap; biggestUpset = sm; } }
    const ranks = ranksOf(m);
    for (const [name, rank, pts] of ranks) {
      if (!bestRank || rank < bestRank.rank) bestRank = { name, rank };
      if (pts != null && (!bestPoints || pts > bestPoints.points)) bestPoints = { name, points: pts };
    }
    if (ranks.some(([, r]) => r <= 10)) topTenSeen++;
    const d = effectiveDate(m);
    if (d) days.add(d);
  }

  const byTournament = tallyDimension(matches, "tournament");
  const byRound = tallyDimension(matches, "round");
  const bySurface = tallyDimension(matches, "surface");
  const bySeries = tallyDimension(matches, "series");

  return {
    totalMatches: matches.length, singles, doubles,
    totalSets, totalGames, totalTiebreaks, bagels, breadsticks, walkovers, retirements,
    totalMinutes, totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    avgMinutes: minutesN ? Math.round(totalMinutes / minutesN) : null,
    totalBreaks, avgBreaks: breaksN ? Math.round((totalBreaks / breaksN) * 10) / 10 : null,
    totalAces, totalDoubleFaults,
    straightSets, deciders, upsets, finalsSeen, topTenSeen,
    avgRating: ratingN ? Math.round((ratingSum / ratingN) * 10) / 10 : null,
    avgPlayerAge: ageN ? Math.round((ageSum / ageN) * 10) / 10 : null,
    avgRankGap: gapN ? Math.round(gapSum / gapN) : null,
    distinctTournaments: byTournament.length,
    distinctCountries: tallyDimension(matches, "country").length,
    distinctPlayers: tallyDimension(matches, "player").length,
    distinctDays: days.size,
    mostPopularTournament: byTournament[0]?.name ?? null,
    mostViewedRound: byRound[0]?.name ?? null,
    mostCommonSurface: bySurface[0]?.name ?? null,
    mostCommonSeries: bySeries[0]?.name ?? null,
    longestMatch, biggestUpset, bestRankSeen: bestRank, bestPointsSeen: bestPoints,
  };
}
