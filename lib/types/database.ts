export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          availability_block: Database["public"]["Enums"]["availability_block"]
          capacity: number
          category: Database["public"]["Enums"]["category"]
          cohort: string
          comfort_size: Database["public"]["Enums"]["comfort_size"]
          created_at: string
          description: string
          external_id: string | null
          external_url: string | null
          host_id: string | null
          id: string
          location_id: string
          safety_preference: Database["public"]["Enums"]["safety_preference"]
          source: Database["public"]["Enums"]["activity_source"]
          start_time: string
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          university_id: string
          updated_at: string
        }
        Insert: {
          availability_block: Database["public"]["Enums"]["availability_block"]
          capacity: number
          category: Database["public"]["Enums"]["category"]
          cohort?: string
          comfort_size?: Database["public"]["Enums"]["comfort_size"]
          created_at?: string
          description?: string
          external_id?: string | null
          external_url?: string | null
          host_id?: string | null
          id?: string
          location_id: string
          safety_preference?: Database["public"]["Enums"]["safety_preference"]
          source?: Database["public"]["Enums"]["activity_source"]
          start_time: string
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          university_id?: string
          updated_at?: string
        }
        Update: {
          availability_block?: Database["public"]["Enums"]["availability_block"]
          capacity?: number
          category?: Database["public"]["Enums"]["category"]
          cohort?: string
          comfort_size?: Database["public"]["Enums"]["comfort_size"]
          created_at?: string
          description?: string
          external_id?: string | null
          external_url?: string | null
          host_id?: string | null
          id?: string
          location_id?: string
          safety_preference?: Database["public"]["Enums"]["safety_preference"]
          source?: Database["public"]["Enums"]["activity_source"]
          start_time?: string
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_connections: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_connections_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          area: string
          created_at: string
          id: string
          name: string
          safety_note: string
          university_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id: string
          name: string
          safety_note: string
          university_id?: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          name?: string
          safety_note?: string
          university_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          activity_id: string
          body: string
          created_at: string
          flagged: boolean
          id: string
          is_system: boolean
          user_id: string | null
        }
        Insert: {
          activity_id: string
          body: string
          created_at?: string
          flagged?: boolean
          id?: string
          is_system?: boolean
          user_id?: string | null
        }
        Update: {
          activity_id?: string
          body?: string
          created_at?: string
          flagged?: boolean
          id?: string
          is_system?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          claim_expires_at: string | null
          claim_token: string | null
          claimed_at: string | null
          deliver_after: string
          id: string
          last_error_code: string | null
          notification_id: string
          sent_at: string | null
          state: Database["public"]["Enums"]["notification_delivery_state"]
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          deliver_after?: string
          id?: string
          last_error_code?: string | null
          notification_id: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notification_delivery_state"]
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          claim_expires_at?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          deliver_after?: string
          id?: string
          last_error_code?: string | null
          notification_id?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["notification_delivery_state"]
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_owner_fk"
            columns: ["notification_id", "user_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "notification_deliveries_subscription_owner_fk"
            columns: ["subscription_id", "user_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          activities_enabled: boolean
          chat_enabled: boolean
          created_at: string
          daily_push_cap: number
          digest_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminders_enabled: boolean
          rewards_enabled: boolean
          safety_enabled: boolean
          social_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activities_enabled?: boolean
          chat_enabled?: boolean
          created_at?: string
          daily_push_cap?: number
          digest_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminders_enabled?: boolean
          rewards_enabled?: boolean
          safety_enabled?: boolean
          social_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activities_enabled?: boolean
          chat_enabled?: boolean
          created_at?: string
          daily_push_cap?: number
          digest_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminders_enabled?: boolean
          rewards_enabled?: boolean
          safety_enabled?: boolean
          social_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_runtime_config: {
        Row: {
          created_at: string
          id: boolean
          notification_core_enabled: boolean
          push_enabled: boolean
          push_rollout_percentage: number
          rewards_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          notification_core_enabled?: boolean
          push_enabled?: boolean
          push_rollout_percentage?: number
          rewards_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          notification_core_enabled?: boolean
          push_enabled?: boolean
          push_rollout_percentage?: number
          rewards_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          data: Json
          dedupe_key: string
          id: string
          last_event_at: string
          read_at: string | null
          seen_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string
          user_id: string
        }
        Insert: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json
          dedupe_key: string
          id?: string
          last_event_at?: string
          read_at?: string | null
          seen_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string
          user_id: string
        }
        Update: {
          body?: string
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          data?: Json
          dedupe_key?: string
          id?: string
          last_event_at?: string
          read_at?: string | null
          seen_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability_blocks: Database["public"]["Enums"]["availability_block"][]
          avatar_url: string | null
          bio: string | null
          cohort: string
          comfort_size: Database["public"]["Enums"]["comfort_size"]
          completed_onboarding: boolean
          created_at: string | null
          display_name: string | null
          email: string
          first_name: string
          graduation_year: number | null
          id: string
          interests: Database["public"]["Enums"]["category"][]
          is_verified: boolean | null
          last_initial: string
          last_name: string
          major: string | null
          meetups_this_week: number
          minor: string | null
          photo_color: string
          points: number
          safety_preference: Database["public"]["Enums"]["safety_preference"]
          status: Database["public"]["Enums"]["student_status"]
          streak_days: number
          university_id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          availability_blocks?: Database["public"]["Enums"]["availability_block"][]
          avatar_url?: string | null
          bio?: string | null
          cohort?: string
          comfort_size?: Database["public"]["Enums"]["comfort_size"]
          completed_onboarding?: boolean
          created_at?: string | null
          display_name?: string | null
          email: string
          first_name: string
          graduation_year?: number | null
          id: string
          interests?: Database["public"]["Enums"]["category"][]
          is_verified?: boolean | null
          last_initial?: string
          last_name: string
          major?: string | null
          meetups_this_week?: number
          minor?: string | null
          photo_color?: string
          points?: number
          safety_preference?: Database["public"]["Enums"]["safety_preference"]
          status?: Database["public"]["Enums"]["student_status"]
          streak_days?: number
          university_id?: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          availability_blocks?: Database["public"]["Enums"]["availability_block"][]
          avatar_url?: string | null
          bio?: string | null
          cohort?: string
          comfort_size?: Database["public"]["Enums"]["comfort_size"]
          completed_onboarding?: boolean
          created_at?: string | null
          display_name?: string | null
          email?: string
          first_name?: string
          graduation_year?: number | null
          id?: string
          interests?: Database["public"]["Enums"]["category"][]
          is_verified?: boolean | null
          last_initial?: string
          last_name?: string
          major?: string | null
          meetups_this_week?: number
          minor?: string | null
          photo_color?: string
          points?: number
          safety_preference?: Database["public"]["Enums"]["safety_preference"]
          status?: Database["public"]["Enums"]["student_status"]
          streak_days?: number
          university_id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      pulses: {
        Row: {
          activity_id: string
          created_at: string
          did_meet: boolean
          id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          did_meet: boolean
          id?: string
          rating?: number | null
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          did_meet?: boolean
          id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          failure_count: number
          id: string
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_seen_at?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_seen_at?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          activity_id: string
          created_at: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_flags: {
        Row: {
          created_at: string
          id: string
          reason: string
          ref_id: string
          resolved_at: string | null
          reviewer: string | null
          status: Database["public"]["Enums"]["flag_status"]
          type: Database["public"]["Enums"]["flag_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          ref_id: string
          resolved_at?: string | null
          reviewer?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          type: Database["public"]["Enums"]["flag_type"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          ref_id?: string
          resolved_at?: string | null
          reviewer?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          type?: Database["public"]["Enums"]["flag_type"]
        }
        Relationships: []
      }
      safety_keywords: {
        Row: {
          created_at: string
          term: string
        }
        Insert: {
          created_at?: string
          term: string
        }
        Update: {
          created_at?: string
          term?: string
        }
        Relationships: []
      }
      safety_reports: {
        Row: {
          context: string
          created_at: string
          id: string
          reported_user_id: string | null
          reporter_id: string
          status: Database["public"]["Enums"]["flag_status"]
        }
        Insert: {
          context: string
          created_at?: string
          id?: string
          reported_user_id?: string | null
          reporter_id: string
          status?: Database["public"]["Enums"]["flag_status"]
        }
        Update: {
          context?: string
          created_at?: string
          id?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: Database["public"]["Enums"]["flag_status"]
        }
        Relationships: [
          {
            foreignKeyName: "safety_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_details: {
        Row: {
          academic_year: string | null
          college: string | null
          created_at: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          interests: string[] | null
          profile_id: string
          skills: string[] | null
          updated_at: string | null
        }
        Insert: {
          academic_year?: string | null
          college?: string | null
          created_at?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          interests?: string[] | null
          profile_id: string
          skills?: string[] | null
          updated_at?: string | null
        }
        Update: {
          academic_year?: string | null
          college?: string | null
          created_at?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          interests?: string[] | null
          profile_id?: string
          skills?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activity_match_score: {
        Args: { p_activity_id: string; p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["activity_match_score_result"]
        SetofOptions: {
          from: "*"
          to: "activity_match_score_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activity_match_score_at: {
        Args: { p_activity_id: string; p_now: string; p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["activity_match_score_result"]
        SetofOptions: {
          from: "*"
          to: "activity_match_score_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_view_activity: { Args: { p_activity_id: string }; Returns: boolean }
      claim_notification_deliveries: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: Database["public"]["CompositeTypes"]["notification_delivery_claim"][]
        SetofOptions: {
          from: "*"
          to: "notification_delivery_claim"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_notification_data: { Args: { p_now?: string }; Returns: Json }
      create_notification: {
        Args: {
          p_body: string
          p_data: Json
          p_dedupe_key: string
          p_last_event_at?: string
          p_reopen?: boolean
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_url: string
          p_user_id: string
        }
        Returns: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          data: Json
          dedupe_key: string
          id: string
          last_event_at: string
          read_at: string | null
          seen_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      disable_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      ensure_profile: {
        Args: never
        Returns: {
          availability_blocks: Database["public"]["Enums"]["availability_block"][]
          avatar_url: string | null
          bio: string | null
          cohort: string
          comfort_size: Database["public"]["Enums"]["comfort_size"]
          completed_onboarding: boolean
          created_at: string | null
          display_name: string | null
          email: string
          first_name: string
          graduation_year: number | null
          id: string
          interests: Database["public"]["Enums"]["category"][]
          is_verified: boolean | null
          last_initial: string
          last_name: string
          major: string | null
          meetups_this_week: number
          minor: string | null
          photo_color: string
          points: number
          safety_preference: Database["public"]["Enums"]["safety_preference"]
          status: Database["public"]["Enums"]["student_status"]
          streak_days: number
          university_id: string
          updated_at: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      huddle_derive_names: {
        Args: { p_email: string; p_full_name: string }
        Returns: Record<string, unknown>
      }
      is_activity_participant: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      is_safe_notification_path: { Args: { p_path: string }; Returns: boolean }
      is_safe_push_endpoint: { Args: { p_endpoint: string }; Returns: boolean }
      is_safety_owner: { Args: never; Returns: boolean }
      leave_activity: { Args: { p_activity_id: string }; Returns: undefined }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          data: Json
          dedupe_key: string
          id: string
          last_event_at: string
          read_at: string | null
          seen_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notification_category_for_type: {
        Args: { p_type: Database["public"]["Enums"]["notification_type"] }
        Returns: Database["public"]["Enums"]["notification_category"]
      }
      notification_deliver_after: {
        Args: {
          p_end: string
          p_now: string
          p_start: string
          p_timezone: string
        }
        Returns: string
      }
      notification_operations_summary: { Args: never; Returns: Json }
      notification_push_allowed: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"]
          p_now: string
          p_user_id: string
        }
        Returns: boolean
      }
      notification_rollout_eligible: {
        Args: { p_percentage: number; p_user_id: string }
        Returns: boolean
      }
      produce_activity_match_digests: {
        Args: { p_now?: string }
        Returns: Database["public"]["CompositeTypes"]["notification_producer_result"]
        SetofOptions: {
          from: "*"
          to: "notification_producer_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      produce_event_reminders: {
        Args: { p_now?: string }
        Returns: Database["public"]["CompositeTypes"]["notification_producer_result"]
        SetofOptions: {
          from: "*"
          to: "notification_producer_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      produce_pulse_prompts: {
        Args: { p_now?: string }
        Returns: Database["public"]["CompositeTypes"]["notification_producer_result"]
        SetofOptions: {
          from: "*"
          to: "notification_producer_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      produce_weekly_recaps: {
        Args: { p_now?: string }
        Returns: Database["public"]["CompositeTypes"]["notification_producer_result"]
        SetofOptions: {
          from: "*"
          to: "notification_producer_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_notification_delivery_result: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_error_code?: string
          p_http_status: number
        }
        Returns: Database["public"]["Enums"]["notification_delivery_state"]
      }
      request_push_dispatch: { Args: never; Returns: Json }
      resolve_flag: {
        Args: {
          p_flag_id: string
          p_status: Database["public"]["Enums"]["flag_status"]
        }
        Returns: {
          created_at: string
          id: string
          reason: string
          ref_id: string
          resolved_at: string | null
          reviewer: string | null
          status: Database["public"]["Enums"]["flag_status"]
          type: Database["public"]["Enums"]["flag_type"]
        }
        SetofOptions: {
          from: "*"
          to: "safety_flags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_activity: {
        Args: {
          p_activity_id: string
          p_status: Database["public"]["Enums"]["activity_status"]
        }
        Returns: {
          availability_block: Database["public"]["Enums"]["availability_block"]
          capacity: number
          category: Database["public"]["Enums"]["category"]
          cohort: string
          comfort_size: Database["public"]["Enums"]["comfort_size"]
          created_at: string
          description: string
          external_id: string | null
          external_url: string | null
          host_id: string | null
          id: string
          location_id: string
          safety_preference: Database["public"]["Enums"]["safety_preference"]
          source: Database["public"]["Enums"]["activity_source"]
          start_time: string
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          university_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rsvp_activity: {
        Args: { p_activity_id: string }
        Returns: Database["public"]["Enums"]["rsvp_status"]
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          failure_count: number
          id: string
          last_seen_at: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_pulse_response: {
        Args: { p_activity_id: string; p_did_meet: boolean; p_rating?: number }
        Returns: {
          activity_id: string
          created_at: string
          did_meet: boolean
          id: string
          rating: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pulses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      try_create_notification: {
        Args: {
          p_body: string
          p_data: Json
          p_dedupe_key: string
          p_last_event_at?: string
          p_reopen?: boolean
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_url: string
          p_user_id: string
        }
        Returns: boolean
      }
      update_notification_preferences: {
        Args: {
          p_activities_enabled: boolean
          p_chat_enabled: boolean
          p_daily_push_cap: number
          p_digest_enabled: boolean
          p_push_enabled: boolean
          p_quiet_hours_end: string
          p_quiet_hours_start: string
          p_reminders_enabled: boolean
          p_rewards_enabled: boolean
          p_safety_enabled: boolean
          p_social_enabled: boolean
          p_timezone: string
        }
        Returns: {
          activities_enabled: boolean
          chat_enabled: boolean
          created_at: string
          daily_push_cap: number
          digest_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminders_enabled: boolean
          rewards_enabled: boolean
          safety_enabled: boolean
          social_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      activity_source: "seeded" | "org" | "user"
      activity_status: "draft" | "pending" | "approved" | "rejected"
      availability_block:
        | "weekday_morning"
        | "weekday_afternoon"
        | "weekday_evening"
        | "weekend_morning"
        | "weekend_afternoon"
        | "weekend_evening"
      category:
        | "study"
        | "coffee"
        | "outdoors"
        | "fitness"
        | "games"
        | "arts"
        | "faith"
        | "language"
        | "volunteering"
        | "hangout"
        | "sports"
      comfort_size: "small" | "medium" | "either"
      flag_status: "open" | "dismissed" | "warned" | "removed" | "frozen"
      flag_type: "chat" | "event" | "report"
      gender:
        | "male"
        | "female"
        | "transgender_woman"
        | "transgender_man"
        | "lesbian"
        | "gay"
        | "bisexual"
        | "non_binary"
        | "prefer_not_to_say"
      notification_category:
        | "chat"
        | "activities"
        | "reminders"
        | "social"
        | "safety"
        | "digest"
        | "rewards"
      notification_delivery_state:
        | "pending"
        | "deferred"
        | "processing"
        | "sent"
        | "failed"
        | "skipped"
      notification_type:
        | "chat_message"
        | "chat_opened"
        | "activity_joined"
        | "activity_approved"
        | "activity_rejected"
        | "event_reminder_24h"
        | "event_reminder_1h"
        | "waitlist_promoted"
        | "pulse_prompt"
        | "friend_request"
        | "friend_accepted"
        | "friend_rsvp"
        | "safety_review"
        | "safety_report_status"
        | "activity_match_digest"
        | "weekly_recap"
        | "streak_at_risk"
        | "points_milestone"
        | "badge_unlocked"
        | "leaderboard_placement"
      rsvp_status: "going" | "waitlisted" | "left"
      safety_preference: "none" | "mixed" | "women_only" | "same_gender"
      student_status:
        | "undergrad_1"
        | "undergrad_2"
        | "undergrad_3"
        | "undergrad_4"
        | "masters"
        | "phd"
        | "postdoc"
        | "other"
    }
    CompositeTypes: {
      activity_match_score_result: {
        total: number | null
        eligible: boolean | null
      }
      notification_delivery_claim: {
        delivery_id: string | null
        claim_token: string | null
        notification_id: string | null
        user_id: string | null
        subscription_id: string | null
        endpoint: string | null
        p256dh: string | null
        auth: string | null
        title: string | null
        body: string | null
        url: string | null
        type: Database["public"]["Enums"]["notification_type"] | null
        category: Database["public"]["Enums"]["notification_category"] | null
        unread_badge_count: number | null
        attempt_count: number | null
      }
      notification_producer_result: {
        scanned: number | null
        created: number | null
        deduped: number | null
        failed: number | null
        skipped: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_source: ["seeded", "org", "user"],
      activity_status: ["draft", "pending", "approved", "rejected"],
      availability_block: [
        "weekday_morning",
        "weekday_afternoon",
        "weekday_evening",
        "weekend_morning",
        "weekend_afternoon",
        "weekend_evening",
      ],
      category: [
        "study",
        "coffee",
        "outdoors",
        "fitness",
        "games",
        "arts",
        "faith",
        "language",
        "volunteering",
        "hangout",
        "sports",
      ],
      comfort_size: ["small", "medium", "either"],
      flag_status: ["open", "dismissed", "warned", "removed", "frozen"],
      flag_type: ["chat", "event", "report"],
      gender: [
        "male",
        "female",
        "transgender_woman",
        "transgender_man",
        "lesbian",
        "gay",
        "bisexual",
        "non_binary",
        "prefer_not_to_say",
      ],
      notification_category: [
        "chat",
        "activities",
        "reminders",
        "social",
        "safety",
        "digest",
        "rewards",
      ],
      notification_delivery_state: [
        "pending",
        "deferred",
        "processing",
        "sent",
        "failed",
        "skipped",
      ],
      notification_type: [
        "chat_message",
        "chat_opened",
        "activity_joined",
        "activity_approved",
        "activity_rejected",
        "event_reminder_24h",
        "event_reminder_1h",
        "waitlist_promoted",
        "pulse_prompt",
        "friend_request",
        "friend_accepted",
        "friend_rsvp",
        "safety_review",
        "safety_report_status",
        "activity_match_digest",
        "weekly_recap",
        "streak_at_risk",
        "points_milestone",
        "badge_unlocked",
        "leaderboard_placement",
      ],
      rsvp_status: ["going", "waitlisted", "left"],
      safety_preference: ["none", "mixed", "women_only", "same_gender"],
      student_status: [
        "undergrad_1",
        "undergrad_2",
        "undergrad_3",
        "undergrad_4",
        "masters",
        "phd",
        "postdoc",
        "other",
      ],
    },
  },
} as const

export type Profile = Tables<"profiles">
export type StudentDetails = Tables<"student_details">
export type LocationRow = Tables<"locations">
export type ActivityRow = Tables<"activities">
export type RsvpRow = Tables<"rsvps">
export type MessageRow = Tables<"messages">
export type SafetyFlagRow = Tables<"safety_flags">
export type SafetyReportRow = Tables<"safety_reports">
export type PulseRow = Tables<"pulses">
export type FriendConnectionRow = Tables<"friend_connections">
export type NotificationRow = Tables<"notifications">
export type NotificationPreferenceRow = Tables<"notification_preferences">
export type PushSubscriptionRow = Tables<"push_subscriptions">
export type NotificationRuntimeConfigRow = Tables<"notification_runtime_config">

// The browser only ever receives the columns granted to the authenticated role, so email
// is never present on a profile read from the client.
export type PublicProfile = Omit<Profile, "email">
