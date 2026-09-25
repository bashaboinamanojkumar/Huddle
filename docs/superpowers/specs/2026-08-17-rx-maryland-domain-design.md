# `rx.maryland.edu` Campus Access Design

**Date:** 2026-08-17

## Goal

Allow people with an exact `rx.maryland.edu` email address to sign in to Huddle or create an
account, and classify their profiles as University of Maryland, Baltimore (`umb`).

## Scope

The change covers both supported authentication methods:

- Google OAuth through Supabase;
- campus email and password sign-in and sign-up.

It also covers every application gate that revalidates an authenticated session, the local
profile bridge used by the client, Supabase profile creation, existing profile correction, tests,
and setup documentation.

The change does not broaden access to arbitrary `maryland.edu`, `umd.edu`, or `umaryland.edu`
subdomains. Matching remains normalized and exact.

## Current Architecture

`lib/auth/policy.ts` owns the shared list of eligible campus domains. Login validation, sign-up
validation, OAuth and email-confirmation callbacks, protected-route proxy checks, and client
session synchronization all consume that policy. User-facing domain lists are generated from the
same source.

Campus assignment is separate from admission. The client currently maps `umaryland.edu` to
`umb` and all other eligible domains to `umd`. Supabase's `handle_new_user` trigger and
`ensure_profile` function repeat the same classification when inserting `public.profiles` rows.

## Design

### Authentication Policy

Add `rx.maryland.edu` to the exact `CAMPUS_DOMAINS` allow-list. Do not use suffix matching.
Addresses such as `person@mail.rx.maryland.edu`, `person@evilrx.maryland.edu`, and
`person@rx.maryland.edu.evil.test` must remain ineligible.

Because every authentication path consumes the shared policy, this admits the domain for Google
OAuth, password login, password sign-up, confirmation callbacks, protected routes, and session
synchronization without adding independent per-screen rules. Generated login copy and validation
messages will list the new domain automatically.

### Campus Assignment

Centralize the TypeScript campus mapping in the authentication policy and make the client store
use it. Both `umaryland.edu` and `rx.maryland.edu` map to `umb`; `umd.edu` and
`terpmail.umd.edu` map to `umd`.

Add a new forward-only Supabase migration rather than editing an already-applied migration. The
migration will replace `handle_new_user` and `ensure_profile` with equivalent definitions whose
campus calculation maps both Baltimore domains to `umb`. It will also update existing
`public.profiles` rows with an exact normalized `rx.maryland.edu` domain from `umd` to `umb`.

The database backfill will compare the normalized domain after the final `@`, not use a loose
`LIKE '%@rx.maryland.edu'` suffix, so malformed lookalikes are not included.

### Failure Behavior

No new error code is needed. Malformed addresses and unlisted domains continue to receive the
existing campus-account message and are signed out if a session was already established.
Supabase API failures continue through the existing generic login or account-creation errors.

### Documentation

Update the Google OAuth and email/password setup guides to list `rx.maryland.edu`, identify it as
a UMB School of Pharmacy domain, and add it to the manual login and account-creation checks. No
new Google Cloud OAuth client or Supabase provider is required because authentication continues
through the existing providers.

## Testing

Automated regression coverage will prove that:

- mixed-case and whitespace-padded `rx.maryland.edu` addresses normalize successfully;
- password login and password sign-up accept the domain;
- callback and protected-session eligibility accept the domain through the shared policy;
- the TypeScript campus mapper assigns it to `umb`;
- nested and lookalike variants remain rejected;
- generated domain-list copy includes all four exact domains.

Run the focused authentication tests first, then the complete test suite, lint, TypeScript checking,
and the production build. If a local Supabase database is available, apply the migration and verify
new-profile assignment plus the backfill there. A real Google OAuth round trip and a real email
confirmation remain deployment checks because they require configured external accounts.

## Acceptance Criteria

- A verified `rx.maryland.edu` Google account can complete authentication.
- An `rx.maryland.edu` address can pass password sign-in and account-creation validation.
- New and existing `rx.maryland.edu` profiles have `university_id = 'umb'`.
- Unlisted subdomains and lookalikes remain rejected.
- Existing eligible domains and provider restrictions continue to behave unchanged.
