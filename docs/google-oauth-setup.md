# Google Login Setup

Hurdle uses Supabase Auth's PKCE flow. Google redirects to Supabase first; Supabase then redirects the browser to Hurdle's `/auth/callback`, where the server exchanges the one-time code and stores the session in cookies.

The application accepts only verified email addresses whose exact domain is `umd.edu`, `terpmail.umd.edu`, `umaryland.edu`, or `rx.maryland.edu`. The two subdomains are explicit allow-list entries because the comparison is exact equality: every other campus subdomain, such as `dept.umd.edu`, `mail.umd.edu`, or `mail.rx.maryland.edu`, is still rejected. Google hosted-domain hints are not authorization controls.

Adding either named subdomain needs no separate Google Cloud or Supabase provider. The application never sends an `hd` hint, so the same OAuth client serves all four exact domains.

Campus email and password is the second supported way in. This document covers Google; see
[Email and Password Login Setup](./email-password-setup.md) for the rest.

## 1. Local environment

Copy `.env.example` to `.env.local` and replace both values with the Project URL and publishable key from the Supabase project's **Connect** dialog:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name is also accepted during migration. Never put a Google client secret or Supabase `service_role` key in a `NEXT_PUBLIC_*` variable.

Install and run through the project's Conda environment:

```powershell
conda run -n hurdle pnpm install
conda run -n hurdle pnpm dev
```

The local application origin is `http://localhost:3000`.

## 2. Google Cloud OAuth client

In Google Cloud Console:

1. Configure an OAuth consent screen for the intended campus users.
2. Create an **OAuth client ID** with application type **Web application**.
3. Add `http://localhost:3000` as an authorized JavaScript origin. The deployed origin does not have to be listed here: `signInWithOAuth` navigates the browser to Supabase, and Google only ever redirects back to the Supabase callback below, so Google never validates Hurdle's own origin. Adding it is harmless but not what makes production work.
4. Add the Supabase project callback shown on **Supabase Dashboard > Authentication > Providers > Google** as an authorized redirect URI. This is the only redirect URI Google needs. It normally has this form:

   ```text
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

5. Save the Google client ID and client secret in the Supabase Google provider settings, not in this repository or Vercel public variables.
6. Keep Google and email/password as the only enabled sign-in providers. Disable phone, anonymous, SSO, and every other social provider in Supabase Auth. The application verifies that every identity on the account is one of those two, so linking any other login method still results in rejection. Email/password has its own configuration in [Email and Password Login Setup](./email-password-setup.md).

See [Supabase Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google) for the current provider screens and callback format.

## 3. Supabase Auth URLs

In **Supabase Dashboard > Authentication > URL Configuration**:

1. Set **Site URL** to `https://myhuddle.vercel.app`.
2. Add these **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://myhuddle.vercel.app/auth/callback`
   - `http://localhost:3000` and `https://myhuddle.vercel.app` — the bare origins that email confirmation and password recovery links are returned to
3. Add a Vercel preview wildcard only if login must work on preview deployments. Keep the pattern restricted to this project rather than allowing arbitrary origins.

The `redirectTo` URL passed by the browser must appear in this allow list. See [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

`https://myhuddle.vercel.app` is the live production alias for the `hurdle` Vercel project. An earlier alias, `hurdle-mu.vercel.app`, no longer resolves and must not be used in either allow list.

### Verified state of the `Huddle` project (ref `mxjfxkkypbnrelhfplii`)

Checked against the live project's public `/auth/v1/settings` and `/auth/v1/authorize` endpoints:

| Item | State |
| --- | --- |
| Google provider | Enabled, with a real Google client ID bound |
| Google Cloud redirect URI | Accepted — `/authorize` reaches the Google chooser with no `redirect_uri_mismatch` |
| `prompt=select_account` | Forwarded through Supabase to Google |
| Redirect URL allow list | **Not observable from outside** — see below |
| Email/password provider | Enabled, and now a supported way in — configure it per [Email and Password Login Setup](./email-password-setup.md) |

### The allow list cannot be probed, only set

`GET /auth/v1/settings` does not expose the allow list, and `GET /auth/v1/authorize?redirect_to=...` echoes **any** value back unchanged — an origin that is definitely not on the list returns the same `302` to Google as an allowed one. GoTrue validates `redirect_to` only when Google returns to the Supabase callback, and on a mismatch it silently substitutes the **Site URL** instead of reporting an error.

So a `302` to the Google chooser is not evidence that a redirect URL is allowed. The only reliable check is completing one real sign-in against the origin in question. Treat the dashboard as the source of truth and confirm the entries above by hand after any domain change.

## 4. Vercel environment

Set the following for the Production environment and for any explicitly approved Preview environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Redeploy after changing environment variables. Production must use HTTPS. Do not add the Google client secret or Supabase `service_role` key to Vercel as a public variable.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is read as a fallback, so an existing deployment using that name keeps working.

The live `hurdle` project already has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for Development, Preview, and Production, and their values match `.env.local`. Because `NEXT_PUBLIC_*` values are inlined at build time, any change to them requires a redeploy, not just a save.

### Deployment order

Do these in order, because the redirect allow list is what breaks first:

1. Deploy once to learn the production origin.
2. Add both environment variables above, then **redeploy** — `NEXT_PUBLIC_*` values are inlined at build time, so setting them without rebuilding leaves the old values in the bundle.
3. Add `https://<production-origin>/auth/callback` to the Supabase **Redirect URLs** allow list and set **Site URL** to `https://<production-origin>`.
4. Sign in on the production origin before relying on it.

Deploy the working tree with `vercel deploy --prod --yes`. The `myhuddle.vercel.app` alias is attached to the project rather than to one deployment, so each production deploy re-points it automatically.

### Preview deployments will not sign in

Every Vercel preview gets its own hostname, such as `https://hurdle-git-feature-user.vercel.app`. Supabase rejects a `redirect_to` that is not in the allow list and falls back to the **Site URL** instead, so Google login on a preview URL appears to succeed and then lands on production or loops back to `/verify` with no useful error.

Vercel Deployment Protection compounds this: per-deployment URLs on this project answer with a `302` to `vercel.com/sso-api` for anyone who is not signed in to the Vercel account, so a judge or teammate cannot open them at all. The `myhuddle.vercel.app` production alias is exempt and serves publicly.

Demo from the production origin. Only if login genuinely must work on a preview, add a scoped wildcard to the Redirect URLs:

```text
https://hurdle-*-manojkumaryadav7702-6618s-projects.vercel.app/auth/callback
```

Keep the pattern scoped to this project. Never allow a bare `https://*.vercel.app`, which would let any Vercel deployment receive a session.

### Demo from a browser tab, not the installed PWA

`start_url` is `/app`, so an installed shortcut opens a protected route and redirects to `/verify` when signed out. Some mobile webviews also hand an OAuth redirect back to the system browser instead of the standalone window, which loses the pending PKCE cookie. Use a normal browser tab for a live demo.

## 5. Safety-owner role

The `/app/admin/*` layout renders only when the validated Supabase user's server-controlled `app_metadata.role` is exactly `safety_owner`.

Assign that role from a trusted server or one-off operator script using a Supabase client initialized with the `service_role` key:

```ts
await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { role: "safety_owner" },
})
```

Run this only in a protected server/operator environment. Never ship the `service_role` key to the browser. Remove the role by updating `app_metadata` from the same trusted environment. See [Supabase `auth.admin.updateUserById`](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

## 6. Verification checklist

1. Visit `/app` in a signed-out private browser and confirm redirect to `/verify`.
2. Select **Continue with Google** and confirm the Google account chooser appears.
3. Complete login with an exact `umd.edu`, `terpmail.umd.edu`, `umaryland.edu`, or `rx.maryland.edu` account.
4. Confirm a new local profile goes to `/onboarding`; for `rx.maryland.edu`, confirm its `university_id` is `umb`. Repeat after onboarding and confirm it returns to `/app`.
5. Try a non-campus account, or an ineligible campus subdomain such as `dept.umd.edu`, and confirm it is signed out with the campus-account message.
6. Confirm a normal campus user cannot render `/app/admin/review`.
7. Assign `safety_owner`, refresh the session by signing out and back in, and confirm the review route renders.
8. Sign out from the profile page and confirm direct navigation back to `/app` requires Google login.

The automated suite, lint, TypeScript, and production build verify the local code. A real Google round trip remains dependent on the Google Cloud, Supabase, and deployed-origin settings above.
