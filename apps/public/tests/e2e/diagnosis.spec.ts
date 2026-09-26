import { expect, test, type Page } from "@playwright/test";
import business from "../../src/diagnoses/business/data";
import aiDx from "../../src/diagnoses/ai-dx/data";

// Prerendering, v1/v2 URL compatibility and the CTA hand-off — none of which a unit test can
// reach, because the result page is static HTML plus a client script reading the query string.

type GtagCall = [string, string, Record<string, unknown>?];

async function dataLayerEvents(page: Page): Promise<GtagCall[]> {
  return page.evaluate(() => {
    const layer = (window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? [];
    return Array.from(layer, (entry) => Array.from(entry) as GtagCall).filter((entry) => entry[0] === "event");
  });
}

test.describe("prerendered result pages", () => {
  for (const type of business.resultTypes) {
    test(`business /${type.id.toLowerCase()}/ renders its own type`, async ({ page }) => {
      const response = await page.goto(`/diagnosis/business/result/${type.id.toLowerCase()}/`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(type.name);
    });
  }

  for (const level of aiDx.levels) {
    test(`ai-dx /${level.id}/ renders its own level`, async ({ page }) => {
      const response = await page.goto(`/diagnosis/ai-dx/result/${level.id}/`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(level.name);
    });
  }
});

test.describe("business result URL compatibility", () => {
  test("a v1 URL (no `v`) still draws the chart in points and shows no v2 blocks", async ({ page }) => {
    await page.goto("/diagnosis/business/result/e/?second=c&concern=4&s=1.0.2.0.3.0.0.1.0");
    await expect(page.locator("#diagnosis-bridge-text")).toBeVisible();
    await expect(page.locator("#diagnosis-scores-section")).toBeVisible();
    await expect(page.locator("#diagnosis-rank-score-0")).toHaveText("3点");
    await expect(page.locator("#diagnosis-secondary")).toBeVisible();
    await expect(page.locator("#diagnosis-reasons")).toBeHidden();
    await expect(page.locator("#diagnosis-strengths")).toBeHidden();
  });

  test("a v2 URL with answers shows reasons, strengths and percentages", async ({ page }) => {
    // q0=4 (concern), q6=1 (口頭・電話・紙), q7=1 (紙・Excel), q8=2 (テンプレはあるが…), rest clean → E 80%, G 67%.
    await page.goto("/diagnosis/business/result/e/?v=2&second=g&concern=4&s=0.1.2.0.4.0.2.0.0&a=4.4.3.4.4.3.1.1.2.3");
    await expect(page.locator("#diagnosis-reasons")).toBeVisible();
    await expect(page.locator("#diagnosis-reasons-list li")).toHaveCount(3);
    await expect(page.locator("#diagnosis-rank-score-0")).toHaveText("80%");
    await expect(page.locator("#diagnosis-strengths")).toBeVisible();
    await expect(page.locator("#diagnosis-complex-cta")).toHaveCount(0);
  });

  test("a v2 URL with a not-applicable type greys it out", async ({ page }) => {
    await page.goto("/diagnosis/business/result/h/?v=2&s=0.0.0.0.0.0.0.2.0&a=7.2.4.4.4.4.4.3.3.3&na=a");
    await expect(page.locator("#diagnosis-na-note")).toContainText("発信力");
  });

  test("a bare URL renders the static copy and no chart", async ({ page }) => {
    await page.goto("/diagnosis/business/result/a/");
    await expect(page.locator("#diagnosis-scores-section")).toBeHidden();
    await expect(page.getByRole("heading", { name: "一般的な改善の方向" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "次の進路" })).toBeVisible();
  });
});

test.describe("ai-dx result URL compatibility", () => {
  test("a v1 URL still draws the axis bars and the weakest axis", async ({ page }) => {
    await page.goto("/diagnosis/ai-dx/result/level-3/?s=4.3.2.3.3");
    await expect(page.locator("#diagnosis-axis-section")).toBeVisible();
    await expect(page.locator("#diagnosis-weakest-heading")).toContainText("AI活用");
    await expect(page.locator("#diagnosis-reason")).toBeHidden();
  });

  test("a v2 URL shows the reason, balance note, strengths and the q5 first step", async ({ page }) => {
    // 6+6+1+0+0 = 13 → level 3, people-org weakest → primary CTA becomes the briefing.
    await page.goto("/diagnosis/ai-dx/result/level-3/?v=2&s=6.6.1.0.0&a=4.4.4.4.1.2.1.1.1.1&f=unknown-ai-usage");
    await expect(page.locator("#diagnosis-reason")).toContainText("13 / 30点");
    await expect(page.locator("#diagnosis-balance-note")).toContainText("人・組織");
    await expect(page.locator("#diagnosis-strengths-list li")).toHaveCount(2);
    await expect(page.locator("#diagnosis-first-steps-list li")).toHaveCount(2);
    const primary = page.locator("#diagnosis-next-steps-heading ~ a[data-cta-kind]");
    await expect(primary).toHaveAttribute("data-cta-kind", "briefing_15min");
  });
});

test.describe("question flow", () => {
  test("answering every business question lands on a v2 result and records GA4 events", async ({ page }) => {
    await page.goto("/diagnosis/business/questions/");
    for (let i = 0; i < business.questions.length; i++) {
      await expect(page.locator("#diagnosis-step-label")).toHaveText(`${i + 1} / ${business.questions.length}`);
      await page.getByRole("radio").first().click();
    }
    await page.waitForURL("**/diagnosis/business/result/**");
    const url = new URL(page.url());
    expect(url.searchParams.get("v")).toBe("2");
    expect(url.searchParams.get("a")?.split(".")).toHaveLength(business.questions.length);
    expect(url.searchParams.get("s")?.split(".")).toHaveLength(9);

    const events = (await dataLayerEvents(page)).map((entry) => entry[1]);
    expect(events).toContain("diagnosis_result_view");
    await expect(page.locator("#diagnosis-reasons")).toBeVisible();
  });

  test("the intro carries ?from= into the questions and the result hides the way back", async ({ page }) => {
    await page.goto("/diagnosis/ai-dx/?from=business");
    const start = page.locator("[data-diagnosis-start]");
    await expect(start).toHaveAttribute("href", /from=business/);
    await start.click();
    await page.waitForURL("**/diagnosis/ai-dx/questions/?from=business");
    for (let i = 0; i < aiDx.questions.length; i++) await page.getByRole("radio").first().click();
    await page.waitForURL("**/diagnosis/ai-dx/result/**");
    expect(new URL(page.url()).searchParams.get("from")).toBe("business");
    await expect(page.locator("#diagnosis-cross")).toBeHidden();
  });

  test("moving to the next question focuses its heading", async ({ page }) => {
    await page.goto("/diagnosis/business/questions/");
    await page.getByRole("radio").first().click();
    await expect(page.locator("#diagnosis-question-heading")).toBeFocused();
  });
});

test.describe("hand-off to the contact form", () => {
  test("the primary CTA pre-selects the service and carries the result URL", async ({ page }) => {
    await page.goto("/diagnosis/business/result/e/?v=2&second=g&s=0.1.2.0.4.0.2.0.0&a=4.4.3.4.4.3.1.1.2.3");
    const primary = page.locator("#diagnosis-next-steps-heading ~ a[data-cta-kind]");
    const href = new URL(await primary.getAttribute("href").then((value) => value ?? ""), page.url());
    expect(href.pathname).toBe("/contact/");
    expect(href.searchParams.get("inquiry-type")).toBe("システム開発について");
    expect(href.searchParams.get("message")).toContain("結果URL: ");
    expect(href.searchParams.get("message")).toContain("アナログ業務型");

    await primary.click();
    await page.waitForURL("**/contact/**");
    await expect(page.locator("#inquiry-type")).toHaveValue("システム開発について");
    await expect(page.locator("#message")).toHaveValue(/業務課題かんたん診断 v2/);
  });

  test("the global navigation links to the diagnosis portal", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#site-header").getByRole("link", { name: "無料診断" })).toHaveAttribute("href", "/diagnosis/");
  });
});
