// GA4 wrapper for the diagnosis flows (PRD-07 §4). Every event goes through here so the
// parameter set stays reviewable in one place: no free text, no personal data.

import { PARAM_TOKEN } from "./routes";

export type DiagnosisEventName = "diagnosis_view" | "diagnosis_start" | "diagnosis_answer" | "diagnosis_back" | "diagnosis_complete" | "diagnosis_result_view" | "diagnosis_cta_click" | "diagnosis_cross_start";

export type DiagnosisEventParams = Record<string, string | number | boolean | null | undefined>;

// GA4 only learns which mode a run was in, never which token (DEV-11 §6-7).
export function currentDiagnosisMode(): "public" | "outbound" {
  return new URLSearchParams(window.location.search).has(PARAM_TOKEN) ? "outbound" : "public";
}

type GtagFn = (command: "event", name: string, params?: DiagnosisEventParams) => void;

export function trackDiagnosisEvent(name: DiagnosisEventName, params: DiagnosisEventParams = {}): void {
  const gtag = (globalThis as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, { mode: currentDiagnosisMode(), ...params });
}
