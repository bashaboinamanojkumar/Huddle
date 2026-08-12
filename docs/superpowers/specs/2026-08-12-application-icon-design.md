# Huddle Application Icon Design

## Goal

Replace the current black-and-white `v0` install icon and favicon with the user-supplied `App logo Transparent.png` artwork across supported PWA surfaces without changing the artwork itself.

## Source Artwork

- Source: `C:\Users\manoj\Downloads\App logo Transparent.png`
- Dimensions: 1920 x 1920 PNG with alpha transparency.
- The regular icon must preserve the supplied rounded cream tile, transparent corners, otter, lettermark, colors, and composition exactly.
- No generative editing, redrawing, sharpening, recoloring, or cropping will be applied.

## Exported Assets

Create versioned assets under `public/icons/`:

- `huddle-app-v1-192.png`: 192 x 192 standard PWA icon.
- `huddle-app-v1-512.png`: 512 x 512 standard PWA icon.
- `huddle-app-maskable-v1-192.png`: 192 x 192 Android maskable icon.
- `huddle-app-maskable-v1-512.png`: 512 x 512 Android maskable icon.
- `huddle-app-apple-v1-180.png`: 180 x 180 Apple touch icon.
- `huddle-app-favicon-v1-32.png`: 32 x 32 browser favicon.

Standard, Apple, and favicon exports retain transparency. Maskable exports fill only transparent pixels with the artwork's matching cream background so Android can safely apply circular, rounded-square, or other device masks without showing black corners or a nested transparent tile.

High-quality Lanczos resampling will be used for reductions from the 1920 x 1920 source.

## Application Integration

- Update `app/manifest.ts` to reference the new versioned standard and maskable files with separate `purpose: "any"` and `purpose: "maskable"` entries.
- Update `app/layout.tsx` so browser favicon metadata and Apple touch-icon metadata reference the new assets.
- Update `public/sw.js` to precache the four PWA icon files and increment the shell cache from `huddle-shell-v2` to `huddle-shell-v3`.
- Leave `public/manifest.json` unchanged because the application links to Next.js's generated `/manifest.webmanifest` from `app/manifest.ts`.
- Do not change the manifest name, `start_url`, scope, theme, orientation, or app identity.

## Verification

- Add a regression test that confirms the active manifest uses distinct versioned standard and maskable icons and contains no legacy `icon-192x192.png` or `icon-512x512.png` references.
- Extend service-worker coverage to confirm the new cache name and icon paths.
- Verify every generated PNG's dimensions, format, alpha behavior, and corner behavior.
- Render and visually inspect representative standard and maskable exports.
- Run the targeted tests, full test suite, and production build.

## Existing Installations

Versioned icon URLs allow current Chrome versions to detect the identity change and offer users the icon update. New installations receive the new icon immediately after deployment. Existing iOS Home Screen installations may still require removal and re-adding because iOS does not reliably refresh installed manifest metadata.
