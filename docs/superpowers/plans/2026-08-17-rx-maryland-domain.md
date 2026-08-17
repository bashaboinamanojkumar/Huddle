# `rx.maryland.edu` Campus Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admit exact `rx.maryland.edu` accounts through every supported authentication path and assign their profiles to UMB.

**Architecture:** Extend the single TypeScript campus-domain policy consumed by Google OAuth, password authentication, callbacks, the route proxy, and session synchronization. Add one tested campus-classification helper for client behavior, then add a forward Supabase migration with the equivalent exact database mapping and a backfill for existing profiles.

**Tech Stack:** TypeScript, React 19, Next.js 16, Vitest, Supabase Auth, PostgreSQL/PLpgSQL, pgTAP

---

## File Map

- Modify `lib/auth/policy.ts`: own the four-domain allow-list and UMD/UMB mapping.
- Modify `lib/store/huddle-store.tsx`: consume the shared campus mapper instead of duplicating suffix logic.
- Modify `tests/auth/policy.test.ts`: verify exact admission, lookalike rejection, generated copy, and campus mapping.
- Modify `tests/auth/credentials.test.ts`: prove password login and account creation accept the domain.
- Modify `tests/auth/callback.test.ts`: prove post-OAuth eligibility accepts the domain.
- Modify `tests/auth/session-sync.test.ts`: prove protected-session reconciliation accepts the domain.
- Create `supabase/migrations/20260817000000_add_rx_maryland_domain.sql`: update profile creation and backfill existing profiles.
- Create `supabase/tests/rx_maryland_domain.test.sql`: verify the database campus mapper and function wiring.
- Modify `docs/google-oauth-setup.md`: document Google access and deployment checks.
- Modify `docs/email-password-setup.md`: document password sign-in/sign-up access and UMB assignment.

### Task 1: Admit the exact domain through all application authentication gates

**Files:**
- Modify: `tests/auth/policy.test.ts`
- Modify: `tests/auth/credentials.test.ts`
- Modify: `tests/auth/callback.test.ts`
- Modify: `tests/auth/session-sync.test.ts`
- Modify: `lib/auth/policy.ts`

- [ ] **Step 1: Add failing exact-domain admission tests**

Add this eligible policy case:

```ts
[" Pharmacy@RX.MARYLAND.EDU ", "pharmacy@rx.maryland.edu"],
```

Add these rejected policy cases:

```ts
"student@mail.rx.maryland.edu",
"student@evilrx.maryland.edu",
"student@rx.maryland.edu.evil.test",
```

Change the generated-copy expectations to:

```ts
expect(listed).toBe(
  "@umd.edu, @terpmail.umd.edu, @umaryland.edu, or @rx.maryland.edu"
)
expect(formatCampusDomains("and")).toBe(
  "@umd.edu, @terpmail.umd.edu, @umaryland.edu, and @rx.maryland.edu"
)
```

Change the stable `invalid_campus_email` expectation to:

```ts
invalid_campus_email:
  "Enter your @umd.edu, @terpmail.umd.edu, @umaryland.edu, or @rx.maryland.edu campus email address.",
```

Add this password sign-in test:

```ts
it("accepts an rx.maryland.edu address", () => {
  expect(
    validateSignIn({ email: " Pharmacy@RX.MARYLAND.EDU ", password: "correct horse" })
  ).toEqual({
    ok: true,
    value: { email: "pharmacy@rx.maryland.edu", password: "correct horse" },
  })
})
```

Add this account-creation test:

```ts
it("creates credentials for an rx.maryland.edu address", () => {
  expect(
    validateSignUp({
      email: " Pharmacy@RX.MARYLAND.EDU ",
      password: "terrapin24",
      confirmation: "terrapin24",
    })
  ).toEqual({
    ok: true,
    value: { email: "pharmacy@rx.maryland.edu", password: "terrapin24" },
  })
})
```

Add this callback test using the existing `createAuth` helper:

```ts
it("continues a verified rx.maryland.edu account", async () => {
  const auth = createAuth({
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-rx",
          email: "pharmacy@rx.maryland.edu",
          email_confirmed_at: "2026-08-17T12:00:00.000Z",
          app_metadata: { provider: "google", providers: ["google"] },
          identities: [{ provider: "google" }],
        },
      },
      error: null,
    }),
  })

  const result = await processAuthCallback(
    new URL("https://hurdle.example/auth/callback?code=pkce-code"),
    auth
  )

  expect(auth.signOut).not.toHaveBeenCalled()
  expect(result).toEqual({
    destination: "/auth/continue?next=%2Fapp",
    errorCode: null,
  })
})
```

Add this session-sync test:

```ts
it("renders protected content for an rx.maryland.edu account", () => {
  expect(
    decideSessionSync({
      lookup: authenticated({ email: "pharmacy@rx.maryland.edu" }),
      localSession: localSession(),
      now: NOW,
    })
  ).toEqual({ kind: "ready" })
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run from the isolated worktree:

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\vitest.cmd' run tests/auth/policy.test.ts tests/auth/credentials.test.ts tests/auth/callback.test.ts tests/auth/session-sync.test.ts
```

Expected: FAIL because `rx.maryland.edu` is not yet in `CAMPUS_DOMAINS`; credential, callback,
and session tests reject it, and generated copy omits it.

- [ ] **Step 3: Add the exact domain to the shared policy**

Change the constant and its comment in `lib/auth/policy.ts` to:

```ts
/**
 * `terpmail.umd.edu` and `rx.maryland.edu` are named explicitly because matching is exact:
 * listing one campus subdomain must not admit any other subdomain automatically.
 */
export const CAMPUS_DOMAINS = [
  "umd.edu",
  "terpmail.umd.edu",
  "umaryland.edu",
  "rx.maryland.edu",
] as const
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\vitest.cmd' run tests/auth/policy.test.ts tests/auth/credentials.test.ts tests/auth/callback.test.ts tests/auth/session-sync.test.ts
```

Expected: all focused authentication tests pass.

- [ ] **Step 5: Commit the admission change**

```powershell
git add lib/auth/policy.ts tests/auth/policy.test.ts tests/auth/credentials.test.ts tests/auth/callback.test.ts tests/auth/session-sync.test.ts
git commit -m "feat: admit rx Maryland campus accounts"
```

### Task 2: Assign pharmacy accounts to UMB in TypeScript

**Files:**
- Modify: `tests/auth/policy.test.ts`
- Modify: `lib/auth/policy.ts`
- Modify: `lib/store/huddle-store.tsx`

- [ ] **Step 1: Add the failing campus-mapping test**

Import `campusUniversityForEmail` from `@/lib/auth/policy`, then add:

```ts
describe("campus assignment", () => {
  it.each([
    ["student@umd.edu", "umd"],
    ["student@terpmail.umd.edu", "umd"],
    ["student@umaryland.edu", "umb"],
    [" Pharmacy@RX.MARYLAND.EDU ", "umb"],
  ])("maps %s to %s", (email, expected) => {
    expect(campusUniversityForEmail(email)).toBe(expected)
  })

  it("does not classify an ineligible domain", () => {
    expect(campusUniversityForEmail("student@mail.rx.maryland.edu")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the policy test and verify RED**

Run:

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\vitest.cmd' run tests/auth/policy.test.ts
```

Expected: FAIL because `campusUniversityForEmail` is not exported.

- [ ] **Step 3: Implement and consume the shared mapper**

Add to `lib/auth/policy.ts` after `isEligibleCampusEmail`:

```ts
export type CampusUniversityId = "umd" | "umb"

const UMB_CAMPUS_DOMAINS = new Set<CampusDomain>([
  "umaryland.edu",
  "rx.maryland.edu",
])

export function campusUniversityForEmail(value: string): CampusUniversityId | null {
  const normalized = normalizeCampusEmail(value)
  if (!normalized) {
    return null
  }

  const domain = normalized.slice(normalized.lastIndexOf("@") + 1) as CampusDomain
  return UMB_CAMPUS_DOMAINS.has(domain) ? "umb" : "umd"
}
```

Change the store import to:

```ts
import {
  campusUniversityForEmail,
  normalizeCampusEmail,
  normalizeReturnPath,
} from "@/lib/auth/policy"
```

Delete the local `universityFor` function and change the derived value to:

```ts
const universityId = state.session
  ? campusUniversityForEmail(state.session.email) ?? DEFAULT_UNIVERSITY_ID
  : DEFAULT_UNIVERSITY_ID
```

- [ ] **Step 4: Run the focused tests and TypeScript checker**

Run:

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\vitest.cmd' run tests/auth/policy.test.ts tests/auth/credentials.test.ts tests/auth/callback.test.ts tests/auth/session-sync.test.ts
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\tsc.cmd' --noEmit
```

Expected: tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the campus mapper**

```powershell
git add lib/auth/policy.ts lib/store/huddle-store.tsx tests/auth/policy.test.ts
git commit -m "refactor: centralize campus assignment"
```

### Task 3: Assign and backfill UMB profiles in Supabase

**Files:**
- Create: `supabase/tests/rx_maryland_domain.test.sql`
- Create: `supabase/migrations/20260817000000_add_rx_maryland_domain.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/rx_maryland_domain.test.sql`:

```sql
begin;

select plan(8);

select is(
  public.huddle_university_id_for_email('pharmacy@rx.maryland.edu'),
  'umb',
  'rx.maryland.edu maps to UMB'
);
select is(
  public.huddle_university_id_for_email(' Pharmacy@RX.MARYLAND.EDU '),
  'umb',
  'rx.maryland.edu mapping normalizes case and whitespace'
);
select is(
  public.huddle_university_id_for_email('student@umaryland.edu'),
  'umb',
  'umaryland.edu remains UMB'
);
select is(
  public.huddle_university_id_for_email('student@umd.edu'),
  'umd',
  'umd.edu remains UMD'
);
select is(
  public.huddle_university_id_for_email('student@mail.rx.maryland.edu'),
  'umd',
  'nested rx domain is not classified as UMB'
);
select is(
  public.huddle_university_id_for_email('student@rx.maryland.edu.evil.test'),
  'umd',
  'rx lookalike is not classified as UMB'
);
select matches(
  pg_get_functiondef('public.handle_new_user()'::regprocedure),
  'huddle_university_id_for_email',
  'new user trigger uses the shared database mapper'
);
select matches(
  pg_get_functiondef('public.ensure_profile()'::regprocedure),
  'huddle_university_id_for_email',
  'profile repair uses the shared database mapper'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test against an isolated pre-migration Supabase stack and verify RED**

Create an ephemeral Supabase project in a uniquely named system temporary directory, copy the
existing migrations and this test but not the new migration, start it, reset it, and run:

```powershell
$sourceRoot = (git rev-parse --show-toplevel).Trim()
$rxDbTestRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'hurdle-rx-domain-supabase-20260817'
if (Test-Path -LiteralPath $rxDbTestRoot) {
  throw "Refusing to reuse existing temporary project: $rxDbTestRoot"
}

New-Item -ItemType Directory -Path $rxDbTestRoot | Out-Null
supabase init --workdir $rxDbTestRoot
New-Item -ItemType Directory -Force -Path (Join-Path $rxDbTestRoot 'supabase\migrations') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $rxDbTestRoot 'supabase\tests') | Out-Null
Copy-Item -Path (Join-Path $sourceRoot 'supabase\migrations\*.sql') `
  -Destination (Join-Path $rxDbTestRoot 'supabase\migrations')
Copy-Item -LiteralPath (Join-Path $sourceRoot 'supabase\tests\rx_maryland_domain.test.sql') `
  -Destination (Join-Path $rxDbTestRoot 'supabase\tests\rx_maryland_domain.test.sql')

supabase start --workdir $rxDbTestRoot
supabase db reset --workdir $rxDbTestRoot --no-seed
supabase test db (Join-Path $rxDbTestRoot 'supabase\tests\rx_maryland_domain.test.sql') `
  --local --workdir $rxDbTestRoot
```

Expected: FAIL because `public.huddle_university_id_for_email(text)` does not exist. Do not run
`supabase db reset` against the developer's main project.

- [ ] **Step 3: Create the forward migration**

Create `supabase/migrations/20260817000000_add_rx_maryland_domain.sql`:

```sql
-- Keep application admission and profile campus assignment aligned for the School of Pharmacy.
create or replace function public.huddle_university_id_for_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(p_email, ''))) ~
      '^[^[:space:]@]+@(umaryland[.]edu|rx[.]maryland[.]edu)$'
      then 'umb'
    else 'umd'
  end;
$$;

comment on function public.huddle_university_id_for_email(text) is
  'Maps an exact normalized eligible campus email to its Huddle university identifier.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived record;
begin
  select *
  into derived
  from public.huddle_derive_names(
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  );

  insert into public.profiles (
    id, email, first_name, last_name, last_initial, avatar_url, university_id
  )
  values (
    new.id,
    new.email,
    derived.out_first_name,
    '',
    derived.out_last_initial,
    nullif(
      coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
      ''
    ),
    public.huddle_university_id_for_email(new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user auth.users;
  derived record;
  result public.profiles;
begin
  select * into auth_user from auth.users where id = (select auth.uid());
  if auth_user.id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select *
  into derived
  from public.huddle_derive_names(
    coalesce(
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.raw_user_meta_data ->> 'name'
    ),
    auth_user.email
  );

  insert into public.profiles (
    id, email, first_name, last_name, last_initial, avatar_url, university_id
  )
  values (
    auth_user.id,
    auth_user.email,
    derived.out_first_name,
    '',
    derived.out_last_initial,
    nullif(
      coalesce(
        auth_user.raw_user_meta_data ->> 'avatar_url',
        auth_user.raw_user_meta_data ->> 'picture'
      ),
      ''
    ),
    public.huddle_university_id_for_email(auth_user.email)
  )
  on conflict (id) do nothing;

  select * into result from public.profiles where id = auth_user.id;
  return result;
end;
$$;

update public.profiles
set university_id = 'umb'
where university_id <> 'umb'
  and lower(btrim(email)) ~ '^[^[:space:]@]+@rx[.]maryland[.]edu$';

-- The trigger owner and ensure_profile security definer can call the helper. Browser roles cannot.
revoke execute on function public.huddle_university_id_for_email(text)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;
```

- [ ] **Step 4: Apply the migration only to the isolated temporary stack and verify GREEN**

Copy the new migration into the temporary project, run `supabase migration up --local`, then:

```powershell
$sourceRoot = (git rev-parse --show-toplevel).Trim()
$rxDbTestRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'hurdle-rx-domain-supabase-20260817'
Copy-Item -LiteralPath `
  (Join-Path $sourceRoot 'supabase\migrations\20260817000000_add_rx_maryland_domain.sql') `
  -Destination (Join-Path $rxDbTestRoot 'supabase\migrations\20260817000000_add_rx_maryland_domain.sql')

supabase migration up --local --workdir $rxDbTestRoot
supabase test db (Join-Path $rxDbTestRoot 'supabase\tests\rx_maryland_domain.test.sql') `
  --local --workdir $rxDbTestRoot

$resolvedTestRoot = (Resolve-Path -LiteralPath $rxDbTestRoot).Path
$resolvedSystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
if (-not $resolvedTestRoot.StartsWith(
  $resolvedSystemTemp,
  [System.StringComparison]::OrdinalIgnoreCase
)) {
  throw "Refusing to clean outside the system temporary directory: $resolvedTestRoot"
}
supabase stop --workdir $resolvedTestRoot --no-backup
Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
```

Expected: eight pgTAP assertions pass. Stop and remove the uniquely named temporary Supabase
stack after recording the result.

- [ ] **Step 5: Commit the database change**

```powershell
git add supabase/migrations/20260817000000_add_rx_maryland_domain.sql supabase/tests/rx_maryland_domain.test.sql
git commit -m "feat: assign rx Maryland profiles to UMB"
```

### Task 4: Update setup and validation documentation

**Files:**
- Modify: `docs/google-oauth-setup.md`
- Modify: `docs/email-password-setup.md`

- [ ] **Step 1: Update every documented eligible-domain list**

Document the exact set as `umd.edu`, `terpmail.umd.edu`, `umaryland.edu`, and
`rx.maryland.edu`. State that `rx.maryland.edu` is a UMB School of Pharmacy domain and that the
application maps it to `university_id = 'umb'`.

Use this Google setup wording:

```md
The application accepts only verified email addresses whose exact domain is `umd.edu`,
`terpmail.umd.edu`, `umaryland.edu`, or `rx.maryland.edu`. The two named subdomains are explicit
allow-list entries; every other subdomain remains rejected.
```

Use this password setup wording:

```md
Huddle accepts campus email and password accounts from the exact `umd.edu`,
`terpmail.umd.edu`, `umaryland.edu`, and `rx.maryland.edu` domains. School of Pharmacy
`rx.maryland.edu` profiles are assigned to UMB.
```

Add `rx.maryland.edu` to the manual Google round-trip and password account-creation checklists.

- [ ] **Step 2: Verify documentation consistency**

Run:

```powershell
rg -n "umd\.edu|umaryland\.edu|rx\.maryland\.edu|three|four" docs/google-oauth-setup.md docs/email-password-setup.md
```

Expected: every current eligible-domain list contains the exact new domain and no prose still
claims there are only three accepted domains.

- [ ] **Step 3: Commit clean documentation files without capturing unrelated work**

In the isolated worktree these files start clean, so commit only the two setup guides:

```powershell
git add docs/google-oauth-setup.md docs/email-password-setup.md
git commit -m "docs: add rx Maryland authentication setup"
```

### Task 5: Verify the complete implementation

**Files:**
- Review all files changed by Tasks 1-4.

- [ ] **Step 1: Run the complete automated test suite**

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\vitest.cmd' run
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run lint and TypeScript checking**

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\eslint.cmd' .
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\tsc.cmd' --noEmit
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Run the production build**

```powershell
& 'C:\Users\manoj\files7\projects\hurdle\node_modules\.bin\next.cmd' build
```

Expected: Next.js reports a successful production build.

- [ ] **Step 4: Inspect the final branch diff and migration scope**

```powershell
git status --short --branch
git diff --check main...HEAD
git diff --stat main...HEAD
git log --oneline --decorate main..HEAD
```

Expected: only the planned authentication policy, tests, store mapper, migration, database test,
and setup documents differ from the base; `git diff --check` emits no errors.

- [ ] **Step 5: Record external verification limits**

A real Google OAuth round trip, email confirmation, and application of the migration to the hosted
Supabase project require deployed credentials and are not claimed by local verification.
