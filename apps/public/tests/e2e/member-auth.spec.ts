import { expect, test, type Page } from "@playwright/test";
import { E2E_MEMBER } from "./global-setup";

// login-form.svelte keeps the button disabled until onMount, so "enabled" is the hydration
// signal — and the only check that catches a page missing its client:* directive.
async function login(page: Page, email: string, password: string) {
  const submit = page.getByRole("button", { name: "Login" });
  await expect(submit).toBeEnabled();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submit.click();
}

test.describe("member login", () => {
  test("wrong credentials stay on the login screen and reveal nothing", async ({ page }) => {
    await page.goto("/login/");
    await login(page, E2E_MEMBER.email, "not-the-password");

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(E2E_MEMBER.email);
    expect(new URL(page.url()).pathname).toBe("/login/");
  });

  test("correct credentials reach the member page with an HttpOnly session cookie", async ({ page, context }) => {
    await page.goto("/login/");
    await login(page, E2E_MEMBER.email, E2E_MEMBER.password);

    await page.waitForURL("**/mypage/");
    await expect(page.getByText(E2E_MEMBER.email)).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "member_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("member pages are never handed to a shared cache", async ({ page }) => {
    // Unlike the admin subdomain, this origin is cacheable by default.
    await page.goto("/login/");
    await login(page, E2E_MEMBER.email, E2E_MEMBER.password);
    await page.waitForURL("**/mypage/");

    const response = await page.goto("/mypage/");
    expect(response?.headers()["cache-control"]).toContain("no-store");
  });

  test("the member page redirects when unauthenticated, uncacheably", async ({ page, request }) => {
    // Guarded in the page frontmatter, so this holds regardless of client-side JS.
    await page.goto("/mypage/");
    expect(new URL(page.url()).pathname).toBe("/login/");

    // The redirect itself must not be cacheable either — a shared cache would otherwise pin
    // one visitor's authenticated/anonymous answer for everyone.
    const redirect = await request.get("/mypage/", { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers()["cache-control"]).toContain("no-store");
  });

  test("an admin session cookie does not authenticate on the public site", async ({ page, context, baseURL }) => {
    // Both apps share one D1; the split into member_sessions is what keeps a token minted for
    // one side unusable on the other.
    await context.addCookies([{ name: "admin_session", value: "some-admin-token", url: baseURL! }]);
    await page.goto("/mypage/");

    expect(new URL(page.url()).pathname).toBe("/login/");
  });

  test("logging out revokes the session, not just the cookie", async ({ page }) => {
    await page.goto("/login/");
    await login(page, E2E_MEMBER.email, E2E_MEMBER.password);
    await page.waitForURL("**/mypage/");

    await page.getByRole("button", { name: "Log out" }).click();
    // A trailing-slash regex would match /mypage/ too and resolve before the redirect lands.
    await page.waitForURL((url) => url.pathname === "/");

    await page.goto("/mypage/");
    expect(new URL(page.url()).pathname).toBe("/login/");
  });
});

test.describe("public site", () => {
  test("the top page renders and its client script runs", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "株式会社ナチュラル" }).first()).toBeVisible();

    // src/js/main.js is the only client entry point. It is loaded as a bundled module, so a
    // build that failed to bundle it still serves the markup — only an interaction catches it.
    const toggle = page.getByRole("button", { name: "メニュー" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("the middleware's security headers are present", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the contact endpoint accepts a post from a visitor with no session", async ({ request, baseURL }) => {
    // The site's only unauthenticated write, so here a 401 would be the bug. Astro's CSRF check
    // still applies, hence the Origin.
    const headers = { Origin: baseURL! };

    // A filled honeypot short-circuits before Turnstile and Resend, so this needs no secrets.
    const bot = await request.post("/api/contact/", { headers, data: { website: "bot" } });
    expect(bot.status()).toBe(200);
    expect((await bot.json()).ok).toBe(true);

    const invalid = await request.post("/api/contact/", { headers, data: { name: "", email: "nope", message: "" } });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).ok).toBe(false);

    // trailingSlash: "always" applies to API routes too, so the slash-less path is a 404. The
    // form would fail silently if someone dropped the slash from its fetch.
    const noSlash = await request.post("/api/contact", { headers, data: { website: "bot" } });
    expect(noSlash.status()).toBe(404);
  });

  test("a Content Collections news post renders at its own route", async ({ page }) => {
    // getStaticPaths is silently ignored under output: "server" without `prerender = true`,
    // and the failure only shows up on the post route itself.
    await page.goto("/news/");
    // Following whichever post is first keeps this from breaking when one is added or removed.
    const firstPost = page.locator("li a[href^='/news/']").first();
    await expect(firstPost).toBeVisible();
    const href = await firstPost.getAttribute("href");

    // Navigating rather than clicking: <html class="scroll-smooth"> makes Playwright's
    // scroll-into-view race the animation, and the link sits below the fold.
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
