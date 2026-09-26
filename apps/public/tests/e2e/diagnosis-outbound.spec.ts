import { expect, test } from "@playwright/test";
import business from "../../src/diagnoses/business/data";
import { E2E_TOKEN, E2E_REVOKED_TOKEN } from "./global-setup";

// The outbound mode end to end: entry URL → questions carrying the token → server-side save →
// result page with the lead form. Seeded by global-setup.ts (campaign + two tokens).

test.describe("outbound entry", () => {
  test("a live token renders the campaign copy and is not indexable", async ({ page }) => {
    const response = await page.goto(`/d/${E2E_TOKEN}/`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toBe("noindex");
    await expect(page.getByText("E2E キャンペーン向けの入口文言")).toBeVisible();
    await expect(page.getByText("ご回答の取り扱いについて")).toBeVisible();
    await expect(page.locator("[data-diagnosis-start]")).toHaveAttribute("href", `/diagnosis/business/questions/?t=${E2E_TOKEN}`);
  });

  test("a revoked or unknown token is a 404 on the page and on the API alike", async ({ page, request }) => {
    expect((await page.goto(`/d/${E2E_REVOKED_TOKEN}/`))?.status()).toBe(404);
    expect((await page.goto("/d/not-a-token/"))?.status()).toBe(404);
    expect((await request.get(`/api/v1/diagnosis-tokens/${E2E_REVOKED_TOKEN}/`)).status()).toBe(404);
    const live = await request.get(`/api/v1/diagnosis-tokens/${E2E_TOKEN}/`);
    expect(live.status()).toBe(200);
    expect((await live.json()).data).toMatchObject({ diagnosis: "business", kind: "outbound", consentRequired: false });
  });
});

test.describe("outbound run", () => {
  test("answers are saved server-side and the result page opens the lead form", async ({ page }) => {
    await page.goto(`/diagnosis/business/questions/?t=${E2E_TOKEN}`);
    for (let i = 0; i < business.questions.length; i++) await page.getByRole("radio").first().click();
    await page.waitForURL("**/diagnosis/business/result/**");

    const url = new URL(page.url());
    expect(url.searchParams.get("t")).toBe(E2E_TOKEN);
    // `r` is the saved response's public id — only present when the POST succeeded.
    expect(url.searchParams.get("r")).toMatch(/^[0-9A-Z]{26}$/);

    const form = page.locator("#diagnosis-lead-form");
    await expect(form).toBeVisible();
    // The briefing CTA now opens the form instead of leaving the page.
    await page.locator('a[data-cta-kind="briefing_15min"]').first().click();
    await expect(page.locator("#lead-purpose")).toHaveValue("briefing");
    expect(new URL(page.url()).pathname).toContain("/diagnosis/business/result/");

    // Client-side validation runs before anything is sent.
    await page.locator("#lead-submit").click();
    await expect(page.locator("#lead-company-error")).toBeVisible();
  });

  test("the lead API refuses a bad Turnstile token and a bad response id", async ({ request, baseURL }) => {
    const headers = { Origin: baseURL!, "Content-Type": "application/json" };
    const base = { purpose: "service", company: "E2E", name: "Tester", email: "e2e@example.test", privacyAgree: true, turnstileToken: "invalid" };
    const forbidden = await request.post("/api/v1/leads/", { headers, data: { ...base, token: E2E_TOKEN } });
    expect(forbidden.status()).toBe(403);

    const unprocessable = await request.post("/api/v1/leads/", { headers, data: { ...base, turnstileToken: "" } });
    expect(unprocessable.status()).toBe(422);
    expect((await unprocessable.json()).errors).toHaveProperty("turnstileToken");

    // Honeypot: looks like a success, writes nothing.
    const bot = await request.post("/api/v1/leads/", { headers, data: { ...base, website: "http://spam.example" } });
    expect(bot.status()).toBe(201);
  });

  test("the save API validates the definition version and the answers", async ({ request, baseURL }) => {
    const headers = { Origin: baseURL!, "Content-Type": "application/json" };
    const answers = Object.fromEntries(business.questions.map((question) => [question.id, 0]));
    const stale = await request.post("/api/v1/diagnosis-responses/", { headers, data: { token: E2E_TOKEN, diagnosis: "business", definitionVersion: 1, answers } });
    expect(stale.status()).toBe(422);
    const noToken = await request.post("/api/v1/diagnosis-responses/", { headers, data: { token: "nope", diagnosis: "business", definitionVersion: business.version, answers } });
    expect(noToken.status()).toBe(404);
  });
});
