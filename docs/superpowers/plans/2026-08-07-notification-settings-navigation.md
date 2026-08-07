# Notification Settings Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing notification settings route discoverable from Profile and the Notifications inbox while preserving the five-item bottom navigation.

**Architecture:** Add one focused presentational module that exports the Profile settings card and the compact inbox-header shortcut. Integrate those components into the two existing pages; both remain ordinary Next.js links to `/app/settings` and introduce no state, API, database, or Push-delivery changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Lucide React, Vitest with server-rendered markup, Playwright.

---

## File structure

- Create `components/notifications/notification-settings-navigation.tsx`: owns the two accessible, responsive links to the existing settings route.
- Modify `app/app/profile/page.tsx`: places the primary Settings card after Fit preferences and before Badges.
- Modify `app/app/notifications/page.tsx`: places the compact settings shortcut at the right side of the inbox header.
- Modify `tests/notifications/components.test.tsx`: verifies both navigation components render the expected content, route, and accessible name.
- Modify `tests/browser/notifications.spec.ts`: verifies authenticated navigation from both entry points, five unchanged bottom tabs, and no mobile horizontal overflow.

The bottom navigation and existing `NotificationSettings` component are intentionally not modified.

### Task 1: Build the tested settings-navigation components

**Files:**
- Create: `components/notifications/notification-settings-navigation.tsx`
- Modify: `tests/notifications/components.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Add these imports to `tests/notifications/components.test.tsx`:

```tsx
import {
  NotificationInboxSettingsLink,
  ProfileNotificationSettingsSection,
} from "@/components/notifications/notification-settings-navigation"
```

Append this test group:

```tsx
describe("notification settings navigation", () => {
  it("renders the Profile settings card with descriptive link text", () => {
    const html = renderToStaticMarkup(<ProfileNotificationSettingsSection />)

    expect(html).toContain('aria-labelledby="notification-settings-heading"')
    expect(html).toContain('href="/app/settings"')
    expect(html).toContain("Notification settings")
    expect(html).toContain("Push, quiet hours, and device controls")
  })

  it("renders an accessible 44-pixel inbox shortcut", () => {
    const html = renderToStaticMarkup(<NotificationInboxSettingsLink />)

    expect(html).toContain('href="/app/settings"')
    expect(html).toContain('aria-label="Notification settings"')
    expect(html).toContain("h-11 w-11")
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
pnpm test -- tests/notifications/components.test.tsx
```

Expected: FAIL because `@/components/notifications/notification-settings-navigation` does not exist.

- [ ] **Step 3: Implement the two presentational components**

Create `components/notifications/notification-settings-navigation.tsx` with:

```tsx
import Link from "next/link"
import { ChevronRight, Settings } from "lucide-react"

const notificationSettingsHref = "/app/settings"

export function ProfileNotificationSettingsSection() {
  return (
    <section
      aria-labelledby="notification-settings-heading"
      className="mt-5 glass-card rounded-[2rem] p-5"
    >
      <h2
        id="notification-settings-heading"
        className="font-heading text-lg font-bold text-white"
      >
        Settings
      </h2>
      <Link
        href={notificationSettingsHref}
        className="mt-4 flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left outline-none transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/14 text-secondary">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white">Notification settings</span>
            <span className="mt-1 block text-xs leading-5 text-white/50">
              Push, quiet hours, and device controls
            </span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/44" aria-hidden="true" />
      </Link>
    </section>
  )
}

export function NotificationInboxSettingsLink() {
  return (
    <Link
      href={notificationSettingsHref}
      aria-label="Notification settings"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/8 text-white outline-none transition-colors hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Settings className="h-5 w-5" aria-hidden="true" />
    </Link>
  )
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
pnpm test -- tests/notifications/components.test.tsx
```

Expected: PASS for the existing notification component tests and the two new navigation tests.

- [ ] **Step 5: Commit the tested component slice**

```powershell
git add components/notifications/notification-settings-navigation.tsx tests/notifications/components.test.tsx
git commit -m "feat: add notification settings navigation"
```

### Task 2: Integrate both entry points and prove mobile navigation

**Files:**
- Modify: `app/app/profile/page.tsx`
- Modify: `app/app/notifications/page.tsx`
- Modify: `tests/browser/notifications.spec.ts`

- [ ] **Step 1: Write the failing authenticated browser test**

Add this test to `tests/browser/notifications.spec.ts` after the existing inbox test:

```ts
test("settings are discoverable from Profile and Notifications", async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/app/profile")
  const profileSettings = page.getByRole("link", {
    name: /Notification settings Push, quiet hours, and device controls/u,
  })
  await expect(profileSettings).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(5)
  await expect.poll(() =>
    page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true)

  await profileSettings.click()
  await expect(page).toHaveURL(/\/app\/settings$/u)
  await expect(page.getByRole("heading", { name: "Push notifications" })).toBeVisible()

  await page.goto("/app/notifications")
  const inboxSettings = page.getByRole("link", {
    name: "Notification settings",
    exact: true,
  })
  await expect(inboxSettings).toBeVisible()
  await expect.poll(() =>
    page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true)

  await inboxSettings.click()
  await expect(page).toHaveURL(/\/app\/settings$/u)
  await expect(page.getByRole("heading", { name: "Push notifications" })).toBeVisible()
})
```

- [ ] **Step 2: Run the focused browser test and verify it fails**

Ensure local Supabase is running, then run:

```powershell
pnpm exec playwright test notifications.spec.ts --grep "settings are discoverable"
```

Expected: FAIL on the missing Profile `Notification settings` link.

- [ ] **Step 3: Add the Profile entry point**

Add this import to `app/app/profile/page.tsx`:

```tsx
import { ProfileNotificationSettingsSection } from "@/components/notifications/notification-settings-navigation"
```

Render the component immediately after the closing tag of the `Fit preferences` section and before the `Badges` section:

```tsx
<ProfileNotificationSettingsSection />
```

- [ ] **Step 4: Add the Notifications-header entry point**

Add this import to `app/app/notifications/page.tsx`:

```tsx
import { NotificationInboxSettingsLink } from "@/components/notifications/notification-settings-navigation"
```

Replace the page header with:

```tsx
<header className="mb-5 flex items-start justify-between gap-4">
  <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">Inbox</p>
    <h1 className="mt-1 font-heading text-3xl font-black text-white">Notifications</h1>
  </div>
  <NotificationInboxSettingsLink />
</header>
```

- [ ] **Step 5: Rerun the focused browser test and verify it passes**

Run:

```powershell
pnpm exec playwright test notifications.spec.ts --grep "settings are discoverable"
```

Expected: PASS at the 390 by 844 viewport. Both links reach `/app/settings`, the settings controls render, Profile still has five bottom-navigation links, and neither page has horizontal overflow.

- [ ] **Step 6: Run the focused unit test again**

Run:

```powershell
pnpm test -- tests/notifications/components.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the page integration**

```powershell
git add app/app/profile/page.tsx app/app/notifications/page.tsx tests/browser/notifications.spec.ts
git commit -m "feat: expose notification settings in app navigation"
```

### Task 3: Run the release-quality verification gate

**Files:**
- No planned file changes.

- [ ] **Step 1: Run all Vitest suites**

```powershell
pnpm test
```

Expected: every Vitest suite passes.

- [ ] **Step 2: Run lint and TypeScript checks**

```powershell
pnpm lint
pnpm typecheck
```

Expected: both commands exit with code 0 and report no errors.

- [ ] **Step 3: Run the production build**

```powershell
pnpm build
```

Expected: the optimized Next.js build succeeds and includes `/app/profile`, `/app/notifications`, and `/app/settings`.

- [ ] **Step 4: Run the complete notification browser suite**

Ensure local Supabase is running, then run:

```powershell
pnpm exec playwright test notifications.spec.ts
```

Expected: every notification browser test passes in Chromium.

- [ ] **Step 5: Verify Git scope and attribution**

```powershell
git diff origin/main...HEAD --check
git diff --name-only origin/main...HEAD
git log --format="%h %an <%ae> %s" origin/main..HEAD
git status --short --branch
```

Expected:

- the diff check prints no errors;
- changed files are limited to the design/plan documents and the five implementation/test files listed above;
- every commit is authored by `bashaboinamanojkumar <manoj7@umd.edu>`;
- the working tree is clean on `feature/settings-navigation`.

If any verification command fails, return to the task that owns that behavior, add or refine the failing test first, make the minimum correction, rerun that task's focused checks, and commit the correction before repeating this gate.
