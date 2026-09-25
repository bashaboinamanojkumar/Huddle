import { spawnSync } from "node:child_process"
import { defineConfig, devices } from "@playwright/test"

function localSupabaseEnvironment(): Record<string, string> {
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm"
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec supabase status -o env"]
    : ["exec", "supabase", "status", "-o", "env"]
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true })

  if (result.status !== 0) {
    throw new Error("Local Supabase must be running before browser tests.")
  }

  return Object.fromEntries(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => {
        const separator = line.indexOf("=")
        if (separator < 1) return null
        const key = line.slice(0, separator)
        const rawValue = line.slice(separator + 1).trim()
        try {
          return [key, JSON.parse(rawValue)]
        } catch {
          return [key, rawValue]
        }
      })
      .filter((entry): entry is [string, string] => entry !== null),
  )
}

const local = localSupabaseEnvironment()
const supabaseUrl = local.API_URL
const publishableKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY
const serviceRoleKey = local.SERVICE_ROLE_KEY

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Local Supabase browser-test credentials are unavailable.")
}
if (!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) {
  throw new Error("Browser fixtures are restricted to local Supabase.")
}

process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "output/playwright/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  globalSetup: "./tests/browser/global-setup.ts",
  globalTeardown: "./tests/browser/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/verify",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
  },
})
