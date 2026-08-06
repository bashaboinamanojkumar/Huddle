# Huddle Notification Producers Design

## Goal

Connect Huddle's existing activity, RSVP, chat, friendship, moderation, and schedule flows to the notification core. Add the minimum missing waitlist and pulse behavior required for those notifications to be truthful and actionable.

This is the second independently deployable milestone and depends on the notification core.

## Principles

- Producers call the single `create_notification()` contract.
- Notification creation occurs in the same database transaction as the source state change whenever possible.
- Every producer supplies a deterministic dedupe key.
- The actor never receives a notification about their own action.
- High-frequency events coalesce; scheduled events are safe to run repeatedly.
- A producer failure must abort the source transaction only when losing that notification would make the state change misleading. Best-effort social fan-out is isolated so one recipient cannot block a group action.

## Event-driven producers

### Group chat

An inserted non-system message notifies every `going` participant except the sender. For each recipient/activity, messages within the same five-minute time bucket share a dedupe key. A conflict updates the existing notification's count, sender summary, body preview, `last_event_at`, and clears `read_at`/`seen_at` so the item becomes unread again.

Chat push copy contains the sender's first name, activity title, and at most a short sanitized preview. Safety-flag details and full message content are not included.

When `rsvp_activity()` reaches the second going participant and creates the system opener, it also creates one `chat_opened` notification for each attendee. The transaction guarantees the chat and notification become visible together.

### RSVP and waitlist

When a participant becomes `going`, the activity host receives a coalesced “students joined” notification, excluding a host joining their own event. Accepted friends of the participant receive a friend-RSVP notification only when the activity is approved, belongs to the same university, is in the future, and still has capacity.

`leave_activity()` locks the relevant RSVP rows, marks the leaving participant `left`, and promotes the oldest waitlisted participant when capacity exists. Promotion and the `waitlist_promoted` notification occur atomically. Concurrent leaves cannot promote the same person twice.

### Activity review

An activity transition from `pending` to `approved` or `rejected` notifies the host once. Replaying the administrator action cannot create a duplicate. Rejection copy remains concise and directs the host to the activity; it does not expose private reviewer notes.

### Friendships

A new pending friend connection notifies the recipient. A transition to accepted notifies the requester. Repeated inserts or updates are deduped by connection and state.

### Safety workflow

A newly opened safety flag or report notifies accounts whose validated Supabase app metadata role is `safety_owner`. Resolution of a user-submitted safety report notifies its reporter with a neutral status update. Push payloads never include the report body, reported person's identity, or reviewer notes.

## Scheduled producers

All jobs call SQL functions and use source-derived dedupe keys. Jobs scan bounded windows slightly wider than their schedule interval so a short scheduler delay cannot lose an event.

- Every five minutes: 24-hour and one-hour activity reminders for current `going` participants.
- Every fifteen minutes: pulse prompts for eligible activities whose start time passed two hours earlier.
- Daily at 17:00 America/New_York: one batched activity-match notification per student.
- Monday at 09:00 America/New_York: a non-reward weekly activity recap.
- Daily cleanup: notification and subscription retention from the core design.

Streak-at-risk and leaderboard-placement schedules are installed with the rewards milestone because they depend on its authoritative ledger and weekly-streak fields.

Cron expressions execute in a documented timezone-safe form. User-specific quiet hours remain the delivery layer's responsibility.

## Activity matching

The daily digest uses existing profile interests, availability blocks, university, and approved future activities. The SQL scoring function mirrors the meaningful inputs from `lib/scoring/score-fit.ts` and is covered by parity fixtures shared with TypeScript.

Only activities created since the user's previous digest window and not already joined are eligible. One notification summarizes the count and links to the feed. No per-activity push fan-out is created.

## Pulse response surface

The pulse prompt deep-links to `/app/activity/[id]/pulse`.

The page:

- verifies the current user had a going RSVP;
- accepts one `did_meet` response and an optional 1-5 rating;
- uses an authenticated idempotent RPC;
- shows the stored response on repeat visits;
- does not expose other attendees' responses;
- explains that the response affects attendance rewards.

The pulse table's existing unique `(activity_id, user_id)` constraint remains the idempotency boundary.

## Preference and anti-spam behavior

Every inbox notification is created. Delivery preferences are checked when delivery rows are created and again when claimed.

- Chat coalesces in five-minute windows.
- Host join notifications coalesce per activity/hour.
- Friend RSVP notifications dedupe per friend/activity.
- Reminder, pulse, digest, streak, and recap keys include the source entity and intended schedule window.
- Daily push caps and quiet hours apply after producer dedupe.

## Error handling

Transactional source functions use exception-safe notification helpers. A duplicate is a normal no-op or coalescing update, not an error. Scheduled functions return scanned, created, deduped, and failed-recipient counts for observability.

Fan-out functions process recipients set-wise. Invalid or missing recipient profiles are skipped and counted rather than causing duplicate source actions. Source identifiers remain in structured database logs; message and safety content does not.

## Testing and acceptance criteria

Database integration tests cover:

- sender/actor exclusion;
- authorization and university boundaries;
- five-minute chat coalescing, count updates, and unread restoration;
- chat-open behavior at exactly the second going RSVP;
- host joins and friend-RSVP capacity rules;
- concurrent waitlist promotion with oldest-first ordering;
- activity approval/rejection transition dedupe;
- friend request/accept state transitions;
- safety-owner targeting and private payloads;
- all scheduled time windows, reruns, and dedupe keys;
- match-score parity fixtures;
- pulse authorization, idempotency, and privacy.

Client tests cover the pulse response states and notification deep links. The full core verification gate runs again. The milestone is accepted only after source mutations still satisfy their existing behavior and each producer creates the expected inbox row without duplicate push deliveries.
