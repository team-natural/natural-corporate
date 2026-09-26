import type { DiagnosisCta } from "../../lib/diagnosis/routes";

export interface DiagnosisOption {
  label: string;
  scores: Record<string, number>;
  /** Concern question only: the types this worry points at (tie-break + bridge text, no points). */
  concerns?: string[];
  /** Types this answer takes out of the judgement ("今回は対象外"). */
  notApplicable?: string[];
}

export interface DiagnosisQuestion {
  id: string;
  prompt: string;
  /** Short subject used when quoting the answer as a judgement reason. */
  topic: string;
  options: DiagnosisOption[];
}

export interface DiagnosisResultType {
  id: string;
  name: string;
  /** Short label for the radar chart axis (the full name doesn't fit across 9 axes). */
  chartLabel: string;
  icon: string;
  description: string;
  risk: string | null;
  direction: string;
  /** Shown when this type scores 0% (a strength). null for the all-clear type. */
  strength: string | null;
  firstSteps: string[];
  relatedService: string;
  /** "課題が明確" route — one service consultation per type. */
  primaryCta: DiagnosisCta;
  /** "課題が複雑" and "検討段階" routes, in display order. */
  secondaryCtas: DiagnosisCta[];
}

export interface DiagnosisDefinition {
  slug: string;
  version: number;
  title: string;
  metaDescription: string;
  catchCopy: string;
  subCopy: string;
  note: string;
  startButtonLabel: string;
  crossLinkLabel: string;
  crossLinkLead: string;
  limitationText: string;
  concernQuestionId: string;
  bridgeTextByConcern: Record<string, string>;
  questions: DiagnosisQuestion[];
  resultTypes: DiagnosisResultType[];
  zeroScoreTypeId: string;
  tieBreakOrder: string[];
  /** Ratio (0–1) both primary and secondary must reach for the "複数課題" rule (PRD-07 §1-7). */
  complexThreshold: number;
  /** Added to the secondary routes when that rule fires and the type does not list it already. */
  complexCta: DiagnosisCta;
}
