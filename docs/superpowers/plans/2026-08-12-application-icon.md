# Huddle Application Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every active `v0` install-icon reference with deterministic exports of the user-supplied Huddle otter logo.

**Architecture:** A small Pillow script produces reproducible standard, Apple, favicon, and opaque maskable PNGs from the original 1920 x 1920 source. The Next.js manifest and metadata use versioned URLs, and the handwritten service worker precaches the new PWA icon set under a bumped cache name. A Vitest regression test checks both source wiring and binary PNG properties.

**Tech Stack:** Python 3.12, Pillow 10.4, Next.js 16 metadata, Web App Manifest, service worker, Vitest 4.

---

## File Map

- Create `scripts/generate_app_icons.py`: deterministic icon export utility.
- Create `tests/pwa/application-icons.test.ts`: manifest, metadata, service-worker, and PNG regression coverage.
- Create six versioned PNGs under `public/icons/`: runtime icon assets.
- Modify `app/manifest.ts`: standard and maskable PWA icon URLs.
- Modify `app/layout.tsx`: favicon and Apple touch-icon URLs.
- Modify `public/sw.js`: versioned precache URLs and cache-name bump.
- Modify `tests/auth/service-worker.test.ts`: assert the new icon precache list.

### Task 1: Add Failing Application-Icon Contract

**Files:**
- Create: `tests/pwa/application-icons.test.ts`
- Modify: `tests/auth/service-worker.test.ts`

- [ ] **Step 1: Write the failing manifest and asset contract**

Create `tests/pwa/application-icons.test.ts` with tests that call `app/manifest.ts`, read `app/layout.tsx` and `public/sw.js`, and parse the PNG IHDR header. Assert these exact paths:

```ts
const expectedManifestIcons = [
  { src: "/icons/huddle-app-v1-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/huddle-app-maskable-v1-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/icons/huddle-app-v1-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/huddle-app-maskable-v1-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
]

const expectedAssets = [
  ["huddle-app-v1-192.png", 192, true],
  ["huddle-app-v1-512.png", 512, true],
  ["huddle-app-maskable-v1-192.png", 192, false],
  ["huddle-app-maskable-v1-512.png", 512, false],
  ["huddle-app-apple-v1-180.png", 180, true],
  ["huddle-app-favicon-v1-32.png", 32, true],
] as const
```

For each PNG, verify the PNG signature, width, height, and color type. Use Pillow-independent header parsing for dimensions and inspect the decoded corner alpha through the generation script's verification command in Task 2.

- [ ] **Step 2: Tighten the existing service-worker install assertion**

In `tests/auth/service-worker.test.ts`, extend the install test to require this exact list:

```ts
expect(addAll).toHaveBeenCalledWith([
  "/",
  "/offline",
  "/icons/huddle-app-v1-192.png",
  "/icons/huddle-app-maskable-v1-192.png",
  "/icons/huddle-app-v1-512.png",
  "/icons/huddle-app-maskable-v1-512.png",
])
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm test -- tests/pwa/application-icons.test.ts tests/auth/service-worker.test.ts
```

Expected: FAIL because the versioned icon files and references do not exist and the service worker still uses the legacy filenames.

### Task 2: Generate the Versioned Icon Assets

**Files:**
- Create: `scripts/generate_app_icons.py`
- Create: `public/icons/huddle-app-v1-192.png`
- Create: `public/icons/huddle-app-v1-512.png`
- Create: `public/icons/huddle-app-maskable-v1-192.png`
- Create: `public/icons/huddle-app-maskable-v1-512.png`
- Create: `public/icons/huddle-app-apple-v1-180.png`
- Create: `public/icons/huddle-app-favicon-v1-32.png`

- [ ] **Step 1: Add the deterministic Pillow exporter**

Implement an `argparse` script that opens the supplied image as RGBA, requires a square source, uses `Image.Resampling.LANCZOS`, and writes the six exact filenames. Standard, Apple, and favicon outputs resize the RGBA source directly. Maskable outputs first alpha-composite the source over opaque cream `(248, 244, 240, 255)` and then resize.

Core implementation:

```python
CREAM = (248, 244, 240, 255)

def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)

def opaque_maskable(image: Image.Image) -> Image.Image:
    background = Image.new("RGBA", image.size, CREAM)
    return Image.alpha_composite(background, image)
```

Save with `format="PNG", optimize=True` and print each output path.

- [ ] **Step 2: Generate the assets**

Run:

```powershell
python scripts\generate_app_icons.py "C:\Users\manoj\Downloads\App logo Transparent.png"
```

Expected: six `Wrote ...` lines under `public/icons/`.

- [ ] **Step 3: Verify binary properties**

Run a Pillow inspection that asserts all dimensions, asserts corner alpha is `0` for standard/Apple/favicon images, and asserts corner alpha is `255` for maskable images.

Expected: `Verified 6 icon files.`

### Task 3: Wire the New Assets into the PWA

**Files:**
- Modify: `app/manifest.ts:15-40`
- Modify: `app/layout.tsx:27-35`
- Modify: `public/sw.js:1-2`

- [ ] **Step 1: Update the active Next.js manifest**

Replace only the four `src` values in `app/manifest.ts`:

```ts
src: "/icons/huddle-app-v1-192.png"
src: "/icons/huddle-app-maskable-v1-192.png"
src: "/icons/huddle-app-v1-512.png"
src: "/icons/huddle-app-maskable-v1-512.png"
```

Keep the existing sizes, MIME types, and separate `purpose` values unchanged.

- [ ] **Step 2: Update browser and Apple metadata**

Set `metadata.icons` in `app/layout.tsx` to:

```ts
icons: {
  icon: [
    {
      url: '/icons/huddle-app-favicon-v1-32.png',
      type: 'image/png',
      sizes: '32x32',
    },
  ],
  apple: '/icons/huddle-app-apple-v1-180.png',
},
```

- [ ] **Step 3: Bump and update the service-worker shell cache**

Set the first two lines of `public/sw.js` to:

```js
const CACHE_NAME = "huddle-shell-v3"
const APP_SHELL = [
  "/",
  "/offline",
  "/icons/huddle-app-v1-192.png",
  "/icons/huddle-app-maskable-v1-192.png",
  "/icons/huddle-app-v1-512.png",
  "/icons/huddle-app-maskable-v1-512.png",
]
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npm test -- tests/pwa/application-icons.test.ts tests/auth/service-worker.test.ts
```

Expected: both files pass with zero failures.

### Task 4: Visual and Full Verification

**Files:**
- Verify all files changed in Tasks 1-3.

- [ ] **Step 1: Render representative icons**

Open `public/icons/huddle-app-v1-512.png` and `public/icons/huddle-app-maskable-v1-512.png` at original detail. Confirm the standard icon matches the supplied artwork and keeps transparent corners; confirm the maskable image has cream corners and unchanged otter artwork.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 4: Run the production build**

Run:

```powershell
npm run build
```

Expected: exit code 0 and a generated `/manifest.webmanifest` route.

- [ ] **Step 5: Review the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only application-icon files plus the user's pre-existing unrelated changes are present.
