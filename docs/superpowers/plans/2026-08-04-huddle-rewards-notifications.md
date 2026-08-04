# Huddle Rewards and Reward Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inferred reward UI with an immutable point ledger, confirmed-attendance weekly streaks, authoritative badge unlocks, deterministic leaderboard results, and restrained reward notifications.

**Architecture:** Trusted database functions validate every source relationship, append idempotent ledger events, maintain cached totals/streak fields transactionally, and evaluate a small badge catalog. Pulse and RSVP hooks feed rewards, while a feature-controlled scheduler produces streak warnings and top-placement notifications through the existing notification pipeline.

**Tech Stack:** Supabase Postgres/RLS/pg_cron, pgTAP, Next.js 16, React 19, TypeScript, Vitest.

---

## File structure

- Create `supabase/migrations/20260804110000_rewards_schema.sql`: reward reason enum, point ledger, profile streak fields, badges/profile badges, constraints, seed catalog, indexes, and grants foundation.
- Create `supabase/migrations/20260804110100_rewards_engine.sql`: idempotent award, correction, RSVP/attendance/host validation, streak update, badge/milestone evaluation, and reward notification functions/triggers.
- Create `supabase/migrations/20260804110200_rewards_schedules.sql`: reward kill switch, schedule lifecycle, Sunday streak warnings, Monday placement notifications, and deterministic leaderboard function.
- Create `supabase/tests/rewards.test.sql`: ledger/RLS/immutability, awards, cap, streak, badges, notifications, corrections, ties, and kill-switch pgTAP coverage.
- Modify `lib/types/database.ts`: regenerate reward table/function/profile types.
- Modify `lib/types/huddle.ts`: `streakWeeks`, `lastMeetupAt`, and reward view contracts.
- Modify `lib/supabase/mappers.ts`: map authoritative profile streak fields.
- Modify `lib/supabase/queries.ts`: select public badge unlocks and owner point history without adding them to the full snapshot.
- Create `lib/rewards/types.ts`: badge, point history, reward summary, and runtime flag types.
- Create `lib/rewards/api.ts`: reward config, summary, badge, history, and leaderboard queries.
- Create `lib/rewards/model.ts`: points reconciliation, copy, formatting, and disabled-state helpers.
- Create `components/rewards/reward-summary.tsx`: points, weekly streak, confirmed meetup copy, and disabled state.
- Create `components/rewards/badge-grid.tsx`: actual unlocked badges only.
- Create `components/rewards/points-history.tsx`: owner ledger history.
- Modify `app/app/profile/page.tsx`: authoritative reward summary, badge grid, rules, and point history.
- Modify `app/app/community/page.tsx`: real points/streak leaderboard and reward-disabled behavior.
- Modify `app/app/profile/[id]/page.tsx`: public authoritative totals/badges without private ledger.
- Create `tests/rewards/model.test.ts`: reward model and exact reconciliation tests.
- Create `tests/rewards/components.test.tsx`: rendered summary/badge/history/disabled state tests.
- Modify `docs/notifications-operations.md`: reward enable/disable, schedule, audit, and reconciliation runbook.

### Task 1: Add the immutable reward schema

**Files:**
- Create: `supabase/migrations/20260804110000_rewards_schema.sql`
- Create: `supabase/tests/rewards.test.sql`

- [ ] **Step 1: Write failing schema, RLS, and immutability tests**

Create two profile fixtures and assert `point_events`, `badges`, and `profile_badges` exist; ledger keys are unique per user; profile/badge links are unique; owners can read only their ledger; authenticated clients cannot insert/update/delete ledger rows; badge catalog and unlocked rows are readable without rule mutation grants; `streak_weeks` defaults to zero; and cached points cannot be directly updated by authenticated clients.

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
select has_table('public', 'point_events');
select has_table('public', 'badges');
select has_table('public', 'profile_badges');
select col_is_unique('public', 'point_events', array['user_id', 'dedupe_key']);
select col_is_unique('public', 'profile_badges', array['profile_id', 'badge_id']);
select * from finish();
rollback;
```

- [ ] **Step 2: Run the reward suite red**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: FAIL because reward tables do not exist.

- [ ] **Step 3: Implement schema and seed catalog**

Create:

```sql
create type public.point_event_reason as enum
  ('rsvp', 'attendance', 'hosting', 'admin_correction');
```

`point_events` stores UUID id, user, reason, signed amount, unique per-user dedupe key, optional source activity, object metadata, and timestamp. Revoke mutation grants from clients and add owner-select RLS only. Add `profiles.streak_weeks integer not null default 0`, `last_meetup_at timestamptz`, and `last_meetup_week date`; include these in authenticated profile select grants but not update grants.

`badges` uses stable text primary keys, name, description, icon key, rule kind, integer threshold, and active flag. `profile_badges` records one profile/badge pair plus unlocked timestamp and optional source event/activity. Seed exact badges:

| Key | Name | Rule |
|---|---|---|
| `first_meetup` | First Huddle | one confirmed attendance |
| `first_hosted` | Huddle Host | one confirmed hosted meetup |
| `four_week_streak` | Four Weeks Together | `streak_weeks >= 4` |
| `points_50` | 50 Point Milestone | `points >= 50` |
| `points_100` | 100 Point Milestone | `points >= 100` |
| `points_250` | 250 Point Milestone | `points >= 250` |

- [ ] **Step 4: Reset and rerun schema/RLS tests**

Run: `npx supabase db reset && npx supabase test db supabase/tests/rewards.test.sql`

Expected: PASS for schema, grants, owner reads, and immutable ledger boundaries.

- [ ] **Step 5: Commit the reward schema**

```powershell
git add supabase/migrations/20260804110000_rewards_schema.sql supabase/tests/rewards.test.sql
git commit -m "feat: add immutable rewards schema"
```

### Task 2: Implement idempotent awards and corrections

**Files:**
- Create: `supabase/migrations/20260804110100_rewards_engine.sql`
- Modify: `supabase/tests/rewards.test.sql`

- [ ] **Step 1: Add failing atomic-award tests**

Assert `award_points()` inserts a ledger row and increments cached points in one transaction; duplicate dedupe keys return the original event without increment; rewards-disabled returns no event/change; negative corrections cannot make total negative; normal clients cannot call the award function; safety owners can record a compensating correction with request UUID and reason; and `sum(point_events.amount) = profiles.points` after every case.

- [ ] **Step 2: Run the atomic tests red**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: FAIL because award functions are missing.

- [ ] **Step 3: Implement trusted ledger functions**

Create non-client-executable fixed-search-path functions:

```sql
award_points(
  p_user_id uuid,
  p_reason public.point_event_reason,
  p_amount integer,
  p_dedupe_key text,
  p_source_activity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.point_events

record_point_correction(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_request_id uuid
) returns public.point_events
```

`award_points()` locks the runtime config and profile, exits with null when rewards are disabled, validates allowed reason/amount combinations (`rsvp=2`, `attendance=10`, `hosting=15`, correction nonzero), inserts once, and updates cached total only for a newly inserted row. `record_point_correction()` requires `is_safety_owner()`, a non-empty reason up to 200 characters, constructs key `admin-correction:<request-id>`, and rejects a negative resulting balance. Metadata contains correction reason/request ID only.

- [ ] **Step 4: Rerun atomic and reconciliation tests**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: PASS, including duplicate no-op and exact ledger/profile reconciliation.

- [ ] **Step 5: Commit the ledger engine**

```powershell
git add supabase/migrations/20260804110100_rewards_engine.sql supabase/tests/rewards.test.sql
git commit -m "feat: award auditable Huddle points"
```

### Task 3: Award RSVP, attendance, hosting, and weekly streaks

**Files:**
- Modify: `supabase/migrations/20260804110100_rewards_engine.sql`
- Modify: `supabase/tests/rewards.test.sql`

- [ ] **Step 1: Add failing source-validation tests**

Test +2 only for a user's first going state per activity, no rejoin award, a maximum of three RSVP awards per user's local calendar day, +10 only for an authorized newly inserted `did_meet=true` pulse, no award for false, +15 host award only after a non-host going participant confirms, no host self-confirm, and one host award per activity.

- [ ] **Step 2: Add failing weekly streak tests**

Cover first confirmed week => 1; second meetup same local week => unchanged; immediately following week => increment; gap => reset to 1; ISO year boundary; New York DST week; and atomic update of `last_meetup_at`/`last_meetup_week`.

- [ ] **Step 3: Run source/streak tests red**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: FAIL because reward hooks and streak updater are absent.

- [ ] **Step 4: Implement validated reward hooks**

Add `profile_local_date()`/`profile_local_week()` using the notification preference timezone and fallback `America/New_York`. Add `update_meetup_streak(user, occurred_at)` that locks the profile and applies same/consecutive/gap rules. Add an after-insert/update RSVP trigger that detects a transition into going, counts that local day's existing `rsvp` ledger rows, and awards key `rsvp:<activity>` only while count is below three.

Add an after-insert pulse trigger. For `did_meet=true`, verify the going RSVP and award attendance key `attendance:<activity>`, update the attendee streak only when the event was newly inserted, and find the activity host. If the confirmer is not the host, award the host key `hosting:<activity>`. False responses do nothing.

- [ ] **Step 5: Rerun source/streak tests**

Run: `npx supabase db reset && npx supabase test db supabase/tests/rewards.test.sql`

Expected: PASS for caps, relationship validation, one-time awards, same/consecutive/reset weeks, year boundary, and DST dates.

- [ ] **Step 6: Commit reward hooks**

```powershell
git add supabase/migrations/20260804110100_rewards_engine.sql supabase/tests/rewards.test.sql
git commit -m "feat: reward confirmed Huddle participation"
```

### Task 4: Evaluate authoritative badges and restrained notifications

**Files:**
- Modify: `supabase/migrations/20260804110100_rewards_engine.sql`
- Modify: `supabase/tests/rewards.test.sql`

- [ ] **Step 1: Add failing badge and notification tests**

Assert first confirmed meetup, first confirmed hosting, four-week streak, and exact point thresholds unlock once. Assert ordinary +2/+10/+15 awards produce no reward notification, non-point badges create one `badge_unlocked` notification, point badges create one `points_milestone` notification instead of a second badge notification, and rerunning evaluation creates neither a duplicate badge nor notification/delivery.

- [ ] **Step 2: Run badge tests red**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: FAIL because `evaluate_badges()` is absent.

- [ ] **Step 3: Implement badge evaluation**

Create `evaluate_badges(p_user_id uuid, p_source_event_id uuid default null, p_source_activity_id uuid default null) returns setof public.profile_badges`. Read the locked profile plus ledger aggregates, insert each newly satisfied active badge with `on conflict do nothing`, and notify only inserted rows. Use type `points_milestone` for badge keys beginning `points_` and `badge_unlocked` otherwise; key `reward-badge:<user>:<badge>`; URL `/app/profile`; and data keys `badgeKey`, `badgeName`, and `points` only. Invoke evaluation after successful new point events and after streak updates.

- [ ] **Step 4: Run badge tests green**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: PASS with exactly one notification per meaningful milestone.

- [ ] **Step 5: Commit badge evaluation**

```powershell
git add supabase/migrations/20260804110100_rewards_engine.sql supabase/tests/rewards.test.sql
git commit -m "feat: unlock reward badges"
```

### Task 5: Add feature-controlled reward schedules and leaderboard

**Files:**
- Create: `supabase/migrations/20260804110200_rewards_schedules.sql`
- Modify: `supabase/tests/rewards.test.sql`
- Modify: `docs/notifications-operations.md`

- [ ] **Step 1: Add failing schedule and tie tests**

Assert deterministic ordering by `points desc, id asc`; only configured top three receive placement rows; ties are stable; Sunday local 18:00 warnings target users with positive streak whose last meetup week is before current week; Monday local 09:00 placement runs once per ISO week; no jobs exist while rewards are disabled; enabling adds exactly two named jobs; disabling removes them; and every producer rechecks `rewards_enabled`.

- [ ] **Step 2: Run schedule tests red**

Run: `npx supabase test db supabase/tests/rewards.test.sql`

Expected: FAIL because schedule lifecycle and producers are absent.

- [ ] **Step 3: Implement runtime switch and producers**

Add `leaderboard_places integer not null default 3 check (leaderboard_places between 1 and 10)` to runtime config. Create:

```sql
reward_leaderboard(p_limit integer default 100)
reward_summary(p_profile_id uuid)
produce_streak_at_risk(p_now timestamptz default now())
produce_leaderboard_placements(p_now timestamptz default now())
set_rewards_enabled(p_enabled boolean)
```

`reward_summary()` returns cached points, `streak_weeks`, and the count of attendance ledger events in the profile's current local week; it exposes no other ledger rows. The two notification producers return `{scanned, created, deduped, failed, skipped}` counts and gate on New York local weekday/hour. Placement keys include ISO year/week/user/place; warning keys include ISO year/week/user. `set_rewards_enabled()` requires `is_safety_owner()` or service role: it locks/updates config, unschedules both known job names, and only when enabling schedules hourly gates `huddle-streak-at-risk` and `huddle-leaderboard-placement`. Migration ends with rewards disabled and no reward cron jobs.

- [ ] **Step 4: Rerun schedule and tie tests**

Run: `npx supabase db reset && npx supabase test db supabase/tests/rewards.test.sql`

Expected: PASS for deterministic ties, local-time gates, schedule enable/disable lifecycle, and kill switch.

- [ ] **Step 5: Document reward operations and commit**

Document exact enable/disable RPCs, schedule inspection, manual producer calls, ledger/profile reconciliation query, badge audit query, and correction RPC authorization.

```powershell
git add supabase/migrations/20260804110200_rewards_schedules.sql supabase/tests/rewards.test.sql docs/notifications-operations.md
git commit -m "feat: schedule reward notifications"
```

### Task 6: Add typed reward queries and pure client model

**Files:**
- Modify: `lib/types/database.ts`
- Modify: `lib/types/huddle.ts`
- Modify: `lib/supabase/mappers.ts`
- Modify: `lib/supabase/queries.ts`
- Create: `lib/rewards/types.ts`
- Create: `lib/rewards/api.ts`
- Create: `lib/rewards/model.ts`
- Create: `tests/rewards/model.test.ts`
- Modify: `tests/supabase/mappers.test.ts`

- [ ] **Step 1: Write failing mapper/model tests**

Assert profiles map `streak_weeks` without relabeling `streak_days`, point history formats signed values/reasons/dates, badge rows render only unlocked active records, reward-disabled hides current reward actions but preserves historical display, leaderboard sorting matches database tie order, and a reconciliation helper reports the exact delta between ledger sum and cached points.

- [ ] **Step 2: Run focused tests red**

Run: `npm test -- tests/rewards/model.test.ts tests/supabase/mappers.test.ts`

Expected: FAIL because reward types/model are absent and mapper lacks `streak_weeks`.

- [ ] **Step 3: Regenerate types and implement queries**

Regenerate database types after a clean local reset. Add `streakWeeks` and optional `lastMeetupAt` to `HuddleProfile`, keeping `streakDays` for backward compatibility but removing its meetup label from UI. `api.ts` fetches runtime reward flag, `reward_summary()`, public unlocked badge joins for one profile, owner-only point history ordered newest first with a 25-row limit, and the database leaderboard RPC. No point ledger data is added to `fetchHuddleSnapshot()`.

- [ ] **Step 4: Implement pure reward helpers**

Export `formatPointReason`, `formatPointAmount`, `reconcilePoints`, `sortLeaderboard`, and `rewardVisibility`. Use exact labels `RSVP`, `Confirmed meetup`, `Confirmed hosting`, and `Admin correction`; positive amounts include `+`; disabled mode returns historical visibility true and earning controls false.

- [ ] **Step 5: Run tests and type checking**

Run: `npm test -- tests/rewards/model.test.ts tests/supabase/mappers.test.ts && npx tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 6: Commit typed reward reads**

```powershell
git add lib/types/database.ts lib/types/huddle.ts lib/supabase/mappers.ts lib/supabase/queries.ts lib/rewards tests/rewards/model.test.ts tests/supabase/mappers.test.ts
git commit -m "feat: read authoritative reward data"
```

### Task 7: Replace inferred reward UI

**Files:**
- Create: `components/rewards/reward-summary.tsx`
- Create: `components/rewards/badge-grid.tsx`
- Create: `components/rewards/points-history.tsx`
- Modify: `app/app/profile/page.tsx`
- Modify: `app/app/community/page.tsx`
- Modify: `app/app/profile/[id]/page.tsx`
- Create: `tests/rewards/components.test.tsx`

- [ ] **Step 1: Write failing rendered-state tests**

Use `react-dom/server` for pure presentational props. Assert the label is `week streak`, confirmed meetup copy is explicit, only actual badge names appear, empty badge/history states are honest, history is owner-only, rules list `+2 RSVP (daily cap)`, `+10 confirmed attendance`, and `+15 confirmed hosting`, and disabled mode says rewards are paused without deleting past totals/badges.

- [ ] **Step 2: Run component tests red**

Run: `npm test -- tests/rewards/components.test.tsx`

Expected: FAIL because reward components are missing.

- [ ] **Step 3: Implement profile surfaces**

Replace the placeholder badge-name map and `day streak` label in the current profile. Load runtime flag, current user's reward summary, actual badge joins, and private point history. Render cached points, `streakWeeks`, confirmed meetups this week from the summary RPC, the three award rules, badge grid, and the 25 newest ledger rows. On another user's profile, render public total/streak/badges only, never point history.

- [ ] **Step 4: Implement community leaderboard surface**

Use authoritative profile points with deterministic ID tie order and label the meetup streak as weeks. Hide reward call-to-action copy while disabled, preserve historical ranking display, and do not infer badges or completed meetups from RSVPs.

- [ ] **Step 5: Run focused and static checks**

Run: `npm test -- tests/rewards/components.test.tsx && npm run lint && npx tsc --noEmit`

Expected: PASS with no lint/type errors.

- [ ] **Step 6: Commit reward UI**

```powershell
git add components/rewards app/app/profile/page.tsx app/app/community/page.tsx app/app/profile/[id]/page.tsx tests/rewards/components.test.tsx
git commit -m "feat: show ledger-backed Huddle rewards"
```

### Task 8: Verify rewards and full notification system

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run all database tests from a clean reset**

Run: `npx supabase db reset && npx supabase test db`

Expected: core, producers, and rewards pgTAP suites all pass.

- [ ] **Step 2: Run explicit reconciliation and idempotency reruns**

For every profile fixture, run:

```sql
select p.id, p.points, coalesce(sum(e.amount), 0) as ledger_points
from public.profiles p
left join public.point_events e on e.user_id = p.id
group by p.id, p.points
having p.points <> coalesce(sum(e.amount), 0);
```

Expected: zero rows. Rerun RSVP, pulse, badge, streak-warning, and placement producers; expected totals, badge counts, notifications, and deliveries remain unchanged.

- [ ] **Step 3: Run all code checks**

Run: `node scripts/verify-match-score-parity.mjs && deno test --allow-env supabase/functions/send-push && deno check supabase/functions/send-push/index.ts && npm test && npm run lint && npx tsc --noEmit && npm run build`

Expected: every command exits zero.

- [ ] **Step 4: Run browser reward smoke tests**

At a mobile viewport, verify current profile totals/history/badges, another profile without private history, community tie ordering, week-streak copy, rewards-disabled copy, and reward notification deep links. Confirm a normal RSVP does not toast/push a reward, while a newly crossed badge/milestone creates one inbox row.

- [ ] **Step 5: Verify production runbook boundaries**

Confirm operations docs distinguish code readiness from live deployment: target migrations, Edge secrets, Vault entries, cron jobs, rollout flags, reward enablement, and a real-device Web Push receipt must still be checked in the production Supabase/Vercel environment before declaring live notifications operational.

- [ ] **Step 6: Commit verification corrections**

```powershell
git add -A
git commit -m "test: verify Huddle notifications and rewards"
```
