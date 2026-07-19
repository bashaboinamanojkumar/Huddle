export type CampusDomain = "umd.edu" | "umaryland.edu"

export type UniversityId = "umd" | "umb"

export type Category =
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

export type AvailabilityBlock =
  | "weekday_morning"
  | "weekday_afternoon"
  | "weekday_evening"
  | "weekend_morning"
  | "weekend_afternoon"
  | "weekend_evening"

export type StudentStatus =
  | "undergrad_1"
  | "undergrad_2"
  | "undergrad_3"
  | "undergrad_4"
  | "masters"
  | "phd"
  | "postdoc"
  | "other"

export type Gender = "male" | "female" | "transgender_woman" | "transgender_man" | "lesbian" | "gay" | "bisexual" | "non_binary" | "prefer_not_to_say"
export type ComfortSize = "small" | "medium" | "either"
export type SafetyPreference = "none" | "mixed" | "women_only" | "same_gender"
export type ActivitySource = "seeded" | "org" | "user"
export type ActivityStatus = "draft" | "pending" | "approved" | "rejected"
export type RsvpStatus = "going" | "waitlisted" | "left"
export type FlagType = "chat" | "event" | "report"
export type FlagStatus = "open" | "dismissed" | "warned" | "removed" | "frozen"

export interface HuddleSession {
  userId: string
  email: string
  expiresAt: string
  universityId: UniversityId
}

export interface WaitlistEntry {
  email: string
  createdAt: string
}

export interface HuddleUser {
  id: string
  email: string
  universityId: UniversityId
  cohort: string
  createdAt: string
}

export interface HuddleProfile {
  userId: string
  displayName: string
  firstName: string
  lastInitial: string
  status: StudentStatus
  gender?: Gender
  interests: Category[]
  availabilityBlocks: AvailabilityBlock[]
  comfortSize: ComfortSize
  safetyPreference: SafetyPreference
  avatarUrl?: string
  photoColor: string
  points: number
  streakDays: number
  meetupsThisWeek: number
  completedOnboarding: boolean
}

export interface HuddleLocation {
  id: string
  universityId: UniversityId
  name: string
  area: string
  safetyNote: string
}

export interface ActivityAttendee {
  userId: string
  displayName: string
  photoColor: string
}

export interface HuddleActivity {
  id: string
  title: string
  description: string
  category: Category
  locationId: string
  hostId: string
  capacity: number
  startTime: string
  availabilityBlock: AvailabilityBlock
  source: ActivitySource
  status: ActivityStatus
  universityId: UniversityId
  cohort: string
  comfortSize: ComfortSize
  safetyPreference: SafetyPreference
  createdAt: string
}

export interface HuddleRsvp {
  activityId: string
  userId: string
  status: RsvpStatus
  timestamp: string
}

export interface ChatMessage {
  id: string
  activityId: string
  userId: string
  body: string
  createdAt: string
  flagged: boolean
}

export interface SafetyFlag {
  id: string
  type: FlagType
  refId: string
  reason: string
  status: FlagStatus
  reviewer?: string
  createdAt: string
  resolvedAt?: string
}

export interface SafetyReport {
  id: string
  reporterId: string
  reportedUserId?: string
  context: string
  status: FlagStatus
  createdAt: string
}

export interface Pulse {
  id: string
  activityId: string
  userId: string
  didMeet: boolean
  rating?: number
  createdAt: string
}

export interface FriendConnection {
  id: string
  userId: string
  friendId: string
  status: "accepted" | "pending"
  createdAt: string
}

export interface CategoryMeta {
  id: Category
  label: string
  shortLabel: string
  icon: string
  color: string
}

export interface AvailabilityMeta {
  id: AvailabilityBlock
  label: string
  shortLabel: string
}

export interface HuddleState {
  session: HuddleSession | null
  users: HuddleUser[]
  profiles: HuddleProfile[]
  locations: HuddleLocation[]
  activities: HuddleActivity[]
  rsvps: HuddleRsvp[]
  messages: ChatMessage[]
  flags: SafetyFlag[]
  reports: SafetyReport[]
  pulses: Pulse[]
  friends: FriendConnection[]
  waitlist: WaitlistEntry[]
}

export interface ActivityView extends HuddleActivity {
  location: HuddleLocation
  host: HuddleProfile
  attendees: ActivityAttendee[]
  goingCount: number
  seatsLeft: number
  userRsvp?: HuddleRsvp
  fitScore: number
  sharedInterests: Category[]
}
