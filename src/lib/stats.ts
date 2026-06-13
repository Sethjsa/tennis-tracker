import type { SavedMatch, TourMatch } from "./types";
import { allPlayers, deriveFacts, effectiveDate } from "./score";

export interface Count { name: string; count: number }

export interface DiaryStats {
  totalMatches: number;
  singles: number;
  doubles: number;

  totalSets: number;
  totalGames: number;
  totalTiebreaks: number;
  bagels: number;
  breadsticks: number;
  walkovers: number;
  retirements: number;

  totalMinutes: number;
  totalHours: number;
  avgMinutes: number | null;

  totalBreaks: number;
  avgBreaks: number | null;
  totalAces: number;
  totalDoubleFaults: number;

  straightSets: number;
  deciders: number;
  upsets: number;
  finalsSeen: number;
  topTenSeen: number;

  avgRating: number | null;
  avgPlayerAge: number | null;
  avgRankGap: number | null;

  distinctTournaments: number;
  distinctCountries: number;
  distinctPlayers: number;
  distinctDays: number;

  topPlayers: Count[];
  bySurface: Count[];
  byRound: Count[];
  byTournament: Count[];
  byLevel: Count[];
  byCountry: Count[];
  byTour: Count[];

  mostViewedRound: string | null;
  mostPopularTournament: string | null;
  mostCommonSurface: string | null;

  longestMatch: SavedMatch | null;
  biggestUpset: SavedMatch | null;
  bestRankSeen: { name: string; rank: number } | null;
}

function tally(items: (string | null | undefined)[]): Count[] {
  const map = new Map<string, number>();
  for (const it of items) if (it) map.set(it, (map.get(it) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

const iocsOf = (m: TourMatch) =>
  [m.winner1_ioc, m.winner2_ioc, m.loser1_ioc, m.loser2_ioc].filter(Boolean) as string[];
const agesOf = (m: TourMatch) =>
  [m.winner1_age, m.winner2_age, m.loser1_age, m.loser2_age].filter((x): x is number => x != null);
const ranksOf = (m: TourMatch) =>
  [
    [m.winner1_name, m.winner1_rank], [m.winner2_name, m.winner2_rank],
    [m.loser1_name, m.loser1_rank], [m.loser2_name, m.loser2_rank],
  ].filter((r) => r[0] && r[1] != null) as [string, number][];

const LEVEL_LABEL: Record<string, string> = {
  G: "Grand Slam", M: "Masters 1000", A: "ATP 250/500", F: "Tour Finals",
  D: "Davis Cup", C: "Challenger", O: "Olympics", P: "WTA Premier", PM: "WTA 1000",
};

export function computeStats(matches: SavedMatch[]): DiaryStats {
  let totalSets = 0, totalGames = 0, totalTiebreaks = 0, bagels = 0, breadsticks = 0;
  let walkovers = 0, retirements = 0, totalMinutes = 0, minutesN = 0;
  let totalBreaks = 0, breaksN = 0, totalAces = 0, totalDoubleFaults = 0;
  let straightSets = 0, deciders = 0, upsets = 0, finalsSeen = 0, topTenSeen = 0;
  let ratingSum = 0, ratingN = 0, ageSum = 0, ageN = 0, gapSum = 0, gapN = 0;
  let singles = 0, doubles = 0;

  const players: string[] = [], iocs: string[] = [];
  const days = new Set<string>();
  let longestMatch: SavedMatch | null = null;
  let biggestUpset: SavedMatch | null = null, biggestUpsetGap = -1;
  let bestRank: { name: string; rank: number } | null = null;

  for (const sm of matches) {
    const m = sm.match;
    const f = deriveFacts(m);
    if (m.is_doubles) doubles++; else singles++;

    totalSets += f.setsTotal;
    totalGames += f.gamesTotal;
    totalTiebreaks += f.tiebreaksTotal;
    bagels += f.bagels;
    breadsticks += f.breadsticks;
    if (f.walkover) walkovers++;
    if (f.retired) retirements++;
    if (f.straightSets) straightSets++;
    if (f.wentDistance) deciders++;
    if (f.upset) upsets++;
    if (m.round === "F") finalsSeen++;

    if (m.minutes != null) {
      totalMinutes += m.minutes; minutesN++;
      if (!longestMatch || (longestMatch.match.minutes ?? 0) < m.minutes) longestMatch = sm;
    }
    if (f.breaksTotal != null) { totalBreaks += f.breaksTotal; breaksN++; }
    if (f.acesTotal != null) totalAces += f.acesTotal;
    if (f.dfTotal != null) totalDoubleFaults += f.dfTotal;
    if (sm.rating != null) { ratingSum += sm.rating; ratingN++; }
    for (const a of agesOf(m)) { ageSum += a; ageN++; }
    if (f.rankGap != null) { gapSum += f.rankGap; gapN++; if (f.upset && f.rankGap > biggestUpsetGap) { biggestUpsetGap = f.rankGap; biggestUpset = sm; } }

    const ranks = ranksOf(m);
    for (const [name, rank] of ranks) {
      if (!bestRank || rank < bestRank.rank) bestRank = { name, rank };
    }
    if (ranks.some(([, r]) => r <= 10)) topTenSeen++;

    players.push(...allPlayers(m));
    iocs.push(...iocsOf(m));
    const d = effectiveDate(m);
    if (d) days.add(d);
  }

  const byTournament = tally(matches.map((m) => (m.year ? `${m.tournament} ${m.year}` : m.tournament)));
  const byRound = tally(matches.map((m) => m.round));
  const bySurface = tally(matches.map((m) => m.surface));
  const topPlayers = tally(players);

  return {
    totalMatches: matches.length,
    singles, doubles,
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
    distinctCountries: new Set(iocs).size,
    distinctPlayers: topPlayers.length,
    distinctDays: days.size,
    topPlayers: topPlayers.slice(0, 8),
    bySurface,
    byRound,
    byTournament,
    byLevel: tally(matches.map((m) => (m.match.tourney_level ? (LEVEL_LABEL[m.match.tourney_level] ?? m.match.tourney_level) : null))),
    byCountry: tally(iocs).slice(0, 10),
    byTour: tally(matches.map((m) => (m.tour ? m.tour.toUpperCase() : null))),
    mostViewedRound: byRound[0]?.name ?? null,
    mostPopularTournament: byTournament[0]?.name ?? null,
    mostCommonSurface: bySurface[0]?.name ?? null,
    longestMatch, biggestUpset, bestRankSeen: bestRank,
  };
}
