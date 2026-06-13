// Shared types across the app.

export type Tour = "atp" | "wta";

/** A match row from the shared tennis-data cache (Sackmann data). */
export interface TourMatch {
  id: number;
  tour: Tour;
  year: number;
  is_doubles: boolean;
  tourney_id: string | null;
  tourney_name: string;
  surface: string | null;
  draw_size: number | null;
  tourney_level: string | null;
  tourney_date: string | null;
  est_date: string | null;
  match_date: string | null;
  date_exact: boolean;
  match_num: number | null;
  round: string | null;
  best_of: number | null;
  minutes: number | null;
  score: string | null;

  winner1_name: string; winner1_ioc: string | null; winner1_age: number | null;
  winner1_ht: number | null; winner1_hand: string | null;
  winner1_rank: number | null; winner1_rank_points: number | null;
  winner2_name: string | null; winner2_ioc: string | null; winner2_age: number | null;
  winner2_ht: number | null; winner2_hand: string | null;
  winner2_rank: number | null; winner2_rank_points: number | null;
  winner_seed: number | null; winner_entry: string | null;

  loser1_name: string; loser1_ioc: string | null; loser1_age: number | null;
  loser1_ht: number | null; loser1_hand: string | null;
  loser1_rank: number | null; loser1_rank_points: number | null;
  loser2_name: string | null; loser2_ioc: string | null; loser2_age: number | null;
  loser2_ht: number | null; loser2_hand: string | null;
  loser2_rank: number | null; loser2_rank_points: number | null;
  loser_seed: number | null; loser_entry: string | null;

  w_ace: number | null; w_df: number | null; w_svpt: number | null; w_1stin: number | null;
  w_1stwon: number | null; w_2ndwon: number | null; w_svgms: number | null;
  w_bpsaved: number | null; w_bpfaced: number | null;
  l_ace: number | null; l_df: number | null; l_svpt: number | null; l_1stin: number | null;
  l_1stwon: number | null; l_2ndwon: number | null; l_svgms: number | null;
  l_bpsaved: number | null; l_bpfaced: number | null;
}

/** A tournament instance = one tournament in one year. */
export interface TournamentInstance {
  tour: Tour;
  tourney_name: string;
  year: number;
  surface: string | null;
  tourney_date: string | null;
  match_count: number;
  has_singles: boolean;
  has_doubles: boolean;
}

/** A user's saved diary entry: the full match snapshot + a rating. */
export interface SavedMatch {
  id: string;
  user_id: string;
  created_at: string;
  source_match_id: number | null;
  tour: Tour | null;
  is_doubles: boolean;
  tournament: string;
  year: number | null;
  surface: string | null;
  round: string | null;
  rating: number | null;
  match: TourMatch;
}
