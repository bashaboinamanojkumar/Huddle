# Huddle Notification Producers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect chat, RSVP/waitlist, activity review, friendship, safety, reminders, pulse prompts, matches, and weekly recap flows to the durable notification core.

**Architecture:** Transactional Postgres functions and triggers call the single `create_notification()` contract with source-derived keys. Scheduled SQL functions scan bounded windows and are safe to rerun. The only new client workflow is an owner-private, idempotent pulse response route.

**Tech Stack:** Supabase Postgres/RLS/pg_cron, pgTAP, Next.js 16, React 19, TypeScript, Vitest.

---

## File structure

- Create `supabase/migrations/20260804100000_transactional_notification_producers.sql`: chat coalescing, RSVP/host/friend fan-out, chat-open, waitlist promotion, review, friendship, and safety notifications.
- Create `supabase/migrations/20260804100100_scheduled_notification_producers.sql`: reminders, pulse prompts, activity matches, weekly recap producers, match scoring, reporting return types, and cron schedules.
- Create `supabase/migrations/20260804100200_pulse_response.sql`: private idempotent pulse-response RPC and tighter pulse grants.
- Create `supabase/tests/notification_producers.test.sql`: pgTAP integration coverage for all transactional/scheduled producers and pulse privacy.
- Create `tests/fixtures/activity-match-scores.json`: canonical parity fixtures for TypeScript and SQL.
- Create `scripts/verify-match-score-parity.mjs`: compare local Postgres `activity_match_score()` with `scoreFit()` fixture expectations.
- Modify `lib/types/database.ts`: regenerate producer and pulse RPC types.
- Modify `lib/types/huddle.ts`: pulse response view contract.
- Modify `lib/supabase/mappers.ts`: pulse response mapping.
- Modify `lib/supabase/mutations.ts`: `submitPulseResponse()` narrow RPC wrapper.
- Modify `lib/supabase/queries.ts`: owner-only pulse response read.
- Create `lib/pulses/model.ts`: rating validation and presentational state helper.
- Create `app/app/activity/[id]/pulse/page.tsx`: pulse response surface.
- Create `tests/pulses/model.test.ts`: pulse validation and state tests.
- Create `tests/pulses/page.test.tsx`: server-rendered page-state tests.
- Modify `docs/notifications-operations.md`: scheduled-producer job checks and observability queries.

### Task 1: Add transactional producer fixtures and failing tests

**Files:**
- Create: `supabase/tests/notification_producers.test.sql`

- [ ] **Step 1: Build deterministic database fixtures**

Create profiles for host, sender, attendee, waitlisted student, accepted friend, safety owner, reporter, and outsider. Insert approved/pending activities, two-device subscriptions, going/waitlisted RSVPs, and friend connections. Use timestamps anchored to `2026-08-04 12:00:00+00` so dedupe keys are stable. Set JWT claims before every authenticated RPC call and use the service role only for fixture setup.

- [ ] **Step 2: Write failing chat and RSVP producer assertions**

Assert:

- a student message excludes the sender and non-going users;
- two messages in the same five-minute bucket produce one notification whose `data.count = 2`, newest preview/body wins, `last_event_at` advances, and read/seen clear;
- a different bucket produces a second notification;
- the exact second going RSVP creates the system opener and one `chat_opened` inbox row per attendee;
- host join notification excludes a self-host RSVP and coalesces per activity/hour;
- accepted friends are notified only for same-university, approved, future, non-full activities.

Use exact checks such as:

```sql
select results_eq(
  $$select count(*)::bigint from public.notifications where user_id = '10000000-0000-0000-0000-000000000003' and type = 'chat_message'$$,
  $$values (1::bigint)$$,
  'chat messages coalesce per recipient/activity/five-minute bucket'
);
```

- [ ] **Step 3: Write failing review, friendship, and safety assertions**

Assert pending-to-approved/rejected transitions notify the host once, new friend requests notify the recipient, accepted transitions notify the requester, safety flags target only app-metadata `safety_owner` accounts, and resolved reports notify only the reporter with a neutral body that excludes report context/reported identity/reviewer notes.

- [ ] **Step 4: Run the test and confirm no producer rows exist**

Run: `npx supabase test db supabase/tests/notification_producers.test.sql`

Expected: FAIL because the producer triggers and enhanced RPCs are absent.

- [ ] **Step 5: Commit the red tests**

```powershell
git add supabase/tests/notification_producers.test.sql
git commit -m "test: define transactional notification producers"
```

### Task 2: Implement transactional producers and atomic waitlist promotion

**Files:**
- Create: `supabase/migrations/20260804100000_transactional_notification_producers.sql`
- Modify: `supabase/tests/notification_producers.test.sql`

- [ ] **Step 1: Implement chat coalescing**

Add `try_create_notification()` as a fixed-search-path, non-client-executable wrapper around `create_notification()`. It returns false after logging only notification type, recipient ID, and source dedupe key on a recipient-specific failure; it never logs message or safety content. Social fan-out uses this wrapper so one bad recipient cannot roll back the source action. Waitlist promotion, activity review, and reporter status changes call `create_notification()` directly because losing those notifications would make the committed state misleading.

Add `notify_chat_message()` as an after-insert trigger for non-system messages. It joins going RSVPs, actor profile, and activity; excludes the actor; sanitizes whitespace; limits preview to 120 characters; and calls `try_create_notification` with the recipient, `chat_message` type, chat title/body/path/data/key, the inserted timestamp, and `p_reopen => true`. The key is:

```sql
'chat:' || new.activity_id || ':' ||
to_char(date_bin('5 minutes', new.created_at, '2000-01-01'::timestamptz), 'YYYYMMDDHH24MI')
```

Pass data keys `activityId`, `messageId`, `count`, and `senderFirstName`. Before calling the wrapper, read the existing row by recipient/key and increment the JSON count so the upsert writes the authoritative total.

- [ ] **Step 2: Replace RSVP and leave RPCs atomically**

Preserve current authorization/capacity locking. When the first transition to `going` occurs, notify the non-self host with hourly key `activity-joined:<activity>:<YYYYMMDDHH24>` and accepted friends with key `friend-rsvp:<friend>:<activity>`. When the going count reaches exactly two and no system opener exists, insert the opener and create `chat_opened:<activity>` for every current attendee.

In `leave_activity()`, lock the activity and all going/waitlisted rows, mark the actor left, and select the oldest waitlisted row `order by created_at, user_id for update skip locked limit 1` only when a seat exists. Promote that row and create `waitlist-promoted:<activity>:<user>` in the same transaction. The function remains idempotent if the actor was already left.

- [ ] **Step 3: Add transition and safety triggers**

Replace `review_activity()` so it captures the old status under lock and notifies the host only for a real `pending -> approved|rejected` transition. Add an after-insert/update friendship trigger keyed by connection plus state. Extend safety-flag insertion to notify all `auth.users` whose `raw_app_meta_data->>'role' = 'safety_owner'`. Extend `resolve_flag()` so report flags update the linked `safety_reports.status` and create `safety-report-status:<report>:<status>` for its reporter. Notification bodies contain identifiers/titles only and never safety context.

- [ ] **Step 4: Rerun transactional producer tests**

Run: `npx supabase db reset && npx supabase test db supabase/tests/notification_producers.test.sql`

Expected: all transactional assertions pass.

- [ ] **Step 5: Add the concurrent promotion proof**

In pgTAP, use two dblink sessions to invoke `leave_activity()` for two going users against a full activity with two waitlisted users. Assert both waitlisted rows are promoted once, oldest first by the committed order, and each has exactly one notification and one delivery per active subscription.

Run: `npx supabase test db supabase/tests/notification_producers.test.sql`

Expected: PASS without deadlock or duplicate promotion.

- [ ] **Step 6: Commit transactional producers**

```powershell
git add supabase/migrations/20260804100000_transactional_notification_producers.sql supabase/tests/notification_producers.test.sql
git commit -m "feat: notify transactional Huddle events"
```

### Task 3: Implement scheduled producers and DST-safe cron gates

**Files:**
- Create: `supabase/migrations/20260804100100_scheduled_notification_producers.sql`
- Modify: `supabase/tests/notification_producers.test.sql`
- Create: `tests/fixtures/activity-match-scores.json`
- Create: `scripts/verify-match-score-parity.mjs`
- Modify: `docs/notifications-operations.md`

- [ ] **Step 1: Add failing scheduled-window tests**

Test 24-hour and one-hour reminders across slightly wider than five-minute windows; pulse prompts two hours after start with a fifteen-minute tolerance; daily match gating at local 17:00; Monday recap gating at local 09:00; rerun dedupe; joined/past/unapproved/wrong-university exclusion; and returned `{scanned, created, deduped, skipped}` counts. Include New York dates on both sides of daylight-saving transitions.

- [ ] **Step 2: Add canonical match parity fixtures**

Create JSON with six named cases containing profile interests/availability/university and activity category/block/status/university/start, plus expected total/eligibility. Cover exact interest+availability, interest only, availability only, wrong university, unapproved, and already joined. Add a Node script that imports the JSON, runs `scoreFit()`, then calls local Supabase RPC `activity_match_score` for each case and exits nonzero on any mismatch.

- [ ] **Step 3: Run scheduled and parity tests red**

Run: `npx supabase test db supabase/tests/notification_producers.test.sql`

Expected: FAIL because scheduled producer functions are absent.

Run: `node scripts/verify-match-score-parity.mjs`

Expected: FAIL because the SQL scoring RPC is absent.

- [ ] **Step 4: Implement scheduled producer functions**

Add functions returning a named composite count type with `scanned`, `created`, `deduped`, `failed`, and `skipped` integer fields:

```sql
produce_event_reminders(p_now timestamptz default now())
produce_pulse_prompts(p_now timestamptz default now())
produce_activity_match_digests(p_now timestamptz default now())
produce_weekly_recaps(p_now timestamptz default now())
activity_match_score(p_user_id uuid, p_activity_id uuid)
```

Reminder keys include activity/user and `24h` or `1h`; pulse key includes activity/user; match key includes the user's local date; recap key includes ISO year/week. Matching mirrors `score-fit.ts`: university and approved/future are mandatory, shared category and availability supply the same weights, already joined and activities outside the prior digest window are excluded, and one inbox row summarizes the count.

Schedule reminders every five minutes and pulses every fifteen. Schedule match and recap gates hourly; inside each function return zero counts unless `timezone('America/New_York', p_now)` is in local hour `17` for matches or Monday hour `09` for recaps. This preserves local wall-clock behavior across DST without changing cron expressions.

- [ ] **Step 5: Run scheduled tests and score parity green**

Run: `npx supabase db reset && npx supabase test db supabase/tests/notification_producers.test.sql`

Expected: PASS for all windows, exclusions, counts, and reruns.

Run: `node scripts/verify-match-score-parity.mjs`

Expected: all six fixtures report matching scores/eligibility.

- [ ] **Step 6: Document and commit schedules**

Add exact `cron.job` inspection queries, manual `select * from produce_*()` smoke calls, and count-return interpretation to operations docs.

```powershell
git add supabase/migrations/20260804100100_scheduled_notification_producers.sql supabase/tests/notification_producers.test.sql tests/fixtures/activity-match-scores.json scripts/verify-match-score-parity.mjs docs/notifications-operations.md
git commit -m "feat: schedule Huddle notification producers"
```

### Task 4: Add the private idempotent pulse response RPC

**Files:**
- Create: `supabase/migrations/20260804100200_pulse_response.sql`
- Modify: `supabase/tests/notification_producers.test.sql`
- Modify: `lib/types/database.ts`
- Modify: `lib/types/huddle.ts`
- Modify: `lib/supabase/mappers.ts`
- Modify: `lib/supabase/mutations.ts`
- Modify: `lib/supabase/queries.ts`

- [ ] **Step 1: Add failing pulse authorization tests**

Assert only a user with a going RSVP can submit; rating is null or 1..5; one response per user/activity is returned unchanged on identical replay; a conflicting replay is rejected; owners can read only their own response; and direct insert/update grants are absent.

- [ ] **Step 2: Run pulse tests red**

Run: `npx supabase test db supabase/tests/notification_producers.test.sql`

Expected: FAIL because `submit_pulse_response()` is missing and direct insert is still granted.

- [ ] **Step 3: Implement the narrow RPC and grants**

Create fixed-search-path `submit_pulse_response(p_activity_id uuid, p_did_meet boolean, p_rating integer default null) returns public.pulses`. Authorize `auth.uid()`, validate a going RSVP existed, validate rating, insert once, return the existing row for an identical replay, and raise SQLSTATE `22023` for conflicting values. Revoke direct insert/update on pulses; retain owner select; grant only the RPC to authenticated.

- [ ] **Step 4: Regenerate browser types and wrappers**

Regenerate `lib/types/database.ts`. Add `PulseResponseView` with `activityId`, `didMeet`, `rating`, and `createdAt`. Add `submitPulseResponse()` RPC wrapper and `fetchOwnPulseResponse()` query that filters by current user through RLS and `.maybeSingle()`.

- [ ] **Step 5: Run DB, mapper, and type checks**

Run: `npx supabase test db supabase/tests/notification_producers.test.sql && npm test -- tests/supabase/mappers.test.ts && npx tsc --noEmit`

Expected: all commands pass.

- [ ] **Step 6: Commit the pulse API**

```powershell
git add supabase/migrations/20260804100200_pulse_response.sql supabase/tests/notification_producers.test.sql lib/types/database.ts lib/types/huddle.ts lib/supabase/mappers.ts lib/supabase/mutations.ts lib/supabase/queries.ts
git commit -m "feat: secure pulse responses"
```

### Task 5: Build the pulse response route

**Files:**
- Create: `lib/pulses/model.ts`
- Create: `app/app/activity/[id]/pulse/page.tsx`
- Create: `tests/pulses/model.test.ts`
- Create: `tests/pulses/page.test.tsx`

- [ ] **Step 1: Write failing pulse model and view tests**

Test state copy for loading, ineligible, unanswered, submitting, stored yes/no with optional rating, and error/retry. Test validation that rating is an integer 1..5 or null and that a stored response cannot be edited.

- [ ] **Step 2: Run focused tests red**

Run: `npm test -- tests/pulses/model.test.ts tests/pulses/page.test.tsx`

Expected: FAIL because the model and route are absent.

- [ ] **Step 3: Implement the route**

At `/app/activity/[id]/pulse`, resolve the activity from `useHuddle()`, require the viewer's going RSVP, load only the viewer's response, and show Yes/No controls with optional 1-5 rating. Submit through the RPC once, disable controls while pending, render the stored response on success/revisit, and explain that confirmed attendance affects rewards. Never query or render other attendees' pulses.

- [ ] **Step 4: Run focused and full client checks**

Run: `npm test -- tests/pulses/model.test.ts tests/pulses/page.test.tsx`

Expected: PASS.

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`

Expected: all commands pass and the pulse route builds.

- [ ] **Step 5: Commit the pulse UI**

```powershell
git add lib/pulses/model.ts app/app/activity/[id]/pulse/page.tsx tests/pulses/model.test.ts tests/pulses/page.test.tsx
git commit -m "feat: add meetup pulse response page"
```

### Task 6: Verify the producers milestone without regressions

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Verify a clean local database**

Run: `npx supabase db reset && npx supabase test db`

Expected: core and producer pgTAP suites pass together.

- [ ] **Step 2: Verify score parity and all application tests**

Run: `node scripts/verify-match-score-parity.mjs && npm test && npm run lint && npx tsc --noEmit && npm run build`

Expected: six parity fixtures match and every application command exits zero.

- [ ] **Step 3: Run transactional smoke flows**

Against local Supabase, execute one chat message, a second-going RSVP, a leave with a waitlist, an approval, a friend request/accept, a safety report resolution, and each scheduled producer twice. Confirm the source state is correct, exactly one expected inbox row exists, and delivery fan-out equals active devices without duplicates.

- [ ] **Step 4: Run the pulse browser smoke**

At a mobile viewport, open a pulse deep link as an eligible user, submit `did_meet = true` with rating 5, refresh, and confirm the stored immutable response. Open as an ineligible user and confirm no submission control appears.

- [ ] **Step 5: Commit verification corrections**

```powershell
git add -A
git commit -m "test: verify notification producers"
```
