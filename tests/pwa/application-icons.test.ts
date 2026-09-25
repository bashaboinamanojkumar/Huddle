import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import manifest from "../../app/manifest"

const projectRoot = process.cwd()
const iconsDirectory = resolve(projectRoot, "public/icons")

const expectedManifestIcons = [
  {
    src: "/icons/huddle-app-v1-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icons/huddle-app-maskable-v1-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "/icons/huddle-app-v1-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icons/huddle-app-maskable-v1-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
]

const expectedAssets = [
  ["huddle-app-v1-192.png", 192],
  ["huddle-app-v1-512.png", 512],
  ["huddle-app-maskable-v1-192.png", 192],
  ["huddle-app-maskable-v1-512.png", 512],
  ["huddle-app-apple-v1-180.png", 180],
  ["huddle-app-favicon-v1-32.png", 32],
] as const

function pngMetadata(filePath: string) {
  const bytes = readFileSync(filePath)

  return {
    signature: bytes.subarray(0, 8).toString("hex"),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  }
}

describe("application icon contract", () => {
  it("uses distinct versioned standard and maskable manifest icons", () => {
    const activeManifest = manifest()

    expect(activeManifest.icons).toEqual(expectedManifestIcons)
    expect(JSON.stringify(activeManifest.icons)).not.toContain("icon-192x192.png")
    expect(JSON.stringify(activeManifest.icons)).not.toContain("icon-512x512.png")
  })

  it("uses the versioned favicon and Apple touch icon", () => {
    const layoutSource = readFileSync(resolve(projectRoot, "app/layout.tsx"), "utf8")

    expect(layoutSource).toContain("/icons/huddle-app-favicon-v1-32.png")
    expect(layoutSource).toContain("/icons/huddle-app-apple-v1-180.png")
    expect(layoutSource).not.toContain("url: '/icon.svg'")
  })

  it("pre-caches the versioned PWA icons under a new cache", () => {
    const workerSource = readFileSync(resolve(projectRoot, "public/sw.js"), "utf8")

    expect(workerSource).toContain('const CACHE_NAME = "huddle-shell-v4"')
    for (const icon of expectedManifestIcons) {
      expect(workerSource).toContain(icon.src)
    }
    expect(workerSource).not.toContain("/icons/icon-192x192.png")
    expect(workerSource).not.toContain("/icons/icon-512x512.png")
  })

  it("ships correctly sized RGBA PNG assets", () => {
    for (const [filename, size] of expectedAssets) {
      const filePath = resolve(iconsDirectory, filename)
      const exists = existsSync(filePath)

      expect(exists, `${filename} should exist`).toBe(true)
      if (!exists) continue

      expect(pngMetadata(filePath)).toEqual({
        signature: "89504e470d0a1a0a",
        width: size,
        height: size,
        colorType: 6,
      })
    }
  })
})
