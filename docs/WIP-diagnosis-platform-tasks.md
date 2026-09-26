# WIP: 診断プラットフォーム — 作業タスクリスト（ブランチ限定）

> **このファイルは `feature/diagnosis-content` ブランチ限定の引き継ぎ用メモ。** 別 PC で作業を再開するときに最初に読む。dev へマージする前に削除するか、残すべき内容を GOV-01 / GOV-02 へ転記する。正式な仕様は各 doc-id の文書が正本で、本ファイルは進行状況だけを持つ。

最終更新: 2026-09-26（Claude Code セッション 3 回目）

## 0. 現在地

- 2026-09-24 に「事業・商品設計 + 影響調査」の 7 文書を作成しコミット済み（1 回目）。
- 同日、藤本さんの判断で **「4 モード・全フェーズの詳細設計を一式揃えてから、正仕様承認 → フェーズ順に実装」** に方針変更（GOV-01 D-012）。詳細設計を既存文書へ追記済み（2 回目。§2）。
- **2026-09-26（3 回目）: 藤本さんの判断で、承認前に Phase 2a を暫定文言で実装した**（§4・§5）。文言は PRD-07 の案をそのまま `data.ts` に入れており、赤入れ後に差し替える前提。**未コミット** — `git status` で差分を確認してからコミットする。
- スキーマ・D1 は未変更。`packages/schema/migrations/` も未生成。
- 決定済み（GOV-01）: D-009 満点比、D-010 参考価格撤去、D-011 外部予約ツール（ツール名未定）、D-012 全体設計先行、D-013 Member を申込者ログインに流用、D-014 名称「中小企業向け IT・DX現状診断」、D-015 価格 モニター 30,000 → 50,000 円。
- レビュー用の対外文言一覧: `docs/WIP-review-copy.md`（ブランチ限定。赤入れ後に PRD-07 / PRD-09 と両 `data.ts` へ反映して削除）。

## 1. 再開手順（別 PC）

```bash
git switch feature/diagnosis-content && git pull
cat docs/WIP-diagnosis-platform-tasks.md        # このファイル
pnpm --filter public exec vitest run --project node   # 判定の単体テスト（D1 不要）
```

読む順: BIZ-04 → PRD-06 → PRD-07 → PRD-08 → PRD-09 → PRD-05 → PRD-01 §2-1/§3-2/§4 → PRD-03 FG-10〜14 → PRD-04 §3 → DEV-07 §3-7/§5/§6-1 → DEV-09 §2-3〜2-11 → DEV-04 §5-6〜5-9 → DEV-02 §1-3/§2-3/§3-2b → DEV-11 §12（WBS）→ GOV-02 §2-6。

- 依頼文の原文はこのリポジトリに無い（2026-09-24 のチャット）。要件は BIZ-04 に `Confirmed` として転記済みなので BIZ-04 を正本として扱う。
- `pnpm test` は `packages/schema/migrations/` 未生成のため workerd 側（`tests/unit/`）が setup で落ちる（設計どおり）。node 側（`tests/scoring/`）は上のコマンドで単独実行できる。
- `pnpm test:e2e` も globalSetup が migrations を要求するため今は走らない。診断 E2E だけ回すなら、globalSetup を持たない一時 config（`testDir` と `baseURL` だけ）を `/tmp` に置いて `npx playwright test -c <それ>` する（2026-09-26 に 26 件 pass を確認）。

## 2. 詳細設計タスク（2 回目セッション）

| # | 作業 | 文書 | 状態 |
| --- | --- | --- | --- |
| 1 | 物理 DB 設計（§3-7 一覧、§5-3〜5-18、§6-1、ERD、§10 保持期限） | DEV-07 | ✅ |
| 2 | 状態遷移（Token / Lead / Briefing / AiJob / AiAnalysis / Campaign / PaidDiagnosis / Deal / CommissionPayment / Partner） | DEV-09 | ✅ |
| 3 | API 一覧（public / 申込者 / partner / admin）+ 例 | DEV-04 | ✅ |
| 4 | 有料版 48 問・ロジック・矛盾ルール | PRD-09（新規） | ✅ |
| 5 | 機能要件 FG-10〜14、F-08-07〜16、US-05〜09、フェーズ別 MVP | PRD-03 | ✅ |
| 6 | 画面一覧 SCR-21〜31 / ADM-11〜14、ASCII モック 5 枚 | PRD-04 | ✅ |
| 7 | ドメインモデル図・エンティティ・ユビキタス言語・境界・状態一覧 | PRD-01 | ✅ |
| 8 | 論理データモデル・リレーション・ライフサイクル・認証範囲 | PRD-02 | ✅ |
| 9 | パートナー認証系統、ロール読み替え、権限マトリクス、スコープ検証、個人情報一覧、レビュー項目 | DEV-02 | ✅ |
| 10 | 統合（AI 採用状況・PDF・予約ツール）、環境変数 | DEV-10 / DEV-08 | ✅ |
| 11 | 契約・規約（有料診断規約・パートナー契約・返金・データ取扱い）、日次バッチ | OPS-01 / OPS-02 | ✅ |
| 12 | テスト方針の追記 | DEV-03 | ✅ |
| 13 | 実装作業分解（フェーズ別 WBS） | DEV-11 §12 | ✅ |
| 14 | 決定の記録（D-009〜D-012）、TBD の解決 | GOV-01 / GOV-02 | ✅ |
| 15 | README 文書一覧に PRD-09 を追加 | 00_README | ✅ |

## 3. 承認前に人間がやること

- [ ] `docs/WIP-review-copy.md` で PRD-07 / PRD-09 の対外文言を赤入れ → PRD-07 / PRD-09 と `apps/public/src/diagnoses/{business,ai-dx}/data.ts` に反映（00_README §8-3「法務表現・対外通知」）
- [ ] **TBD-21 配点の最終値を §6 のシミュレーション結果を見て決める**（配点を変えたら `tests/scoring/business.test.ts` の最大点の期待値も変える）
- [ ] TBD-22 I タイプの改称: 実装は推奨案の「顧客リピート不足型」を採用済み。現行維持なら `data.ts` の `name` を戻す
- [ ] GOV-02 §2-6 の P0（TBD-13 / 16 / 17 / 18 / 28）の担当と期限を決める
- [ ] TBD-25 のツール名を確定 → `PUBLIC_BRIEFING_BOOKING_URL` をビルド変数に設定（未設定の間は `/contact/` にフォールバック）
- [ ] 00_INTAKE §4 / §5 / §10 へ依頼内容を転記（AI は INTAKE を編集しない）
- [ ] GOV-01 §4-3 に正仕様承認（APR-001）を記録
- [ ] GA4 側でコンバージョン（`diagnosis_complete`、`diagnosis_cta_click`）を設定（2a-11 の手作業分）

## 4. 実装フェーズ（着手順は DEV-11 §12 が正本）

| Phase | 内容 | 前提（GOV-02） | 状態 |
| --- | --- | --- | --- |
| 2a | 無料診断 v2 + 結果別 CTA + 相互誘導 + GA4 + テスト + ナビ（DEV-11 §12-1） | TBD-21 の配点最終値、結果文章の最終稿 | 🟡 実装済み・暫定文言（§5） |
| 2b | 営業版トークン・回答保存・リード・15 分解説記録・ADM-12・日次バッチ（§12-2） | TBD-01/03（初回 db:generate）、TBD-04/13/18/20/31/33 | ⬜ |
| 3 | 有料診断 MVP（§12-3） | TBD-14/15/27/28/29/30/32 | ⬜ |
| 4 | パートナー版（§12-4） | TBD-16/17/34 | ⬜ |

## 5. Phase 2a 実装メモ（2026-09-26）

DEV-11 §12-1 の 2a-2〜2a-10 を実施。2a-1（文章の最終稿）と 2a-11 の GA4 設定は §3 の人間作業。

| # | 状態 | 備考 |
| --- | --- | --- |
| 2a-2 | ✅ | `lib/diagnosis/routes.ts`: `v` / `from` / `a` / `s` / `t` / `p` 定数、CTA 8 種 → href 解決（`resolveCtas`）、`briefingBookingHref`（`PUBLIC_BRIEFING_BOOKING_URL`、`{result}` 置換、未設定は `/contact/`）。`paid_diagnosis` は `PAID_DIAGNOSIS_HREF = null` のため Phase 3 まで非表示 |
| 2a-3 | ✅ | `lib/diagnosis/analytics.ts`（`trackDiagnosisEvent`。`mode: "public"` 固定）。`lib/diagnosis/intro.ts` も追加（イントロで `diagnosis_view` と `?from=` の引き継ぎ） |
| 2a-4 | ✅ | business: q0 加点廃止（`concerns`）、q2 Web、q4 統合、`notApplicable`、満点比、強み ≤3、判定理由 ≤3。最大点は `maxPointsByType` でデータから算出 |
| 2a-5 | ✅ | `?v=2&second&concern&s&a&na&from`。`v` 無しは v1 描画（点数表示・判定理由なし）。radiogroup + 見出しフォーカス + 矢印キー |
| 2a-6 | ✅ | ai-dx: q5 に「把握していない」（flag `unknown-ai-usage`）、判定理由・バランス注記・強み ≤2（4 点以上）・放置リスク・軸別最初の一歩。最弱軸が人・組織 / 仕組みなら主 CTA を 15 分解説に差し替え（`result.js`） |
| 2a-7 | ✅ | `Header.astro` に「無料診断」（テキストリンクでは 1024px で折り返したため、枠線ピルの副 CTA にし、デスクトップナビの出現を `md` → `lg` に変更）、ポータルに「診断のあとは」、`/contact/` 事前入力は診断名・版・結果・上位課題度（or 軸別点）・結果 URL の定型。`contact.astro` 自体は無変更で足りた |
| 2a-8 | ✅ | `diagnosis.css` に `prefers-reduced-motion` |
| 2a-9 | ✅ | `vitest.config.ts` を projects 化（`workerd` / `node`）。`tests/scoring/{business,ai-dx,routes}.test.ts` 42 件 |
| 2a-10 | ✅ | `tests/e2e/diagnosis.spec.ts` 26 件（15 結果 URL の prerender、v1/v2 URL、該当なし、設問フロー、`?from=`、フォーカス、`/contact/` 引き継ぎ、ナビ）。CLAUDE.md の「`tests/e2e/` guards this」は実態と一致した |
| 2a-11 | 🟡 | CLAUDE.md Diagnoses / Testing 節、DEV-06 §1 のツリー、PRD-07 §1-2 の最大点誤記（A 4 → 5）を修正。PRD-06 / PRD-07 の status は承認まで `draft-ai` のまま |

暫定で決めたこと（承認時に見直す）:

- I タイプ名は TBD-22 推奨案「顧客リピート不足型」を採用（URL `i` は不変）。
- 結果見出しは「〜の傾向があります」（Z のみ「です」）、ai-dx は「〜の段階です」。
- 「複数課題」ルール（主・副とも 60% 以上）は `complexThreshold` で実装済みだが、有料診断の href が無いため Phase 3 まで何も出ない。
- 事例 CTA は `/cases/` へのリンク（個別事例のアンカーが無い）。
- v1 結果 URL でも本文は v2 の文章（ぼかし・参考価格は D-010 どおり撤去）。v1 互換は `s` の解釈（点数）と副次リンクのみ。

## 6. business v2 配点シミュレーション（TBD-21 の判断材料）

`tests/scoring/business.test.ts` が出力。q1〜q9 の全 409,600 通りを一様に数えたもので、実際の回答者分布ではない。`ratio` = 実装した満点比、`raw` = 参考の v1 方式（生点最大）。

| タイプ | ratio | raw（参考） |
| --- | ---: | ---: |
| A 発信力不足型 | 4.51% | 24.52% |
| B 販売チャネル不足型 | 29.13% | 19.95% |
| C 社内情報分散型 | 1.93% | 18.89% |
| D 問い合わせ対応疲弊型 | 12.13% | 8.34% |
| E アナログ業務型 | 0.74% | 9.65% |
| F 数字が見えない型 | 8.59% | 5.74% |
| G 定型作業過多型 | 6.79% | 3.00% |
| H 集客導線不足型 | 2.06% | 7.23% |
| I 顧客リピート不足型 | 34.08% | 2.64% |
| Z 健全経営型 | 0.03% | 0.03% |
| 同点（固定順で解決） | 40.78% | — |

読み方: 満点比は最大点が小さいタイプ（I = 2、B = 3）が 1 問で 100% に達するため強く出る。C・E は最大 5 なので満点比では出にくい。**配点をいじるなら I・B の最大点を上げる（情報源を増やす）か、C・E の +1 を整理する方向**が候補。q0 の関心が同点に効くことは別テストで全件確認済み。

## 7. メモ

- 予約ツール名（TBD-25）が決まったら DEV-01 §2 と DEV-10 §8-6 に追記し、`PUBLIC_BRIEFING_BOOKING_URL` をビルド変数に設定する（`.dev.vars.example` に説明あり）。
- DEV-09 の Member 節は §2-13。他文書の「DEV-09 §2-6」参照は AiJob を指しており正しい（2026-09-26 確認）。
- Mermaid の ERD（DEV-07 §2）に 19 エンティティを追加した。GitHub 上で描画が崩れないか一度確認する（未確認）。
- `pnpm dev` はこのシェルでは `APP_PORT_DEV_PUBLIC` が渡らず 5173 で上がることがある。`astro dev status` の表示より `ss -ltnp` を信じる。
