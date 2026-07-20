// Hand-written to match supabase/migrations/*.sql.
// If you have the Supabase CLI + a linked project, prefer regenerating this
// with: `supabase gen types typescript --linked > lib/database.types.ts`

export type PlayerRole = "player" | "admin";
export type TeeColor = "white" | "yellow";
export type RoundType = "full_18" | "front_9" | "back_9";
export type ScorecardStatus = "pending_approval" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          current_handicap: number;
          pin_hash: string;
          role: PlayerRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          current_handicap: number;
          pin_hash: string;
          role?: PlayerRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
      };
      courses: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          hole_count: 9 | 18;
          handicap_cut_per_point: number;
          handicap_increase_per_point: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          hole_count?: 9 | 18;
          handicap_cut_per_point?: number;
          handicap_increase_per_point?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
      };
      holes: {
        Row: {
          id: string;
          course_id: string;
          hole_number: number;
          par: number;
          stroke_index: number;
          white_yards: number | null;
          yellow_yards: number | null;
        };
        Insert: {
          id?: string;
          course_id: string;
          hole_number: number;
          par: number;
          stroke_index: number;
          white_yards?: number | null;
          yellow_yards?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["holes"]["Insert"]>;
      };
      scorecards: {
        Row: {
          id: string;
          player_id: string;
          course_id: string;
          tee_color: TeeColor;
          round_type: RoundType;
          playing_handicap: number;
          played_at: string;
          total_gross_stroke_play: number | null;
          total_net_stroke_play: number | null;
          total_stableford_points: number | null;
          proposed_handicap_change: number | null;
          status: ScorecardStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          course_id: string;
          tee_color: TeeColor;
          round_type: RoundType;
          playing_handicap: number;
          played_at?: string;
          total_gross_stroke_play?: number | null;
          total_net_stroke_play?: number | null;
          total_stableford_points?: number | null;
          proposed_handicap_change?: number | null;
          status?: ScorecardStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scorecards"]["Insert"]>;
      };
      scores: {
        Row: {
          id: string;
          scorecard_id: string;
          hole_id: string;
          gross_strokes: number;
          net_strokes: number;
          stableford_points: number;
        };
        Insert: {
          id?: string;
          scorecard_id: string;
          hole_id: string;
          gross_strokes: number;
          net_strokes: number;
          stableford_points: number;
        };
        Update: Partial<Database["public"]["Tables"]["scores"]["Insert"]>;
      };
      handicap_history: {
        Row: {
          id: string;
          player_id: string;
          scorecard_id: string | null;
          handicap_value: number;
          adjustment_amount: number;
          effective_date: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          scorecard_id?: string | null;
          handicap_value: number;
          adjustment_amount: number;
          effective_date?: string;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["handicap_history"]["Insert"]>;
      };
    };
    Functions: {
      approve_scorecard: {
        Args: {
          p_scorecard_id: string;
          p_reviewer_id: string;
          p_applied_change: number;
        };
        Returns: { new_handicap: number }[];
      };
      reject_scorecard: {
        Args: {
          p_scorecard_id: string;
          p_reviewer_id: string;
        };
        Returns: undefined;
      };
    };
  };
}
