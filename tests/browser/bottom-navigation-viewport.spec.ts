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
    const link = navigation.getByRole("link").filter({ hasText: label })
    await expect(link).toHaveCount(1)
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
test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(mobileViewport)
})

test("checking state does not create document-level vertical overflow", async ({ page }) => {
  let releaseAuthRequest: (() => void) | undefined
  let authRequestBlocked = false
  const authGate = new Promise<void>((resolve) => {
    releaseAuthRequest = resolve
  })

  await page.route("**/auth/v1/user", async (route) => {
    if (page.url().includes("/auth/continue")) {
      await route.continue()
      return
    }
    authRequestBlocked = true
    await authGate
    await route.continue()
  })

  try {
    await page.goto("/verify")
    await page.getByLabel("Campus email").fill(FIXTURE_EMAIL)
    await page.getByLabel("Password").fill(FIXTURE_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click({ noWaitAfter: true })
    await expect.poll(() => page.url()).toMatch(/\/app(?:$|\/)/u)
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
