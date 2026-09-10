// Presentation-only metadata for the /diagnosis/ portal listing. Deliberately
// decoupled from each diagnosis's own data/scoring/UI (src/diagnoses/<slug>/)
// so the portal never needs to know how a diagnosis works internally.
export interface DiagnosisCatalogEntry {
  slug: string;
  name: string;
  blurb: string;
  minutes: number;
}

export const diagnosesCatalog: DiagnosisCatalogEntry[] = [
  {
    slug: "business",
    name: "業務課題かんたん診断",
    blurb: "自社の業務課題タイプと解決の方向性がわかります。",
    minutes: 2,
  },
  {
    slug: "ai-dx",
    name: "AI・DX浸透診断",
    blurb: "自社のAI・DXの現在地（レベル1〜5）と次の一手がわかります。",
    minutes: 2,
  },
];
