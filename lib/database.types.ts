// Hand-written to match supabase/migrations/*.sql.
// If you have the Supabase CLI + a linked project, prefer regenerating this
// with: `supabase gen types typescript --linked > lib/database.types.ts`
//
// IMPORTANT: every table below includes a `Relationships` array (even when
// empty) because @supabase/supabase-js's internal generic constraints
// require that key to be present to correctly resolve Row/Insert/Update
// types on .from().insert()/.update()/.select(). A hand-written type
// missing this key doesn't just lose embedded-select typing (players(...),
// courses(...), etc.) — in some library versions it degrades basic
// operations like .insert() to `never`, which is what caused a build
// failure on a plain players insert that had nothing to do with embeds.
// If you regenerate this file from `supabase gen types`, it already
// includes accurate Relationships for you — this hand-written version
// just needed to catch up to that format.
//
// society_id (added in 0015_future_proof_multi_tenancy.sql): every table
// has one, marked OPTIONAL on every Insert type here because the database
// column has a DEFAULT — this is what keeps every existing .insert() call
// across the app compiling and working unchanged. Don't make society_id
// required on any Insert type unless the DB default is also removed.

export type PlayerRole = "player" | "admin";
export type TeeColor = "white" | "yellow";
export type RoundType = "full_18" | "front_9" | "back_9";
export type ScorecardStatus = "pending_approval" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      societies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["societies"]["Insert"]>;
        Relationships: [];
      };
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
          society_id: string;
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
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "players_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
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
          society_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          hole_count?: 9 | 18;
          handicap_cut_per_point?: number;
          handicap_increase_per_point?: number;
          created_at?: string;
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "courses_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
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
          society_id: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          hole_number: number;
          par: number;
          stroke_index: number;
          white_yards?: number | null;
          yellow_yards?: number | null;
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["holes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "holes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "holes_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
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
          society_id: string;
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
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scorecards"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "scorecards_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scorecards_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scorecards_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scorecards_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
      };
      scores: {
        Row: {
          id: string;
          scorecard_id: string;
          hole_id: string;
          gross_strokes: number | null;
          net_strokes: number | null;
          stableford_points: number;
          picked_up: boolean;
          society_id: string;
        };
        Insert: {
          id?: string;
          scorecard_id: string;
          hole_id: string;
          gross_strokes?: number | null;
          net_strokes?: number | null;
          stableford_points: number;
          picked_up?: boolean;
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scores"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "scores_scorecard_id_fkey";
            columns: ["scorecard_id"];
            isOneToOne: false;
            referencedRelation: "scorecards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_hole_id_fkey";
            columns: ["hole_id"];
            isOneToOne: false;
            referencedRelation: "holes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
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
          society_id: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          scorecard_id?: string | null;
          handicap_value: number;
          adjustment_amount: number;
          effective_date?: string;
          notes?: string | null;
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["handicap_history"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "handicap_history_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handicap_history_scorecard_id_fkey";
            columns: ["scorecard_id"];
            isOneToOne: false;
            referencedRelation: "scorecards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handicap_history_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
      };
      app_settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
          updated_by: string | null;
          society_id: string;
        };
        Insert: {
          key: string;
          value: unknown;
          updated_at?: string;
          updated_by?: string | null;
          society_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_settings_society_id_fkey";
            columns: ["society_id"];
            isOneToOne: false;
            referencedRelation: "societies";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    // Functions are intentionally omitted — approve_scorecard/reject_scorecard
    // RPC calls in app/actions/approvals.ts bypass Database-generic typing
    // entirely with an `any` cast, since matching this installed
    // supabase-js version's .rpc() generic constraints by hand kept
    // surfacing new mismatches. If you regenerate this file from
    // `supabase gen types`, it'll add a correct Functions section
    // automatically and those `any` casts can be removed at that point.
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
