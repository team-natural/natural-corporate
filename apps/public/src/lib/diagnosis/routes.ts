// Single source of truth for the diagnosis URL structure. Every diagnosis
// shares the same "questions"/"result" sub-structure under /diagnosis/<slug>/ —
// only the slug varies per diagnosis, so it's the only thing callers pass in.

import { DIAGNOSIS_INQUIRY_TYPE } from "../contact/inquiry-types";

export const DIAGNOSIS_ROOT_SEGMENT = "diagnosis";
export const QUESTIONS_SEGMENT = "questions";
export const RESULT_SEGMENT = "result";

// Query parameters shared by every diagnosis flow (PRD-07 §1-3 / §2-3, PRD-08 §1-1).
// `t` / `p` are reserved for the outbound and partner tokens (Phase 2b / 4).
export const PARAM_VERSION = "v";
export const PARAM_FROM = "from";
export const PARAM_ANSWERS = "a";
export const PARAM_SCORES = "s";
export const PARAM_TOKEN = "t";
export const PARAM_PARTNER = "p";

export function diagnosisIntroPath(slug: string): string {
  return `/${DIAGNOSIS_ROOT_SEGMENT}/${slug}/`;
}

export function diagnosisQuestionsPath(slug: string): string {
  return `/${DIAGNOSIS_ROOT_SEGMENT}/${slug}/${QUESTIONS_SEGMENT}/`;
}

export function diagnosisResultPath(slug: string, resultTypeId: string): string {
  return `/${DIAGNOSIS_ROOT_SEGMENT}/${slug}/${RESULT_SEGMENT}/${resultTypeId.toLowerCase()}/`;
}

// Cross-guidance link: the destination intro carries `from` through the questions
// into its own result URL, where it suppresses the link back (one round trip only).
export function diagnosisCrossPath(toSlug: string, fromSlug: string): string {
  return `${diagnosisIntroPath(toSlug)}?${new URLSearchParams({ [PARAM_FROM]: fromSlug })}`;
}

export const DIAGNOSIS_CTA_HREF = "/contact/";
export const LINE_CONSULT_HREF = "https://lin.ee/U6qCUXl";
export const CASES_HREF = "/cases/";
export const SEMINAR_HREF = "/seminar/";

// SCR-21 does not exist until Phase 3; CTAs of kind "paid_diagnosis" stay hidden while null.
export const PAID_DIAGNOSIS_HREF: string | null = null;

// External booking tool for the 15-minute briefing (GOV-01 D-011). Build-time variable:
// unset means the CTA falls back to the contact form. A literal `{result}` in the URL is
// replaced with the encoded result URL so the tool's notes field can be prefilled.
const BRIEFING_BOOKING_URL: string = import.meta.env?.PUBLIC_BRIEFING_BOOKING_URL ?? "";

export const BRIEFING_FALLBACK_MESSAGE = "15分オンライン結果解説を希望します。";

export function briefingBookingHref(resultUrl: string | null): string {
  if (!BRIEFING_BOOKING_URL) {
    const message = resultUrl ? `${BRIEFING_FALLBACK_MESSAGE}\n結果URL: ${resultUrl}` : BRIEFING_FALLBACK_MESSAGE;
    return diagnosisContactHref(message);
  }
  return BRIEFING_BOOKING_URL.replace("{result}", resultUrl ? encodeURIComponent(resultUrl) : "");
}

// Pure string builder — carries the diagnosis result over to the contact form as a
// prefilled message plus a pre-selected お問い合わせ項目 (contact.astro reads the
// ?inquiry-type= and ?message= params). What the message says is up to each diagnosis.
export function diagnosisContactHref(message: string, inquiryType: string = DIAGNOSIS_INQUIRY_TYPE): string {
  const params = new URLSearchParams({ "inquiry-type": inquiryType, message });
  return `${DIAGNOSIS_CTA_HREF}?${params}`;
}

// The eight CTA kinds of PRD-07 §4 (`diagnosis_cta_click.cta`). Each diagnosis picks
// which ones a result shows; resolving a kind to a URL is the only shared part.
export type DiagnosisCtaKind = "service_contact" | "briefing_15min" | "paid_diagnosis" | "contact" | "line" | "cross_diagnosis" | "case" | "seminar";

export interface DiagnosisCta {
  kind: DiagnosisCtaKind;
  label: string;
  /** service_contact only: the お問い合わせ項目 to pre-select. */
  inquiryType?: string;
}

export interface ResolvedCta extends DiagnosisCta {
  href: string;
}

export interface CtaContext {
  slug: string;
  otherSlug: string;
  /** Message prefilled into the contact form for service_contact / contact. */
  contactMessage: string;
  /** Known only client-side; the SSR pass passes null and result.js fills it in. */
  resultUrl: string | null;
}

export function resolveCtaHref(cta: DiagnosisCta, ctx: CtaContext): string | null {
  switch (cta.kind) {
    case "service_contact":
      return diagnosisContactHref(ctx.contactMessage, cta.inquiryType ?? DIAGNOSIS_INQUIRY_TYPE);
    case "contact":
      return diagnosisContactHref(ctx.contactMessage);
    case "briefing_15min":
      return briefingBookingHref(ctx.resultUrl);
    case "paid_diagnosis":
      return PAID_DIAGNOSIS_HREF;
    case "line":
      return LINE_CONSULT_HREF;
    case "cross_diagnosis":
      return diagnosisCrossPath(ctx.otherSlug, ctx.slug);
    case "case":
      return CASES_HREF;
    case "seminar":
      return SEMINAR_HREF;
  }
}

export function resolveCtas(ctas: DiagnosisCta[], ctx: CtaContext): ResolvedCta[] {
  return ctas.flatMap((cta) => {
    const href = resolveCtaHref(cta, ctx);
    return href ? [{ ...cta, href }] : [];
  });
}
