# Huddle Rewards and Reward Notifications Design

## Goal

Make Huddle's currently displayed points, streaks, badges, and leaderboard values trustworthy and auditable, then emit restrained reward notifications through the existing notification core.

This is the third independently deployable milestone. It depends on notification core, scheduled producers, and the pulse response flow.

## Reward principles

- Confirmed real-world participation matters more than app activity.
- Every award is ledger-backed and idempotent.
- Aggregate profile counters cannot be written directly by clients.
- Reward notifications celebrate meaningful milestones, not every point mutation.
- The rules are intentionally small and visible to students.

## Database model

### `point_events`

- immutable UUID primary key
- owner profile ID
- reason enum or constrained value
- signed point amount
- deterministic dedupe key unique per user
- source activity ID when applicable
- creation timestamp and metadata containing only non-sensitive source identifiers

Owners may read their ledger. Only trusted definer functions may insert. Updates and deletes are not granted to clients.

### Profile reward fields

- `points` remains the cached total maintained only by `award_points()`
- add `streak_weeks integer not null default 0`
- add `last_meetup_at timestamptz`
- add `last_meetup_week date`

The existing `streak_days` field is no longer presented as the meetup streak. It remains untouched for backward compatibility until a separate daily-engagement feature defines it.

### Badges

`badges` contains stable badge keys, names, descriptions, icon identifiers, and rule configuration. `profile_badges` links a profile and badge with a unique pair, unlock timestamp, and source point event or activity where relevant.

The initial badge set is deliberately small:

- first confirmed meetup;
- first successfully confirmed hosted meetup;
- four-week meetup streak;
- defined point milestones used by the current profile experience.

Client-side badge inference is removed. UI reads actual unlocked rows.

## Award rules

`award_points(user_id, reason, amount, dedupe_key, source_activity_id)` is a fixed-search-path `security definer` function unavailable to normal clients. It inserts the ledger event and increments `profiles.points` in one transaction. A duplicate key returns the existing result without changing points.

- RSVP: +2 when a user first becomes `going`, capped to a small number of RSVP awards per local calendar day. Rejoining the same activity does not award again.
- Confirmed attendance: +10 once when an eligible going participant records `did_meet = true`.
- Confirmed hosting: +15 once after at least one non-host going participant records `did_meet = true` for the hosted activity.

False pulse responses do not award points. Changing a stored response is not supported in the first version; corrections require an administrator path and an explicit compensating ledger entry rather than mutating history.

## Weekly streaks

A confirmed attendance event derives the user's local meetup week. The streak function:

- does nothing when another confirmed meetup occurs in the same week;
- increments when the prior confirmed week is exactly one week earlier;
- resets to one after a longer gap;
- updates `last_meetup_at` and `last_meetup_week` atomically.

Sunday warnings target users with a streak greater than zero whose last confirmed meetup week precedes the current week. Monday recaps use the stored, already-updated streak. This avoids an ambiguous cron-only streak calculation.

The rewards migration schedules Sunday 18:00 America/New_York streak warnings and Monday 09:00 America/New_York leaderboard-placement notifications. These jobs are absent while rewards are disabled.

## Badge and milestone evaluation

After a successful point or attendance transaction, one `evaluate_badges(user_id)` function checks the small rule catalog and inserts missing `profile_badges` rows. Inserted rows call `create_notification()` with one dedupe key per user/badge.

Point-milestone notifications use fixed thresholds and one dedupe key per threshold. Normal +2/+10/+15 awards update UI without creating a push.

Weekly leaderboard placement uses the authoritative point total with deterministic tie ordering. Only the configured top placements receive a placement notification; all users can still view the leaderboard.

## Client changes

Profile and community pages read real ledger-backed totals, `streak_weeks`, and unlocked badges. The profile can show a short points-history view using the owner's RLS-protected ledger.

The UI explains the three award rules and makes clear that attendance confirmation drives streaks. It never labels unconfirmed RSVP counts as completed meetups.

Reward features are hidden when the database runtime flag is disabled. Disabling rewards stops new awards and reward notifications but preserves historical ledger and badge data.

## Integrity and abuse controls

- All award entry points validate the source activity, RSVP, host, and pulse relationship in the database.
- Dedupe keys are constructed server-side.
- RSVP daily caps use the student's configured timezone.
- A host cannot self-confirm the hosting award.
- Ledger corrections are signed compensating events with an administrator reason, not row edits.
- Point and badge metadata excludes chat, safety, and private profile content.

## Testing and acceptance criteria

Database integration tests cover:

- ledger immutability and RLS;
- atomic total updates and duplicate award no-ops;
- RSVP daily cap and rejoin behavior;
- attendance authorization and one-time award;
- host award only after non-host confirmation;
- same-week, consecutive-week, and reset streak behavior across year and daylight-saving boundaries;
- badge uniqueness and exact thresholds;
- point milestones and restrained notification behavior;
- deterministic leaderboard ties;
- runtime kill-switch behavior;
- compensating correction events.

Client tests verify actual badge rendering, points history ownership, `streak_weeks` copy, and disabled-feature states. The full notification and producer verification gates run again.

The milestone is accepted only when points rendered in the app reconcile exactly to each user's ledger, streaks derive from confirmed attendance, badge rows are authoritative, and rerunning any producer cannot double-award or duplicate a reward notification.
