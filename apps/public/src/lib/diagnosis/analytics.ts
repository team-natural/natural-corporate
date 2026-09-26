// GA4 wrapper for the diagnosis flows (PRD-07 §4). Every event goes through here so the
// parameter set stays reviewable in one place: no free text, no personal data.

export type DiagnosisEventName = "diagnosis_view" | "diagnosis_start" | "diagnosis_answer" | "diagnosis_back" | "diagnosis_complete" | "diagnosis_result_view" | "diagnosis_cta_click" | "diagnosis_cross_start";

export type DiagnosisEventParams = Record<string, string | number | boolean | null | undefined>;

// Public (anonymous) mode is the only one until Phase 2b adds outbound tokens.
export const DIAGNOSIS_MODE = "public";

type GtagFn = (command: "event", name: string, params?: DiagnosisEventParams) => void;

export function trackDiagnosisEvent(name: DiagnosisEventName, params: DiagnosisEventParams = {}): void {
  const gtag = (globalThis as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, { mode: DIAGNOSIS_MODE, ...params });
}
