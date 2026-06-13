// Shared types across the app.

export type Tour = "atp" | "wta";

/** A match row from the shared tennis-data cache (Sackmann data). */
export interface TourMatch {
  id: number;
  tour: Tour;
  year: number;
  tourney_name: string;
  surface: string | null;
  tourney_date: string | null;
  round: string | null;
  match_num: number | null;
  winner_name: string;
  loser_name: string;
  winner_ioc: string | null;
  loser_ioc: string | null;
  score: string | null;
  best_of: number | null;
  minutes: number | null;
  winner_rank: number | null;
  loser_rank: number | null;
}

/** A tournament instance = one tournament in one year (the unit a user "attends"). */
export interface TournamentInstance {
  tour: Tour;
  tourney_name: string;
  year: number;
  surface: string | null;
  tourney_date: string | null;
  match_count: number;
}

/** A user's saved diary entry. */
export interface SavedMatch {
  id: string;
  user_id: string;
  created_at: string;
  source_match_id: number | null;
  tour: Tour | null;
  player1: string;
  player2: string;
  winner: string;
  tournament: string;
  year: number | null;
  surface: string | null;
  round: string | null;
  match_date: string | null;
  score: string | null;
  best_of: number | null;
  minutes: number | null;
  winner_ioc: string | null;
  loser_ioc: string | null;
  winner_rank: number | null;
  loser_rank: number | null;
  sets_total: number | null;
  games_total: number | null;
  tiebreaks_total: number | null;
  went_distance: boolean | null;
  straight_sets: boolean | null;
  rating: number | null;
}
