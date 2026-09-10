export interface CaseStudy {
  category: "AI・DX支援" | "システム開発" | "自社サービス";
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

export function caseBadgeClass(category: CaseStudy["category"]): string {
  return category === "自社サービス" ? "bg-natural-peach-dark/15 text-natural-peach-dark" : "bg-natural-teal/10 text-natural-teal-dark";
}

export const caseStudies: CaseStudy[] = [
  {
    category: "AI・DX支援",
    title: "受発注業務の自動化で月40時間の工数削減",
    description: "製造業A社様への生成AI活用支援事例。受発注データの入力・突合作業をAIで自動化し、担当者の負荷を大幅に軽減しました。",
    icon: "fa-robot",
    gradient: "from-natural-teal-dark via-natural-teal via-60% to-natural-teal-light",
  },
  {
    category: "システム開発",
    title: "予約システムの内製開発でコストを50%圧縮",
    description: "サービス業B社様への業務システム開発事例。既存の外部サービス利用から自社開発への切り替えにより、運用コストを半減しました。",
    icon: "fa-laptop-code",
    gradient: "from-[#6b6b6b] via-[#9a9a9a] via-60% to-[#cfcfcf]",
  },
  {
    category: "自社サービス",
    title: "ペット漢方.comの立ち上げから運用まで",
    description: "自社開発力を活かした新規事業立ち上げの実例。企画・開発・運用までを自社チームで一貫して対応しています。",
    icon: "fa-paw",
    gradient: "from-natural-peach-dark via-natural-peach-mid via-60% to-natural-peach",
  },
  {
    category: "AI・DX支援",
    title: "AIチャットボット導入で問い合わせ初動対応を50%短縮",
    description: "小売業C社様へのカスタマーサポート効率化支援事例。よくある質問への一次回答をAIが担うことで、対応時間を短縮しました。",
    icon: "fa-comments",
    gradient: "from-natural-teal to-natural-teal-light",
  },
  {
    category: "システム開発",
    title: "老朽化した基幹システムのクラウド移行",
    description: "製造業D社様への基幹システム刷新事例。オンプレミス環境からクラウドへの移行により、運用負荷とサーバーコストを削減しました。",
    icon: "fa-cloud-arrow-up",
    gradient: "from-natural-teal-dark to-natural-forest",
  },
];
