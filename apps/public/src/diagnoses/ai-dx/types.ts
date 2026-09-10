export interface AxisOption {
  label: string;
  points: number;
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
  /** Second half of "pitfalls at this level". Masked with a CSS blur to drive inquiries. null means fully public. */
  pitfallLocked: string | null;
  nextStep: string;
  /** Second half of "path to the next level". Masked with a CSS blur to drive inquiries. null means fully public. */
  nextStepLocked: string | null;
}

export interface WeakestAxisStep {
  axisId: string;
  body: string;
  relatedService: string;
}

export interface AiDxDefinition {
  slug: string;
  title: string;
  metaDescription: string;
  catchCopy: string;
  subCopy: string;
  startButtonLabel: string;
  ctaHref: string;
  ctaLabel: string;
  crossLinkLabel: string;
  questions: AxisQuestion[];
  axes: Axis[];
  thresholds: LevelThreshold[];
  levels: LevelContent[];
  weakestAxisSteps: WeakestAxisStep[];
}
