# Bottom Navigation Safe-Area Design

## Status

Approved on 2026-08-09 for PR #8 (`fix/bottom-nav-viewport-followup`). This design amends the unmerged Visual Viewport implementation; it does not authorize merging or production promotion before physical-device QA.

## Problem and evidence

The installed Android PWA initially renders the bottom navigation partly or completely below the visible screen. Scrolling to the end and overscrolling causes the navigation to move into view. A physical-device screenshot also shows that the nearly empty `SessionGuard` checking screen can be moved vertically, which is evidence that the outer document or dynamic browser safe area is participating in scrolling.

PR #7's `100vh`/`100dvh` frame classes are deployed, so a stale deployment is not the explanation. PR #8 adds `ViewportHeightSync`, but it does not change `BottomNav`, does not implement maximum safe-area handling, and does not include its claimed rendered live-resize regression in the committed test suite. The current navigation still applies the shared `.safe-pb` rule, whose padding changes with `safe-area-inset-bottom`.

Chrome's Android edge-to-edge guidance identifies this symptom class: a bottom-anchored control can be obscured when the browser chin retracts and the viewport extends into the gesture area. Chrome recommends reserving `safe-area-max-inset-bottom` up front and using the current `safe-area-inset-bottom` only for compositor-friendly positioning, instead of changing the bar's padding on every inset update.

## Goals

- Keep all five navigation icons and labels fully visible and tappable on first render.
- Keep their physical position stable while browser controls expand or collapse.
- Keep the navigation background covering the bottom gesture area when appropriate.
- Ensure the document body has no vertical scrollbar; only the existing authenticated main content region may scroll.
- Cover the checking screen and authenticated application shell with rendered regressions.
- Preserve PR #7's `100vh` fallback, `100dvh` override, and desktop `3rem` frame spacing.
- Leave `.safe-pb` unchanged for onboarding, chat composer, and other consumers.

## Non-goals and constraints

- No route, public component API, database, notification provider, prompt, header, page-layout, or navigation item changes.
- No icon, label, tap-target, or base navigation sizing changes.
- No restructuring of the existing `PhoneFrame` flex hierarchy or authenticated main scroll container.
- No service-worker or PWA caching changes.
- No merge, alias promotion, or production release until Android and iOS physical-device QA passes.

## Selected approach

### 1. Add rendered regressions before production changes

Add a focused Playwright specification for a 360x800 mobile viewport. It will authenticate using the existing local-only browser fixture and verify:

- The checking state does not create document-level vertical overflow.
- The authenticated shell exposes exactly five navigation links.
- Every link remains inside the visible viewport and passes a hit-test at its center.
- The body/document height equals the viewport height before and after a live viewport change.
- A coupled viewport and safe-area transition representing browser controls retracting keeps every link's screen coordinates stable.
- Feed, Community, Host, Chats, Profile, and an activity detail route retain the same shell behavior.

The test will expose safe-area values through bottom-navigation-specific CSS custom properties. Production defaults will read the real `env(safe-area-inset-bottom)` and `env(safe-area-max-inset-bottom)` values; the rendered test will override only those custom properties so it can run deterministically in CI without depending on a particular bundled Chromium version.

### 2. Give BottomNav dedicated current/maximum inset behavior

Replace `safe-pb` on `BottomNav` with a dedicated class. The class will:

- Read the current bottom inset from `safe-area-inset-bottom`, falling back to `0px`.
- Read the maximum bottom inset from `safe-area-max-inset-bottom`, falling back to the current inset on browsers that do not expose the maximum value.
- Reserve `max(1rem, maximum inset)` as navigation background space from first render.
- Offset the existing navigation-content row within that reserved space by `maximum - current`. When browser controls retract, viewport growth and the decreasing content offset cancel each other, so icons and labels stay at the same physical screen position.

The offset applies to the existing inner navigation row, not to the bar's normal-flow box. This keeps the adjustment inside reserved space and avoids creating document overflow. The bar's background can therefore extend through the reserved area without moving the app shell or changing link dimensions.

### 3. Evidence-gate ViewportHeightSync

The rendered live-resize and document-overflow tests will be run against both PR #7's CSS-only baseline and PR #8. `ViewportHeightSync` will remain only if the tests demonstrate an independent failure on the CSS-only baseline that the synchronizer fixes.

If no such independent failure is reproduced, PR #8's JavaScript viewport synchronizer and `--app-viewport-height` overrides will be removed, restoring the approved CSS-only `100vh`/`100dvh` frame implementation. This avoids global layout changes during pinch zoom, keyboard display, or high-frequency Visual Viewport scroll events without evidence that JavaScript is required.

## Failure handling and compatibility

Browsers without `safe-area-max-inset-bottom` fall back to the current inset. Older browsers that do not implement either environment variable retain the existing `1rem` bottom padding. The navigation remains usable before JavaScript hydration because the safe-area behavior is CSS-driven.

Physical-device behavior remains the release authority. A failure on Android Chrome, installed Android PWA, iOS Safari, or installed iOS PWA blocks merge/promotion even if automation passes.

## Verification and release gates

Before updating the PR:

- Demonstrate the new rendered regression failing for the current unsafe navigation behavior.
- Implement the minimum dedicated safe-area change and demonstrate it passing.
- Run `pnpm lint`, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm test:browser`, and `git diff --check`.
- Inspect optimized CSS for `100vh`, `100dvh`, both desktop `- 3rem` calculations, and the current/maximum safe-area declarations.

Before merge or promotion, test 360x800 Android Chrome and installed PWA plus 390x844 iOS Safari and installed PWA. Check all primary tabs and activity details at page top, middle, bottom, repeated downward overscroll, and with browser controls expanded/collapsed. Notification bell, unread indicators, and installation prompts must remain intact.

Pass criteria: five icons and labels remain visible and tappable; the bar stays above gesture controls; the document body does not scroll; and there is no overlap, jump, or clipping.
