import { describe, expect, it } from "vitest";
import { briefingBookingHref, diagnosisContactHref, diagnosisCrossPath, diagnosisResultPath, resolveCtas, type CtaContext } from "../../src/lib/diagnosis/routes";

const ctx: CtaContext = { slug: "business", otherSlug: "ai-dx", contactMessage: "msg", resultUrl: "https://naturaling.jp/diagnosis/business/result/e/?v=2" };

describe("diagnosis URLs", () => {
  it("always end with a slash (trailingSlash: always)", () => {
    expect(diagnosisResultPath("business", "E")).toBe("/diagnosis/business/result/e/");
    expect(diagnosisCrossPath("ai-dx", "business")).toBe("/diagnosis/ai-dx/?from=business");
    expect(diagnosisContactHref("hello")).toMatch(/^\/contact\/\?/);
  });

  it("pre-selects the requested お問い合わせ項目", () => {
    const params = new URL(diagnosisContactHref("hello", "システム開発について"), "https://example.test").searchParams;
    expect(params.get("inquiry-type")).toBe("システム開発について");
    expect(params.get("message")).toBe("hello");
  });
});

describe("briefing booking", () => {
  it("falls back to the contact form with the result URL when no tool is configured", () => {
    const params = new URL(briefingBookingHref(ctx.resultUrl), "https://example.test").searchParams;
    expect(params.get("inquiry-type")).toBe("診断結果について");
    expect(params.get("message")).toContain(ctx.resultUrl);
  });
});

describe("resolveCtas", () => {
  it("drops the paid diagnosis until its page exists", () => {
    const resolved = resolveCtas(
      [
        { kind: "paid_diagnosis", label: "paid" },
        { kind: "seminar", label: "seminar" },
      ],
      ctx,
    );
    expect(resolved.map((cta) => cta.kind)).toEqual(["seminar"]);
  });

  it("sends the cross diagnosis to the other intro with ?from=", () => {
    const [cross] = resolveCtas([{ kind: "cross_diagnosis", label: "x" }], ctx);
    expect(cross.href).toBe("/diagnosis/ai-dx/?from=business");
  });
});
