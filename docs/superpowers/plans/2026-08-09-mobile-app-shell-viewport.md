# Mobile App-Shell Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Android PWA refreshes from creating a document-level scroll range that moves the header and bottom navigation off screen.

**Architecture:** The mobile phone frame will be anchored by fixed inset edges and will no longer consume JavaScript Visual Viewport measurements. The document will be non-scrollable only while this app shell is mounted, leaving the existing flex child `<main>` as the sole vertical scroller. Desktop keeps the existing `100vh`/`100dvh` fallback chain and `3rem` frame spacing.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Vitest, Playwright

---

### Task 1: Reproduce a stale-too-tall Android viewport

**Files:**
- Modify: `tests/browser/bottom-navigation-viewport.spec.ts:153-220`

- [ ] **Step 1: Replace the shorter-Visual-Viewport regression with the real failure direction**

Set the browser viewport to `360x764`, report `764px` from Visual Viewport on the initial load, then report a stale `800px` value after reload:

```ts
test("refresh ignores a stale visual viewport that is taller than the screen", async ({ page }) => {
  const renderedHeight = 764
  const staleVisualViewportHeight = 800
  await page.setViewportSize({ width: mobileViewport.width, height: renderedHeight })
  await page.addInitScript(({ staleHeight, storageKey }) => {
    const viewport = window.visualViewport
    if (!viewport) return

    const hasLoaded = window.sessionStorage.getItem(storageKey) === "true"
    window.sessionStorage.setItem(storageKey, "true")
    Object.defineProperty(viewport, "height", {
      configurable: true,
      get: () => hasLoaded ? staleHeight : window.innerHeight,
    })
  }, {
    staleHeight: staleVisualViewportHeight,
    storageKey: "bottom-nav-stale-viewport-test",
  })

  await signIn(page)
  await page.reload()
  await expect(page.locator(".phone-frame-height")).toHaveCSS("height", `${renderedHeight}px`)
})
```

Extend the test after authentication to assert the real behavioral contract:

```ts
const shell = await page.evaluate(() => {
  const frame = document.querySelector<HTMLElement>(".phone-frame-height")
  if (!frame) throw new Error("Phone frame is unavailable")
  const rect = frame.getBoundingClientRect()
  return {
    frameTop: rect.top,
    frameBottom: rect.bottom,
    documentClientHeight: document.documentElement.clientHeight,
    documentScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    windowScrollY: window.scrollY,
  }
})

expect(shell.frameTop).toBe(0)
expect(shell.frameBottom).toBe(renderedHeight)
expect(shell.documentScrollHeight).toBe(shell.documentClientHeight)
expect(shell.bodyScrollHeight).toBe(shell.documentClientHeight)
expect(shell.windowScrollY).toBe(0)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm exec playwright test tests/browser/bottom-navigation-viewport.spec.ts --project=chromium --grep "stale visual viewport"
```

Expected: FAIL because `.phone-frame-height` is `800px` in a real `764px` viewport and the document scroll height exceeds its client height.

- [ ] **Step 3: Commit the regression test**

```powershell
git add tests/browser/bottom-navigation-viewport.spec.ts
git commit -m "test: reproduce document scrolling after PWA refresh"
```

### Task 2: Make the mobile frame a single viewport-anchored shell

**Files:**
- Modify: `components/layout/phone-frame.tsx:1-18`
- Delete: `components/layout/viewport-height-sync.tsx`
- Modify: `app/globals.css:120-172`
- Modify: `tests/layout/phone-frame.test.ts:1-65`

- [ ] **Step 1: Remove JavaScript sizing and mark the app-shell root**

Use this mobile-shell structure without changing the component interface or inner flex layout:

```tsx
import { cn } from "@/lib/utils"

export function PhoneFrame({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="phone-frame-viewport phone-frame-min-height bg-background text-foreground">
      <div className="phone-frame-height mx-auto flex w-full max-w-md flex-col bg-background shadow-2xl shadow-black/50 md:my-6 md:overflow-hidden md:rounded-[2.4rem] md:border md:border-white/10">
        <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

Delete `components/layout/viewport-height-sync.tsx`.

- [ ] **Step 2: Restore CSS fallbacks and add the mobile shell boundary**

Keep the existing fallback and desktop rules, then place this rule after the `100dvh` support block so it wins on mobile:

```css
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
    inset: 0;
    height: auto;
  }
}
```

The fallback chain must be:

```css
.phone-frame-min-height { min-height: 100vh; }
.phone-frame-height { height: 100vh; }
@media (min-width: 48rem) {
  .phone-frame-height { height: calc(100vh - 3rem); }
}
@supports (height: 100dvh) {
  .phone-frame-min-height { min-height: 100dvh; }
  .phone-frame-height { height: 100dvh; }
  @media (min-width: 48rem) {
    .phone-frame-height { height: calc(100dvh - 3rem); }
  }
}
```

- [ ] **Step 3: Update source-contract tests**

Assert that `PhoneFrame` contains `phone-frame-viewport`, no longer imports `ViewportHeightSync`, retains no `h-screen`, and that CSS contains the exact `100vh`, `100dvh`, desktop, fixed-inset, and scoped root-overflow contracts. Keep all existing assertions proving `.safe-pb` and dedicated bottom-navigation safe-area handling are unchanged.

- [ ] **Step 4: Run focused unit and rendered tests and verify GREEN**

Run:

```powershell
pnpm test -- tests/layout/phone-frame.test.ts
pnpm exec playwright test tests/browser/bottom-navigation-viewport.spec.ts --project=chromium
```

Expected: the source-contract tests pass and all four phone-frame browser tests pass, including the stale-too-tall refresh regression.

- [ ] **Step 5: Commit the implementation**

```powershell
git add app/globals.css components/layout/phone-frame.tsx components/layout/viewport-height-sync.tsx tests/layout/phone-frame.test.ts
git commit -m "fix: anchor mobile app shell to viewport"
```

### Task 3: Verify, push, and stage without promotion

**Files:**
- Verify only; no additional source files

- [ ] **Step 1: Run all release gates**

```powershell
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec playwright test --project=chromium
git diff --check
```

Expected: zero lint errors, all Vitest and Playwright tests pass, TypeScript and production build exit successfully, and `git diff --check` produces no errors.

- [ ] **Step 2: Inspect optimized CSS**

Search `.next/static` and confirm the optimized CSS retains `100vh`, `100dvh`, both desktop `- 3rem` declarations, the mobile fixed inset, and the scoped `overflow-y:hidden` rule.

- [ ] **Step 3: Push only PR #8's branch**

```powershell
git push origin fix/bottom-nav-viewport-followup
gh pr checks 8 --watch --interval 10
```

Expected: every required PR check passes.

- [ ] **Step 4: Deploy a new isolated staged production build**

```powershell
vercel deploy --prod --skip-domain
```

Expected: a new generated Hurdle deployment URL reaches READY without moving `myhuddle.vercel.app` or the project production alias.

- [ ] **Step 5: Keep release blocked for physical-device QA**

Add only the new staged origin's exact `/auth/callback` URL to Supabase, install from the staged root URL, and repeat refresh, close/reopen, page scrolling, document overscroll, safe-area, and notification/prompt tests on Android and iOS. Do not merge or promote until the whole shell remains stationary and both the header and all five navigation labels are simultaneously visible.
