"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { normalizeCampusEmail, normalizeReturnPath } from "@/lib/auth/policy"
import { scoreFit } from "@/lib/scoring/score-fit"
import { createClient } from "@/lib/supabase/client"
import { toChatMessage } from "@/lib/supabase/mappers"
import * as mutations from "@/lib/supabase/mutations"
import { ensureProfile, fetchHuddleSnapshot } from "@/lib/supabase/queries"
import type { MessageRow } from "@/lib/types/database"
import type {
  ActivityView,
  Category,
  ChatMessage,
  ComfortSize,
  Gender,
  HuddleActivity,
  HuddleProfile,
  HuddleState,
  SafetyFlag,
  SafetyPreference,
  StudentStatus,
  UniversityId,
  AvailabilityBlock,
} from "@/lib/types/huddle"

const ANONYMOUS_USER_ID = "anonymous"

/** The pilot campus, used until a session tells us which school the viewer belongs to. */
const DEFAULT_UNIVERSITY_ID: UniversityId = "umd"

/**
 * The local session marker is presentation state that outlives the short-lived access
 * token. The Supabase cookie remains the actual security boundary.
 */
const SESSION_DAYS = 30

/**
 * Screens type `currentProfile` as always present, so an unassociated viewer needs a
 * placeholder. It must never be a real student, otherwise a viewer without a verified
 * association would be shown someone else's name, points, and activity.
 */
const ANONYMOUS_PROFILE: HuddleProfile = {
  userId: ANONYMOUS_USER_ID,
  displayName: "Guest",
  firstName: "Guest",
  lastInitial: "",
  status: "other",
  interests: [],
  availabilityBlocks: [],
  comfortSize: "either",
  safetyPreference: "none",
  photoColor: "#3a3f4b",
  points: 0,
  streakDays: 0,
  meetupsThisWeek: 0,
  completedOnboarding: false,
}

const EMPTY_STATE: HuddleState = {
  session: null,
  profiles: [],
  locations: [],
  activities: [],
  rsvps: [],
  messages: [],
  flags: [],
  reports: [],
  pulses: [],
  friends: [],
}

export interface AuthenticatedIdentity {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
}

export interface OnboardingInput {
  firstName: string
  lastInitial: string
  status: StudentStatus
  gender?: Gender
  interests: Category[]
  availabilityBlocks: AvailabilityBlock[]
  comfortSize: ComfortSize
  safetyPreference: SafetyPreference
}

export interface CreateActivityInput {
  title: string
  description: string
  category: Category
  locationId: string
  capacity: number
  startTime: string
  availabilityBlock: AvailabilityBlock
  comfortSize: ComfortSize
  safetyPreference: SafetyPreference
}

interface HuddleContextValue {
  state: HuddleState
  hydrated: boolean
  currentUserId: string
  currentProfile: HuddleProfile
  universityId: UniversityId
  activities: ActivityView[]
  approvedActivities: ActivityView[]
  chatActivities: ActivityView[]
  pendingActivities: HuddleActivity[]
  refresh: () => Promise<void>
  bridgeAuthenticatedUser: (
    identity: AuthenticatedIdentity,
    requestedPath?: string | null
  ) => Promise<string>
  clearLocalSession: () => void
  completeOnboarding: (input: OnboardingInput) => Promise<void>
  updateProfile: (updates: Partial<HuddleProfile>) => Promise<void>
  rsvpActivity: (activityId: string) => Promise<mutations.RsvpOutcome>
  leaveActivity: (activityId: string) => Promise<void>
  createActivity: (input: CreateActivityInput) => Promise<HuddleActivity>
  sendMessage: (activityId: string, body: string) => Promise<ChatMessage>
  reportSafetyConcern: (context: string, reportedUserId?: string) => Promise<void>
  resolveFlag: (flagId: string, status: SafetyFlag["status"]) => Promise<void>
  reviewActivity: (
    activityId: string,
    status: "approved" | "rejected"
  ) => Promise<void>
  addFriend: (friendId: string) => Promise<void>
  acceptFriend: (connectionId: string) => Promise<void>
  declineFriend: (connectionId: string) => Promise<void>
}

const HuddleContext = createContext<HuddleContextValue | undefined>(undefined)

function addDays(date: Date, days: number): string {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result.toISOString()
}

function universityFor(email: string): UniversityId {
  return email.endsWith("@umaryland.edu") ? "umb" : "umd"
}

function buildActivityViews(state: HuddleState, currentUserId: string): ActivityView[] {
  const profile =
    state.profiles.find((item) => item.userId === currentUserId) ?? ANONYMOUS_PROFILE

  return state.activities
    .map((activity) => {
      const location =
        state.locations.find((item) => item.id === activity.locationId) ?? state.locations[0]
      // Org listings have no Huddle host, so this stays null rather than pretending
      // someone owns the event.
      const host = state.profiles.find((item) => item.userId === activity.hostId) ?? null
      const rsvps = state.rsvps.filter(
        (item) => item.activityId === activity.id && item.status === "going"
      )
      const attendees = rsvps
        .map((rsvp) => state.profiles.find((item) => item.userId === rsvp.userId))
        .filter((item): item is HuddleProfile => Boolean(item))
        .map((item) => ({
          userId: item.userId,
          displayName: item.displayName,
          photoColor: item.photoColor,
        }))
      const fit = scoreFit(profile, activity)

      return {
        ...activity,
        location,
        host,
        attendees,
        goingCount: rsvps.length,
        seatsLeft: Math.max(activity.capacity - rsvps.length, 0),
        userRsvp: state.rsvps.find(
          (item) => item.activityId === activity.id && item.userId === currentUserId
        ),
        fitScore: fit.total,
        sharedInterests: fit.sharedInterests,
      }
    })
    .filter((activity) => activity.fitScore >= 0 && Boolean(activity.location))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "approved" ? -1 : 1
      }
      return (
        b.fitScore - a.fitScore ||
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
    })
}

export function HuddleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HuddleState>(EMPTY_STATE)
  const [hydrated, setHydrated] = useState(false)
  const sessionUserId = state.session?.userId ?? null
  const loadedFor = useRef<string | null>(null)

  const load = useCallback(async (identity: AuthenticatedIdentity) => {
    const supabase = createClient()
    const email = normalizeCampusEmail(identity.email) ?? identity.email

    await ensureProfile(supabase)
    const snapshot = await fetchHuddleSnapshot(supabase, identity.id)

    loadedFor.current = identity.id
    setState({
      ...snapshot,
      session: {
        userId: identity.id,
        email,
        expiresAt: addDays(new Date(), SESSION_DAYS),
        universityId: universityFor(email),
      },
    })

    return (
      snapshot.profiles.find((profile) => profile.userId === identity.id) ??
      ANONYMOUS_PROFILE
    )
  }, [])

  const refresh = useCallback(async () => {
    const userId = loadedFor.current
    if (!userId) {
      return
    }

    const supabase = createClient()
    const snapshot = await fetchHuddleSnapshot(supabase, userId)
    setState((prev) => ({ ...snapshot, session: prev.session }))
  }, [])

  // Restores the signed-in view on a hard refresh, so protected pages do not have to wait
  // for SessionGuard to adopt the session before they have data.
  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!active || !user?.email) {
          return
        }

        await load({ id: user.id, email: user.email })
      } catch {
        // A failed bootstrap leaves the store empty; SessionGuard decides what to show.
      } finally {
        if (active) {
          setHydrated(true)
        }
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [load])

  // Chat is the only surface that needs to update without a navigation. Realtime respects
  // RLS, so only threads this student has joined ever reach the client.
  useEffect(() => {
    if (!sessionUserId) {
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`huddle-messages-${sessionUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = toChatMessage(payload.new as MessageRow)
          setState((prev) =>
            prev.messages.some((item) => item.id === message.id)
              ? prev
              : { ...prev, messages: [...prev.messages, message] }
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionUserId])

  const currentUserId = sessionUserId ?? ANONYMOUS_USER_ID
  const currentProfile =
    state.profiles.find((profile) => profile.userId === currentUserId) ?? ANONYMOUS_PROFILE

  const activities = useMemo(
    () => buildActivityViews(state, currentUserId),
    [state, currentUserId]
  )
  const universityId = state.session
    ? universityFor(state.session.email)
    : DEFAULT_UNIVERSITY_ID
  const approvedActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.status === "approved" &&
          activity.universityId === universityId &&
          new Date(activity.startTime) > new Date()
      ),
    [activities, universityId]
  )
  const chatActivities = useMemo(
    () =>
      approvedActivities.filter(
        (activity) => activity.goingCount >= 2 && activity.userRsvp?.status === "going"
      ),
    [approvedActivities]
  )
  const pendingActivities = useMemo(
    () => state.activities.filter((activity) => activity.status === "pending"),
    [state.activities]
  )

  const bridgeAuthenticatedUser = useCallback(
    async (identity: AuthenticatedIdentity, requestedPath?: string | null) => {
      const profile = await load(identity)
      return profile.completedOnboarding
        ? normalizeReturnPath(requestedPath)
        : "/onboarding"
    },
    [load]
  )

  const clearLocalSession = useCallback(() => {
    loadedFor.current = null
    setState(EMPTY_STATE)
  }, [])

  const requireUser = useCallback(() => {
    if (!sessionUserId) {
      throw new Error("You need to be signed in to do that.")
    }
    return sessionUserId
  }, [sessionUserId])

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      const supabase = createClient()
      await mutations.completeOnboarding(supabase, requireUser(), input)
      await refresh()
    },
    [refresh, requireUser]
  )

  const updateProfile = useCallback(
    async (updates: Partial<HuddleProfile>) => {
      const supabase = createClient()
      await mutations.updateProfile(supabase, requireUser(), updates)
      await refresh()
    },
    [refresh, requireUser]
  )

  const rsvpActivity = useCallback(
    async (activityId: string) => {
      const supabase = createClient()
      requireUser()
      const outcome = await mutations.rsvpActivity(supabase, activityId)
      await refresh()
      return outcome
    },
    [refresh, requireUser]
  )

  const leaveActivity = useCallback(
    async (activityId: string) => {
      const supabase = createClient()
      requireUser()
      await mutations.leaveActivity(supabase, activityId)
      await refresh()
    },
    [refresh, requireUser]
  )

  const createActivity = useCallback(
    async (input: CreateActivityInput) => {
      const supabase = createClient()
      const userId = requireUser()
      const activity = await mutations.createActivity(
        supabase,
        userId,
        state.session?.universityId ?? "umd",
        input
      )
      await refresh()
      return activity
    },
    [refresh, requireUser, state.session?.universityId]
  )

  const sendMessage = useCallback(
    async (activityId: string, body: string) => {
      const supabase = createClient()
      const message = await mutations.sendMessage(
        supabase,
        activityId,
        requireUser(),
        body
      )

      setState((prev) =>
        prev.messages.some((item) => item.id === message.id)
          ? prev
          : { ...prev, messages: [...prev.messages, message] }
      )

      return message
    },
    [requireUser]
  )

  const reportSafetyConcern = useCallback(
    async (context: string, reportedUserId?: string) => {
      const supabase = createClient()
      await mutations.reportSafetyConcern(
        supabase,
        requireUser(),
        context,
        reportedUserId
      )
      await refresh()
    },
    [refresh, requireUser]
  )

  const resolveFlag = useCallback(
    async (flagId: string, status: SafetyFlag["status"]) => {
      const supabase = createClient()
      await mutations.resolveFlag(supabase, flagId, status)
      await refresh()
    },
    [refresh]
  )

  const reviewActivity = useCallback(
    async (activityId: string, status: "approved" | "rejected") => {
      const supabase = createClient()
      await mutations.reviewActivity(supabase, activityId, status)
      await refresh()
    },
    [refresh]
  )

  const addFriend = useCallback(
    async (friendId: string) => {
      const supabase = createClient()
      const connection = await mutations.addFriend(supabase, requireUser(), friendId)

      if (connection) {
        setState((prev) => ({ ...prev, friends: [...prev.friends, connection] }))
      }
    },
    [requireUser]
  )

  const acceptFriend = useCallback(
    async (connectionId: string) => {
      const supabase = createClient()
      await mutations.acceptFriend(supabase, connectionId)
      await refresh()
    },
    [refresh]
  )


  
  const declineFriend = useCallback(
    async (connectionId: string) => {
      const supabase = createClient()
      await mutations.declineFriend(supabase, connectionId)
      await refresh()
    },
    [refresh]
  )

  const value = useMemo<HuddleContextValue>(
    () => ({
      state,
      hydrated,
      currentUserId,
      currentProfile,
      universityId,
      activities,
      approvedActivities,
      chatActivities,
      pendingActivities,
      refresh,
      bridgeAuthenticatedUser,
      clearLocalSession,
      completeOnboarding,
      updateProfile,
      rsvpActivity,
      leaveActivity,
      createActivity,
      sendMessage,
      reportSafetyConcern,
      resolveFlag,
      reviewActivity,
      addFriend,
      acceptFriend,
      declineFriend,
    }),
    [
      state,
      hydrated,
      currentUserId,
      currentProfile,
      universityId,
      activities,
      approvedActivities,
      chatActivities,
      pendingActivities,
      refresh,
      bridgeAuthenticatedUser,
      clearLocalSession,
      completeOnboarding,
      updateProfile,
      rsvpActivity,
      leaveActivity,
      createActivity,
      sendMessage,
      reportSafetyConcern,
      resolveFlag,
      reviewActivity,
      addFriend,
      acceptFriend,
      declineFriend,
    ]
  )

  return <HuddleContext.Provider value={value}>{children}</HuddleContext.Provider>
}

export function useHuddle() {
  const context = useContext(HuddleContext)
  if (!context) {
    throw new Error("useHuddle must be used inside HuddleProvider")
  }
  return context
}
