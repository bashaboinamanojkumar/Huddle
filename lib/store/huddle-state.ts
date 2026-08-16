import type {
  ChatMessage,
  FriendConnection,
  HuddleActivity,
  HuddleProfile,
  HuddleRsvp,
  HuddleState,
  SafetyFlag,
  SafetyReport,
} from "@/lib/types/huddle"

function upsertBy<T>(items: T[], item: T, key: (value: T) => string): T[] {
  const itemKey = key(item)
  const index = items.findIndex((value) => key(value) === itemKey)
  if (index < 0) return [...items, item]
  const next = [...items]
  next[index] = item
  return next
}

export const mergeProfiles = (
  state: HuddleState,
  profile: HuddleProfile,
): HuddleState => ({
  ...state,
  profiles: upsertBy(state.profiles, profile, ({ userId }) => userId),
})

export const mergeActivities = (
  state: HuddleState,
  activity: HuddleActivity,
): HuddleState => ({
  ...state,
  activities: upsertBy(state.activities, activity, ({ id }) => id),
})

export const mergeRsvp = (
  state: HuddleState,
  rsvp: HuddleRsvp,
): HuddleState => ({
  ...state,
  rsvps: upsertBy(
    state.rsvps,
    rsvp,
    ({ activityId, userId }) => `${activityId}:${userId}`,
  ),
})

export const removeRsvp = (
  state: HuddleState,
  activityId: string,
  userId: string,
): HuddleState => ({
  ...state,
  rsvps: state.rsvps.filter(
    (item) => item.activityId !== activityId || item.userId !== userId,
  ),
})

export const mergeMessages = (
  state: HuddleState,
  message: ChatMessage,
): HuddleState => ({
  ...state,
  messages: upsertBy(state.messages, message, ({ id }) => id),
})

export const mergeFlags = (
  state: HuddleState,
  flag: SafetyFlag,
): HuddleState => ({
  ...state,
  flags: upsertBy(state.flags, flag, ({ id }) => id),
})

export const mergeReports = (
  state: HuddleState,
  report: SafetyReport,
): HuddleState => ({
  ...state,
  reports: upsertBy(state.reports, report, ({ id }) => id),
})

export const mergeFriends = (
  state: HuddleState,
  friend: FriendConnection,
): HuddleState => ({
  ...state,
  friends: upsertBy(state.friends, friend, ({ id }) => id),
})

export const removeFriend = (
  state: HuddleState,
  connectionId: string,
): HuddleState => ({
  ...state,
  friends: state.friends.filter(({ id }) => id !== connectionId),
})
