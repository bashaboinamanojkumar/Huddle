"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, StudentDetails } from "@/lib/types/database"

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    async function fetchProfile() {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()

        if (profileError) throw profileError
        setProfile(profileData)

        const { data: studentData, error: studentError } = await supabase
          .from("student_details")
          .select("*")
          .eq("profile_id", userId)
          .single()

        if (studentError) {
          if (studentError.code !== "PGRST116") throw studentError
          // PGRST116 = no rows returned, which is fine for new users
        } else {
          setStudentDetails(studentData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [userId])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!userId) return
    const supabase = createClient()
    const { error: err } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
    if (err) throw err
    setProfile((prev) => (prev ? { ...prev, ...updates } : null))
  }, [userId])

  const updateStudentDetails = useCallback(async (updates: Partial<StudentDetails>) => {
    if (!userId) return
    const supabase = createClient()
    const { error: err } = await supabase
      .from("student_details")
      .upsert({ profile_id: userId, ...updates }, { onConflict: "profile_id" })
    if (err) throw err
    setStudentDetails((prev) => (prev ? { ...prev, ...updates } : { ...updates, profile_id: userId } as StudentDetails))
  }, [userId])

  return { profile, studentDetails, loading, error, updateProfile, updateStudentDetails }
}
