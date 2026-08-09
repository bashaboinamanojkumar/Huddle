# Android PWA refresh and app-shell design

## Problem

The installed Android PWA can reload into an authentication-confirmation state
where Chrome's layout viewport is taller than the rectangle actually visible to
the user. A fixed mobile shell is still insufficient because Chrome positions
fixed elements against the layout viewport, while the Visual Viewport can have
a smaller height and a non-zero top offset. At the same time, overscroll from
the authenticated content can chain to the document and trigger Android's
native pull-to-refresh.

The application intends `<main>` to be the only vertical scroll owner. Any
document scroll range, shell movement, or native pull-to-refresh inside the app
is therefore a layout failure.

## Decision

Combine Visual Viewport alignment with strict, app-scoped scroll containment.

- Add an app viewport controller that remains mounted outside `SessionGuard`,
  including while the confirmation screen is rendered.
- On every measurement, read `visualViewport.height` and
  `visualViewport.offsetTop`. Clamp the shell height against both
  `window.innerHeight` and `document.documentElement.clientHeight`, so neither
  a stale Visual Viewport nor a stale layout viewport can enlarge the shell.
  When Visual Viewport is unavailable, use a zero top offset and the smaller of
  the two layout-height sources.
- Publish the synchronized top and height as CSS custom properties used by the
  mobile frame.
- Measure on mount, `pageshow`, restoration to a visible document, orientation
  changes, window resize, and Visual Viewport resize or scroll.
- Coalesce event bursts with `requestAnimationFrame`. After applying the app
  scroll lock, reset document scroll to zero.
- Add an app-only class to `html` and `body` while the controller is mounted.
  The class sets `overflow-y: hidden` and `overscroll-behavior-y: none`.
- Keep the current `:has(.phone-frame-viewport)` rule as a pre-hydration
  overflow fallback.
- Add `overscroll-behavior-y: contain` to the authenticated `<main>` scroller,
  preventing top and bottom overscroll from chaining to the document while
  preserving normal content scrolling.
- Remove listeners, a pending animation frame, custom properties, and app-only
  classes when the controller unmounts.

Native Android pull-to-refresh is intentionally disabled within the app. No
custom refresh UI will replace it. A genuine browser-menu hard reload can still
show the confirmation state, but the transition must not resize or move the
shell.

## Preserved behavior

The existing `100vh` fallback, `100dvh` support, and desktop `3rem` spacing
remain. The mobile frame alone consumes the synchronized top and height
variables. The implementation must not change `.safe-pb`, current/maximum
bottom-inset handling, navigation dimensions, routes, providers, prompts,
component APIs, or the shell's flex structure.

No public API, route, database, manifest, navigation-size, or component
interface changes are in scope. Portrait mobile remains the target.

## Alternatives considered

1. Keep the current fixed-inset shell. Rejected because a fixed element can be
   positioned against a layout viewport that does not match the visible
   rectangle after refresh.
2. Restore only the height synchronizer. Rejected because height alignment does
   not prevent document scroll chaining or native pull-to-refresh, and height
   alone does not account for a non-zero Visual Viewport top offset.
3. Synchronize the visible rectangle and enforce one scroll owner. Selected
   because it addresses the viewport mismatch and the independent overscroll
   path while retaining the application's existing internal scroller.

## Regression coverage

Add the rendered regression before implementation and observe it fail against
the current fixed-inset branch. The scenario must:

- render the initial app at the expected size;
- reload into the confirmation state;
- report a layout viewport taller than the Visual Viewport and a non-zero
  Visual Viewport top offset;
- keep both the confirmation and authenticated shells within the simulated
  visible rectangle;
- keep the header and all five navigation links simultaneously visible;
- keep document scroll at zero while `<main>` remains scrollable.

Retain the opposite stale-value regression where Visual Viewport height is too
large and the layout viewport is correct. Exercise repeated downward overscroll
at the top and upward overscroll at the bottom. Cover Feed, Community, Host,
Chats, Profile, activity details, notifications, and prompts at `360x800` and
`390x844`.

## Verification

Release gates are lint, the complete Vitest suite (at least 259 tests),
TypeScript, production build, the complete Playwright suite,
`git diff --check`, and inspection of optimized CSS for the fallback,
synchronized-shell, scroll-lock, safe-area, and overscroll rules.

Physical acceptance is required on Android and iOS:

- pulling down at the top does not reload or move the shell;
- closing and reopening the installed PWA works;
- a browser-menu hard reload completes the confirmation transition without
  clipping;
- the header and all navigation links remain visible throughout content
  scrolling;
- no document scrolling or scroll chaining occurs.

## Staging and release boundary

Push only to PR #8's existing `fix/bottom-nav-viewport-followup` branch. Create
a new `vercel deploy --prod --skip-domain` deployment and verify production
aliases remain unchanged. Add only that staged origin's exact `/auth/callback`
URL to Supabase and install from the staged root.

Do not merge or promote until the exact deployment passes the Android and iOS
physical-device matrices. Any clipping, document scrolling, or scroll chaining
blocks production promotion.
