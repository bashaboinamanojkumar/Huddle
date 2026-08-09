# Mobile app-shell viewport design

## Problem

After an installed Android PWA refresh, the browser can report a Visual
Viewport height that is taller than the area actually visible on screen. The
current phone frame copies that value into its outer minimum height and inner
height. Because the document permits vertical overflow, the entire shell can
then scroll: moving it upward reveals the bottom navigation but clips the
header.

The authenticated layout already provides the intended scroll container:
`<main>` is a flex child with `min-height: 0` and `overflow-y: auto`. Document
scrolling is therefore unintended.

## Decision

Use a viewport-anchored mobile shell and keep the existing sized desktop phone
frame.

- On viewports below the existing `48rem` desktop breakpoint, anchor the phone
  frame with fixed inset edges instead of assigning it a measured height.
- Prevent the app document from becoming a second vertical scroll container
  while the mobile shell is mounted.
- Keep `<main>` as the only vertical scrolling surface.
- Stop using JavaScript Visual Viewport height to size the mobile frame.
- Preserve the `100vh` fallback, `100dvh` override, and `3rem` desktop spacing
  for the desktop phone-frame presentation.
- Preserve the current bottom-navigation component, link dimensions,
  dedicated safe-area classes, `.safe-pb`, routes, providers, prompts, page
  layouts, and component interfaces.

## Alternatives considered

1. Continue resampling `visualViewport.height` after refresh. Rejected because
   the physical device demonstrates that the API value itself can remain too
   large until user interaction.
2. Add only `overflow-y: hidden` to the document. Rejected because a too-tall
   frame would remain clipped and the user would lose the ability to reveal
   the navigation.
3. Anchor the mobile shell and retain the existing internal scroller.
   Selected because it removes the bad measurement from mobile layout and
   enforces the application's existing one-scroller architecture.

## Regression coverage

The rendered regression will use a real `360x764` browser viewport and make
Visual Viewport report a stale `800px` height after reload. Before the fix it
must demonstrate document overflow and an off-screen frame/navigation. After
the fix it must prove:

- the phone frame top and bottom match the rendered viewport;
- the document scroll height equals its client height;
- attempts to scroll the document leave its scroll position at zero;
- all five navigation links remain visible and tappable;
- the existing `<main>` still scrolls long page content;
- the authentication checking transition does not change shell bounds.

Existing route, safe-area, notification, prompt, TypeScript, lint, build, and
optimized-CSS checks remain release gates. Physical Android and iOS installed
PWA refresh testing remains mandatory before merge or production promotion.

## Release boundary

Push the correction only to `fix/bottom-nav-viewport-followup` and deploy a new
non-aliased staged production build. Do not merge or promote until the physical
device matrix passes without document scrolling, clipping, overlap, or shell
movement.
