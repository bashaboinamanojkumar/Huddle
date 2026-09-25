import { expect, test, type Page } from "@playwright/test"
import {
  DETAIL_ACTIVITY_ID,
  FIXTURE_EMAIL,
  FIXTURE_PASSWORD,
  INELIGIBLE_ACTIVITY_ID,
  RSVP_ACTIVITY_ID,
} from "./fixture"

async function signIn(page: Page): Promise<void> {
  await page.goto("/verify")
  await page.getByLabel("Campus email").fill(FIXTURE_EMAIL)
  await page.getByLabel("Password").fill(FIXTURE_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/app(?:$|\/)/u)
  await expect(page.getByRole("link", { name: "Open profile" })).toBeVisible()
}

test.describe.configure({ mode: "serial" })

test("Feed and Community expose only their approved header actions", async ({ page }) => {
  await signIn(page)
  await page.goto("/app")

  const feedHeader = page.locator("header").first()
  await expect.poll(() =>
    page.locator(".authenticated-main").evaluate((main) => getComputedStyle(main).paddingTop)
  ).toBe("0px")
  await expect(page.getByText(/^huddle$/iu)).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Huddle home" })).toHaveCount(0)
  await expect(feedHeader.locator("a[aria-label], button[aria-label]")).toHaveCount(3)
  expect(
    await feedHeader.locator("a[aria-label], button[aria-label]").evaluateAll((actions) =>
      actions.map((action) => action.getAttribute("aria-label")),
    ),
  ).toEqual(["Notifications, 2 unread", "Invite friends", "Open profile"])
  await expect(page.getByRole("heading", { name: "Hey, Browser 👋" })).toBeVisible()

  await feedHeader.getByRole("button", { name: "Invite friends" }).click()
  const inviteToast = page.getByText("Invite link copied for the pilot demo.")
  await expect(inviteToast).toBeVisible()
  const viewport = page.viewportSize()
  await page.mouse.move(4, Math.max(4, (viewport?.height ?? 844) - 4))
  await expect(inviteToast).toBeHidden({ timeout: 10_000 })

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 })
    await expect.poll(() =>
      page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true)
  }

  await feedHeader.getByRole("link", { name: "Notifications, 2 unread" }).click()
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Huddle home" })).toHaveCount(0)

  await page.goto("/app")
  await page.locator("header").first().getByRole("link", { name: "Open profile" }).click()
  await expect(page).toHaveURL(/\/app\/profile$/u)
  await expect(page.getByRole("heading", { name: /Browser/u })).toBeVisible()

  await page.goto("/app/community")
  const communityHeader = page.locator("header").first()
  await expect.poll(() =>
    page.locator(".authenticated-main").evaluate((main) => getComputedStyle(main).paddingTop)
  ).toBe("0px")
  await expect(page.getByText(/^huddle$/iu)).toHaveCount(1)
  await expect(page.getByRole("link", { name: "Huddle home" })).toHaveCount(0)
  await expect(communityHeader.locator("a[aria-label]")).toHaveCount(2)
  expect(
    await communityHeader.locator("a[aria-label]").evaluateAll((actions) =>
      actions.map((action) => action.getAttribute("aria-label")),
    ),
  ).toEqual(["Notifications, 2 unread", "Open profile"])
  await expect(
    communityHeader.getByPlaceholder("Search activities or locations").locator("..").locator("svg"),
  ).toHaveCount(1)

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 })
    await expect.poll(() =>
      page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true)
  }

  await communityHeader.getByRole("link", { name: "Notifications, 2 unread" }).click()
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible()
})

test("inbox unread state, mark-all, and validated deep link", async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole("link", { name: "Notifications, 2 unread" })).toBeVisible()
  await page.getByRole("link", { name: "Notifications, 2 unread" }).click()

  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible()
  await expect(page.getByText("Browser activity update")).toBeVisible()
  const markAllResponse = page.waitForResponse((response) =>
    response.url().includes("/rpc/mark_all_notifications_read")
      && response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Mark all read" }).click()
  await markAllResponse

  await page.goto("/app")
  await expect(page.getByRole("link", { name: "Notifications, 0 unread" })).toBeVisible()
  await page.goto("/app/community")
  await expect(page.getByRole("link", { name: "Notifications, 0 unread" })).toBeVisible()

  await page.goto("/app/notifications")
  await page.getByRole("button", { name: /Browser activity update/u }).click()
  await expect(page).toHaveURL(new RegExp(`/app/activity/${DETAIL_ACTIVITY_ID}$`, "u"))
  await expect(page.getByRole("heading", { name: "Browser Detail Huddle" })).toBeVisible()
})

test("settings are discoverable from Profile and Notifications", async ({ page }) => {
  await signIn(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/app/profile")
  await expect(page.getByRole("link", { name: "Huddle home" })).toHaveCount(0)
  const profileSettings = page.getByRole("link", {
    name: /Notification settings Push, quiet hours, and device controls/u,
  })
  await expect(profileSettings).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(5)
  await expect.poll(() =>
    page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true)

  await profileSettings.click()
  await expect(page).toHaveURL(/\/app\/settings$/u)
  await expect(page.getByRole("link", { name: "Huddle home" })).toHaveCount(0)
  await expect.poll(() =>
    page.locator(".authenticated-main").evaluate((main) => getComputedStyle(main).paddingTop)
  ).toBe("16px")
  await expect(page.getByRole("heading", { name: "Push notifications" })).toBeVisible()

  await page.goto("/app/notifications")
  await expect(page.getByRole("link", { name: "Huddle home" })).toHaveCount(0)
  const inboxSettings = page.getByRole("link", {
    name: "Notification settings",
    exact: true,
  })
  await expect(inboxSettings).toBeVisible()
  await expect.poll(() =>
    page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true)

  await inboxSettings.click()
  await expect(page).toHaveURL(/\/app\/settings$/u)
  await expect(page.getByRole("heading", { name: "Push notifications" })).toBeVisible()
})

test("settings expose production defaults and persist changes", async ({ page }) => {
  await signIn(page)
  await page.goto("/app/settings")

  await expect(page.getByRole("heading", { name: "Push notifications" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Start", exact: true })).toHaveValue("22:00")
  await expect(page.getByRole("textbox", { name: "End", exact: true })).toHaveValue("08:00")
  await expect(page.getByLabel("Daily Push cap")).toHaveValue("6")
  await expect(page.getByText("Rewards", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Enable on this device" })).toBeVisible()

  await page.getByLabel("Daily Push cap").fill("7")
  await page.getByRole("button", { name: "Save settings" }).click()
  await expect(page.getByRole("status")).toContainText("Settings saved")
})

test("eligible pulse is stored once and remains immutable after refresh", async ({ page }) => {
  await signIn(page)
  await page.goto(`/app/activity/${DETAIL_ACTIVITY_ID}/pulse`)

  await expect(page.getByText("Did you meet up with your Huddle?")).toBeVisible()
  await page.getByRole("button", { name: "Yes" }).click()
  await page.getByLabel("Optional rating").selectOption("5")
  await page.getByRole("button", { name: "Submit response" }).click()
  await expect(page.getByText(/response is saved/u)).toBeVisible()
  await expect(page.getByText("Rating: 5/5")).toBeVisible()

  await page.reload()
  await expect(page.getByText(/response is saved/u)).toBeVisible()
  await expect(page.getByRole("button", { name: "Submit response" })).toHaveCount(0)
})

test("ineligible pulse hides submission controls", async ({ page }) => {
  await signIn(page)
  await page.goto(`/app/activity/${INELIGIBLE_ACTIVITY_ID}/pulse`)
  await expect(page.getByText(/only available to people who joined/u)).toBeVisible()
  await expect(page.getByRole("button", { name: "Submit response" })).toHaveCount(0)
})

test("first successful RSVP exposes the privacy-first Push explanation", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "default" satisfies NotificationPermission,
    })
  })
  await signIn(page)
  await page.goto(`/app/activity/${RSVP_ACTIVITY_ID}`)
  await page.getByRole("button", { name: "Huddle up" }).click()
  await expect(page.getByText("Get Huddle alerts")).toBeVisible()
  await expect(page.getByText(/privacy-safe reminders and updates/u)).toBeVisible()
})

test.describe("iOS install-first branch", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  })

  test("does not request permission and shows installation guidance", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("huddle.push.rsvpEligibleAt", new Date().toISOString())
      Object.defineProperty(window, "__notificationRequestCount", {
        value: 0,
        writable: true,
      })
      if ("Notification" in window) {
        Object.defineProperty(Notification, "requestPermission", {
          configurable: true,
          value: async () => {
            ;(window as typeof window & { __notificationRequestCount: number })
              .__notificationRequestCount += 1
            return "default" as NotificationPermission
          },
        })
      }
    })

    await signIn(page)
    await expect(page.getByText("Install Huddle", { exact: true })).toBeVisible()
    await expect(page.getByText(/Install Huddle before enabling Push/u)).toBeVisible()
    await expect(page.getByText("Open Huddle in Safari.")).toBeVisible()
    expect(
      await page.evaluate(() =>
        (window as typeof window & { __notificationRequestCount: number })
          .__notificationRequestCount
      ),
    ).toBe(0)
  })
})
