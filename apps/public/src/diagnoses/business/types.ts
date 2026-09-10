export interface DiagnosisOption {
  label: string;
  scores: Record<string, number>;
}

export interface DiagnosisQuestion {
  id: string;
  prompt: string;
  options: DiagnosisOption[];
}

export interface DiagnosisResultPricing {
  conventionalPriceFrom: string;
  conventionalDuration: string;
  priceFrom: string;
  durationFrom: string;
}

export interface DiagnosisResultType {
  id: string;
  name: string;
  /** Short label for the radar chart axis (the full name doesn't fit across 8 axes). */
  chartLabel: string;
  icon: string;
  description: string;
  risk: string | null;
  direction: string;
  /** Second half of "direction of resolution". Masked with a CSS blur to drive inquiries. null means fully public. */
  directionLocked: string | null;
  proposal: string;
  /** Second half of "proposed service". Masked with a CSS blur to drive inquiries. null means fully public. */
  proposalLocked: string | null;
  pricing: DiagnosisResultPricing | null;
}

export interface DiagnosisDefinition {
  slug: string;
  title: string;
  metaDescription: string;
  catchCopy: string;
  subCopy: string;
  note: string;
  startButtonLabel: string;
  ctaHref: string;
  ctaLabel: string;
  crossLinkLabel: string;
  concernQuestionId: string;
  bridgeTextByConcern: Record<string, string>;
  questions: DiagnosisQuestion[];
  resultTypes: DiagnosisResultType[];
  zeroScoreTypeId: string;
  tieBreakOrder: string[];
}
