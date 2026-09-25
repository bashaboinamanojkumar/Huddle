# Supabase query and resource optimization design

## Problem

The production Supabase project became overloaded enough that both dashboard
schema queries and public API requests timed out. Restarting the project restored
service responsiveness, but the application currently performs avoidable work
that increases the probability of another resource-exhaustion event.

The authenticated store loads one monolithic snapshot. A normal load runs an
`ensure_profile` RPC and then starts ten concurrent reads for profiles,
locations, activities, RSVPs, messages, safety flags, safety reports, pulses,
friend connections, and private gender data. Most reads request every row
allowed by RLS, and most use `select("*")`. Messages, moderation data, and pulse
responses are therefore loaded even when the user is only viewing the feed.
Many mutations then reload this entire snapshot.

The notification subsystem also schedules database work at one-, five-,
fifteen-, and sixty-minute intervals. The one-minute recovery job can call the
Push Edge Function even when no delivery is due. The schedules are required for
feature correctness; the unnecessary no-work execution is not.

This design addresses verified application and migration inefficiencies. It
does not claim that they were the only cause of the outage because production
CPU, RAM, disk I/O, connection, and query-statistics reports were not available
during diagnosis. A concurrent Supabase API Gateway/JWT incident also affected
live validation and must remain distinct from project-local resource use.

## Goals

- Preserve every user-facing feature: authentication, feed, community,
  profiles, activities, RSVPs, chat, realtime updates, safety moderation,
  pulses, notifications, Push, pull-to-refresh, and lifecycle refresh.
- Preserve all existing RLS, grants, role checks, privacy boundaries, and
  university scoping.
- Remove messages, safety data, and pulse data from routine application boot
  and core refreshes.
- Replace unbounded wildcard reads with explicit projections, semantic filters,
  deterministic ordering, and pagination or limits where the UI is bounded.
- Replace full-snapshot reloads after mutations with local state updates or one
  focused reconciliation read.
- Keep background schedules while avoiding database scans, Edge Function calls,
  and overlapping producer runs when no work is due.
- Produce measurable before/after request-count evidence and regression tests.

## Non-goals

- Disabling or reducing feature coverage.
- Changing authentication providers, API keys, RLS policy intent, or role
  assignment.
- Changing the Supabase plan, compute size, disk size, or connection limits.
- Replacing Supabase with another persistence layer or introducing a new client
  caching dependency.
- Deleting production data, rewriting migration history, or applying changes to
  production without a separate deployment decision.
- Implementing rewards or unrelated notification features.

## Decision

Use staged query slicing. Retain the existing store and component contracts,
but divide the monolithic snapshot into a small core dataset and feature-owned
loaders. Add a forward-only migration for query support and no-work background
guards. Update mutations incrementally so the application no longer refreshes
all core data after a focused change.

This approach is selected because it removes the largest verified waste while
keeping the current UI architecture and rollback path. It avoids concentrating
all work in a large JSON-producing RPC and avoids the regression risk of a
complete state-management rewrite.

## Alternatives considered

1. **One snapshot RPC.** This would reduce HTTP round trips but would still
   collect unrelated data, move serialization pressure into Postgres, produce a
   large response, and create a monolithic function that is harder to secure and
   evolve. Rejected.
2. **Complete route-level data-layer rewrite.** This offers the strongest
   theoretical isolation but changes every consumer at once and makes feature
   parity difficult to prove. Rejected for this recovery-focused change.
3. **Staged query slicing with compatible store state.** Selected because it
   removes unnecessary rows and calls in independently testable increments while
   preserving component behavior.

## Client data architecture

### Core application data

`HuddleState` remains the compatibility boundary consumed by existing pages.
The core loader populates only:

- public profile data needed by feed, community, and relationship surfaces;
- locations;
- activities needed by the current campus/feed and the signed-in user's
  immediately visible activity relationships;
- RSVPs required to construct those activity views;
- friend connections visible to the current user; and
- the signed-in user's private gender field.

The loader must use named column projections for every table. Activity and RSVP
queries must use filters that match existing UI semantics. If a profile or
activity history is not part of the core window, the relevant profile or
activity page loads it explicitly rather than expanding every user's boot data.

The normal path must not call `ensure_profile` preemptively. It first reads core
profile data. If the current user's profile is absent, it calls
`ensure_profile`, fetches that one profile, and merges it into the snapshot.
This preserves support for accounts created before the profile trigger while
removing the routine write-capable RPC from established accounts.

The initial and manual-refresh budgets are:

- at most six core table requests in the normal path;
- no message, safety flag, safety report, or pulse-response request;
- no routine `ensure_profile` RPC for an existing profile; and
- no wildcard projection.

### Feature-owned data

Data excluded from the core snapshot is loaded by the surface that owns it:

- Chat loads the selected activity's messages with explicit columns,
  chronological ordering, and bounded pagination. Existing realtime inserts are
  merged without re-fetching the full message history.
- Admin safety review loads flags and reports only after the server-side admin
  layout has authorized the user. Normal students never issue these requests.
- Pulse pages load only the current user's response and any aggregate data that
  the visible pulse UI requires. Private free-text responses remain owner-only.
- Profile/activity detail pages load historical records outside the feed window
  only for the requested entity.
- Notifications retain their dedicated provider and pagination. Their queries
  also replace remaining wildcard projections with named columns.

Optional feature loaders have their own loading, retry, and single-flight state.
A failure on one feature surface does not erase already loaded core data.

### Refresh and mutation flow

Manual pull-to-refresh and lifecycle refresh remain available, retain the
existing thirty-second automatic throttle, and reload only core data. The
existing single-flight guard continues to prevent overlapping core refreshes.

Each mutation updates or reconciles only its affected slice:

- profile updates merge the returned profile fields;
- RSVP/leave operations merge the returned RSVP/capacity result or run one
  focused activity reconciliation;
- activity creation appends the returned activity;
- message creation and realtime delivery merge one message by ID;
- safety creation does not reload unrelated student data;
- moderation updates replace the affected flag or activity;
- friend add/accept/decline/unfriend updates the affected connection; and
- pulse submission replaces the current activity/user response.

A focused read is allowed when a mutation result cannot safely represent a
server-side trigger outcome. No mutation may call the generic six-request core
refresh solely for convenience.

## Database and background-work design

Add one forward-only migration. It must not remove policies, tables, functions,
triggers, publications, or schedules.

### Query support

The migration adds only indexes justified by the final query predicates and
existing RLS paths. Candidate indexes must be compared with existing indexes so
the migration does not add equivalent or unused structures. The implementation
plan must map each new index to a specific query or policy predicate, including
campus/status/start-time activity reads, relationship lookups, and any
feature-loader ordering/filtering not already covered.

Query plans should be inspected locally where representative data exists.
Production index creation or `EXPLAIN ANALYZE` is outside this local change and
requires an explicit deployment/operations step.

### Scheduled jobs

Keep current cron names and schedules. Change their work boundaries:

- The one-minute Push recovery job first checks runtime configuration and the
  existence of a due, deliverable notification. It calls `net.http_post` only
  when such work exists.
- Producer functions check their feature/runtime gate before scanning source
  tables.
- Each producer uses a transaction-scoped advisory lock or equivalent
  non-overlap guard. A concurrent invocation exits cleanly rather than doing
  duplicate scans.
- Batch and retry limits remain bounded. Existing deduplication keys, quiet
  hours, daily caps, privacy copy, leases, and retry behavior remain unchanged.
- Cleanup remains daily and does not move to a higher frequency.

The migration must be safe to apply before the application change. The old
application must continue working against the optimized database functions.

## Error handling

- Auth or core-load transport failure keeps the existing session-retry behavior
  and never converts an unavailable Supabase service into a signed-out state.
- A core refresh failure keeps the previous snapshot and surfaces the existing
  refresh failure indication.
- A feature-loader failure is isolated to that feature and provides a retry path
  without clearing core state.
- A mutation failure leaves the previous state intact unless the server confirms
  success. If success is confirmed but reconciliation fails, the UI preserves
  the mutation result and marks the affected slice for a later focused refresh.
- Background no-work and overlapping-run exits are successful no-ops, not
  errors. Real dispatch/producer failures retain current retry and operational
  visibility.

## Security and privacy invariants

- RLS remains enabled on every current table.
- Existing authenticated, admin, safety-owner, owner-only, and service-role
  boundaries remain unchanged.
- Client queries continue to omit protected profile email fields.
- Safety data is never prefetched for ordinary users.
- Private gender and pulse response data remain visible only to their owner.
- Push secrets remain in Vault/server-side code and never enter browser bundles,
  logs, errors, tests, or migrations.

## Regression coverage

Follow test-driven development. Every behavior change begins with a failing
test that demonstrates the current unnecessary request or reload.

Client tests must prove:

- the core loader requests only the approved datasets and explicit columns;
- existing profiles skip `ensure_profile`, while a missing profile uses the
  fallback exactly once;
- boot and manual refresh do not request messages, safety data, or pulses;
- feature loaders request the correct scoped rows, pagination, and ordering;
- concurrent refreshes and feature loads remain single-flight;
- each mutation avoids a generic core refresh and merges/reconciles the correct
  slice; and
- feature-loader failures retain core state and can retry.

Database tests must prove:

- the migration is forward-only and keeps current schedules/features;
- no-work Push recovery does not enqueue an HTTP request;
- due work still requests dispatch;
- disabled runtime configuration exits before producer scans/creation;
- overlapping producer execution is skipped safely;
- deduplication, quiet hours, caps, leases, retries, cleanup, and RLS continue to
  pass the existing pgTAP suites; and
- every new index exists with the intended columns/predicate and is not a
  duplicate of a current index.

Rendered/browser coverage must exercise sign-in restoration, feed refresh,
RSVP/leave, activity creation, chat history and realtime insertion, friend
actions, pulse submission, notification inbox/settings, and authorized admin
safety review.

## Success criteria

- All existing user-visible features and authorization boundaries pass.
- Normal authenticated core load and manual refresh issue at most six core
  table requests, down from ten, with zero message/safety/pulse reads.
- Established accounts do not call `ensure_profile` during normal load.
- No browser-side Supabase query or mutation uses `select("*")`.
- A normal mutation performs its write plus no more than one focused
  reconciliation read; it never launches the generic core refresh.
- The one-minute recovery job performs zero HTTP requests when no due delivery
  exists and still dispatches due work within the existing schedule.
- Full Vitest, pgTAP, typecheck, lint, production build, and browser suites pass.
- Before/after evidence records request counts and, where the environment makes
  them observable, transferred rows/bytes and relevant query plans.

## Rollout and rollback

Work occurs on `codex/query-resource-optimization` in the isolated worktree
created from current `origin/main` (`09bfaa1`). The original dirty checkout is
not modified.

Release order is:

1. validate the migration and pgTAP suites locally;
2. deploy the backward-compatible database migration;
3. verify scheduled jobs, API health, and database resource reports;
4. deploy the application query-slicing change;
5. run the authenticated browser matrix and compare request evidence; and
6. monitor database CPU, RAM, disk I/O, connections, API latency, cron history,
   and Edge Function invocations.

The application rollback is a redeploy of the prior build because the database
migration remains backward-compatible. If a background guard is faulty, a
forward correction restores the previous function body or cron command; applied
migrations are not deleted or rewritten.

This task produces local commits and verification evidence. Applying migrations,
deploying Vercel, pushing branches, or changing production settings requires a
separate explicit release decision.
