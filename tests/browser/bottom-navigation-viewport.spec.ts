import { expect, test, type Page } from "@playwright/test"
import {
  DETAIL_ACTIVITY_ID,
  FIXTURE_EMAIL,
  FIXTURE_PASSWORD,
} from "./fixture"

const mobileViewport = { width: 360, height: 800 }
const mobileViewports = [
  mobileViewport,
  { width: 390, height: 844 },
] as const
const navigationLabels = ["Feed", "Community", "Host", "Chats", "Profile"] as const
const shellRoutes = [
  "/app",
  "/app/community",
  "/app/host",
  "/app/chats",
  "/app/profile",
  `/app/activity/${DETAIL_ACTIVITY_ID}`,
  "/app/notifications",
] as const

type VisibleRect = {
  top: number
  bottom: number
}

type LinkRect = {
  label: string
  x: number
  y: number
  width: number
  height: number
}

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
    bodyWithinViewport: document.body.scrollHeight <= window.innerHeight,
  }))).toEqual({
    innerHeight: height,
    documentClientHeight: height,
    documentScrollHeight: height,
    bodyWithinViewport: true,
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

async function expectNavigationUsable(
  page: Page,
  visibleRect?: VisibleRect,
): Promise<void> {
  const navigation = page.getByRole("navigation")
  await expect(navigation.getByRole("link")).toHaveCount(5)
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  const top = visibleRect?.top ?? 0
  const bottom = visibleRect?.bottom ?? viewportHeight

  for (const label of navigationLabels) {
    const link = navigation.getByRole("link").filter({ hasText: label })
    await expect(link).toHaveCount(1)
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box, `${label} must have a rendered box`).not.toBeNull()
    expect(box!.y, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(top)
    expect(
      box!.y + box!.height,
      `${label} must end inside the viewport`,
    ).toBeLessThanOrEqual(bottom)

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

test("reload aligns confirmation and authenticated shells to the visible viewport", async ({ page }) => {
  const storageKey = "bottom-nav-short-visual-viewport"
  await page.setViewportSize(mobileViewport)
  await installVisualViewportMismatch(
    page,
    { height: 764, offsetTop: 36 },
    storageKey,
  )
  await signIn(page)
  await expect(page.locator(".phone-frame-height")).toHaveCSS("height", "800px")
  await expect(page.locator(".phone-frame-height")).toHaveCSS("top", "0px")

  let releaseAuthRequest: (() => void) | undefined
  const authGate = new Promise<void>((resolve) => {
    releaseAuthRequest = resolve
  })
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
    expect(noticeBox, "confirmation must have a rendered box").not.toBeNull()
    expect(noticeBox!.y).toBeGreaterThanOrEqual(36)
    expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(800)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  } finally {
    releaseAuthRequest?.()
    await page.unroute("**/auth/v1/user")
  }

  await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
  const frameBounds = await page.locator(".phone-frame-height").evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom }
  })
  expect(frameBounds).toEqual({ top: 36, bottom: 800 })

  const header = page.locator("header").first()
  await expect(header).toBeVisible()
  const headerBox = await header.boundingBox()
  expect(headerBox, "header must have a rendered box").not.toBeNull()
  expect(headerBox!.y).toBeGreaterThanOrEqual(36)
  expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(800)
  await expectNavigationUsable(page, { top: 36, bottom: 800 })

  await page.evaluate(() => window.scrollTo(0, 100))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.goto("/app/community")
  const main = page.locator("main")
  await expect(main).toBeVisible()
  expect(await main.evaluate((element) => (
    element.scrollHeight > element.clientHeight
  ))).toBe(true)
  await main.evaluate((element) => {
    element.scrollTop = 100
  })
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test("a stale full height cannot extend below a non-zero visual offset", async ({ page }) => {
  const storageKey = "bottom-nav-stale-height-and-offset"
  await page.setViewportSize(mobileViewport)
  await installVisualViewportMismatch(
    page,
    { height: 800, offsetTop: 36 },
    storageKey,
  )
  await signIn(page)
  await page.evaluate((key) => {
    sessionStorage.setItem(key, "true")
    window.visualViewport?.dispatchEvent(new Event("resize"))
  }, storageKey)

  await expect(page.locator(".phone-frame-height")).toHaveCSS("top", "36px")
  await expect(page.locator(".phone-frame-height")).toHaveCSS("height", "764px")
  const frameBounds = await page.locator(".phone-frame-height").evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom }
  })
  expect(frameBounds).toEqual({ top: 36, bottom: 800 })
  await expectNavigationUsable(page, { top: 36, bottom: 800 })
})

test("refresh ignores a stale visual viewport that is taller than the screen", async ({ page }) => {
  const renderedHeight = 764
  const staleVisualViewportHeight = 800
  const storageKey = "bottom-nav-tall-visual-viewport"
  await page.setViewportSize({ width: mobileViewport.width, height: renderedHeight })
  await installVisualViewportMismatch(
    page,
    { height: staleVisualViewportHeight, offsetTop: 0 },
    storageKey,
  )

  await signIn(page)
  await expect(page.locator(".phone-frame-height")).toHaveCSS(
    "height",
    `${renderedHeight}px`,
  )

  let releaseAuthRequest: (() => void) | undefined
  const authGate = new Promise<void>((resolve) => {
    releaseAuthRequest = resolve
  })
  await page.route("**/auth/v1/user", async (route) => {
    await authGate
    await route.continue()
  })
  await page.evaluate((key) => sessionStorage.setItem(key, "true"), storageKey)

  try {
    await page.reload()
    await expect(page.getByText(/Confirming your verified campus profile/u)).toBeVisible()
    await expect(page.locator(".phone-frame-height")).toHaveCSS(
      "height",
      `${renderedHeight}px`,
    )
  } finally {
    releaseAuthRequest?.()
    await page.unroute("**/auth/v1/user")
  }

  await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
  const measurements = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".phone-frame-height")
    const navigation = document.querySelector<HTMLElement>("nav")
    if (!frame || !navigation || !window.visualViewport) {
      throw new Error("Viewport test elements are unavailable")
    }

    return {
      bodyScrollHeight: document.body.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      frameBottom: frame.getBoundingClientRect().bottom,
      frameTop: frame.getBoundingClientRect().top,
      navigationBottom: navigation.getBoundingClientRect().bottom,
      visualViewportHeight: window.visualViewport.height,
      windowScrollY: window.scrollY,
    }
  })

  expect(measurements.visualViewportHeight).toBe(staleVisualViewportHeight)
  expect(measurements.frameTop).toBe(0)
  expect(measurements.frameBottom).toBe(renderedHeight)
  expect(measurements.documentClientHeight).toBe(renderedHeight)
  expect(measurements.documentScrollHeight).toBe(renderedHeight)
  expect(measurements.bodyScrollHeight).toBeLessThanOrEqual(renderedHeight)
  expect(measurements.windowScrollY).toBe(0)
  expect(measurements.navigationBottom).toBeLessThanOrEqual(
    renderedHeight,
  )
  await expectNavigationUsable(page)

  await page.evaluate(() => window.scrollTo(0, 100))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.goto("/app/community")
  const main = page.locator("main")
  await expect(main).toBeVisible()
  const mainCanScroll = await main.evaluate((element) => {
    const mainElement = element as HTMLElement
    return mainElement.scrollHeight > mainElement.clientHeight
  })
  expect(mainCanScroll).toBe(true)
  await main.evaluate((element) => {
    const mainElement = element as HTMLElement
    mainElement.scrollTop = 100
  })
  await expect.poll(() => main.evaluate((element) => (
    element as HTMLElement
  ).scrollTop)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test("all application routes keep five bottom navigation links visible and tappable", async ({ page }) => {
  await signIn(page)

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport)
    for (const route of shellRoutes) {
      await page.goto(route)
      await setBottomSafeArea(page, 36, 36)
      await expectNoDocumentOverflow(page, viewport.height)
      await expectNavigationUsable(page)
    }
  }
})

test("repeated main-boundary overscroll never chains to the document", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/community")
  const main = page.locator("main")
  await expect(main).toBeVisible()

  await expect.poll(() => page.evaluate(() => ({
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    bodyOverscrollY: getComputedStyle(document.body).overscrollBehaviorY,
    documentOverflowY: getComputedStyle(document.documentElement).overflowY,
    documentOverscrollY: getComputedStyle(document.documentElement).overscrollBehaviorY,
    mainOverscrollY: getComputedStyle(document.querySelector("main")!).overscrollBehaviorY,
  }))).toEqual({
    bodyOverflowY: "hidden",
    bodyOverscrollY: "none",
    documentOverflowY: "hidden",
    documentOverscrollY: "none",
    mainOverscrollY: "contain",
  })

  await main.evaluate((element) => { element.scrollTop = 0 })
  await main.hover()
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.wheel(0, -1200)
  }
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await main.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const maximumScroll = await main.evaluate(
    (element) => element.scrollHeight - element.clientHeight,
  )
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.wheel(0, 1200)
  }
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(maximumScroll)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page).toHaveURL(/\/app\/community$/u)
})

test("install and Push prompts stay inside both portrait viewports", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "default" satisfies NotificationPermission,
    })
  })
  await signIn(page)

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport)
    await page.evaluate(() => {
      localStorage.removeItem("huddle.install.dismissed")
      localStorage.removeItem("huddle.push.rsvpEligibleAt")
      localStorage.removeItem("huddle.push.dismissedUntil")
    })
    await page.reload()
    await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt")
      Object.defineProperties(event, {
        prompt: { value: async () => undefined },
        userChoice: {
          value: Promise.resolve({ outcome: "dismissed", platform: "web" }),
        },
      })
      window.dispatchEvent(event)
    })

    await expect(page.getByText("Install Huddle", { exact: true })).toBeVisible()
    const prompt = page.locator("aside")
    const promptBox = await prompt.boundingBox()
    expect(promptBox, "install prompt must have a rendered box").not.toBeNull()
    expect(promptBox!.y).toBeGreaterThanOrEqual(0)
    expect(promptBox!.y + promptBox!.height).toBeLessThanOrEqual(viewport.height)
    await expectNavigationUsable(page)
    await page.getByRole("button", { name: "Dismiss install prompt" }).click()
    await expect(prompt).toHaveCount(0)

    await page.evaluate(() => {
      window.dispatchEvent(new Event("huddle:rsvp-success"))
    })
    const pushPromptEnvironment = await page.evaluate(() => ({
      eligibleAt: localStorage.getItem("huddle.push.rsvpEligibleAt"),
      notificationPermission: Notification.permission,
      notificationSupported: "Notification" in window,
      pushManagerSupported: "PushManager" in window,
      serviceWorkerSupported: "serviceWorker" in navigator,
    }))
    expect(pushPromptEnvironment.eligibleAt).not.toBeNull()
    expect(pushPromptEnvironment.notificationPermission).not.toBe("granted")
    expect(pushPromptEnvironment.notificationSupported).toBe(true)
    expect(pushPromptEnvironment.pushManagerSupported).toBe(true)
    expect(pushPromptEnvironment.serviceWorkerSupported).toBe(true)
    await expect(page.getByText("Get Huddle alerts", { exact: true })).toBeVisible()
    const pushPrompt = page.locator("aside")
    const pushPromptBox = await pushPrompt.boundingBox()
    expect(pushPromptBox, "Push prompt must have a rendered box").not.toBeNull()
    expect(pushPromptBox!.y).toBeGreaterThanOrEqual(0)
    expect(pushPromptBox!.y + pushPromptBox!.height).toBeLessThanOrEqual(viewport.height)
    await expectNavigationUsable(page)
    await page.getByRole("button", { name: "Dismiss Push prompt" }).click()
    await expect(pushPrompt).toHaveCount(0)
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
