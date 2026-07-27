# Google-Only Campus Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Hurdle's simulated magic-link boundary with Supabase Google PKCE login restricted to verified exact-domain `umd.edu` and `umaryland.edu` accounts.

**Architecture:** Pure modules in `lib/auth` own policy, callback orchestration, routing decisions, OAuth options, and sign-out ordering so security-sensitive behavior is directly unit tested. Next.js `proxy.ts` and server route/layout adapters connect those pure decisions to Supabase, while an idempotent pure store bridge associates the validated Supabase identity with the existing local demo data.

**Tech Stack:** Next.js 16 App Router and proxy, React 19, TypeScript, Supabase SSR/Auth, Vitest, pnpm, Conda environment `hurdle`.

---

## File map

- `lib/auth/policy.ts`: exact campus-domain policy, safe return paths, stable error messages.
- `lib/auth/oauth.ts`: deterministic Google OAuth options for the login UI.
- `lib/auth/callback.ts`: dependency-injected callback exchange and identity eligibility orchestration.
- `lib/auth/routing.ts`: pure public/protected/auth-page route decisions.
- `lib/auth/sign-out.ts`: Supabase-first dual sign-out ordering.
- `lib/store/profile-bridge.ts`: pure, idempotent Supabase-to-local-state bridge.
- `lib/supabase/proxy.ts`, `proxy.ts`: cookie refresh, validated user lookup, protected-route redirects.
- `app/auth/callback/route.ts`: server callback adapter.
- `app/auth/continue/page.tsx`: hydrated client bridge and new/returning-user routing.
- `app/verify/page.tsx`: Google-only login UI and stable error presentation.
- `app/app/admin/layout.tsx`: server-side `safety_owner` authorization.
- `app/app/profile/page.tsx`: asynchronous dual sign-out UI.
- `lib/store/huddle-store.tsx`: expose hydration and identity-bridge operations; remove simulated email login.
- `tests/auth/*.test.ts`, `tests/store/*.test.ts`: policy, OAuth, callback, proxy, bridge, and sign-out coverage.
- `docs/google-oauth-setup.md`, `.env.example`: local, Google Cloud, Supabase, Vercel, and role setup.

### Task 1: Test runner and shared authentication policy

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.ts`
- Create: `tests/auth/policy.test.ts`
- Create: `lib/auth/policy.ts`

- [ ] **Step 1: Add Vitest and a deterministic test command**

Add `"test": "vitest run"` to scripts and `"vitest"` to dev dependencies. Configure the `@` alias in `vitest.config.ts` with `fileURLToPath(new URL(".", import.meta.url))`.

- [ ] **Step 2: Write failing policy tests**

Cover acceptance of trimmed/mixed-case exact campus emails; rejection of subdomains, suffix lookalikes, malformed addresses, and empty values; safe single-slash return paths; rejection of absolute/protocol-relative/auth-loop paths; and every stable error-code message.

- [ ] **Step 3: Verify RED**

Run: `conda run -n hurdle .\node_modules\.bin\vitest.CMD run tests\auth\policy.test.ts`

Expected: FAIL because `@/lib/auth/policy` does not exist.

- [ ] **Step 4: Implement the pure policy**

Export:

```ts
export const CAMPUS_DOMAINS = ["umd.edu", "umaryland.edu"] as const
export type AuthErrorCode =
  | "oauth_start_failed" | "oauth_cancelled" | "invalid_callback"
  | "missing_email" | "campus_account_required" | "session_expired"
export function normalizeCampusEmail(value: string): string | null
export function isEligibleCampusEmail(value: string): boolean
export function normalizeReturnPath(value: string | null | undefined, fallback = "/app"): string
export function getAuthErrorMessage(value: string | null | undefined): string | null
```

Email parsing must require exactly one nonempty local part and exact lower-cased domain equality. Return paths must start with one slash, reject URLs and auth entry/callback loops, and fall back safely.

- [ ] **Step 5: Verify GREEN**

Run the focused policy test and confirm all cases pass.

### Task 2: OAuth options and Google-only login screen

**Files:**
- Create: `tests/auth/oauth.test.ts`
- Create: `lib/auth/oauth.ts`
- Modify: `app/verify/page.tsx`

- [ ] **Step 1: Write a failing OAuth-options test**

Assert provider `google`, `prompt: "select_account"`, the origin-scoped `/auth/callback`, and a percent-encoded safe `next` value. Assert unsafe continuation values become `/app`.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm the missing module is the failure.

- [ ] **Step 3: Implement minimal OAuth option creation**

```ts
export function createGoogleOAuthOptions(origin: string, next: string | null) {
  const returnTo = normalizeReturnPath(next)
  const callback = new URL("/auth/callback", origin)
  callback.searchParams.set("next", returnTo)
  return { provider: "google" as const, options: {
    redirectTo: callback.toString(), queryParams: { prompt: "select_account" },
  } }
}
```

- [ ] **Step 4: Replace simulated login UI**

Remove campus-email form, waitlist mutation, fake magic-link state, and `Open secure link`. Render one Google button that calls `signInWithOAuth(createGoogleOAuthOptions(window.location.origin, searchParams.get("next")))`, disables during startup, and maps startup/query errors through the shared policy without rendering raw provider details.

- [ ] **Step 5: Verify GREEN**

Run OAuth and policy tests.

### Task 3: Server callback and exact-domain enforcement

**Files:**
- Create: `tests/auth/callback.test.ts`
- Create: `lib/auth/callback.ts`
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Write failing callback tests**

Use injected `exchangeCodeForSession`, `getUser`, and `signOut` functions. Cover eligible success, provider cancellation, missing/failed code, missing or unconfirmed email, and disallowed-domain immediate sign-out. Assert destinations contain only stable error codes.

- [ ] **Step 2: Verify RED**

Run the callback test and confirm it fails because the orchestration module is absent.

- [ ] **Step 3: Implement callback orchestration**

Return `/auth/continue?next=<safe path>` only after a successful code exchange and server-validated eligible user. Map access denial to `oauth_cancelled`; map missing/expired exchanges to `invalid_callback`; map absent/unverified email to `missing_email`; sign out ineligible users and return `campus_account_required`.

- [ ] **Step 4: Add the route adapter**

`GET` constructs the Supabase server client, delegates to the pure callback handler, and returns `NextResponse.redirect(new URL(destination, request.url))`. Log only a stable category, never tokens, codes, or user objects.

- [ ] **Step 5: Verify GREEN**

Run callback and policy tests.

### Task 4: Validated proxy route protection

**Files:**
- Create: `tests/auth/routing.test.ts`
- Create: `lib/auth/routing.ts`
- Create: `lib/supabase/proxy.ts`
- Create: `proxy.ts`
- Delete: `middleware.ts`
- Delete: `lib/supabase/middleware.ts`

- [ ] **Step 1: Write failing routing tests**

Cover public pass-through; unauthenticated `/app`, descendants, and `/onboarding`; authenticated redirects away from `/verify`, `/login`, and `/signup`; safe preservation of path/query; ineligible-session rejection; and no redirect loops for callback/error routes.

- [ ] **Step 2: Verify RED**

Run the routing test and confirm the missing module is the failure.

- [ ] **Step 3: Implement pure decisions**

```ts
export type AuthState = "anonymous" | "eligible" | "ineligible"
export type RouteDecision = { kind: "next" } | { kind: "redirect"; destination: string }
export function decideAuthRoute(url: URL, authState: AuthState): RouteDecision
```

Protected paths are `/app` and `/onboarding`; auth entry paths are `/verify`, `/login`, and `/signup`. Anonymous protected access redirects to `/verify?error=session_expired&next=...`; ineligible sessions receive `campus_account_required`; eligible users leave auth entry pages for their safe continuation.

- [ ] **Step 4: Implement Supabase proxy adapter**

Use `createServerClient`, synchronize refreshed cookies onto both request and response, call `auth.getUser()` (not `getSession()`), derive eligibility with the shared email policy and confirmed-email timestamp, sign out ineligible sessions, and copy refreshed cookies to redirect responses.

- [ ] **Step 5: Adopt Next.js 16 proxy convention**

Export `proxy` and the existing static-asset matcher from root `proxy.ts`; remove the obsolete middleware adapters.

- [ ] **Step 6: Verify GREEN**

Run routing, policy, and callback tests.

### Task 5: Idempotent local profile bridge and continuation page

**Files:**
- Create: `tests/store/profile-bridge.test.ts`
- Create: `lib/store/profile-bridge.ts`
- Modify: `lib/store/huddle-store.tsx`
- Modify: `lib/data/seed.ts`
- Create: `app/auth/continue/page.tsx`

- [ ] **Step 1: Write failing bridge tests**

Cover new UMD and UMB users, trusted Google-name/avatar metadata, email-name fallback, repeated calls without duplicate users/profiles, returning users preserving onboarding/activity state, and `/onboarding` versus safe requested-route results.

- [ ] **Step 2: Verify RED**

Run the focused bridge test and confirm the module is absent.

- [ ] **Step 3: Implement the pure bridge**

```ts
export interface AuthenticatedIdentity { id: string; email: string; fullName?: string; avatarUrl?: string }
export function bridgeAuthenticatedIdentity(
  state: HuddleState, identity: AuthenticatedIdentity, requestedPath?: string | null
): { state: HuddleState; destination: string }
```

Use Supabase UUID as the local identity, append only missing user/profile records, preserve existing records and all activity data, set a 30-day local UI association, and route incomplete profiles to onboarding.

- [ ] **Step 4: Expose hydration and bridge operations**

Remove `signInWithEmail`, `addToWaitlist`, and exported permissive `isCampusEmail`. Add `hydrated`, `bridgeAuthenticatedUser`, and `clearLocalSession`. Import the missing `RsvpStatus` type. Set seeded authentication session to `null` so demo state is not an authentication claim.

- [ ] **Step 5: Add continuation page**

After store hydration, call server-validated `supabase.auth.getUser()`, reject missing/expired/ineligible identities, bridge the Google UUID/email/name/avatar, and `router.replace(destination)`. The page contains only a loading state and no prefetched protected links.

- [ ] **Step 6: Verify GREEN**

Run bridge and all authentication tests.

### Task 6: Dual sign-out and administrator authorization

**Files:**
- Create: `tests/auth/sign-out.test.ts`
- Create: `lib/auth/sign-out.ts`
- Modify: `app/app/profile/page.tsx`
- Create: `app/app/admin/layout.tsx`

- [ ] **Step 1: Write failing sign-out tests**

Assert Supabase sign-out runs before the local clear; local state is not cleared when Supabase fails; and a successful result permits navigation.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm the missing module is the failure.

- [ ] **Step 3: Implement ordered dual sign-out**

```ts
export async function signOutEverywhere(deps: {
  signOutSupabase: () => Promise<{ error: Error | null }>
  clearLocalSession: () => void
}): Promise<{ error: Error | null }>
```

Clear local state only after Supabase returns no error.

- [ ] **Step 4: Update the profile UI**

Disable the button while signing out, surface a toast on failure, and on success navigate to `/` and call `router.refresh()`.

- [ ] **Step 5: Add admin server layout**

Fetch the validated user with the server Supabase client. Render children only when `user.app_metadata.role === "safety_owner"`; otherwise redirect to `/app` before admin content renders.

- [ ] **Step 6: Verify GREEN**

Run sign-out and full authentication tests.

### Task 7: Delivery-gate repairs and deployment documentation

**Files:**
- Modify: `next.config.mjs`
- Modify: `app/manifest.ts`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `docs/google-oauth-setup.md`

- [ ] **Step 1: Repair baseline blockers**

Use a Node-aware global access for `NODE_ENV`, stop ignoring TypeScript build errors, split each manifest icon into valid `"any"` and `"maskable"` entries, and keep generated `.next` artifacts out of direct validation runs.

- [ ] **Step 2: Document environment and provider setup**

Include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Google Web OAuth origins and Supabase callback URI, Supabase Site URL and redirect allow list for localhost/Vercel, HTTPS, and server-controlled `safety_owner` app-metadata assignment. Explicitly prohibit client secrets and service-role keys in `NEXT_PUBLIC_*` or Git.

- [ ] **Step 3: Validate tracked configuration**

Run `git check-ignore -v .env.example` and confirm the exception makes the example trackable while real `.env*` secrets remain ignored.

### Task 8: Full verification in Conda environment `hurdle`

- [ ] **Step 1: Remove stale generated route types safely**

Delete only the resolved workspace `.next` directory before typecheck/build if it exists.

- [ ] **Step 2: Run full tests**

Run: `conda run -n hurdle .\node_modules\.bin\vitest.CMD run`

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run lint**

Run: `conda run -n hurdle .\node_modules\.bin\eslint.CMD .`

Expected: exit 0 with no errors.

- [ ] **Step 4: Run TypeScript**

Run: `conda run -n hurdle .\node_modules\.bin\tsc.CMD --noEmit --incremental false`

Expected: exit 0 with no errors.

- [ ] **Step 5: Run production build**

Run: `conda run -n hurdle .\node_modules\.bin\next.CMD build`

Expected: exit 0. If Google Font network access blocks the sandbox, retry only with explicit approval and report the distinction.

- [ ] **Step 6: Smoke test locally**

With valid local Supabase variables, verify unauthenticated `/app` redirect, stable error display, OAuth account selection, rejected-domain message/sign-out, new and returning routing, non-admin denial, admin role access, and successful sign-out. Record any external-dashboard dependency that prevents a real OAuth round trip.

## Plan self-review

- Every design acceptance criterion maps to Tasks 1-8.
- Security decisions are pure and unit tested before framework adapters.
- The implementation preserves the browser data model and does not migrate activities, chat, reports, or profiles to Supabase.
- No password, magic-link, Google API, One Tap, or admin-management scope was added.
- External OAuth verification is explicitly separated from locally verifiable code gates.
