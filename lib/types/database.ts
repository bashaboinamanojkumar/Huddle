export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          username: string | null
          avatar_url: string | null
          bio: string | null
          graduation_year: number | null
          major: string | null
          minor: string | null
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name: string
          last_name: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          graduation_year?: number | null
          major?: string | null
          minor?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          graduation_year?: number | null
          major?: string | null
          minor?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      student_details: {
        Row: {
          id: string
          profile_id: string
          college: string | null
          academic_year: "Freshman" | "Sophomore" | "Junior" | "Senior" | "Graduate" | "PhD" | null
          skills: string[] | null
          interests: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          college?: string | null
          academic_year?: "Freshman" | "Sophomore" | "Junior" | "Senior" | "Graduate" | "PhD" | null
          skills?: string[] | null
          interests?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          college?: string | null
          academic_year?: "Freshman" | "Sophomore" | "Junior" | "Senior" | "Graduate" | "PhD" | null
          skills?: string[] | null
          interests?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type StudentDetails = Database["public"]["Tables"]["student_details"]["Row"]
