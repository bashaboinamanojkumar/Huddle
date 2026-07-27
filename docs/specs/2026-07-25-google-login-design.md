# Google-Only Campus Login Design

## Goal

Replace Hurdle's simulated magic-link flow with real Google OAuth through Supabase Auth. Only Google accounts whose verified email domain is exactly `umd.edu` or `umaryland.edu` may enter the application.

## Current Project Context

Hurdle is a Next.js 16 App Router PWA. The activity, RSVP, chat, moderation, and onboarding experiences currently run against a typed browser `localStorage` store seeded from `lib/data/seed.ts`. The repository also contains Supabase browser/server helpers and a session-refresh middleware, but those helpers are not connected to the current login UI or route authorization.

This feature will make authentication real without migrating the full demo data model to Supabase. After Supabase authenticates a user, the application will bridge the stable Supabase user ID, verified email, and Google display-name metadata into the existing local Huddle store. That preserves the current product behavior while replacing the insecure simulated account boundary.

## Scope

### Included

- Google as the only sign-in method.
- Supabase PKCE OAuth with a server callback that stores the session in cookies.
- Exact-domain enforcement for `umd.edu` and `umaryland.edu`.
- Server-side protection for `/app`, `/onboarding`, and other authenticated application routes.
- A post-authentication bridge that creates or restores the corresponding local Huddle profile.
- Supabase and local-state sign-out.
- A secure-by-default authorization guard for `/app/admin/*` based on `app_metadata.role === "safety_owner"`.
- User-facing handling for OAuth cancellation, provider errors, invalid callbacks, missing or unverified email, disallowed domain, and expired sessions.
- Automated unit and integration-oriented tests for authentication policy and route decisions.
- Repair of existing lint and TypeScript blockers required for a clean delivery gate.
- Setup documentation for Google Cloud, Supabase Auth, localhost, Vercel production, and administrator role assignment.

### Excluded

- Migrating activities, RSVPs, chats, reports, or profiles from the browser store to Supabase tables.
- Google One Tap or automatic sign-in.
- Access to Google APIs beyond the basic OpenID, email, and profile scopes required for login.
- Password, email magic-link, or non-Google authentication.
- Accepting subdomains such as `dept.umd.edu`; only the two exact domains are eligible.
- Building an administrator-management UI.

## Architecture

### Supabase Clients and Next.js Proxy

The existing browser and server clients remain the single Supabase construction points. The project will adopt the current Next.js 16 `proxy.ts` convention and move the session-refresh logic to `lib/supabase/proxy.ts`.

The proxy will validate the token with Supabase rather than trusting an unverified cookie session. It will apply these routing rules:

- Unauthenticated requests to `/app` or `/onboarding` redirect to `/verify` with a safe relative return path.
- Authenticated requests to `/verify`, `/login`, or `/signup` redirect to the post-login continuation route.
- Public pages, static assets, the OAuth callback, and the authentication error route remain accessible without a session.
- Return paths must begin with one `/` and must not begin with `//`; unsafe values fall back to `/app`.

### Login UI

`/verify` becomes a Google-only sign-in screen that preserves the existing Huddle visual language. The current campus-email form, fake “magic link ready” state, waitlist mutation, and “Open secure link” action are removed.

The button calls `supabase.auth.signInWithOAuth` with:

- provider `google`;
- a callback URL at `/auth/callback`;
- a safe continuation target at `/auth/continue`;
- `prompt=select_account`, so users can choose the correct campus account.

The UI disables the button while the redirect is starting and displays an inline error if Supabase cannot initiate OAuth. It will state clearly that only UMD and University of Maryland Google accounts are accepted.

### OAuth Callback and Domain Enforcement

`GET /auth/callback` will:

1. Validate the authorization code and safe relative continuation target.
2. Exchange the PKCE code for a Supabase session using the server client.
3. Fetch the server-validated user.
4. Require a nonempty, verified email address.
5. Parse the email address and compare its normalized domain for exact equality with `umd.edu` or `umaryland.edu`.
6. Sign the user out immediately if the identity is ineligible.
7. Redirect eligible users to `/auth/continue` and rejected users to `/verify` with a stable, non-sensitive error code.

Google's hosted-domain hint is not an authorization control and will not be relied upon. The callback is the authoritative eligibility gate.

### Local Profile Bridge

`/auth/continue` is a minimal client route with no prefetched application links. It obtains the server-established Supabase user, then calls a focused Huddle-store operation with:

- Supabase user UUID;
- normalized campus email;
- Google full name and avatar metadata when available.

The store operation is idempotent:

- Existing local users are selected without duplicating users or profiles.
- New users receive a local session and a default incomplete profile.
- The first name and last initial are derived from trusted Google metadata when present, with the existing email-derived fallback.
- Existing onboarding choices and activity state are preserved.

New users go to `/onboarding`. Users whose local profile has `completedOnboarding` go to the safe requested application route, defaulting to `/app`.

The local session is a UI/data-store association only. Supabase cookies remain the authentication authority.

### Sign-Out

Sign-out becomes asynchronous and performs both operations:

1. `supabase.auth.signOut()` invalidates the Supabase browser session.
2. The Huddle store clears its local user-session association.

The user is then sent to `/` and the router is refreshed so protected server content cannot remain visible. A Supabase sign-out failure is surfaced to the user and does not falsely claim success.

### Administrator Authorization

Authentication alone must not expose the safety review queue. A server layout under `/app/admin` will require a validated Supabase user whose `app_metadata.role` is exactly `safety_owner`. Everyone else is redirected to `/app` without rendering admin content.

The role is server-controlled Supabase app metadata, not editable user metadata. Setup documentation will describe how an authorized project operator assigns the role. No user is treated as an administrator by default.

## Shared Authentication Policy

A small pure module will own:

- the two allowed campus domains;
- exact email parsing and eligibility checks;
- safe relative return-path normalization;
- stable authentication error codes and user-facing messages.

The callback, proxy, login screen, and tests will use the same policy functions so domain or redirect logic cannot drift between layers.

## Error Handling

The browser will receive stable error codes rather than raw provider or token details. `/verify` will translate those codes into concise messages:

- `oauth_start_failed`: Google sign-in could not be started.
- `oauth_cancelled`: Google sign-in was cancelled or denied.
- `invalid_callback`: the callback code was missing, invalid, or expired.
- `missing_email`: Google did not return a usable verified email.
- `campus_account_required`: the account is not an exact `umd.edu` or `umaryland.edu` account.
- `session_expired`: a previously authenticated session is no longer valid.
- `sign_in_required`: a protected route was requested with no session cookie at all. Distinguished from `session_expired` so a first-time visitor is prompted rather than told a session lapsed, and rendered as a neutral notice instead of an error.

Logs may record the error category but must not print access tokens, refresh tokens, authorization codes, or full user profiles.

## Test Strategy

The project currently has no test runner, so a lightweight Vitest configuration will be added. Tests will be written before production changes and observed failing for the expected missing behavior.

Coverage will include:

- exact acceptance of mixed-case and whitespace-normalized `umd.edu` and `umaryland.edu` emails;
- rejection of lookalike, suffix, subdomain, missing-domain, and malformed addresses;
- safe acceptance of relative return paths and rejection of protocol-relative or absolute redirects;
- OAuth start options, callback success, callback failure, and rejected-domain sign-out behavior through injected Supabase dependencies;
- local profile bridge idempotency and new-versus-returning routing;
- protected/public/admin route decisions;
- dual sign-out behavior and failure handling;
- login-screen error-code presentation.

The final delivery gate is:

1. Authentication test suite passes.
2. Full test suite passes.
3. ESLint reports no errors.
4. TypeScript reports no errors.
5. Next.js production build succeeds.
6. Local browser smoke test verifies redirect, rejected-domain messaging, protected-route redirect, returning-user routing, and sign-out.
7. A real Google OAuth round trip is verified after the external Google and Supabase dashboard settings are available.

## Existing Baseline Repairs

The following current blockers will be repaired because they prevent reliable verification:

- Declare the Node environment for `next.config.mjs` so ESLint recognizes `process`.
- Use valid separate web-manifest icon purpose values.
- Import the missing `RsvpStatus` type.
- Regenerate or remove stale `.next` route-type artifacts before the final typecheck.

Unused-variable warnings will be cleaned where they are in files touched by this work. Unrelated product behavior will not be refactored.

## External Configuration

Code alone cannot enable Google OAuth. The deployment checklist will require:

- A Google Cloud Web OAuth client with the application origins.
- The Supabase project callback URL registered as Google's authorized redirect URI.
- Google provider enabled in Supabase with the client ID and secret.
- Supabase Site URL set to the production Hurdle origin.
- Supabase redirect allow-list entries for localhost, the production `/auth/callback`, and explicitly approved Vercel preview patterns if previews need authentication.
- `NEXT_PUBLIC_SUPABASE_URL` and a public anon/publishable key in local and Vercel environments.
- The production domain served over HTTPS.
- A server-controlled `safety_owner` app-metadata role assigned only to approved reviewers.

Google client secrets and Supabase service-role keys must never be committed or exposed through `NEXT_PUBLIC_*` variables.

## Acceptance Criteria

- The old simulated magic-link UI and action no longer exist.
- Selecting Google starts the Supabase PKCE OAuth flow.
- Only exact `umd.edu` and `umaryland.edu` verified accounts can reach protected application routes.
- Disallowed Google accounts are signed out and receive a clear campus-account message.
- Unauthenticated direct navigation to `/app`, including `/app/admin/review`, cannot render protected content.
- Authenticated non-safety-owner users cannot render `/app/admin/*`.
- New eligible users enter onboarding; returning eligible users retain their local onboarding state and enter the app.
- Sign-out invalidates Supabase authentication and clears the local session.
- Authentication errors do not leak secrets or trap the user in a redirect loop.
- Tests, lint, typecheck, and production build pass on the completed checkout.
