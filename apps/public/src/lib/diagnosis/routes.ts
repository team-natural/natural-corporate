// Single source of truth for the diagnosis URL structure. Every diagnosis
// shares the same "questions"/"result" sub-structure under /diagnosis/<slug>/ —
// only the slug varies per diagnosis, so it's the only thing callers pass in.

import { DIAGNOSIS_INQUIRY_TYPE } from "../contact/inquiry-types";

export const DIAGNOSIS_ROOT_SEGMENT = "diagnosis";
export const QUESTIONS_SEGMENT = "questions";
export const RESULT_SEGMENT = "result";

export function diagnosisIntroPath(slug: string): string {
  return `/${DIAGNOSIS_ROOT_SEGMENT}/${slug}/`;
}

export function diagnosisQuestionsPath(slug: string): string {
  return `/${DIAGNOSIS_ROOT_SEGMENT}/${slug}/${QUESTIONS_SEGMENT}/`;
}

export function diagnosisResultPath(slug: string, resultTypeId: string): string {
  return `/${DIAGNOSIS_ROOT_SEGMENT}/${slug}/${RESULT_SEGMENT}/${resultTypeId.toLowerCase()}/`;
}

// The only piece of content genuinely shared across diagnoses: every
// diagnosis's CTA points at the same consultation flow, so it's a single
// constant rather than duplicated literals in each data.ts.
export const DIAGNOSIS_CTA_HREF = "/contact/";

// Pure string builder — carries the diagnosis result over to the contact
// form as a prefilled message plus a pre-selected お問い合わせ項目
// (contact.astro reads the ?inquiry-type= and ?message= params).
// What the message says is up to each diagnosis's own ResultPage.astro.
export function diagnosisContactHref(message: string): string {
  const params = new URLSearchParams({ "inquiry-type": DIAGNOSIS_INQUIRY_TYPE, message });
  return `${DIAGNOSIS_CTA_HREF}?${params}`;
}
