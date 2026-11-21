// lib/terplink/adapter.ts
// Adapter for TerpLink's undocumented public JSON endpoint.
// All coupling to the external API shape is isolated here.
// If the endpoint changes, only this file needs updating.

const TERPLINK_BASE_URL =
  'https://terplink.umd.edu/api/discovery/event/search'

// ─── TerpLink API types ───────────────────────────────────────────────────────

interface TerpLinkEvent {
  id: string
  name: string
  description: string
  organizationName: string
  location: string
  startsOn: string       // ISO 8601 with offset
  endsOn: string
  theme: string
  categoryNames: string[]
  benefitNames: string[]
  latitude: string | null
  longitude: string | null
  rsvpTotal: number
  status: string
  visibility: string
}

interface TerpLinkResponse {
  '@odata.count': number
  value: TerpLinkEvent[]
}

// ─── Huddle types (match your activities table) ───────────────────────────────

export interface TerpLinkMappedEvent {
  terplink_id: string
  title: string
  description: string
  organization: string
  raw_location: string
  start_time: string     // ISO UTC
  end_time: string
  category: HuddleCategory
  availability_block: AvailabilityBlock
  has_free_food: boolean
  latitude: number | null
  longitude: number | null
  rsvp_count: number
}

type HuddleCategory =
  | 'arts'
  | 'study'
  | 'hangout'
  | 'outdoors'
  | 'fitness'
  | 'coffee'
  | 'faith'
  | 'games'
  | 'volunteering'

type AvailabilityBlock =
  | 'weekday_morning'
  | 'weekday_afternoon'
  | 'weekday_evening'
  | 'weekend_morning'
  | 'weekend_afternoon'
  | 'weekend_evening'

// ─── Category mapping ─────────────────────────────────────────────────────────

function mapCategory(theme: string, categoryNames: string[]): HuddleCategory {
  const tags = categoryNames.map(c => c.toLowerCase())

  if (tags.includes('sustainability') || theme === 'CommunityService') return 'outdoors'
  if (tags.includes('service'))                                          return 'volunteering'
  if (tags.includes('music') || theme === 'Arts')                        return 'arts'
  if (tags.includes('sports and recreation') || theme === 'Athletics')   return 'fitness'
  if (tags.includes('social') || theme === 'Social')                     return 'hangout'
  if (tags.includes('cultural') || theme === 'Cultural')                 return 'hangout'
  if (theme === 'Spirituality')                                           return 'faith'
  if (theme === 'ThoughtfulLearning')                                     return 'study'
  if (theme === 'GroupBusiness')                                          return 'study'

  return 'hangout' // safe fallback
}

// ─── Availability block ───────────────────────────────────────────────────────

function mapAvailabilityBlock(isoString: string): AvailabilityBlock {
  const date = new Date(isoString)
  // Convert to US/Eastern for UMD events
  const eastern = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = eastern.getHours()
  const dow = eastern.getDay() // 0 = Sunday, 6 = Saturday
  const isWeekend = dow === 0 || dow === 6

  let slot: 'morning' | 'afternoon' | 'evening'
  if (hour < 12)      slot = 'morning'
  else if (hour < 17) slot = 'afternoon'
  else                slot = 'evening'

  return `${isWeekend ? 'weekend' : 'weekday'}_${slot}` as AvailabilityBlock
}

// ─── Strip HTML from description ─────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) // cap at 500 chars for the DB
}

// ─── Map one event ────────────────────────────────────────────────────────────

function mapEvent(e: TerpLinkEvent): TerpLinkMappedEvent {
  return {
    terplink_id:        e.id,
    title:              e.name.trim().slice(0, 120),
    description:        stripHtml(e.description),
    organization:       e.organizationName,
    raw_location:       e.location,
    start_time:         new Date(e.startsOn).toISOString(),
    end_time:           new Date(e.endsOn).toISOString(),
    category:           mapCategory(e.theme, e.categoryNames),
    availability_block: mapAvailabilityBlock(e.startsOn),
    has_free_food:      e.benefitNames.includes('Free Food'),
    latitude:           e.latitude  ? parseFloat(e.latitude)  : null,
    longitude:          e.longitude ? parseFloat(e.longitude) : null,
    rsvp_count:         e.rsvpTotal,
  }
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchTerpLinkEvents(options?: {
  take?: number
  endsAfter?: Date
}): Promise<TerpLinkMappedEvent[]> {
  const take      = options?.take      ?? 50
  const endsAfter = options?.endsAfter ?? new Date()

  const params = new URLSearchParams({
    endsAfter:        endsAfter.toISOString(),
    orderByField:     'endsOn',
    orderByDirection: 'ascending',
    status:           'Approved',
    take:             String(take),
    query:            '',
  })

  const res = await fetch(`${TERPLINK_BASE_URL}?${params}`, {
    next: { revalidate: 3600 }, // cache 1 hour in Next.js
  })

  if (!res.ok) {
    throw new Error(`TerpLink fetch failed: ${res.status} ${res.statusText}`)
  }

  const data: TerpLinkResponse = await res.json()

  return data.value
    .filter(e => e.status === 'Approved' && e.visibility === 'Public')
    .map(mapEvent)
}

// ─── Location mapper ──────────────────────────────────────────────────────────

const LOCATION_MAP: Record<string, string> = {
  // Stamp
  'stamp':              'loc-stamp',
  'stamp student union':'loc-stamp',
  'hoff theater':       'loc-stamp',
  'terpzone':           'loc-stamp',
  'grand ballroom':     'loc-stamp',
  'baltimore room':     'loc-stamp',

  // McKeldin
  'mckeldin':           'loc-mckeldin',
  'mckeldin library':   'loc-mckeldin',
  'mckeldin mall':      'loc-mckeldin',

  // Eppley
  'eppley':             'loc-eppley',
  'eppley recreation':  'loc-eppley',
  'reckord armory':     'loc-eppley-gym',

  // Tawes
  'tawes':              'loc-tawes',
  'ulrich recital':     'loc-tawes',
  'ulrich concert':     'loc-tawes',

  // Hornbake
  'hornbake':           'loc-hornbake',

  // Paint Branch / outdoors
  'paint branch':       'loc-paint-branch',
  'arboretum':          'loc-paint-branch',
  'greenhouse':         'loc-paint-branch',
  'umd research greenhouse': 'loc-paint-branch',
  'community learning garden': 'loc-eppley',
  'between eppley':     'loc-eppley',
}

export function mapLocation(rawLocation: string): string {
  const lower = rawLocation.toLowerCase()
  for (const [keyword, locId] of Object.entries(LOCATION_MAP)) {
    if (lower.includes(keyword)) return locId
  }
  return 'loc-stamp' // default fallback
}