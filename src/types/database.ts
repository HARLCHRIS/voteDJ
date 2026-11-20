export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoundName = 'Prime 1' | 'Prime 2';
export type RoundStatus = 'draft' | 'scheduled' | 'live' | 'completed';
export type PerformanceStatus = 'waiting' | 'open' | 'closed';
export type DeviceStatus = 'active' | 'flagged' | 'blocked';
export type DeviceEventType =
  | 'linked'
  | 'refused_second_account'
  | 'refused_other_device'
  | 'flagged'
  | 'blocked'
  | 'unblocked'
  | 'unlinked_by_admin';
export type AdminRole = 'super_admin' | 'moderator';
export type AllowedScore = 2 | 4 | 6 | 8 | 10;

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          slug: string;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          event_id: string;
          name: RoundName;
          order_number: 1 | 2;
          status: RoundStatus;
          min_scores_required: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: RoundName;
          order_number: 1 | 2;
          status?: RoundStatus;
          min_scores_required?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          name?: RoundName;
          order_number?: 1 | 2;
          status?: RoundStatus;
          min_scores_required?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      djs: {
        Row: {
          id: string;
          stage_name: string;
          real_name: string | null;
          bio: string | null;
          genre: string | null;
          photo_url: string | null;
          media_url: string | null;
          social_links: Record<string, string>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stage_name: string;
          real_name?: string | null;
          bio?: string | null;
          genre?: string | null;
          photo_url?: string | null;
          media_url?: string | null;
          social_links?: Record<string, string>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stage_name?: string;
          real_name?: string | null;
          bio?: string | null;
          genre?: string | null;
          photo_url?: string | null;
          media_url?: string | null;
          social_links?: Record<string, string>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      performances: {
        Row: {
          id: string;
          round_id: string;
          dj_id: string;
          performance_order: number;
          status: PerformanceStatus;
          opened_at: string | null;
          closed_at: string | null;
          is_qualified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          round_id: string;
          dj_id: string;
          performance_order: number;
          status?: PerformanceStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          is_qualified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          dj_id?: string;
          performance_order?: number;
          status?: PerformanceStatus;
          opened_at?: string | null;
          closed_at?: string | null;
          is_qualified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      performance_results: {
        Row: {
          performance_id: string;
          public_avg: number;
          public_count: number;
          public_rank: number | null;
          updated_at: string;
        };
        Insert: {
          performance_id: string;
          public_avg?: number;
          public_count?: number;
          public_rank?: number | null;
          updated_at?: string;
        };
        Update: {
          performance_id?: string;
          public_avg?: number;
          public_count?: number;
          public_rank?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          id: string;
          auth_user_id: string;
          role: AdminRole;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          role: AdminRole;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          role?: AdminRole;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      voters: {
        Row: {
          id: string;
          auth_user_id: string;
          auth_provider: 'google';
          created_at: string;
          is_blocked: boolean;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          auth_provider?: 'google';
          created_at?: string;
          is_blocked?: boolean;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          auth_provider?: 'google';
          created_at?: string;
          is_blocked?: boolean;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          voter_id: string;
          device_token_hash: string;
          fingerprint_hash: string | null;
          status: DeviceStatus;
          ip_hash: string | null;
          user_agent: string | null;
          first_seen_at: string;
          last_seen_at: string;
          unlinked_at: string | null;
        };
        Insert: {
          id?: string;
          voter_id: string;
          device_token_hash: string;
          fingerprint_hash?: string | null;
          status?: DeviceStatus;
          ip_hash?: string | null;
          user_agent?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          unlinked_at?: string | null;
        };
        Update: {
          id?: string;
          voter_id?: string;
          device_token_hash?: string;
          fingerprint_hash?: string | null;
          status?: DeviceStatus;
          ip_hash?: string | null;
          user_agent?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          unlinked_at?: string | null;
        };
        Relationships: [];
      };
      device_events: {
        Row: {
          id: string;
          device_id: string | null;
          voter_id: string | null;
          event_type: DeviceEventType;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id?: string | null;
          voter_id?: string | null;
          event_type: DeviceEventType;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      public_scores: {
        Row: {
          id: string;
          performance_id: string;
          voter_id: string;
          device_id: string;
          score: AllowedScore;
          ip_hash: string | null;
          created_at: string;
          updated_at: string;
          is_valid: boolean;
          invalidated_reason: string | null;
          invalidated_by: string | null;
        };
        Insert: {
          id?: string;
          performance_id: string;
          voter_id: string;
          device_id: string;
          score: AllowedScore;
          ip_hash?: string | null;
          created_at?: string;
          updated_at?: string;
          is_valid?: boolean;
          invalidated_reason?: string | null;
          invalidated_by?: string | null;
        };
        Update: {
          score?: AllowedScore;
          device_id?: string;
          ip_hash?: string | null;
          updated_at?: string;
          is_valid?: boolean;
          invalidated_reason?: string | null;
          invalidated_by?: string | null;
        };
        Relationships: [];
      };
      score_aggregates: {
        Row: {
          performance_id: string;
          scores_sum: number;
          scores_count: number;
          updated_at: string;
        };
        Insert: {
          performance_id: string;
          scores_sum?: number;
          scores_count?: number;
          updated_at?: string;
        };
        Update: {
          scores_sum?: number;
          scores_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_create_dj: {
        Args: {
          p_stage_name: string;
          p_round_id: string;
          p_real_name?: string | null;
          p_bio?: string | null;
          p_genre?: string | null;
          p_photo_url?: string | null;
          p_media_url?: string | null;
          p_social_links?: Json;
        };
        Returns: Json;
      };
      admin_update_dj: {
        Args: {
          p_dj_id: string;
          p_stage_name: string;
          p_round_id?: string | null;
          p_real_name?: string | null;
          p_bio?: string | null;
          p_genre?: string | null;
          p_photo_url?: string | null;
          p_media_url?: string | null;
          p_social_links?: Json | null;
        };
        Returns: undefined;
      };
      admin_open_performance: {
        Args: { p_performance_id: string };
        Returns: undefined;
      };
      admin_close_performance: {
        Args: { p_performance_id: string };
        Returns: undefined;
      };
      admin_invalidate_score: {
        Args: { p_score_id: string; p_reason: string };
        Returns: undefined;
      };
      submit_public_score: {
        Args: {
          p_performance_id: string;
          p_voter_id: string;
          p_device_id: string;
          p_score: AllowedScore;
          p_ip_hash?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}

