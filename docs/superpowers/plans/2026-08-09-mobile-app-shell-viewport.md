# Android PWA Refresh and App-Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the authenticated shell aligned to Android's visible viewport after refresh while preventing document scrolling, scroll chaining, and native pull-to-refresh.

**Architecture:** A route-scoped client controller mounted outside `SessionGuard` publishes a clamped Visual Viewport top and height, locks the document, and owns all lifecycle listeners. Mobile CSS consumes those values while preserving viewport-unit fallbacks, and the existing authenticated `<main>` remains the only vertical scroller.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7, Tailwind CSS 4, Vitest 4, Playwright 1.51

---

## File responsibilities

- Create `components/layout/app-viewport-controller.tsx`: own viewport measurement, event batching, root/body lock classes, scroll reset, and cleanup.
- Modify `app/app/layout.tsx`: mount the controller inside `PhoneFrame` but before `SessionGuard`, and preserve the current provider/navigation/prompt tree.
- Modify `app/globals.css`: preserve `vh`/`dvh` and desktop sizing; align the fixed mobile frame to synchronized variables; add hydrated document lock and authenticated scroller containment.
- Modify `tests/layout/phone-frame.test.ts`: protect mount order, controller lifecycle, CSS fallbacks, safe-area rules, and scroll-owner contracts.
- Modify `tests/browser/bottom-navigation-viewport.spec.ts`: reproduce both stale-viewport directions and verify route, prompt, notification, and overscroll behavior at both required portrait sizes.

### Task 1: Add failing source and rendered regressions

**Files:**
- Modify: `tests/layout/phone-frame.test.ts`
- Modify: `tests/browser/bottom-navigation-viewport.spec.ts`

- [ ] **Step 1: Add source-contract expectations for the controller and mount boundary**

Read the new controller path and app layout, then assert the exact ownership contract:

```ts
const controllerPath = resolve(
  process.cwd(),
  "components/layout/app-viewport-controller.tsx",
)
expect(existsSync(controllerPath)).toBe(true)
const controllerSource = readFileSync(controllerPath, "utf8")
const appLayoutSource = readFileSync(
  resolve(process.cwd(), "app/app/layout.tsx"),
  "utf8",
)

expect(controllerSource).toContain('"--app-viewport-height"')
expect(controllerSource).toContain('"--app-viewport-top"')
expect(controllerSource).toContain('"app-viewport-locked"')
expect(controllerSource).toContain("requestAnimationFrame")
expect(controllerSource).toContain("cancelAnimationFrame")
for (const eventName of [
  '"pageshow"',
  '"visibilitychange"',
  '"orientationchange"',
  '"resize"',
  '"scroll"',
]) {
  expect(controllerSource).toContain(eventName)
}
expect(controllerSource).toContain("window.innerHeight")
expect(controllerSource).toContain("document.documentElement.clientHeight")
expect(controllerSource).toContain("viewport.height")
expect(controllerSource).toContain("viewport.offsetTop")
expect(controllerSource).toContain("window.scrollTo(0, 0)")
expect(controllerSource).toContain("classList.remove")
expect(controllerSource).toContain("removeProperty")
expect(controllerSource).toContain("removeEventListener")

const controllerMount = appLayoutSource.indexOf("<AppViewportController />")
const guardMount = appLayoutSource.indexOf("<SessionGuard>")
expect(controllerMount).toBeGreaterThan(-1)
expect(controllerMount).toBeLessThan(guardMount)
```

Update the existing CSS source assertions to require:

```ts
expect(globalStyles).toContain(
  "html.app-viewport-locked, body.app-viewport-locked { overflow-y: hidden; overscroll-behavior-y: none; }",
)
expect(globalStyles).toContain(
  ".phone-frame-height { position: fixed; top: var(--app-viewport-top, 0px); right: 0; bottom: auto; left: 0; height: var(--app-viewport-height, 100vh); }",
)
expect(globalStyles).toContain(
  ".authenticated-main { overscroll-behavior-y: contain; }",
)
```

Keep every existing safe-area assertion unchanged.

- [ ] **Step 2: Add a reusable Visual Viewport mismatch initializer**

Add this helper near the existing mobile constants:

```ts
async function installVisualViewportMismatch(
  page: Page,
  mismatch: { height: number; offsetTop: number },
  storageKey: string,
): Promise<void> {
  await page.addInitScript(({ stale, key }) => {
    const viewport = window.visualViewport
    if (!viewport) return
    const mismatchActive = () => window.sessionStorage.getItem(key) === "true"
    Object.defineProperties(viewport, {
      height: {
        configurable: true,
        get: () => mismatchActive() ? stale.height : window.innerHeight,
      },
      offsetTop: {
        configurable: true,
        get: () => mismatchActive() ? stale.offsetTop : 0,
      },
    })
  }, { stale: mismatch, key: storageKey })
}
```

- [ ] **Step 3: Add the shorter Visual Viewport plus non-zero offset regression**

Use a real `360x800` layout viewport, switch Visual Viewport to `764px` with a
`36px` top offset immediately before reload, and hold the auth request so the
confirmation state can be measured:

```ts
test("reload aligns confirmation and authenticated shells to the visible viewport", async ({ page }) => {
  const storageKey = "bottom-nav-short-visual-viewport"
  await page.setViewportSize({ width: 360, height: 800 })
  await installVisualViewportMismatch(
    page,
    { height: 764, offsetTop: 36 },
    storageKey,
  )
  await signIn(page)
  await expect(page.locator(".phone-frame-height")).toHaveCSS("height", "800px")

  let releaseAuthRequest: (() => void) | undefined
  const authGate = new Promise<void>((resolve) => { releaseAuthRequest = resolve })
  await page.route("**/auth/v1/user", async (route) => {
    await authGate
    await route.continue()
  })
  await page.evaluate((key) => sessionStorage.setItem(key, "true"), storageKey)

  try {
    await page.reload()
    const notice = page.getByText(/Confirming your verified campus profile/u)
    await expect(notice).toBeVisible()
    await expect(page.locator(".phone-frame-height")).toHaveCSS("height", "764px")
    await expect(page.locator(".phone-frame-height")).toHaveCSS("top", "36px")
    const noticeBox = await notice.boundingBox()
    expect(noticeBox).not.toBeNull()
    expect(noticeBox!.y).toBeGreaterThanOrEqual(36)
    expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(800)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  } finally {
    releaseAuthRequest?.()
    await page.unroute("**/auth/v1/user")
  }

  const header = page.locator("header").first()
  await expect(header).toBeVisible()
  const headerBox = await header.boundingBox()
  expect(headerBox).not.toBeNull()
  expect(headerBox!.y).toBeGreaterThanOrEqual(36)
  await expectNavigationUsable(page, { top: 36, bottom: 800 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})
```

Change `expectNavigationUsable` to accept an optional visible rectangle and use
its top/bottom instead of always assuming `0..window.innerHeight`.

- [ ] **Step 4: Retain the opposite stale-too-large regression**

Refactor the existing `800px` Visual Viewport versus `764px` layout test to use
`installVisualViewportMismatch(page, { height: 800, offsetTop: 0 }, key)`. Set
the session marker immediately before reload. Preserve assertions that the
frame remains `764px`, document scroll remains zero, all five links remain
usable, and `<main>` still scrolls.

- [ ] **Step 5: Cover both portrait sizes, all shell routes, prompts, and repeated boundary overscroll**

Use both required sizes and include notifications:

```ts
const mobileViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
] as const

const shellRoutes = [
  "/app",
  "/app/community",
  "/app/host",
  "/app/chats",
  "/app/profile",
  `/app/activity/${DETAIL_ACTIVITY_ID}`,
  "/app/notifications",
] as const
```

For each size and route, assert document scroll is zero, the shell bounds are
inside the viewport, and all five navigation links are visible and tappable.
For prompts, dispatch `huddle:rsvp-success`, assert the prompt `aside` and all
navigation links are simultaneously inside the viewport, dismiss it, and
repeat at the other size.

On `/app/community`, set `<main>` to its top and issue three upward wheel
gestures, then set it to its maximum scroll position and issue three downward
wheel gestures:

```ts
await main.evaluate((element) => { (element as HTMLElement).scrollTop = 0 })
await main.hover()
for (let index = 0; index < 3; index += 1) await page.mouse.wheel(0, -1200)
await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

await main.evaluate((element) => {
  const mainElement = element as HTMLElement
  mainElement.scrollTop = mainElement.scrollHeight
})
for (let index = 0; index < 3; index += 1) await page.mouse.wheel(0, 1200)
await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
```

- [ ] **Step 6: Run the focused tests and verify RED**

Run:

```powershell
pnpm test -- tests/layout/phone-frame.test.ts
pnpm exec playwright test tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: the unit test fails because the controller does not exist; the
shorter Visual Viewport rendered test fails because the fixed shell stays at
`top: 0` and `height: 800px`.

- [ ] **Step 7: Commit only the failing regressions**

```powershell
git add tests/layout/phone-frame.test.ts tests/browser/bottom-navigation-viewport.spec.ts
git commit -m "test: reproduce Android visible viewport offset"
```

### Task 2: Implement synchronized geometry and one scroll owner

**Files:**
- Create: `components/layout/app-viewport-controller.tsx`
- Modify: `app/app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create the route-scoped controller**

Create `components/layout/app-viewport-controller.tsx` with one effect and no
rendered output:

```tsx
"use client"

import { useEffect } from "react"

const APP_VIEWPORT_CLASS = "app-viewport-locked"
const HEIGHT_PROPERTY = "--app-viewport-height"
const TOP_PROPERTY = "--app-viewport-top"

export function AppViewportController() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const viewport = window.visualViewport
    let animationFrame: number | undefined

    const measure = () => {
      animationFrame = undefined
      const height = Math.max(0, Math.min(
        viewport?.height ?? Number.POSITIVE_INFINITY,
        window.innerHeight,
        root.clientHeight,
      ))
      const top = Math.max(0, viewport?.offsetTop ?? 0)
      root.style.setProperty(HEIGHT_PROPERTY, `${height}px`)
      root.style.setProperty(TOP_PROPERTY, `${top}px`)
      window.scrollTo(0, 0)
    }

    const schedule = () => {
      if (animationFrame === undefined) {
        animationFrame = window.requestAnimationFrame(measure)
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") schedule()
    }

    root.classList.add(APP_VIEWPORT_CLASS)
    body.classList.add(APP_VIEWPORT_CLASS)
    schedule()
    window.addEventListener("pageshow", schedule)
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("orientationchange", schedule)
    window.addEventListener("resize", schedule)
    viewport?.addEventListener("resize", schedule)
    viewport?.addEventListener("scroll", schedule)

    return () => {
      window.removeEventListener("pageshow", schedule)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("orientationchange", schedule)
      window.removeEventListener("resize", schedule)
      viewport?.removeEventListener("resize", schedule)
      viewport?.removeEventListener("scroll", schedule)
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
      root.classList.remove(APP_VIEWPORT_CLASS)
      body.classList.remove(APP_VIEWPORT_CLASS)
      root.style.removeProperty(HEIGHT_PROPERTY)
      root.style.removeProperty(TOP_PROPERTY)
    }
  }, [])

  return null
}
```

- [ ] **Step 2: Mount the controller outside `SessionGuard`**

Import `AppViewportController` in `app/app/layout.tsx` and place it as the first
child of `PhoneFrame`:

```tsx
<PhoneFrame>
  <AppViewportController />
  <SessionGuard>
    <NotificationProvider>
      <main className="authenticated-main min-h-0 flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <div className="shrink-0">
        <BottomNav />
      </div>
      <PromptCoordinator />
    </NotificationProvider>
  </SessionGuard>
</PhoneFrame>
```

- [ ] **Step 3: Align the fixed mobile frame and lock document overscroll**

Preserve the base `100vh`, `100dvh`, desktop `calc(... - 3rem)`, safe-area, and
bottom-navigation declarations. Replace only the mobile fixed rule and add the
hydrated lock/scroller rules:

```css
html.app-viewport-locked,
body.app-viewport-locked {
  overflow-y: hidden;
  overscroll-behavior-y: none;
}

@media (max-width: 47.999rem) {
  html:has(.phone-frame-viewport),
  body:has(.phone-frame-viewport) {
    overflow-y: hidden;
  }

  .phone-frame-min-height {
    min-height: 0;
  }

  .phone-frame-height {
    position: fixed;
    top: var(--app-viewport-top, 0px);
    right: 0;
    bottom: auto;
    left: 0;
    height: var(--app-viewport-height, 100vh);
  }

  @supports (height: 100dvh) {
    .phone-frame-height {
      height: var(--app-viewport-height, 100dvh);
    }
  }
}

.authenticated-main {
  overscroll-behavior-y: contain;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
pnpm test -- tests/layout/phone-frame.test.ts
pnpm exec playwright test tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: all source-contract and mobile-shell Playwright tests pass, including
both stale-value directions, route/prompt coverage, and boundary overscroll.

- [ ] **Step 5: Commit the implementation**

```powershell
git add app/app/layout.tsx app/globals.css components/layout/app-viewport-controller.tsx
git commit -m "fix: align Android app shell to visible viewport"
```

### Task 3: Verify the complete branch and optimized output

**Files:**
- Verify only

- [ ] **Step 1: Run every local release gate**

Run each command separately and retain its exit status and test count:

```powershell
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec playwright test --project=chromium
git diff --check
```

Expected: zero lint or TypeScript errors, at least 259 Vitest tests pass, the
production build succeeds, the complete Playwright suite passes, and the Git
whitespace check is empty.

- [ ] **Step 2: Inspect optimized CSS**

Search generated `.next/static/**/*.css` and confirm the optimized output
contains all of these contracts:

```text
100vh
100dvh
calc(100vh - 3rem)
calc(100dvh - 3rem)
--app-viewport-height
--app-viewport-top
overscroll-behavior-y:none
overscroll-behavior-y:contain
safe-area-inset-bottom
safe-area-max-inset-bottom
```

- [ ] **Step 3: Review branch scope**

Run `git status --short --branch`, `git diff origin/main...HEAD --stat`, and
`git log --oneline origin/fix/bottom-nav-viewport-followup..HEAD`. Confirm no
database, manifest, route, navigation-size, or component-interface changes.

### Task 4: Push and create an isolated staged deployment

**Files:**
- External branch/deployment configuration only

- [ ] **Step 1: Push PR #8's existing branch**

```powershell
git push origin fix/bottom-nav-viewport-followup
gh pr checks 8 --watch --interval 10
```

Expected: push succeeds and every required PR check passes.

- [ ] **Step 2: Record production aliases before staging**

Run `vercel alias ls` and save the displayed aliases and their deployment
targets in the task log before creating a new deployment.

- [ ] **Step 3: Create the non-aliased staged production build**

```powershell
vercel deploy --prod --skip-domain
```

Expected: Vercel returns a new READY deployment URL without moving any existing
production alias.

- [ ] **Step 4: Verify aliases are unchanged and stage only OAuth callback**

Run `vercel alias ls` again and compare it with Step 2. In the authenticated
Supabase dashboard for the linked project, open **Authentication > URL
Configuration**, append exactly `https://<new-staged-origin>/auth/callback` to
**Redirect URLs**, save, and read the list back. Do not change the site URL or
existing callback URLs.

- [ ] **Step 5: Stop at the physical-device gate**

Provide the exact staged root URL. The user installs the PWA from that root and
runs this matrix first on Android Chrome/installed Android PWA and then on iOS
Safari/installed iOS PWA:

1. Pull downward repeatedly at the top and verify the app does not reload or
   move the shell.
2. Scroll to the bottom and continue upward repeatedly; verify no scroll chains
   to the document.
3. Close and reopen the installed PWA.
4. Use the browser menu for a genuine hard reload and verify the confirmation
   transition completes without clipping.
5. Visit Feed, Community, Host, Chats, Profile, activity detail, notifications,
   and the install/Push prompts; keep the header and all five navigation links
   visible together throughout content scrolling.

Do not merge PR #8 and do not promote the staged deployment until both matrices
pass without clipping, document scrolling, or scroll chaining.
