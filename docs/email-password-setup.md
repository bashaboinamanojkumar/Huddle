# Email and Password Login Setup

Huddle accepts two ways to sign in: a campus Google account, and a campus email address with
a password. Both are held to the same admission rules — a verified email whose exact domain is
`umd.edu`, `terpmail.umd.edu`, or `umaryland.edu`. Everything else (phone, magic link, SSO,
anonymous, other social providers) is still rejected and signed out.

The eligible domains live in one place, `CAMPUS_DOMAINS` in `lib/auth/policy.ts`, and the
sign-in copy and error messages are generated from that list. Matching is exact equality, so
adding `terpmail.umd.edu` did not admit any other `umd.edu` subdomain.

The application code is complete. The steps below are the Supabase dashboard configuration it
depends on, and none of them can be committed to this repository.

## 1. What changed in the application

`lib/auth/policy.ts` no longer requires that Google be the only identity on an account. It now
requires that every identity be one of `google` or `email`, which is enforced in the same four
places as before: the proxy (`lib/supabase/proxy.ts`), the OAuth callback (`lib/auth/callback.ts`),
the client session guard (`lib/auth/session-sync.ts`), and `/auth/continue`.

Two routes are new:

| Route | Purpose |
| --- | --- |
| `/auth/confirm` | Verifies a signup-confirmation or password-recovery link, then hands off to `/auth/continue` or `/auth/update-password`. |
| `/auth/update-password` | Where a recovery link lands so the student can choose a new password. |

Supabase links a Google identity and a password identity that share one confirmed address into a
single account, so a student who starts with Google and later sets a password keeps one profile
rather than gaining a second one.

## 2. Enable the email provider

In **Supabase Dashboard > Authentication > Sign In / Providers**:

1. Enable the **Email** provider.
2. Turn **Confirm email** on. This is what stops anyone from claiming an address they do not
   control. With it off, `signUp` returns a session immediately; the application detects that and
   signs the student straight in, but the campus-domain gate would then rest on the browser alone.
3. Set **Minimum password length** to `8`, matching `MIN_PASSWORD_LENGTH` in `lib/auth/policy.ts`.
   If you raise one, raise the other.
4. Enable **Prevent use of leaked passwords** if your plan offers it.
5. Leave phone, anonymous sign-ins, and every other provider disabled. Keep Google enabled.

## 3. Add the redirect origins

In **Supabase Dashboard > Authentication > URL Configuration > Redirect URLs**, the list must
contain the bare origins as well as the existing OAuth callbacks:

```text
http://localhost:3000
http://localhost:3000/auth/callback
https://myhuddle.vercel.app
https://myhuddle.vercel.app/auth/callback
```

The application asks Supabase to send confirmation and recovery emails back to
`window.location.origin`, and the email template appends the path. Supabase validates that origin
against this list; if it does not match, it silently substitutes the **Site URL** instead, and
every link in every email points at production regardless of where the student signed up.

## 4. Replace two email templates

In **Supabase Dashboard > Authentication > Emails > Templates**, replace the link in both
templates below. This is required, not cosmetic.

The stock templates send a PKCE `code`, and the verifier for that code lives only in the browser
that started the signup. A student who signs up on a laptop and opens the email on a phone gets a
dead link. A `token_hash` carries no such dependency and verifies from any device.

**Confirm signup:**

```html
<h2>Confirm your campus email</h2>
<p>Follow the link below to finish setting up your Huddle account.</p>
<p>
  <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">
    Confirm my email
  </a>
</p>
<p>If you did not create a Huddle account, you can ignore this email.</p>
```

**Reset password:**

```html
<h2>Reset your Huddle password</h2>
<p>Follow the link below to choose a new password.</p>
<p>
  <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
    Choose a new password
  </a>
</p>
<p>If you did not ask to reset your password, you can ignore this email.</p>
```

`{{ .RedirectTo }}` is the origin the browser sent, with no trailing slash, so the rendered link
becomes `https://myhuddle.vercel.app/auth/confirm?token_hash=...`. Do not add a slash after it.

If a template is left unedited, the confirmation still succeeds — Supabase verifies the token on
its own domain first — but the student lands on the home page instead of being signed in, and has
to sign in by hand afterwards. Recovery links will not reach the password form at all.

## 5. Configure production email delivery

Supabase's built-in email service is for development only. It is rate limited to a handful of
messages per hour and, on some projects, refuses to deliver to addresses outside your
organization with `email_address_not_authorized`.

Before real students use this, add a custom SMTP provider under
**Project Settings > Authentication > SMTP Settings**, then raise the email rate limit under
**Authentication > Rate Limits**. Without this, signups fail silently for everyone after the first
few of each hour: the application reports "Too many attempts. Wait a minute and try again."

## 6. Verification checklist

Run this against the deployed origin after the settings above are saved.

1. Open `/verify` signed out. Confirm both the Google button and the email form render.
2. Enter a non-campus address such as `someone@gmail.com` and confirm the campus-email message
   appears without any request reaching Supabase.
3. Create an account with an eligible campus address. Confirm the "check your inbox" panel appears
   and no session is created.
4. Open the confirmation email **on a different device**. Confirm the link host is your own origin
   with the path `/auth/confirm`, and that following it lands on `/onboarding`.
5. Sign out, then sign in with the same address and password. Confirm it lands on `/app`.
6. Sign in with a deliberately wrong password and confirm the message is
   "That email and password combination is incorrect."
7. Use **Forgot your password?**, follow the emailed link, set a new password, and confirm it
   lands back in the application. Confirm the old password no longer works.
8. Repeat step 3 with an address that already has an account. Confirm the message is identical to
   a fresh signup — the screen must never reveal that an address is registered.
9. Sign in with Google using an account whose address already has a password. Confirm it still
   works and reaches the same profile.
10. Confirm a signed-out browser opening `/app` still redirects to `/verify`.

## 7. Known limits

- The campus-domain rule is applied in the browser, in the proxy, in the callback, and in the
  session guard, but not inside Postgres. An ineligible address that is created by calling the
  Supabase API directly can never use the application — every route signs it out — but it does
  leave a row in `auth.users` and `public.profiles`. This is unchanged from the Google-only
  design. Closing it would mean adding a domain check to `handle_new_user`, which is a database
  migration rather than an application change.
- Supabase's own rate limits are the only brute-force protection on the sign-in form.
- Microsoft 365 Safe Links and similar scanners can consume a one-time email token before the
  student clicks it. If campus mail starts doing this, the fix is an interstitial page that
  requires a click before calling `verifyOtp`.
