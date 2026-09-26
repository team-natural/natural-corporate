import type { AiDxDefinition } from "./types";

const SYSTEM_DEV = "システム開発について";
const AI_DX = "AI・DX支援について";

const BRIEFING = { kind: "briefing_15min", label: "15分のオンライン結果解説を予約する" } as const;
const PAID = { kind: "paid_diagnosis", label: "有料のIT・DX現状診断を見る" } as const;
const CROSS = { kind: "cross_diagnosis", label: "業務課題かんたん診断を受ける" } as const;
const CASES = { kind: "case", label: "関連する導入事例を見る" } as const;
const SEMINAR = { kind: "seminar", label: "セミナーを見る" } as const;
const LINE = { kind: "line", label: "LINEで相談する" } as const;

const aiDx: AiDxDefinition = {
  slug: "ai-dx",
  version: 2,
  title: "AI・DX浸透診断",
  metaDescription: "10の質問に答えるだけで、貴社のAI・DX浸透度（レベル1〜5）と、土台として弱い軸、次に打つべき一手がわかる無料診断です。所要時間1〜2分、登録不要。",
  catchCopy: "あなたの会社のAI活用は、いま何合目？<br />AI・DX浸透診断",
  subCopy: "10の質問に答えるだけ。自社のAI・DXの現在地（レベル1〜5）と、次に打つべき一手がわかります。無料・登録不要。",
  note: "この診断では「いまどの段階か」と一般的な次の一手をお示しします。具体的なツール選定や費用、ロードマップの作成は含みません。",
  startButtonLabel: "診断をはじめる",
  crossLinkLabel: "業務課題かんたん診断を受ける（約2分）",
  crossLinkLead: "現在地は分かりました。どの業務から手を付けるべきかは、業務課題かんたん診断で具体化できます。",
  limitationText: "今回の無料診断では、上記の段階にあることが確認できました。ただし、どの業務から着手すべきか、どの程度の予算が必要かは、現在の業務量・利用システム・社内体制によって異なります。",
  axes: [
    { id: "digital-foundation", name: "デジタル基盤", strength: "日常業務がシステムで回り、AI活用の土台があります。", firstStep: "毎日発生する業務を1つ選び、紙・電話・FAXで扱っている件数を1週間数える" },
    { id: "data", name: "データ", strength: "情報が一か所にまとまり、数字が見える状態です。", firstStep: "「先月の売上」を出すのに何分かかるか、誰に聞く必要があるかを確認する" },
    { id: "ai-usage", name: "AI活用", strength: "会社としてAIを業務に組み込み、成果を測っています。", firstStep: "社内でAIツールを使っている人と用途を聞き取り、1枚にまとめる" },
    { id: "people-org", name: "人・組織", strength: "学ぶ仕組みと経営の後押しがあり、活用が個人に依存していません。", firstStep: "経営会議で「AI・DXで解決したい業務課題」を1つ決めて言葉にする" },
    { id: "rules", name: "仕組み", strength: "ルールと見直しの習慣があり、安心して活用を広げられます。", firstStep: "AIに入力してよい情報・いけない情報を5行で決めて共有する" },
  ],
  questions: [
    {
      id: "q1",
      axisId: "digital-foundation",
      prompt: "受発注・顧客管理・勤怠などの日常業務は、どのように行っていますか？",
      options: [
        { label: "ほとんどが紙・電話・FAXでの手作業", points: 0 },
        { label: "Excelなどで一部をデジタル管理している", points: 1 },
        { label: "主要な業務は専用のツールやシステムで行っている", points: 2 },
        { label: "ほぼすべての業務がシステム上で完結している", points: 3 },
      ],
    },
    {
      id: "q2",
      axisId: "digital-foundation",
      prompt: "社内の連絡・コミュニケーションの中心は？",
      options: [
        { label: "口頭・電話・紙の回覧が中心", points: 0 },
        { label: "メールが中心", points: 1 },
        { label: "ビジネスチャットも使っている", points: 2 },
        { label: "チャットが中心で、用途ごとの使い分けルールもある", points: 3 },
      ],
    },
    {
      id: "q3",
      axisId: "data",
      prompt: "社内の情報・データはどこに保存されていますか？",
      options: [
        { label: "紙のファイルや個人のPCの中", points: 0 },
        { label: "共有フォルダはあるが、置き場所がバラバラで探しにくい", points: 1 },
        { label: "クラウドで共有され、だいたいの情報は見つかる", points: 2 },
        { label: "一元化されていて、検索すればすぐ見つかる", points: 3 },
      ],
    },
    {
      id: "q4",
      axisId: "data",
      prompt: "売上・在庫・進捗などの数字は？",
      options: [
        { label: "感覚で把握している", points: 0 },
        { label: "必要になったらExcelなどで集計する", points: 1 },
        { label: "定期的なレポートで確認している", points: 2 },
        { label: "いつでも画面でほぼリアルタイムに見られる", points: 3 },
      ],
    },
    {
      id: "q5",
      axisId: "ai-usage",
      prompt: "社内でChatGPTなどのAIツールは、どのくらい使われていますか？（分かる範囲で）",
      options: [
        { label: "ほとんど誰も使っていない、または把握していない", points: 0, flag: "unknown-ai-usage" },
        { label: "一部の人が個人的に使っている", points: 1 },
        { label: "半数くらいの従業員が日常的に使っている", points: 2 },
        { label: "ほぼ全員が日常業務で当たり前に使っている", points: 3 },
      ],
    },
    {
      id: "q6",
      axisId: "ai-usage",
      prompt: "会社として、業務の手順にAIを組み込んでいますか？",
      options: [
        { label: "組み込んでいない", points: 0 },
        { label: "検討・お試しを始めたところ", points: 1 },
        { label: "1〜2の業務で実際に使っている", points: 2 },
        { label: "複数の業務で使い、効果も測っている", points: 3 },
      ],
    },
    {
      id: "q7",
      axisId: "people-org",
      prompt: "AI・デジタルに詳しい人材や、学ぶ仕組みはありますか？",
      options: [
        { label: "詳しい人がいない", points: 0 },
        { label: "詳しい人が1人いて、その人に頼っている", points: 1 },
        { label: "複数名いて、社内で情報共有の場もある", points: 2 },
        { label: "育成・学習の仕組みが継続的に回っている", points: 3 },
      ],
    },
    {
      id: "q8",
      axisId: "people-org",
      prompt: "経営層のAI・DXへの姿勢は？",
      options: [
        { label: "あまり関心がない", points: 0 },
        { label: "関心はあるが、具体的な取り組みはない", points: 1 },
        { label: "予算や担当を決めて推進している", points: 2 },
        { label: "経営戦略の柱として位置づけている", points: 3 },
      ],
    },
    {
      id: "q9",
      axisId: "rules",
      prompt: "AIの利用ルールやセキュリティの取り決めは？",
      options: [
        { label: "特に決めていない", points: 0 },
        { label: "口頭で注意している程度", points: 1 },
        { label: "簡単なルールを文書で決めている", points: 2 },
        { label: "ガイドラインがあり、見直しの体制もある", points: 3 },
      ],
    },
    {
      id: "q10",
      axisId: "rules",
      prompt: "業務のやり方の見直し・改善は？",
      options: [
        { label: "昔からのやり方を続けている", points: 0 },
        { label: "課題は感じているが、手をつけられていない", points: 1 },
        { label: "気づいたときに単発で改善している", points: 2 },
        { label: "定期的に見直す仕組みが回っている", points: 3 },
      ],
    },
  ],
  thresholds: [
    { level: 1, min: 0, max: 6 },
    { level: 2, min: 7, max: 12 },
    { level: 3, min: 13, max: 18 },
    { level: 4, min: 19, max: 24 },
    { level: 5, min: 25, max: 30 },
  ],
  strengthThreshold: 4,
  maxStrengths: 2,
  balanceNote: { minLevel: 3, maxAxisScore: 1 },
  briefingFirstAxisIds: ["people-org", "rules"],
  flagFirstSteps: {
    "unknown-ai-usage": "社内のAI利用状況を把握することが最初の一歩です。誰が・どの業務で・どのツールを使っているかを聞き取ってみてください。",
  },
  briefingCta: BRIEFING,
  levels: [
    {
      id: "level-1",
      level: 1,
      name: "アナログ期",
      icon: "description",
      current: "業務の中心が紙・電話・FAXによる手作業にある状態です。受発注や予約、顧客対応の多くが電話一本・手書きメモで動いており、情報が紙とスタッフの記憶の中に留まっています。裏を返せば、これから手を打つことによる効果が最も大きく出る段階でもあり、小さな一歩でも数字に表れやすいのが今のフェーズです。",
      pitfall: "「AIを導入すれば一気に変わる」と期待してしまうことです。AIはデジタル化されたデータと業務フローの上で初めて機能するため、紙と手作業が残ったままAIツールだけを導入しても、入力や確認の手間が増えるだけで定着しません。流行りのツールに飛びつく前に、自社の土台がどこまで整っているかを見極める必要があります。",
      risk: "手作業と記憶に頼る業務は、担当者の退職や繁忙期にそのまま止まります。人手不足が進むほど、同じ売上を保つ負担が増えていきます。",
      nextStep: "AIの前に、毎日発生する業務のデジタル化から始めることです。効果がすぐ数字に表れる業務（受発注・予約・顧客管理など）を1つ選んで着手し、成功体験を作ってから次の業務へ広げていくのが定石です。ここで貯まったデータが、次のレベルでのAI活用の土台になります。",
      primaryCta: { kind: "cross_diagnosis", label: "業務課題かんたん診断で、どの業務から手を付けるか確かめる" },
      secondaryCtas: [BRIEFING, SEMINAR, LINE],
    },
    {
      id: "level-2",
      level: 2,
      name: "デジタル移行期",
      icon: "sync_alt",
      current: "ツールの導入は始まっていますが、部署やツールごとにデータが散在し、同じ情報を何度も入力し直す・必要な情報を探す時間が日常的に発生している状態です。デジタル化はできても「つながっていない」ため、現場の負担は思ったほど減っていません。",
      pitfall: "課題を感じるたびに新しいツールを追加してしまうことです。個々のツールは便利でも、連携させないまま増やすとデータの分断がさらに深まり、「どこに何があるか分からない」状態が悪化します。ツールの数と業務の楽さは、必ずしも比例しません。",
      risk: "ツールが増えても連携しないままだと、探す・入力し直す時間が減らず、データもAIに読ませられる形で貯まりません。投資しても効果が見えにくい状態が続きます。",
      nextStep: "新しいツールを増やす前に、情報の置き場所を一元化することです。散らばったデータを1つの場所に集約し、検索・共有できる状態を作ります。ここが整うと、次の段階でのAI活用に欠かせない「AIに読ませられるデータ」が自然に貯まり始め、投資の効果も出やすくなります。",
      primaryCta: { kind: "service_contact", label: "業務のデジタル化・情報の一元化について相談する", inquiryType: SYSTEM_DEV },
      secondaryCtas: [BRIEFING, PAID, CASES, CROSS],
    },
    {
      id: "level-3",
      level: 3,
      name: "デジタル定着期",
      icon: "cloud_done",
      current: "業務はデジタルで回っており、AI活用に必要な土台がほぼ整っている状態です。多くの企業がこの段階に到達していますが、実際にAIを使い始めている会社はまだ多くありません。ここから一歩踏み出すかどうかで、今後数年の競争力に差がつき始めます。",
      pitfall: "「うちはデジタル化できているから大丈夫」と、現状維持に留まってしまうことです。土台が整っているのにAIを使わないのは、畑を耕したまま種をまいていない状態に近く、投資した労力の見返りを取りこぼしています。競合が先にAI活用を始めれば、同じ土台からのスタートでも差は開いていきます。",
      risk: "土台が整っているのにAIを使わない期間が長いほど、先に始めた同業との差が開きます。現場の「使ってみたい」が個人利用のまま散らばり、ルール無しの利用が広がるリスクもあります。",
      nextStep: "効果が見えやすい業務から、最初のAI活用を1つ立ち上げることです。よくある問い合わせへの自動応答や、定型書類の自動生成は、投資が小さく効果測定もしやすい定番の入口です。小さく始めて成果を確認し、社内に「AIは使える」という実感を作ることが、次のレベルへの近道になります。",
      primaryCta: { kind: "service_contact", label: "最初のAI活用（FAQチャットボット・書類自動生成）について相談する", inquiryType: AI_DX },
      secondaryCtas: [BRIEFING, PAID, { kind: "case", label: "事例「AIチャットボット導入で問い合わせ初動対応を50%短縮」を見る" }],
    },
    {
      id: "level-4",
      level: 4,
      name: "AI活用期",
      icon: "auto_awesome",
      current: "AIの活用が始まっており、社内でも先行グループに入っている状態です。特定の担当者や部署では成果が出ている一方で、活用が一部の人・業務に偏り、他の部署には広がっていない段階でもあります。「AIに詳しい人がいる会社」から「AIを使う会社」への転換点にいます。",
      pitfall: "属人化とルール不在です。AI活用が特定の人に依存していると、その人の退職や異動で活用ごと止まってしまいます。また、利用ルールが整わないまま現場が独自に広げていくと、情報の取り扱いや出力内容のチェック体制が追いつかず、思わぬトラブルの火種になりかねません。",
      risk: "活用が特定の人に依存したままだと、その人の異動・退職で止まります。ルールが追いつかないまま広がると、情報の取り扱いでトラブルになりかねません。",
      nextStep: "個人の活用を組織の仕組みに変えることです。利用ルールの整備、活用ノウハウの共有の場づくり、効果測定の習慣化を通じて、「あの人だけのAI」を「会社のAI」に変えていきます。ここまで整えられれば、活用の幅も安心して広げられるようになります。",
      primaryCta: { kind: "service_contact", label: "AI活用を組織に広げる支援（ルール整備・内製化サポート）について相談する", inquiryType: AI_DX },
      secondaryCtas: [PAID, SEMINAR, BRIEFING],
    },
    {
      id: "level-5",
      level: 5,
      name: "AI浸透期",
      icon: "rocket_launch",
      current: "AIが組織として業務に組み込まれ、利用ルールと改善サイクルも回っている、業界内でも先端の状態です。特定の個人に依存せず、複数の業務・部署でAIが当たり前に使われており、社内で使い方を教え合える体制まで育っています。",
      pitfall: "強いて挙げるなら、社内の効率化だけで満足してしまうことです。社内業務が十分に最適化されると、そこで手を止めたくなりますが、競合との差別化という観点では、そこはまだ通過点に過ぎません。この段階での足踏みは、次の成長機会を先に競合に取られるリスクにつながります。",
      risk: "社内効率化で満足すると、次の成長機会（AIを活かした商品・顧客体験）を競合に先に取られます。",
      nextStep: "社内効率化の先にある、AIを活かした新しいサービスや顧客体験の設計です。社内で磨いたAI活用ノウハウを、商品・サービス・顧客とのやり取りにも展開することで、守りの投資から攻めの投資に軸を移していけます。",
      primaryCta: { kind: "service_contact", label: "AIを活かした新サービス・顧客体験について相談する", inquiryType: AI_DX },
      secondaryCtas: [BRIEFING, CASES, SEMINAR],
    },
  ],
  weakestAxisSteps: [
    {
      axisId: "digital-foundation",
      body: "日常業務のデジタル化が最初の一歩です。予約・受発注・顧客管理など、毎日発生する業務のシステム化から着手しましょう。",
      relatedService: "業務デジタル化（予約・受付・発注・顧客管理）、Webサイト基盤",
    },
    {
      axisId: "data",
      body: "情報の一元化と可視化が最初の一歩です。散らばった情報の置き場所を1つに集め、見たい数字が見えるようにしましょう。",
      relatedService: "社内ポータル、業務ダッシュボード",
    },
    {
      axisId: "ai-usage",
      body: "小さく始めるAI導入が最初の一歩です。問い合わせ対応の自動化や書類の自動生成など、効果の見えやすい業務から立ち上げましょう。",
      relatedService: "FAQ + AIチャットボット、ドキュメント自動生成",
    },
    {
      axisId: "people-org",
      body: "社内のAIリテラシーづくりが最初の一歩です。ツール導入より先に、経営層を含めた活用イメージの共有と学びの場が効きます。",
      relatedService: "AI・DX支援（社内浸透・リテラシー研修）",
    },
    {
      axisId: "rules",
      body: "利用ルールと改善サイクルの整備が最初の一歩です。安心してAIを使える取り決めがあってはじめて、活用は組織に広がります。",
      relatedService: "AI・DX支援（利用ルール・運用体制の整備）",
    },
  ],
};

export default aiDx;
