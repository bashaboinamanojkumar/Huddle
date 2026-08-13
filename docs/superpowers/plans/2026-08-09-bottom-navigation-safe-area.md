# Bottom Navigation Safe-Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep all five bottom-navigation links visible, tappable, and physically stable across mobile browser-control and safe-area changes without introducing document-level scrolling.

**Architecture:** The existing CSS-only `100vh` fallback and `100dvh` phone-frame sizing remain the global viewport boundary. `BottomNav` receives its own current/maximum safe-area variables: the navigation box reserves the maximum inset, while its existing content row is translated by `maximum - current` so viewport growth and row movement cancel. A rendered Playwright regression drives deterministic inset values through those component-specific variables, checks the session-confirmation state and authenticated routes, and evidence-gates the unproven Visual Viewport JavaScript synchronizer.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, CSS environment variables, Playwright 1.51, Vitest 4, TypeScript 5.7

---

## File structure

- Create `tests/browser/bottom-navigation-viewport.spec.ts`: rendered 360px mobile regression for checking-state overflow, five-link visibility/hit testing, primary routes, activity detail, and coupled viewport/safe-area changes.
- Modify `components/app/bottom-nav.tsx`: replace the shared safe-padding class on this component only and identify the existing row that receives the safe-area translation.
- Modify `app/globals.css`: add bottom-navigation-only current/maximum inset rules; preserve `.safe-pb`; restore direct `100vh`/`100dvh` phone-frame values if the JavaScript synchronizer fails its evidence gate.
- Modify `components/layout/phone-frame.tsx`: remove `ViewportHeightSync` only after the CSS-only version passes the rendered live-resize regression.
- Delete `components/layout/viewport-height-sync.tsx`: remove the global Visual Viewport writer when it has no independently reproduced benefit.
- Modify `tests/layout/phone-frame.test.ts`: retain the phone-frame fallback/desktop-spacing contract and add a source-level guard for the dedicated navigation classes and unchanged `.safe-pb` rule.

### Task 1: Add the rendered failing regression

**Files:**
- Create: `tests/browser/bottom-navigation-viewport.spec.ts`
- Reuse: `tests/browser/fixture.ts`

- [ ] **Step 1: Create the focused Playwright specification**

Create `tests/browser/bottom-navigation-viewport.spec.ts` with the following complete content:

```ts
import { expect, test, type Page } from "@playwright/test"
import {
  DETAIL_ACTIVITY_ID,
  FIXTURE_EMAIL,
  FIXTURE_PASSWORD,
} from "./fixture"

const mobileViewport = { width: 360, height: 800 }
const navigationLabels = ["Feed", "Community", "Host", "Chats", "Profile"] as const
const shellRoutes = [
  "/app",
  "/app/community",
  "/app/host",
  "/app/chats",
  "/app/profile",
  `/app/activity/${DETAIL_ACTIVITY_ID}`,
] as const

type LinkRect = {
  label: string
  x: number
  y: number
  width: number
  height: number
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/verify")
  await page.getByLabel("Campus email").fill(FIXTURE_EMAIL)
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/app(?:$|\/)/u)
  await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
}

async function setBottomSafeArea(
  page: Page,
  currentInset: number,
  maximumInset: number,
): Promise<void> {
  const navigation = page.getByRole("navigation")
  await expect(navigation).toBeVisible()
  await navigation.evaluate((element, insets) => {
    const navigationElement = element as HTMLElement
    navigationElement.style.setProperty(
      "--bottom-nav-current-inset",
      `${insets.currentInset}px`,
    )
    navigationElement.style.setProperty(
      "--bottom-nav-maximum-inset",
      `${insets.maximumInset}px`,
    )
  }, { currentInset, maximumInset })
}

async function expectNoDocumentOverflow(page: Page, height: number): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    innerHeight: window.innerHeight,
    documentClientHeight: document.documentElement.clientHeight,
    documentScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
  }))).toEqual({
    innerHeight: height,
    documentClientHeight: height,
    documentScrollHeight: height,
    bodyScrollHeight: height,
  })
}

async function navigationRects(page: Page): Promise<LinkRect[]> {
  return page.getByRole("navigation").getByRole("link").evaluateAll((links) =>
    links.map((link) => {
      const rect = link.getBoundingClientRect()
      return {
        label: link.textContent?.trim() ?? "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
}

async function expectNavigationUsable(page: Page): Promise<void> {
  const navigation = page.getByRole("navigation")
  await expect(navigation.getByRole("link")).toHaveCount(5)
  const viewportHeight = await page.evaluate(() => window.innerHeight)

  for (const label of navigationLabels) {
    const link = navigation.getByRole("link", { name: label, exact: true })
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box, `${label} must have a rendered box`).not.toBeNull()
    expect(box!.y, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(0)
    expect(
      box!.y + box!.height,
      `${label} must end inside the viewport`,
    ).toBeLessThanOrEqual(viewportHeight)

    const centerHitsLink = await page.evaluate(({ x, y, expectedLabel }) => {
      const hit = document.elementFromPoint(x, y)?.closest("a")
      return hit?.textContent?.includes(expectedLabel) ?? false
    }, {
      x: box!.x + box!.width / 2,
      y: box!.y + box!.height / 2,
      expectedLabel: label,
    })
    expect(centerHitsLink, `${label} center must be tappable`).toBe(true)
  }
}

test.describe.configure({ mode: "serial" })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(mobileViewport)
})

test("checking state does not create document-level vertical overflow", async ({ page }) => {
  await signIn(page)

  let releaseAuthRequest: (() => void) | undefined
  let authRequestBlocked = false
  const authGate = new Promise<void>((resolve) => {
    releaseAuthRequest = resolve
  })

  await page.route("**/auth/v1/user", async (route) => {
    authRequestBlocked = true
    await authGate
    await route.continue()
  })

  try {
    await page.goto("/app", { waitUntil: "domcontentloaded" })
    await expect.poll(() => authRequestBlocked).toBe(true)
    await expect(page.getByText("Confirming your verified campus profile…")).toBeVisible()
    await expectNoDocumentOverflow(page, mobileViewport.height)
  } finally {
    releaseAuthRequest?.()
    await page.unroute("**/auth/v1/user")
  }
})

test("all application routes keep five bottom navigation links visible and tappable", async ({ page }) => {
  await signIn(page)

  for (const route of shellRoutes) {
    await page.goto(route)
    await setBottomSafeArea(page, 36, 36)
    await expectNoDocumentOverflow(page, mobileViewport.height)
    await expectNavigationUsable(page)
  }
})

test("browser-control retraction keeps link coordinates stable", async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: mobileViewport.width, height: 764 })
  await page.goto("/app")
  await setBottomSafeArea(page, 0, 36)
  await expectNoDocumentOverflow(page, 764)
  await expectNavigationUsable(page)
  const before = await navigationRects(page)

  await page.setViewportSize(mobileViewport)
  await setBottomSafeArea(page, 36, 36)
  await expectNoDocumentOverflow(page, mobileViewport.height)
  await expectNavigationUsable(page)
  const after = await navigationRects(page)

  expect(after.map(({ label }) => label)).toEqual(before.map(({ label }) => label))
  for (const [index, earlier] of before.entries()) {
    const later = after[index]
    expect(Math.abs(later.x - earlier.x), `${earlier.label} x coordinate`).toBeLessThanOrEqual(1)
    expect(Math.abs(later.y - earlier.y), `${earlier.label} y coordinate`).toBeLessThanOrEqual(1)
    expect(later.width).toBeCloseTo(earlier.width, 1)
    expect(later.height).toBeCloseTo(earlier.height, 1)
  }
})
```

- [ ] **Step 2: Run the regression against the current PR #8 implementation**

Ensure the repository's local Supabase stack is running, then run:

```powershell
pnpm test:browser -- tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: the checking-state and route assertions may pass, but `browser-control retraction keeps link coordinates stable` fails because changing the viewport by 36px moves every link by roughly 36px; the current navigation ignores the two bottom-nav-specific variables.

- [ ] **Step 3: Commit the failing rendered regression**

```powershell
git add tests/browser/bottom-navigation-viewport.spec.ts
git commit -m "test: reproduce bottom navigation safe-area clipping"
```

Expected: one commit containing only the rendered regression.

### Task 2: Add dedicated current/maximum safe-area handling

**Files:**
- Modify: `components/app/bottom-nav.tsx`
- Modify: `app/globals.css`
- Test: `tests/browser/bottom-navigation-viewport.spec.ts`

- [ ] **Step 1: Give BottomNav dedicated outer and content-row classes**

In `components/app/bottom-nav.tsx`, replace only the opening navigation and row lines:

```tsx
    <nav className="bottom-nav-safe-area sticky bottom-0 z-40 border-t border-white/10 bg-black/75 px-3 pt-2 backdrop-blur-xl">
      <div className="bottom-nav-safe-area-content mx-auto flex max-w-md items-end justify-between">
```

Do not change the tab array, link markup, icon sizes, labels, notification indicator, base padding, or the surrounding authenticated layout.

- [ ] **Step 2: Add bottom-navigation-only safe-area CSS**

In `app/globals.css`, insert these rules immediately before the existing `.safe-pb` rule:

```css
.bottom-nav-safe-area {
  --bottom-nav-current-inset: env(safe-area-inset-bottom, 0px);
  --bottom-nav-maximum-inset: env(
    safe-area-max-inset-bottom,
    var(--bottom-nav-current-inset)
  );
  padding-bottom: max(1rem, var(--bottom-nav-maximum-inset));
}

.bottom-nav-safe-area-content {
  transform: translateY(
    calc(var(--bottom-nav-maximum-inset) - var(--bottom-nav-current-inset))
  );
}

.safe-pb {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

The `.safe-pb` block shown above is the existing block and must remain byte-for-byte equivalent; do not apply the new maximum inset behavior to any other consumer.

- [ ] **Step 3: Run the focused rendered regression**

```powershell
pnpm test:browser -- tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: all three tests pass. In the coupled transition, the frame grows by 36px while the row translation falls from 36px to 0px, so all five link coordinates remain within one pixel of their original values.

- [ ] **Step 4: Inspect the rendered navigation contract in the test report on failure**

If the focused run fails, open `output/playwright/report/index.html` and use the retained trace to confirm these exact conditions before changing code: `.phone-frame-height` equals `window.innerHeight`; `.bottom-nav-safe-area` owns the maximum padding; `.bottom-nav-safe-area-content` owns the translation; and neither `html` nor `body` has a scroll height above the viewport. Fix only a demonstrated mismatch in those four conditions, then rerun Step 3.

- [ ] **Step 5: Commit the safe-area implementation**

```powershell
git add components/app/bottom-nav.tsx app/globals.css
git commit -m "fix: reserve maximum safe area for bottom navigation"
```

Expected: one commit changing only BottomNav class names and dedicated CSS.

### Task 3: Evidence-gate the Visual Viewport synchronizer

**Files:**
- Modify: `components/layout/phone-frame.tsx`
- Modify: `app/globals.css`
- Delete: `components/layout/viewport-height-sync.tsx`
- Modify: `tests/layout/phone-frame.test.ts`
- Test: `tests/browser/bottom-navigation-viewport.spec.ts`

- [ ] **Step 1: Confirm the focused rendered regression passes with PR #8's synchronizer present**

```powershell
pnpm test:browser -- tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: all three tests pass with `ViewportHeightSync` still mounted. Record this as the synchronized comparison result in the PR verification note.

- [ ] **Step 2: Restore the phone frame to direct CSS viewport sizing**

Replace `components/layout/phone-frame.tsx` with:

```tsx
import { cn } from "@/lib/utils"

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="phone-frame-min-height bg-background text-foreground">
      <div className="phone-frame-height mx-auto flex w-full max-w-md flex-col bg-background shadow-2xl shadow-black/50 md:my-6 md:overflow-hidden md:rounded-[2.4rem] md:border md:border-white/10">
        <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

In `app/globals.css`, replace only the phone-frame sizing section with:

```css
.phone-frame-min-height {
  min-height: 100vh;
}

.phone-frame-height {
  height: 100vh;
}

@media (min-width: 48rem) {
  .phone-frame-height {
    height: calc(100vh - 3rem);
  }
}

@supports (height: 100dvh) {
  .phone-frame-min-height {
    min-height: 100dvh;
  }

  .phone-frame-height {
    height: 100dvh;
  }

  @media (min-width: 48rem) {
    .phone-frame-height {
      height: calc(100dvh - 3rem);
    }
  }
}
```

Delete `components/layout/viewport-height-sync.tsx` using `apply_patch`. Do not change the phone-frame flex structure or desktop spacing.

- [ ] **Step 3: Update the source-level regression to lock both contracts**

Replace `tests/layout/phone-frame.test.ts` with:

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("phone frame viewport sizing", () => {
  it("uses CSS viewport fallbacks with desktop spacing", () => {
    const frameSource = readFileSync(
      resolve(process.cwd(), "components/layout/phone-frame.tsx"),
      "utf8",
    )
    const globalStyles = readFileSync(
      resolve(process.cwd(), "app/globals.css"),
      "utf8",
    ).replace(/\s+/g, " ")

    expect(frameSource).toContain("phone-frame-min-height")
    expect(frameSource).toContain("phone-frame-height")
    expect(frameSource).not.toContain("ViewportHeightSync")
    expect(frameSource).not.toMatch(/\b(?:min-)?h-screen\b/)

    expect(globalStyles).toContain(
      ".phone-frame-min-height { min-height: 100vh; }",
    )
    expect(globalStyles).toContain(
      ".phone-frame-height { height: 100vh; }",
    )
    expect(globalStyles).toContain(
      "@media (min-width: 48rem) { .phone-frame-height { height: calc(100vh - 3rem); } }",
    )
    expect(globalStyles).toContain(
      "@supports (height: 100dvh) { .phone-frame-min-height { min-height: 100dvh; } .phone-frame-height { height: 100dvh; } @media (min-width: 48rem) { .phone-frame-height { height: calc(100dvh - 3rem); } } }",
    )
  })

  it("keeps shared safe padding unchanged and scopes maximum inset handling to BottomNav", () => {
    const navigationSource = readFileSync(
      resolve(process.cwd(), "components/app/bottom-nav.tsx"),
      "utf8",
    )
    const globalStyles = readFileSync(
      resolve(process.cwd(), "app/globals.css"),
      "utf8",
    ).replace(/\s+/g, " ")

    expect(navigationSource).toContain(
      'className="bottom-nav-safe-area sticky bottom-0',
    )
    expect(navigationSource).toContain(
      'className="bottom-nav-safe-area-content mx-auto',
    )
    expect(navigationSource).not.toMatch(/<nav className="[^"]*\bsafe-pb\b/u)
    expect(globalStyles).toContain(
      ".safe-pb { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }",
    )
    expect(globalStyles).toContain(
      ".bottom-nav-safe-area { --bottom-nav-current-inset: env(safe-area-inset-bottom, 0px); --bottom-nav-maximum-inset: env( safe-area-max-inset-bottom, var(--bottom-nav-current-inset) ); padding-bottom: max(1rem, var(--bottom-nav-maximum-inset)); }",
    )
    expect(globalStyles).toContain(
      ".bottom-nav-safe-area-content { transform: translateY( calc(var(--bottom-nav-maximum-inset) - var(--bottom-nav-current-inset)) ); }",
    )
  })
})
```

- [ ] **Step 4: Run the source-level and rendered evidence checks without JavaScript sizing**

```powershell
pnpm test -- tests/layout/phone-frame.test.ts
pnpm test:browser -- tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: both commands pass. This demonstrates that the available rendered live-resize and overflow reproductions do not require the Visual Viewport writer, so the CSS-only version is the selected implementation. If the rendered test fails specifically because `.phone-frame-height` no longer follows `window.innerHeight`, restore the exact PR #8 synchronizer files from the previous commit and retain the original synchronizer expectations in the unit test; do not weaken the rendered assertions.

- [ ] **Step 5: Commit the evidence-gated phone-frame result**

When the CSS-only checks pass, run:

```powershell
git add components/layout/phone-frame.tsx components/layout/viewport-height-sync.tsx app/globals.css tests/layout/phone-frame.test.ts
git commit -m "fix: keep phone frame sizing CSS-only"
```

Expected: the synchronizer file is recorded as deleted, PR #7's `100vh`/`100dvh` rules remain, and the new navigation safe-area rules remain unchanged.

### Task 4: Run the complete automated release gates

**Files:**
- Verify: all changed production, test, and documentation files
- Inspect: `.next/static/**/*.css`

- [ ] **Step 1: Confirm the intended diff and author identity**

```powershell
git status --short --branch
git diff origin/main...HEAD --stat
git config user.name
git config user.email
```

Expected: the branch is `fix/bottom-nav-viewport-followup`; only the design/plan documents, focused tests, BottomNav, phone-frame files, and `globals.css` differ from `origin/main`; author name is `bashaboinamanojkumar` and email is `manoj7@umd.edu`.

- [ ] **Step 2: Run static and unit verification**

```powershell
pnpm lint
pnpm test
pnpm exec tsc --noEmit
git diff --check origin/main...HEAD
```

Expected: lint exits 0; all Vitest tests pass; TypeScript exits 0; diff check prints no output.

- [ ] **Step 3: Build the optimized production bundle**

```powershell
pnpm build
```

Expected: Next.js production build exits 0 with all application routes compiled.

- [ ] **Step 4: Inspect optimized CSS for every viewport and inset contract**

```powershell
rg -n -g "*.css" "100vh|100dvh|calc\(100vh - 3rem\)|calc\(100dvh - 3rem\)|safe-area-inset-bottom|safe-area-max-inset-bottom|bottom-nav-maximum-inset" .next
```

Expected: optimized CSS contains `100vh`, `100dvh`, both desktop `- 3rem` calculations, the current `safe-area-inset-bottom`, the maximum `safe-area-max-inset-bottom`, and the bottom-navigation maximum-inset variable. It also retains the unchanged `.safe-pb` declaration.

- [ ] **Step 5: Run the full rendered browser suite**

```powershell
pnpm test:browser
```

Expected: the new bottom-navigation tests and all existing notification/header/prompt browser tests pass against the local-only Supabase fixture.

- [ ] **Step 6: Review the final patch and commit any verification-only test corrections**

```powershell
git status --short
git diff origin/main...HEAD --check
git log --oneline origin/main..HEAD
```

Expected: the working tree is clean, diff check prints no output, and the commit list contains the approved design/plan plus the rendered test and minimal implementation commits. If a test-only correction was required during verification, commit only that correction as:

```powershell
git add tests/browser/bottom-navigation-viewport.spec.ts tests/layout/phone-frame.test.ts
git commit -m "test: harden bottom navigation viewport regression"
```

### Task 5: Push, stage, and stop at physical-device QA

**Files:**
- Update: PR #8 verification evidence only; no additional production files

- [ ] **Step 1: Push only the user-owned follow-up branch**

```powershell
git push origin fix/bottom-nav-viewport-followup
gh pr checks 8 --watch
```

Expected: the push updates PR #8 and every required GitHub/Vercel check passes. Do not merge yet.

- [ ] **Step 2: Create one non-aliased staged production deployment**

```powershell
vercel deploy --prod --skip-domain
```

Expected: Vercel returns one immutable deployment URL. Confirm the production alias still points to the previous known-good deployment. Add only `<immutable-deployment-url>/auth/callback` to Supabase's redirect allowlist if sign-in on that staged URL requires it; do not change the Site URL or add a wildcard.

- [ ] **Step 3: Complete the physical-device matrix**

On Android Chrome and the installed Android PWA at 360x800, then iOS Safari and the installed iOS PWA at 390x844, verify Feed, Community, Host, Chats, Profile, and the fixture-equivalent activity detail. On every surface, check page top, middle, bottom, repeated downward overscroll, and browser controls expanded/collapsed. Also check the notification bell, unread indicators, and install/notification prompts.

Expected pass criteria: all five icons and labels are visible and tappable on first render; the navigation remains above system gesture areas; and there is no document/body scrollbar, overlap, jump, or clipping. A failure on any real device blocks merge and promotion.

- [ ] **Step 4: Merge and promote only after the physical matrix passes**

After the user explicitly confirms the complete physical matrix passed, merge PR #8 through GitHub without checking out or force-pushing the dirty local `main`. Promote the exact immutable deployment tested in Step 3, smoke-test production on the same devices, and remove only the temporary staged callback entry from Supabase.

Expected: the tested artifact—not a fresh untested rebuild—serves production, the production smoke test passes, and temporary authentication configuration is removed.
