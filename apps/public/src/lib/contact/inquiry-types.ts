// Single source of truth for the contact form's お問い合わせ項目 options.
// Shared with src/lib/diagnosis/routes.ts, which pre-selects
// DIAGNOSIS_INQUIRY_TYPE when linking from a diagnosis result page —
// keeping the literal here prevents the link and the <select> drifting apart.

export const DIAGNOSIS_INQUIRY_TYPE = "診断結果について";

export const INQUIRY_TYPES = ["システム開発について", "AI・DX支援について", "自社サービスについて", "セミナーについて", "導入事例について", DIAGNOSIS_INQUIRY_TYPE, "その他"];
