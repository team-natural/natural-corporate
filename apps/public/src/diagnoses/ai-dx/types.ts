import type { DiagnosisCta } from "../../lib/diagnosis/routes";

export interface AxisOption {
  label: string;
  points: number;
  /** Raised when chosen; each flag adds its own "最初の一歩" and is carried in the result URL. */
  flag?: string;
}

export interface AxisQuestion {
  id: string;
  axisId: string;
  prompt: string;
  options: AxisOption[];
}

// Order matters: ties on the weakest axis are broken toward the earlier
// (more foundational) axis in this array.
export interface Axis {
  id: string;
  name: string;
  /** Shown when the axis reaches strengthThreshold. */
  strength: string;
  /** Self-check action shown when this is the weakest axis. */
  firstStep: string;
}

export interface LevelThreshold {
  level: number;
  min: number;
  max: number;
}

export interface LevelContent {
  id: string;
  level: number;
  name: string;
  icon: string;
  current: string;
  pitfall: string;
  risk: string;
  nextStep: string;
  primaryCta: DiagnosisCta;
  secondaryCtas: DiagnosisCta[];
}

export interface WeakestAxisStep {
  axisId: string;
  body: string;
  relatedService: string;
}

export interface AiDxDefinition {
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
  questions: AxisQuestion[];
  axes: Axis[];
  thresholds: LevelThreshold[];
  levels: LevelContent[];
  weakestAxisSteps: WeakestAxisStep[];
  /** Axis score (0–6) from which an axis counts as a strength. */
  strengthThreshold: number;
  maxStrengths: number;
  /** "総合ではレベル n ですが…" fires at this level or above when the weakest axis is at or below maxAxisScore. */
  balanceNote: { minLevel: number; maxAxisScore: number };
  /** Weakest axes for which the primary CTA is swapped to the 15-minute briefing (BIZ-04 §13). */
  briefingFirstAxisIds: string[];
  flagFirstSteps: Record<string, string>;
  briefingCta: DiagnosisCta;
}
