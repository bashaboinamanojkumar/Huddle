# Huddle Notification Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, durable in-app notification inbox with Realtime updates, per-device Web Push delivery, compact global header, grouped inbox, preferences, and an RSVP-triggered permission flow.

**Architecture:** Postgres owns notification truth and per-subscription delivery state. Narrow authenticated RPCs expose only owner-safe mutations, while a secret-authenticated Supabase Edge Function claims and sends due deliveries. A separate client provider paginates and reconciles notifications without expanding the existing Huddle snapshot.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Postgres/RLS/Realtime/Edge Functions, pg_cron, pg_net, Vault, Web Push/VAPID, Vitest, pgTAP.

---

## File structure

- Create `supabase/config.toml`: local Supabase project and Edge Function verification settings.
- Create `supabase/migrations/20260804090000_notification_schema.sql`: enums, notification/preferences/subscription/delivery/config tables, constraints, indexes, defaults, and Realtime publication.
- Create `supabase/migrations/20260804090100_notification_access.sql`: owner RLS, column grants, profile provisioning, safe-path validation, notification creation, preference, read, and subscription RPCs.
- Create `supabase/migrations/20260804090200_notification_delivery.sql`: eligibility checks, quiet-hour calculation, atomic claims, leases, delivery result recording, subscription disabling, cleanup, and aggregate operations RPC.
- Create `supabase/migrations/20260804090300_notification_dispatch.sql`: pg_net dispatch hook and pg_cron retry/cleanup jobs backed by Vault values.
- Create `supabase/tests/notification_core.test.sql`: pgTAP integration coverage for schema, authorization, dedupe, quiet hours, caps, ownership, claims, and multi-device outcomes.
- Modify `lib/types/database.ts`: regenerated schema types for the four core migrations.
- Create `lib/notifications/types.ts`: browser-safe domain types and page/result contracts.
- Create `lib/notifications/model.ts`: pure sorting, pagination merge, unread counts, grouping, safe URL, and push-payload helpers.
- Create `lib/notifications/api.ts`: typed Supabase reads and narrow RPC calls.
- Create `lib/notifications/push.ts`: capability checks, iOS/standalone decisions, VAPID conversion, subscribe/reconcile/disable behavior, and prompt cooldown storage.
- Create `lib/notifications/notification-provider.tsx`: independent notification state, cursor pagination, optimistic mutations, Realtime INSERT/UPDATE reconciliation, badge synchronization, and foreground toast policy.
- Create `components/app/app-header.tsx`: compact Huddle header and accessible notification bell.
- Create `components/notifications/notification-row.tsx`: one inbox row with category icon and read state.
- Create `components/notifications/notification-inbox.tsx`: Today/This week/Older groups, retry, empty, mark-all, and load-more states.
- Create `components/notifications/notification-settings.tsx`: preference and current-device controls with confirmed save/error states.
- Create `components/pwa/prompt-coordinator.tsx`: single install/push prompt surface and RSVP eligibility event listener.
- Modify `components/pwa/install-prompt.tsx`: export reusable install capability helpers and presentation used by the coordinator.
- Delete `components/app/ios-install-banner.tsx`: remove the duplicate install prompt.
- Modify `components/app/bottom-nav.tsx`: unread-chat dot.
- Modify `components/huddle/activity-card.tsx` and `app/app/activity/[id]/page.tsx`: record successful first-RSVP push eligibility.
- Create `app/app/notifications/page.tsx`: inbox route.
- Modify `app/app/settings/page.tsx`: replace redirect with notification settings.
- Create `app/app/admin/notifications/page.tsx`: privacy-safe delivery aggregates for safety owners.
- Modify `app/app/layout.tsx`: mount the notification provider, compact header, and prompt coordinator inside authenticated UI.
- Modify `app/layout.tsx`: remove the global duplicate install prompt.
- Modify `public/sw.js`: push, click, app badge, and subscription-repair behavior while preserving protected cache boundaries.
- Create `supabase/functions/send-push/delivery.ts`: payload construction, response classification, and retry schedule.
- Create `supabase/functions/send-push/index.ts`: dispatch authentication, claim loop, Web Push send, and result recording.
- Create `supabase/functions/send-push/deno.json`: pinned npm dependency and test configuration.
- Create `supabase/functions/send-push/delivery_test.ts`: payload privacy and delivery classification tests.
- Create `tests/notifications/model.test.ts`: pure inbox reconciliation and grouping tests.
- Create `tests/notifications/push.test.ts`: permission eligibility, iOS install-first, cooldown, and VAPID conversion tests.
- Create `tests/notifications/service-worker.test.ts`: Web Push event/click/repair tests.
- Modify `tests/auth/service-worker.test.ts`: retain existing cache/auth regression coverage with the expanded worker harness.
- Create `docs/notifications-operations.md`: deployment secrets, Vault entries, migration/deploy order, cron checks, rollout, and real-device checklist.

### Task 1: Establish the core schema and invariants

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20260804090000_notification_schema.sql`
- Test: `supabase/tests/notification_core.test.sql`

- [ ] **Step 1: Write the failing pgTAP schema tests**

Create a transaction-scoped test that asserts the four tables, unique keys, safe URL check, default preferences, delivery states, singleton runtime row, and Realtime publication. The fixture IDs are fixed UUIDs, and the test begins with:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'notifications');
select has_table('public', 'notification_preferences');
select has_table('public', 'push_subscriptions');
select has_table('public', 'notification_deliveries');
select col_is_pk('public', 'notifications', 'id');
select col_is_unique('public', 'notifications', array['user_id', 'dedupe_key']);
select col_is_unique('public', 'notification_deliveries', array['notification_id', 'subscription_id']);
select results_eq(
  $$select push_enabled, digest_enabled from public.notification_preferences where false$$,
  $$values (true, false)$$,
  'preference defaults are push on and digest off'
);
select * from finish();
rollback;
```

- [ ] **Step 2: Run the test and verify the schema is absent**

Run: `npx supabase start && npx supabase test db supabase/tests/notification_core.test.sql`

Expected: FAIL because `public.notifications` does not exist.

- [ ] **Step 3: Add the schema migration**

Define exact enums:

```sql
create type public.notification_category as enum
  ('chat', 'activities', 'reminders', 'social', 'safety', 'digest', 'rewards');
create type public.notification_type as enum
  ('chat_message', 'chat_opened', 'activity_joined', 'activity_approved',
   'activity_rejected', 'event_reminder_24h', 'event_reminder_1h',
   'waitlist_promoted', 'pulse_prompt', 'friend_request', 'friend_accepted',
   'friend_rsvp', 'safety_review', 'safety_report_status',
   'activity_match_digest', 'weekly_recap', 'streak_at_risk',
   'points_milestone', 'badge_unlocked', 'leaderboard_placement');
create type public.notification_delivery_state as enum
  ('pending', 'deferred', 'processing', 'sent', 'failed', 'skipped');
```

Create the four tables with the columns and foreign keys from the approved core design. Enforce `url ~ '^/[^/]'`, `jsonb_typeof(data) = 'object'`, `daily_push_cap between 1 and 50`, `push_rollout_percentage between 0 and 100`, non-empty endpoint/key fields, non-negative attempts/failures, and exactly one `notification_runtime_config` row with `id = true`. Add `(user_id, last_event_at desc, id desc)`, due-delivery partial, expired-lease partial, and active-subscription indexes. Add `notifications` to `supabase_realtime` with `replica identity full` and insert the config row using `on conflict do nothing`.

Configure local project ID `huddle-notifications`, API port `54321`, database port `54322`, Studio port `54323`, and `[functions.send-push] verify_jwt = false` because dispatch uses its own secret.

- [ ] **Step 4: Reset the local database and rerun the schema tests**

Run: `npx supabase db reset && npx supabase test db supabase/tests/notification_core.test.sql`

Expected: PASS for all 18 assertions.

- [ ] **Step 5: Commit the schema slice**

```powershell
git add supabase/config.toml supabase/migrations/20260804090000_notification_schema.sql supabase/tests/notification_core.test.sql
git commit -m "feat: add notification core schema"
```

### Task 2: Add owner-safe access and idempotent creation

**Files:**
- Create: `supabase/migrations/20260804090100_notification_access.sql`
- Modify: `supabase/tests/notification_core.test.sql`

- [ ] **Step 1: Add failing authorization and dedupe tests**

Extend pgTAP with two profile fixtures and authenticated JWT claims. Assert owners can select only their notifications/preferences/subscriptions, authenticated clients cannot insert or edit notification content, `mark_notification_read()` rejects another owner, malformed paths are rejected, duplicate `(user_id, dedupe_key)` returns one row, and `ensure_profile()` creates preferences for repaired users.

Use exact claim switching:

```sql
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.mark_notification_read('30000000-0000-0000-0000-000000000001')$$,
  'owner can mark one notification read'
);
select throws_ok(
  $$select public.mark_notification_read('30000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Not authorized',
  'another owner notification is rejected'
);
reset role;
```

- [ ] **Step 2: Run the focused database test**

Run: `npx supabase test db supabase/tests/notification_core.test.sql`

Expected: FAIL because the access functions and policies do not exist.

- [ ] **Step 3: Implement access functions, RLS, and grants**

Add `notification_category_for_type()`, `is_safe_notification_path()`, `create_notification()`, `mark_notification_read()`, `mark_all_notifications_read()`, `update_notification_preferences()`, `save_push_subscription()`, and `disable_push_subscription()` as fixed-`search_path`, `security definer` functions. Revoke them from `public`/`anon`; grant only the five client RPCs to `authenticated`; keep `create_notification()` service-role/trusted-function only.

`create_notification()` has this stable contract:

```sql
public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_url text,
  p_data jsonb,
  p_dedupe_key text,
  p_last_event_at timestamptz default now(),
  p_reopen boolean default false
) returns public.notifications
```

It trims and length-limits title/body/key, rejects unsafe paths and non-object JSON, derives category from type, inserts once, and on conflict updates body/data/time plus clears `read_at`/`seen_at` only when `p_reopen` is true. Create owner-select RLS policies; provide no client policy/grant for deliveries. Let authenticated users select the singleton runtime row but expose updates only through trusted administrative functions. Grant `notification_operations_summary()` to authenticated only after it performs its own `is_safety_owner()` authorization check. Replace both `handle_new_user()` and `ensure_profile()` so each inserts `notification_preferences` after ensuring the profile. Use column grants so authenticated users can select allowed preference/subscription fields but never encryption keys from another row.

- [ ] **Step 4: Rerun the authorization tests**

Run: `npx supabase test db supabase/tests/notification_core.test.sql`

Expected: PASS for ownership, client-write rejection, safe paths, dedupe, and provisioning.

- [ ] **Step 5: Commit the access slice**

```powershell
git add supabase/migrations/20260804090100_notification_access.sql supabase/tests/notification_core.test.sql
git commit -m "feat: secure notification access"
```

### Task 3: Implement delivery eligibility, claims, retries, and operations

**Files:**
- Create: `supabase/migrations/20260804090200_notification_delivery.sql`
- Modify: `supabase/tests/notification_core.test.sql`

- [ ] **Step 1: Add failing delivery-state tests**

Add pgTAP cases for a cross-midnight quiet period, New York DST dates, deterministic rollout, a two-device notification, daily cap counted by distinct notification ID, atomic non-overlapping claims, expired lease recovery, stale-token result rejection, 404/410 subscription disablement, transient retry, fifth-attempt failure, and aggregate output without body/endpoint/key columns.

- [ ] **Step 2: Run the delivery cases and see the missing functions**

Run: `npx supabase test db supabase/tests/notification_core.test.sql`

Expected: FAIL on `notification_deliver_after`, `claim_notification_deliveries`, and `record_notification_delivery_result`.

- [ ] **Step 3: Implement the delivery state machine**

Add fixed-search-path helpers:

```sql
notification_rollout_eligible(p_user_id uuid, p_percentage integer) returns boolean
notification_deliver_after(p_now timestamptz, p_timezone text, p_start time, p_end time) returns timestamptz
notification_push_allowed(p_user_id uuid, p_category notification_category, p_now timestamptz) returns boolean
enqueue_notification_deliveries() returns trigger
claim_notification_deliveries(p_limit integer default 50, p_lease_seconds integer default 120) returns setof public.notification_delivery_claim
record_notification_delivery_result(p_delivery_id uuid, p_claim_token uuid, p_http_status integer, p_error_code text) returns notification_delivery_state
notification_operations_summary() returns jsonb
cleanup_notification_data(p_now timestamptz default now()) returns jsonb
```

The notification insert trigger creates one row per active subscription only when core/push/category/rollout allow it, using `deferred` plus calculated `deliver_after` for quiet hours. The claim function uses one `for update skip locked` CTE; rechecks config/preferences/cap; claims `pending`, due `deferred`, and expired `processing`; increments attempts; and returns only minimal notification and subscription fields. The result function requires the current claim token, marks 2xx sent, 404/410 skipped and disables the endpoint, schedules exponential retry for 429/network/5xx, marks other 4xx failed, and permanently fails attempt five. Cleanup keeps unread inbox rows, deletes read rows after 30 days, terminal delivery audit after 30 days, and disabled subscriptions after 60 days.

- [ ] **Step 4: Rerun the delivery cases**

Run: `npx supabase test db supabase/tests/notification_core.test.sql`

Expected: PASS, including two-device partial success without resending the sent device.

- [ ] **Step 5: Commit the delivery slice**

```powershell
git add supabase/migrations/20260804090200_notification_delivery.sql supabase/tests/notification_core.test.sql
git commit -m "feat: add reliable notification delivery state"
```

### Task 4: Wire immediate dispatch and scheduled recovery

**Files:**
- Create: `supabase/migrations/20260804090300_notification_dispatch.sql`
- Modify: `supabase/tests/notification_core.test.sql`
- Create: `docs/notifications-operations.md`

- [ ] **Step 1: Add failing dispatch-contract tests**

Assert extensions `pg_net`, `pg_cron`, and `vault` are present; the transition-table trigger exists on deliveries; exactly one retry job and one cleanup job are named; and the dispatch function returns `not_configured` when Vault values are absent rather than failing a source transaction.

- [ ] **Step 2: Run the dispatch-contract tests**

Run: `npx supabase test db supabase/tests/notification_core.test.sql`

Expected: FAIL because extensions, hook, and jobs are absent.

- [ ] **Step 3: Implement Vault-backed dispatch**

Enable extensions, add `request_push_dispatch()` that reads decrypted secrets named `huddle_send_push_url` and `huddle_notification_dispatch_secret`, calls `net.http_post()` with `x-dispatch-secret`, and returns a status JSON object. Add one `after insert on public.notification_deliveries referencing new table as inserted_deliveries for each statement` trigger that invokes the function once per insert statement. Schedule `huddle-notification-delivery-retry` every minute and `huddle-notification-cleanup` daily at `08:20 UTC`. Catch missing Vault configuration inside the dispatch helper so inbox creation remains available during a push outage.

Document exact operational commands:

```powershell
npx supabase secrets set VAPID_PUBLIC_KEY=<public-key> VAPID_PRIVATE_KEY=<private-key> VAPID_SUBJECT=mailto:ops@example.com NOTIFICATION_DISPATCH_SECRET=<random-secret>
npx supabase functions deploy send-push --no-verify-jwt
```

Also document the two Vault secret names, dark launch at zero rollout, staged percentages `5`, `25`, `100`, kill-switch SQL, cron inspection query, delivery aggregate RPC, and Chrome/Android plus installed-iOS real-device checks.

- [ ] **Step 4: Rerun dispatch-contract tests**

Run: `npx supabase db reset && npx supabase test db supabase/tests/notification_core.test.sql`

Expected: PASS with the absent-secret no-op verified.

- [ ] **Step 5: Commit dispatch operations**

```powershell
git add supabase/migrations/20260804090300_notification_dispatch.sql supabase/tests/notification_core.test.sql docs/notifications-operations.md
git commit -m "feat: schedule notification dispatch"
```

### Task 5: Build and test the Edge delivery worker

**Files:**
- Create: `supabase/functions/send-push/delivery.ts`
- Create: `supabase/functions/send-push/index.ts`
- Create: `supabase/functions/send-push/deno.json`
- Create: `supabase/functions/send-push/delivery_test.ts`

- [ ] **Step 1: Write failing delivery helper tests**

Test that payload construction truncates title/body, rejects cross-origin paths, strips safety data, emits only `title`, `body`, `url`, `notificationId`, `tag`, and `badge`, and classifies 201 as sent, 410 as disable, 429/503/network as retry, and 400 as permanent.

```ts
Deno.test("push payload is minimal and same-origin", () => {
  const payload = buildPushPayload({
    notificationId: "n-1",
    title: "Chat update",
    body: "Meet at McKeldin",
    url: "/app/chats/a-1",
    tag: "chat:a-1",
    badge: 3,
  })
  assertEquals(Object.keys(payload).sort(), ["badge", "body", "notificationId", "tag", "title", "url"])
})
```

- [ ] **Step 2: Run the Deno test and verify it fails**

Run: `deno test --allow-env supabase/functions/send-push/delivery_test.ts`

Expected: FAIL because `buildPushPayload` is missing.

- [ ] **Step 3: Implement helper and worker**

Pin `web-push` through `npm:web-push@3.6.7`. `delivery.ts` exports `buildPushPayload`, `classifyPushResult`, and `retryDelaySeconds`. `index.ts` accepts POST only, constant-time compares `x-dispatch-secret`, creates a service-role Supabase client from `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, claims at most 50 rows, sets VAPID details, sends each payload, and records every outcome with the claim token. It returns counts only; it never logs body, endpoint, keys, or safety data. Missing environment values return 503 before a claim.

- [ ] **Step 4: Run Edge tests and type checks**

Run: `deno test --allow-env supabase/functions/send-push/delivery_test.ts`

Expected: PASS.

Run: `deno check supabase/functions/send-push/index.ts`

Expected: no diagnostics.

- [ ] **Step 5: Commit the worker**

```powershell
git add supabase/functions/send-push
git commit -m "feat: send web push from notification outbox"
```

### Task 6: Add browser types, pure model, and Supabase API

**Files:**
- Modify: `lib/types/database.ts`
- Create: `lib/notifications/types.ts`
- Create: `lib/notifications/model.ts`
- Create: `lib/notifications/api.ts`
- Create: `tests/notifications/model.test.ts`

- [ ] **Step 1: Write failing pure-model tests**

Cover stable `last_event_at/id` ordering, INSERT dedupe, UPDATE replacement/move/reopen, pagination merge, unread/all and unread/chat counts, Today/This week/Older grouping, and same-origin route validation.

```ts
it("reopens and moves a coalesced chat update", () => {
  const next = reconcileNotification(existing, { ...existing[0], read_at: null, last_event_at: "2026-08-04T15:00:00Z" })
  expect(next[0].read_at).toBeNull()
  expect(next[0].last_event_at).toBe("2026-08-04T15:00:00Z")
})
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- tests/notifications/model.test.ts`

Expected: FAIL because the model module is absent.

- [ ] **Step 3: Implement exact browser contracts**

Define `NotificationItem`, `NotificationPreferences`, `PushSubscriptionRecord`, `NotificationCursor`, and `NotificationPage`. Implement pure helpers `sortNotifications`, `reconcileNotification`, `mergeNotificationPage`, `countUnread`, `groupNotifications`, and `safeNotificationPath`. `api.ts` selects a 25-row page ordered by `last_event_at` then `id`, applies the two-column keyset cursor, and wraps the five authenticated RPCs without direct notification updates.

Regenerate `lib/types/database.ts` with:

```powershell
npx supabase gen types typescript --local
```

Replace the file only with the successful command output and retain the existing exported aliases at its bottom.

- [ ] **Step 4: Run model tests and TypeScript**

Run: `npm test -- tests/notifications/model.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: no diagnostics.

- [ ] **Step 5: Commit the client model**

```powershell
git add lib/types/database.ts lib/notifications/types.ts lib/notifications/model.ts lib/notifications/api.ts tests/notifications/model.test.ts
git commit -m "feat: add notification client model"
```

### Task 7: Build the independent provider and compact navigation

**Files:**
- Create: `lib/notifications/notification-provider.tsx`
- Create: `components/app/app-header.tsx`
- Modify: `components/app/bottom-nav.tsx`
- Modify: `app/app/layout.tsx`
- Modify: `tests/notifications/model.test.ts`

- [ ] **Step 1: Add failing provider-state tests**

Test the exported reducer for load success/failure/retry, optimistic single/all read, rollback snapshots, INSERT/UPDATE events, pagination exhaustion, and user-switch reset. Verify badge counts derive from the same reducer state.

- [ ] **Step 2: Run the focused reducer tests**

Run: `npm test -- tests/notifications/model.test.ts`

Expected: FAIL because notification state/reducer exports are missing.

- [ ] **Step 3: Implement provider and navigation**

Create a reducer-driven provider with context values `items`, `status`, `error`, `hasMore`, `unreadCount`, `unreadChatCount`, `preferences`, `loadMore`, `retry`, `markRead`, `markAllRead`, `savePreferences`, `enablePush`, and `disablePush`. Subscribe to `postgres_changes` for both `INSERT` and `UPDATE` on `public.notifications` filtered by `user_id=eq.<session user>`. Remove the channel on cleanup and ignore events after a user switch. Use Sonner only when `Notification.permission !== "granted"`. Call `navigator.setAppBadge(unreadCount)` or `clearAppBadge()` when available.

Mount the provider inside `SessionGuard`, render a compact sticky header above the scroll area, and leave the bottom navigation unchanged except for a small `aria-label="Unread chats"` dot on Chats. The bell links to `/app/notifications`, caps visible numeric text at `99+`, and includes a screen-reader label with the exact unread total.

- [ ] **Step 4: Run tests and build-time checks**

Run: `npm test -- tests/notifications/model.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit && npm run lint`

Expected: no errors.

- [ ] **Step 5: Commit provider and header**

```powershell
git add lib/notifications/notification-provider.tsx components/app/app-header.tsx components/app/bottom-nav.tsx app/app/layout.tsx tests/notifications/model.test.ts
git commit -m "feat: add realtime notification header"
```

### Task 8: Add grouped inbox, settings, and admin aggregates

**Files:**
- Create: `components/notifications/notification-row.tsx`
- Create: `components/notifications/notification-inbox.tsx`
- Create: `components/notifications/notification-settings.tsx`
- Create: `app/app/notifications/page.tsx`
- Modify: `app/app/settings/page.tsx`
- Create: `app/app/admin/notifications/page.tsx`
- Create: `tests/notifications/components.test.tsx`

- [ ] **Step 1: Write failing server-rendered component tests**

Render presentational components with `react-dom/server` and assert Today/This week headings, unread accessible text, empty/error/retry/loading states, mark-all visibility, category labels, disabled push explanation, and admin aggregates without body/endpoint fields.

- [ ] **Step 2: Run component tests**

Run: `npm test -- tests/notifications/components.test.tsx`

Expected: FAIL because inbox/settings components do not exist.

- [ ] **Step 3: Implement the three routes and presentational states**

The inbox consumes the provider, uses approved chronological groups, marks a row read before routing through `safeNotificationPath`, and exposes Load more only when `hasMore`. Settings exposes master/category toggles, digest default off, quiet start/end, browser timezone, cap `1..50`, and current-device enable/disable; it disables controls during a request and shows confirmation only after RPC success. The admin page calls only `notification_operations_summary()` after `requireSafetyOwner()` and renders counts/error codes, never raw notifications or subscriptions.

- [ ] **Step 4: Run focused and static checks**

Run: `npm test -- tests/notifications/components.test.tsx`

Expected: PASS.

Run: `npx tsc --noEmit && npm run lint`

Expected: no errors.

- [ ] **Step 5: Commit inbox and settings**

```powershell
git add components/notifications app/app/notifications/page.tsx app/app/settings/page.tsx app/app/admin/notifications/page.tsx tests/notifications/components.test.tsx
git commit -m "feat: add notification inbox and settings"
```

### Task 9: Consolidate install flow and gate push after RSVP

**Files:**
- Create: `lib/notifications/push.ts`
- Create: `components/pwa/prompt-coordinator.tsx`
- Modify: `components/pwa/install-prompt.tsx`
- Delete: `components/app/ios-install-banner.tsx`
- Modify: `components/huddle/activity-card.tsx`
- Modify: `app/app/activity/[id]/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/app/layout.tsx`
- Create: `tests/notifications/push.test.ts`

- [ ] **Step 1: Write failing push-decision tests**

Cover unsupported APIs, denied permission, no successful RSVP marker, cooldown, iPhone/iPad non-standalone install-first, installed iOS permission explanation, normal browser eligibility, base64url VAPID conversion, and reconciliation payload generation.

- [ ] **Step 2: Run the push helper test**

Run: `npm test -- tests/notifications/push.test.ts`

Expected: FAIL because push decisions are missing.

- [ ] **Step 3: Implement one prompt coordinator**

Use storage keys `huddle.push.rsvpEligibleAt` and `huddle.push.dismissedUntil`; cooldown is 14 days. Both RSVP surfaces dispatch `window.dispatchEvent(new Event("huddle:rsvp-success"))` only when the RPC returns `going`. The coordinator records eligibility, shows iOS installation guidance first when not standalone, otherwise explains value and calls `Notification.requestPermission()` only from the `Enable alerts` click. Convert `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, subscribe with `userVisibleOnly: true`, and persist via `save_push_subscription`. Reconcile on provider start, permission grant, and worker `PUSH_SUBSCRIPTION_CHANGED` messages. Remove the legacy iOS component and global `InstallPrompt`; mount one coordinator in authenticated layout.

- [ ] **Step 4: Run tests and checks**

Run: `npm test -- tests/notifications/push.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit && npm run lint`

Expected: no errors.

- [ ] **Step 5: Commit the permission flow**

```powershell
git add lib/notifications/push.ts components/pwa/prompt-coordinator.tsx components/pwa/install-prompt.tsx components/huddle/activity-card.tsx app/app/activity/[id]/page.tsx app/layout.tsx app/app/layout.tsx tests/notifications/push.test.ts
git rm components/app/ios-install-banner.tsx
git commit -m "feat: ask for push after first RSVP"
```

### Task 10: Extend the service worker safely

**Files:**
- Modify: `public/sw.js`
- Modify: `tests/auth/service-worker.test.ts`
- Create: `tests/notifications/service-worker.test.ts`

- [ ] **Step 1: Add failing worker-event tests**

Extend the VM harness with `registration.showNotification`, `registration.getNotifications`, `clients.matchAll`, `clients.openWindow`, and `registration.pushManager`. Test valid push display, malformed generic fallback, stable tag, badge update, safe same-origin click focus/navigation, hostile URL fallback to `/app/notifications`, and subscription-change client messaging. Retain all cache-boundary tests.

- [ ] **Step 2: Run service-worker tests**

Run: `npm test -- tests/auth/service-worker.test.ts tests/notifications/service-worker.test.ts`

Expected: FAIL because push handlers are absent.

- [ ] **Step 3: Implement worker handlers**

Always call `showNotification()` for every received push. Validate the payload shape and use `{ title: "Huddle", body: "You have a new update.", url: "/app/notifications", tag: "huddle-update", badge: 0 }` on parse/validation failure. Use `event.waitUntil`, icons `/icons/icon-192x192.png`, a stable tag, `renotify: true`, and app badge when supported. On click, allow only one-slash same-origin `/app` paths, prefer an existing window client, and otherwise open a new one. On `pushsubscriptionchange`, post `{ type: "PUSH_SUBSCRIPTION_CHANGED" }` to all window clients. Do not write Supabase from the worker and do not suppress a visible push for focused clients.

- [ ] **Step 4: Run worker and full unit tests**

Run: `npm test -- tests/auth/service-worker.test.ts tests/notifications/service-worker.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 5: Commit the worker**

```powershell
git add public/sw.js tests/auth/service-worker.test.ts tests/notifications/service-worker.test.ts
git commit -m "feat: handle web push in service worker"
```

### Task 11: Verify the core milestone end to end

**Files:**
- Modify only files required by failures found in this verification task.

- [ ] **Step 1: Run database integration tests from a clean reset**

Run: `npx supabase db reset && npx supabase test db`

Expected: all pgTAP tests pass.

- [ ] **Step 2: Run Edge checks**

Run: `deno test --allow-env supabase/functions/send-push && deno check supabase/functions/send-push/index.ts`

Expected: all Deno tests pass and type checking is clean.

- [ ] **Step 3: Run application verification**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`

Expected: every command exits zero; the production build includes `/app/notifications`, `/app/settings`, and `/app/admin/notifications`.

- [ ] **Step 4: Run browser smoke tests**

Start: `npm run dev`

Verify at a mobile viewport: compact header on authenticated pages, bell count, grouped inbox, load more, mark read/all, Chats dot, settings save/error states, first-going-RSVP prompt eligibility, iOS install-first branch through a mocked user agent, and notification deep links. Record the tested routes and browser in `docs/notifications-operations.md`.

- [ ] **Step 5: Confirm external readiness without overstating live operation**

Verify the migration list, function deployment command, four Edge secrets, two Vault secrets, cron jobs, push rollout row, and real-device checklist are documented. Mark live Web Push as pending until the target Supabase/Vercel environment and a real device are actually verified.

- [ ] **Step 6: Commit verification-only corrections**

```powershell
git add -A
git commit -m "test: verify notification core"
```
