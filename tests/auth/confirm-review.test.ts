import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const cookieGet = vi.hoisted(() => vi.fn())

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}))

type ReviewPage = (props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) => Promise<React.ReactNode>

describe("email confirmation review page", () => {
  beforeEach(() => {
    cookieGet.mockReset()
    cookieGet.mockReturnValue({ value: "hash-abc" })
  })

  it("requires an explicit form submission before confirming a signup", async () => {
    let ReviewPage: ReviewPage | undefined
    try {
      ReviewPage = (
        await vi.importActual<{ default: ReviewPage }>("@/app/auth/confirm/review/page")
      ).default
    } catch {
      // The assertion below is the intended red state before the page exists.
    }

    expect(ReviewPage).toBeTypeOf("function")
    if (!ReviewPage) return

    const html = renderToStaticMarkup(
      await ReviewPage({
        searchParams: Promise.resolve({
          kind: "token_hash",
          type: "signup",
          next: "/app/chats",
        }),
      })
    )

    expect(html).toContain('method="post"')
    expect(html).toContain('action="/auth/confirm"')
    expect(html).toContain('name="kind" value="token_hash"')
    expect(html).toContain('name="type" value="signup"')
    expect(html).toContain('name="next" value="/app/chats"')
    expect(html).toContain("Confirm email and create account")
  })

  it("does not offer confirmation after the staged token cookie is missing", async () => {
    cookieGet.mockReturnValue(undefined)
    const ReviewPage = (
      await vi.importActual<{ default: ReviewPage }>("@/app/auth/confirm/review/page")
    ).default

    const html = renderToStaticMarkup(
      await ReviewPage({
        searchParams: Promise.resolve({
          kind: "token_hash",
          type: "signup",
          next: "/app/chats",
        }),
      })
    )

    expect(html).toContain("This link is incomplete")
    expect(html).not.toContain('action="/auth/confirm"')
  })
})
