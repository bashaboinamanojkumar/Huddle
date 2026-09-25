# Huddle Notification Core Design

## Goal

Build a secure, durable notification inbox and Web Push delivery system for Huddle. This is the first independently deployable milestone. It creates the shared notification pipeline used later by event producers and the rewards engine.

## Current project context

Huddle is a Next.js 16 App Router PWA using Supabase Auth, Postgres, RLS, Realtime, and typed browser clients. Activity, RSVP, chat, moderation, pulse, and friend data already live in Supabase. The app has a hand-written service worker, a shared `HuddleProvider`, Sonner, and two overlapping PWA installation prompts.

The notification system must not join `fetchHuddleSnapshot()`. That snapshot refetches the full application dataset after mutations, while notifications need independent pagination, unread state, and Realtime updates.

## Approved product decisions

- Expose an accessible notification bell with unread count only in the page-specific Feed and Community headers.
- Use one grouped chronological inbox with `Today` and `This week` sections.
- Ask for push permission only after the first successful RSVP.
- On iPhone and iPad, installation comes before push permission.
- Keep the inbox complete even when a push category is disabled. Preferences control push delivery, not notification creation.
- Use one database-first outbox and one Edge Function. Do not add an external queue service.

## Architecture

Postgres is the source of truth. Every notification is a durable `notifications` row. A notification can create one `notification_deliveries` row for each active browser/device subscription. Supabase Realtime updates the in-app inbox immediately. An authenticated Supabase Edge Function atomically claims due delivery rows and sends Web Push.

The delivery function is invoked immediately through an asynchronous `pg_net` database webhook and periodically by `pg_cron`. Both routes call the same Edge Function and the same atomic claim function, so retries cannot send a claimed delivery twice.

The retry schedule is a recovery path, not a second queue. The worker handles immediate and scheduled invocations identically.

## Database model

### `notifications`

- `id uuid primary key`
- `user_id uuid not null references profiles(id) on delete cascade`
- `type notification_type not null`
- `category notification_category not null`
- `title text not null`
- `body text not null`
- `url text not null`
- `data jsonb not null default '{}'`
- `dedupe_key text not null`
- `read_at timestamptz`
- `seen_at timestamptz`
- `created_at timestamptz not null default now()`
- `last_event_at timestamptz not null default now()`
- unique `(user_id, dedupe_key)`
- index `(user_id, last_event_at desc, id desc)`

The notification categories are `chat`, `activities`, `reminders`, `social`, `safety`, `digest`, and `rewards`. The initial type catalog is `chat_message`, `chat_opened`, `activity_joined`, `activity_approved`, `activity_rejected`, `event_reminder_24h`, `event_reminder_1h`, `waitlist_promoted`, `pulse_prompt`, `friend_request`, `friend_accepted`, `friend_rsvp`, `safety_review`, `safety_report_status`, `activity_match_digest`, `weekly_recap`, `streak_at_risk`, `points_milestone`, `badge_unlocked`, and `leaderboard_placement`.

The URL must be a safe same-origin application path beginning with one `/` and not `//`. Notification producer functions supply URLs from known route patterns. The `data` value contains identifiers needed for rendering or deep-link handling, never secrets or raw auth data.

### `notification_preferences`

- one row per profile
- one push-enabled boolean per notification category
- digest defaults off; other categories default on
- quiet-hours start/end, IANA timezone, and a daily push-notification cap
- a master push-enabled switch
- timestamps for creation and last update

Defaults are created by both new-user provisioning and the existing profile-repair path so old and new users behave identically.

### `push_subscriptions`

- one row per browser/device endpoint
- owner profile ID, endpoint, `p256dh`, `auth`, user-agent summary, timestamps, failure count, and disabled timestamp
- endpoint is globally unique
- subscription save is idempotent and reassigns an endpoint only when the current authenticated browser proves possession by supplying that endpoint and keys

Raw endpoints and encryption keys are never exposed in administrator aggregates or logs.

### `notification_deliveries`

- one row per notification/subscription pair
- unique `(notification_id, subscription_id)`
- state: `pending`, `deferred`, `processing`, `sent`, `failed`, or `skipped`
- `deliver_after`, claim timestamp/token, attempt count, last error code, sent timestamp, and update timestamp
- indexes for due work and expired processing leases

This per-subscription table is required because a student can have multiple devices. A single status on `notifications` could not safely retry a failed device without resending to devices that already succeeded.

### `notification_runtime_config`

One singleton row controls core notifications, Web Push, rewards, and push rollout percentage. Authenticated clients may read it. Only server-side administrator functions may update it. The Edge Function rechecks it before sending.

## Database functions and security

`create_notification()` is a `security definer` function available only to trusted database functions and the service role. It validates inputs, inserts idempotently, calculates quiet-hours deferral, applies the rollout flag, and creates delivery rows for active subscriptions when push is eligible. It always creates the inbox row even when push is disabled.

Quiet-hours calculations use the user's IANA timezone at execution time so daylight-saving transitions are handled by Postgres. A quiet-hours interval crossing midnight is supported. The daily cap counts distinct sent notification IDs, not device deliveries.

Clients use narrow authenticated RPCs to:

- mark one notification read;
- mark all of their notifications read;
- update allowed preference fields;
- save or disable their own push subscription.

Clients never receive direct update rights to notification content or delivery state.

RLS permits owners to select their notification rows, preferences, and subscriptions. Delivery rows have no client policy or grant. All definer functions set a fixed `search_path`, authorize `auth.uid()`, and avoid caller-controlled dynamic SQL. The service role key, VAPID private key, and dispatch secret never reach the browser.

## Client design

`NotificationProvider` owns:

- the first cursor-paginated inbox page;
- loading, empty, error, and retry states;
- unread total and unread chat total;
- optimistic read mutations with rollback on failure;
- preferences and subscription state;
- filtered Realtime subscriptions for both `INSERT` and `UPDATE` events.

The provider is mounted inside authenticated application UI, not around public routes. Realtime uses a `user_id` filter and selects only the notification columns needed by the client. Coalescing updates replace the existing item, move it by `last_event_at`, and restore unread state.

Feed and Community each place the shared notification bell in their existing page-specific header. Feed orders its actions Bell, Share, then Profile; Community orders Bell, then Profile. Other authenticated routes retain their own page-specific chrome without a notification bell or a separate global header. The bell links to `/app/notifications`, exposes the unread count with accessible text, and does not replace any bottom-navigation tab. The Chats tab displays a dot when unread chat notifications exist.

The inbox uses the approved grouped chronological layout. Activating a row marks it read and then navigates to its validated application path. The inbox supports a mark-all-read action and cursor-based load-more behavior.

The settings page controls push categories, quiet hours, timezone, master push enablement, and the current device subscription. Controls use explicit save/error feedback and do not claim success before Supabase confirms it.

## Installation and permission flow

The two current installation prompts are consolidated into one coordinator.

After the first successful RSVP, the application records a local prompt-eligibility marker. It does not call the native permission API automatically.

- If the device lacks Service Worker, Push API, or Notifications API support, the push prompt is not shown.
- If an iPhone/iPad app is not running in standalone mode, Huddle shows installation guidance and defers push permission.
- If the app is installed or the browser supports normal Web Push, Huddle shows its own value explanation.
- Only the student's `Enable alerts` action calls `Notification.requestPermission()` and subscribes through `PushManager`.
- Dismissal is remembered with a cooling-off period; a settings action can always retry when browser permission is still `default`.
- A browser-level `denied` state is explained without repeatedly prompting.

## Service worker behavior

The existing cache and protected-route safeguards remain intact.

The service worker adds:

- `push`: parse a validated payload, fall back to a generic Huddle notification for malformed payloads, use a stable tag for replacement/coalescing, display the user-visible notification, and update the application badge when available;
- `notificationclick`: close the banner, validate a same-origin application path, focus/navigate an existing client or open a new window;
- `pushsubscriptionchange`: notify open clients that the subscription needs repair.

The authenticated application reconciles the browser subscription with Supabase on every app start, after permission grant, and after a worker repair message. The service worker does not attempt an unauthenticated database write.

The pasted plan's “skip the banner when a focused client is viewing the URL” rule is removed. Web Push subscriptions use `userVisibleOnly`; received push events must produce a visible notification. To avoid a duplicate foreground experience, Sonner arrival toasts are used only when push permission is not granted. Realtime still updates the inbox and counters in every state.

## Edge Function and delivery reliability

The `send-push` Edge Function:

1. authenticates the dispatch request using a secret stored in Supabase secrets and Vault;
2. calls an atomic database claim function for due deliveries;
3. sends standards-based VAPID Web Push with minimal payloads;
4. records each delivery result;
5. disables subscriptions on `404` or `410`;
6. retries `429`, network, and `5xx` failures with bounded backoff;
7. treats other permanent `4xx` responses as failed;
8. stops after five attempts.

Processing claims expire so a worker terminated after claiming cannot strand work. Every result update includes the claim token, preventing an expired worker from overwriting a later attempt.

Payloads contain a short title, a generic or truncated body, a same-origin path, a notification ID, tag, and unread badge count. Chat text is limited and no safety-report content, private moderation notes, subscription endpoints, or auth data is sent through push providers.

## Operations and observability

The safety-owner admin area gains a notification operations page with aggregate opt-in, active subscription, due, sent, failed, retry, and disabled-endpoint counts. It shows recent error codes by category, never notification bodies or endpoint values.

The runtime-config row supports a zero-percent dark launch, controlled rollout percentage, global push kill switch, and rewards switch. Rollout assignment is deterministic per user.

Cleanup removes read notifications older than 30 days, permanently failed delivery records after their audit window, and subscriptions disabled longer than 60 days.

## Testing and acceptance criteria

Automated coverage must include:

- RLS ownership and forbidden client writes;
- notification dedupe and safe URL validation;
- quiet hours across midnight and daylight-saving boundaries;
- daily cap counting notifications rather than devices;
- atomic claims, expired leases, retry decisions, and multi-device partial failure;
- subscription replacement and disabling;
- cursor pagination, insert/update Realtime reconciliation, unread counters, and rollback;
- permission eligibility and iOS install-first sequencing;
- service-worker push, click, invalid payload, and subscription-change behavior;
- privacy-safe payload construction;
- feature-flag and rollout decisions.

The milestone is complete only when focused and full tests pass, ESLint and TypeScript are clean, the production build succeeds, Edge Function checks pass, database integration tests pass against a disposable Supabase instance, and browser smoke tests cover the approved header, inbox, settings, prompt, and deep link.

Live Web Push is not declared operational until migrations, `pg_net`, `pg_cron`, Vault values, VAPID keys, Edge Function deployment, production environment variables, and at least one real-device delivery are verified in the target Supabase/Vercel environment.

## External references

- Supabase Realtime database changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase database webhooks: https://supabase.com/docs/guides/database/webhooks
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase scheduled Edge Functions and Vault: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase Edge Function dependencies: https://supabase.com/docs/guides/functions/dependencies
- WebKit Web Push on iOS/iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
