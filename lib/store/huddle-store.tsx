"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { seedState } from "@/lib/data/seed"
import { scoreFit } from "@/lib/scoring/score-fit"
import { flagMessage } from "@/lib/safety/keywords"
import {
  bridgeAuthenticatedIdentity,
  type AuthenticatedIdentity,
} from "@/lib/store/profile-bridge"
import type {
  ActivityView,
  Category,
  ChatMessage,
  ComfortSize,
  Gender,
  HuddleActivity,
  HuddleProfile,
  HuddleState,
  RsvpStatus,
  SafetyFlag,
  SafetyPreference,
  StudentStatus,
  AvailabilityBlock,
} from "@/lib/types/huddle"

const STORAGE_KEY = "huddle.phase1.state.v1"

const ANONYMOUS_USER_ID = "anonymous"

/**
 * Screens type `currentProfile` as always present, so an unassociated viewer needs a
 * placeholder. It must never be a seeded student, otherwise a viewer without a verified
 * local association would be shown someone else's name, points, and activity.
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
  activities: ActivityView[]
  approvedActivities: ActivityView[]
  chatActivities: ActivityView[]
  pendingActivities: HuddleActivity[]
  bridgeAuthenticatedUser: (
    identity: AuthenticatedIdentity,
    requestedPath?: string | null
  ) => string
  clearLocalSession: () => void
  completeOnboarding: (input: OnboardingInput) => void
  updateProfile: (updates: Partial<HuddleProfile>) => void
  rsvpActivity: (activityId: string) => "going" | "waitlisted" | "full"
  leaveActivity: (activityId: string) => void
  createActivity: (input: CreateActivityInput) => HuddleActivity
  sendMessage: (activityId: string, body: string) => ChatMessage
  reportSafetyConcern: (context: string, reportedUserId?: string) => void
  resolveFlag: (flagId: string, status: SafetyFlag["status"]) => void
  reviewActivity: (activityId: string, status: "approved" | "rejected") => void
  addFriend: (friendId: string) => void
  resetDemo: () => void
}

const HuddleContext = createContext<HuddleContextValue | undefined>(undefined)

function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

function hydrateState(): HuddleState {
  if (typeof window === "undefined") {
    return seedState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return seedState
    }
    const parsed = JSON.parse(raw) as HuddleState
    return {
      ...seedState,
      ...parsed,
      locations: parsed.locations?.length ? parsed.locations : seedState.locations,
      activities: parsed.activities?.length ? parsed.activities : seedState.activities,
    }
  } catch {
    return seedState
  }
}

function buildActivityViews(state: HuddleState, currentUserId: string): ActivityView[] {
  const profile = state.profiles.find((item) => item.userId === currentUserId) ?? ANONYMOUS_PROFILE

  return state.activities
    .map((activity) => {
      const location = state.locations.find((item) => item.id === activity.locationId) ?? state.locations[0]
      const host = state.profiles.find((item) => item.userId === activity.hostId) ?? profile
      const rsvps = state.rsvps.filter((item) => item.activityId === activity.id && item.status === "going")
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
        userRsvp: state.rsvps.find((item) => item.activityId === activity.id && item.userId === currentUserId),
        fitScore: fit.total,
        sharedInterests: fit.sharedInterests,
      }
    })
    .filter((activity) => activity.fitScore >= 0)
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "approved" ? -1 : 1
      }
      return b.fitScore - a.fitScore || new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })
}

export function HuddleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HuddleState>(seedState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(hydrateState())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [hydrated, state])

  const currentUserId = state.session?.userId ?? ANONYMOUS_USER_ID
  const currentProfile =
    state.profiles.find((profile) => profile.userId === currentUserId) ?? ANONYMOUS_PROFILE

  const activities = useMemo(() => buildActivityViews(state, currentUserId), [state, currentUserId])
  const approvedActivities = useMemo(
  () => activities.filter((activity) => 
    activity.status === "approved" && new Date(activity.startTime) > new Date()
  ),
  [activities]
  )
  const chatActivities = useMemo(
  () => approvedActivities.filter((activity) => 
    activity.goingCount >= 2 && activity.userRsvp?.status === "going"
  ),
  [approvedActivities]
  )
  const pendingActivities = useMemo(
    () => state.activities.filter((activity) => activity.status === "pending"),
    [state.activities]
  )

  const bridgeAuthenticatedUser = useCallback((
    identity: AuthenticatedIdentity,
    requestedPath?: string | null
  ) => {
    const result = bridgeAuthenticatedIdentity(state, identity, requestedPath)
    setState(result.state)
    return result.destination
  }, [state])

  const clearLocalSession = useCallback(() => {
    setState((prev) => ({ ...prev, session: null }))
  }, [])

  const completeOnboarding = useCallback((input: OnboardingInput) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.userId === currentUserId
          ? {
              ...profile,
              ...input,
              displayName: `${input.firstName} ${input.lastInitial}.`,
              completedOnboarding: true,
            }
          : profile
      ),
    }))
  }, [currentUserId])

  const updateProfile = useCallback((updates: Partial<HuddleProfile>) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.userId === currentUserId ? { ...profile, ...updates } : profile
      ),
    }))
  }, [currentUserId])

  const rsvpActivity = useCallback((activityId: string) => {
    let result: "going" | "waitlisted" | "full" = "going"

    setState((prev) => {
      const activity = prev.activities.find((item) => item.id === activityId)
      if (!activity || activity.status !== "approved") {
        result = "full"
        return prev
      }

      const going = prev.rsvps.filter((item) => item.activityId === activityId && item.status === "going")
      const previous = prev.rsvps.find((item) => item.activityId === activityId && item.userId === currentUserId)
      const status = going.length >= activity.capacity && previous?.status !== "going" ? "waitlisted" : "going"
      result = status
      const timestamp = new Date().toISOString()
      const rsvps = previous
        ? prev.rsvps.map((item) =>
            item.activityId === activityId && item.userId === currentUserId
            ? { ...item, status: status as RsvpStatus, timestamp }
            : item
          )
          : [...prev.rsvps, { activityId, userId: currentUserId, status: status as RsvpStatus, timestamp }]
      const nextGoingCount = rsvps.filter((item) => item.activityId === activityId && item.status === "going").length
      const hasOpener = prev.messages.some((item) => item.activityId === activityId && item.userId === "system")
      const messages =
        status === "going" && nextGoingCount >= 2 && !hasOpener
          ? [
              ...prev.messages,
              {
                id: createId("msg"),
                activityId,
                userId: "system",
                body: `You are set for ${activity.title}. Use this chat for public meet-point logistics.`,
                createdAt: timestamp,
                flagged: false,
              },
            ]
          : prev.messages

      return { ...prev, rsvps, messages }
    })

    return result
  }, [currentUserId])

  const leaveActivity = useCallback((activityId: string) => {
    setState((prev) => ({
      ...prev,
      rsvps: prev.rsvps.map((item) =>
        item.activityId === activityId && item.userId === currentUserId
          ? { ...item, status: "left", timestamp: new Date().toISOString() }
          : item
      ),
    }))
  }, [currentUserId])

  const createActivity = useCallback((input: CreateActivityInput) => {
    const activity: HuddleActivity = {
      id: createId("activity"),
      ...input,
      hostId: currentUserId,
      source: "user",
      status: "pending",
      universityId: "umd",
      cohort: "umd-pilot",
      createdAt: new Date().toISOString(),
    }

    setState((prev) => ({
      ...prev,
      activities: [activity, ...prev.activities],
      flags: [
        {
          id: createId("flag"),
          type: "event",
          refId: activity.id,
          reason: "User-created activity pending checklist review.",
          status: "open",
          createdAt: new Date().toISOString(),
        },
        ...prev.flags,
      ],
    }))

    return activity
  }, [currentUserId])

  const sendMessage = useCallback((activityId: string, body: string) => {
    const scan = flagMessage(body)
    const message: ChatMessage = {
      id: createId("msg"),
      activityId,
      userId: currentUserId,
      body,
      createdAt: new Date().toISOString(),
      flagged: scan.flagged,
    }

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
      flags: scan.flagged
        ? [
            {
              id: createId("flag"),
              type: "chat",
              refId: message.id,
              reason: scan.reason ?? "Message matched a safety keyword.",
              status: "open",
              createdAt: message.createdAt,
            },
            ...prev.flags,
          ]
        : prev.flags,
    }))

    return message
  }, [currentUserId])

  const reportSafetyConcern = useCallback((context: string, reportedUserId?: string) => {
    setState((prev) => {
      const reportId = createId("report")
      return {
        ...prev,
        reports: [
          {
            id: reportId,
            reporterId: currentUserId,
            reportedUserId,
            context,
            status: "open",
            createdAt: new Date().toISOString(),
          },
          ...prev.reports,
        ],
        flags: [
          {
            id: createId("flag"),
            type: "report",
            refId: reportId,
            reason: context,
            status: "open",
            createdAt: new Date().toISOString(),
          },
          ...prev.flags,
        ],
      }
    })
  }, [currentUserId])

  const resolveFlag = useCallback((flagId: string, status: SafetyFlag["status"]) => {
    setState((prev) => ({
      ...prev,
      flags: prev.flags.map((flag) =>
        flag.id === flagId
          ? { ...flag, status, reviewer: "Safety owner", resolvedAt: new Date().toISOString() }
          : flag
      ),
    }))
  }, [])

  const reviewActivity = useCallback((activityId: string, status: "approved" | "rejected") => {
    setState((prev) => ({
      ...prev,
      activities: prev.activities.map((activity) =>
        activity.id === activityId ? { ...activity, status } : activity
      ),
      flags: prev.flags.map((flag) =>
        flag.type === "event" && flag.refId === activityId
          ? {
              ...flag,
              status: status === "approved" ? "dismissed" : "removed",
              reviewer: "Safety owner",
              resolvedAt: new Date().toISOString(),
            }
          : flag
      ),
    }))
  }, [])

  const addFriend = useCallback((friendId: string) => {
    setState((prev) => {
      if (prev.friends.some((item) => item.userId === currentUserId && item.friendId === friendId)) {
        return prev
      }
      return {
        ...prev,
        friends: [
          ...prev.friends,
          {
            id: createId("friend"),
            userId: currentUserId,
            friendId,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
      }
    })
  }, [currentUserId])

  const resetDemo = useCallback(() => {
    setState(seedState)
  }, [])

  const value = useMemo<HuddleContextValue>(
    () => ({
      state,
      hydrated,
      currentUserId,
      currentProfile,
      activities,
      approvedActivities,
      chatActivities,
      pendingActivities,
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
      resetDemo,
    }),
    [
      state,
      hydrated,
      currentUserId,
      currentProfile,
      activities,
      approvedActivities,
      chatActivities,
      pendingActivities,
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
      resetDemo,
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
