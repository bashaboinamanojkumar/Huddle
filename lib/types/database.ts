// Generated from the live Supabase schema. Regenerate after every migration rather than
// editing by hand.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
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
      can_view_activity: { Args: { p_activity_id: string }; Returns: boolean }
      ensure_profile: {
        Args: never
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      huddle_derive_names: {
        Args: { p_email: string; p_full_name: string }
        Returns: Record<string, unknown>
      }
      is_activity_participant: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      is_safety_owner: { Args: never; Returns: boolean }
      leave_activity: { Args: { p_activity_id: string }; Returns: undefined }
      resolve_flag: {
        Args: {
          p_flag_id: string
          p_status: Database["public"]["Enums"]["flag_status"]
        }
        Returns: Database["public"]["Tables"]["safety_flags"]["Row"]
      }
      review_activity: {
        Args: {
          p_activity_id: string
          p_status: Database["public"]["Enums"]["activity_status"]
        }
        Returns: Database["public"]["Tables"]["activities"]["Row"]
      }
      rsvp_activity: {
        Args: { p_activity_id: string }
        Returns: Database["public"]["Enums"]["rsvp_status"]
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
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]

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

// The browser only ever receives the columns granted to the authenticated role, so email
// is never present on a profile read from the client.
export type PublicProfile = Omit<Profile, "email">
