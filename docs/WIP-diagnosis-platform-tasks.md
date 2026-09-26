# WIP: 診断プラットフォーム — 作業タスクリスト（ブランチ限定）

> **このファイルは `feature/diagnosis-content` ブランチ限定の引き継ぎ用メモ。** 別 PC で作業を再開するときに最初に読む。dev へマージする前に削除するか、残すべき内容を GOV-01 / GOV-02 へ転記する。正式な仕様は各 doc-id の文書が正本で、本ファイルは進行状況だけを持つ。

最終更新: 2026-09-26（Claude Code セッション 3 回目・後半）

## 0. 現在地

- 2026-09-24: 設計文書一式（1〜2 回目）。GOV-01 D-009〜D-015。
- 2026-09-26 前半: Phase 2a（無料診断 v2）を暫定文言で実装しコミット（`06c5f7e`）。
- **2026-09-26 後半: Phase 2b（営業版）を実装した。未コミット。** 初回 `pnpm db:generate` を実行し、`packages/schema/migrations/0000_grey_vector.sql` を生成（TBD-03 解決）。§5 に内容、§7 に残作業。
- 決定済み（GOV-01）: D-009 満点比、D-010 参考価格撤去、D-011 外部予約ツール（ツール名未定）、D-012 全体設計先行、D-013 Member を申込者ログインに流用、D-014 名称「中小企業向け IT・DX現状診断」、D-015 価格 モニター 30,000 → 50,000 円。
- レビュー用の対外文言一覧: `docs/WIP-review-copy.md`（未着手。赤入れ後に PRD-07 / PRD-09 と両 `data.ts` へ反映して削除）。

## 1. 再開手順（別 PC）

```bash
git switch feature/diagnosis-content && git pull
pnpm install
pnpm db:migrate                                   # 共有ローカル D1 にマイグレーション適用
pnpm --filter admin seed -- --table=admin_users --email=<you> --password=<pw> --name=<name> --role=admin
pnpm check                                        # format / lint / typecheck / 単体（public 22 + node 42、admin 56、schema 12）
pnpm test:e2e                                     # public 41 件・admin。dev サーバーが 5176/5177 で上がっているときは APP_PORT_DEV_PUBLIC=5176 / APP_PORT_DEV_ADMIN=5177 を付けて各アプリで npx playwright test
```

読む順（変更なし）: BIZ-04 → PRD-06 → PRD-07 → PRD-08 → PRD-09 → PRD-05 → PRD-01 → PRD-03 FG-10〜14 → PRD-04 §3 → DEV-07 §3-7/§5 → DEV-09 §2-3〜2-11 → DEV-04 §5-6〜5-9 → DEV-02 → DEV-11 §12 → GOV-02 §2-6。

- 依頼文の原文はこのリポジトリに無い（2026-09-24 のチャット）。要件は BIZ-04 に `Confirmed` として転記済み。
- ローカルの `.dev.vars` は各自で `.dev.vars.example` から作る。無いと `/api/contact/` と `/api/v1/leads/` の Turnstile 検証が 403 になる（リード送信の動作確認はここで止まる。単体テストと API レベルの E2E は通る）。

## 2. 詳細設計タスク（2 回目セッション）— すべて ✅

（変更なし。§2 の 15 項目は完了。）

## 3. 承認前に人間がやること

- [ ] `docs/WIP-review-copy.md` の赤入れ → PRD-07 / PRD-09 と `apps/public/src/diagnoses/{business,ai-dx}/data.ts` へ反映
- [ ] TBD-21 配点の最終値（§6 のシミュレーション結果）
- [ ] TBD-22 I タイプ名（実装は「顧客リピート不足型」）
- [ ] GOV-02 §2-6 の P0（TBD-13 / 16 / 17 / 18 / 28）の担当と期限
- [ ] TBD-25 ツール名 → `PUBLIC_BRIEFING_BOOKING_URL`
- [ ] 00_INTAKE §4 / §5 / §10 への転記（AI は INTAKE を編集しない）
- [ ] GOV-01 §4-3 に正仕様承認（APR-001）
- [ ] GA4 コンバージョン設定（`diagnosis_complete`、`diagnosis_cta_click`）
- [ ] **Phase 2b 運用開始前（法務・運用）**: TBD-13 営業メールの法令確認、TBD-18 プライバシーポリシー改訂（「診断回答の匿名保存と連絡先入力時の紐付け」を `privacy-policy.astro` に追記 — 入口ページと連絡先フォームの同意文はこの文面を前提に書いてある）、TBD-31 保存 API の WAF / Rate Limiting、TBD-33 保持期間の確定（実装の暫定値は `apps/admin/src/lib/server/jobs/daily.ts` の `RETENTION`）、TBD-04 Cloudflare リソースの実値化（admin 側 `replace-with-*`）

## 4. 実装フェーズ（着手順は DEV-11 §12 が正本）

| Phase | 内容 | 前提（GOV-02） | 状態 |
| --- | --- | --- | --- |
| 2a | 無料診断 v2 + 結果別 CTA + 相互誘導 + GA4 + テスト + ナビ | TBD-21、文言最終稿 | 🟡 実装済み・暫定文言（コミット `06c5f7e`） |
| 2b | 営業版トークン・回答保存・リード・15 分解説記録・ADM-12・日次バッチ | TBD-13/18/31/33（運用開始前） | 🟡 実装済み・未コミット（§5） |
| 3 | 有料診断 MVP | TBD-14/15/27/28/29/30/32 | ⬜ |
| 4 | パートナー版 | TBD-16/17/34 | ⬜ |

## 5. Phase 2b 実装メモ（2026-09-26）

DEV-11 §12-2 の 2b-1〜2b-11 を実施。2b-12（法務）は §3。

| # | 状態 | 備考 |
| --- | --- | --- |
| 2b-1 | ✅ | `packages/schema/src/schema.ts` に 6 テーブル（`diagnosis_definitions` / `campaigns` / `diagnosis_tokens` / `leads` / `diagnosis_responses` / `briefing_requests`）。**`partner_customer_id` は Phase 4 で追加**（参照先が無いため。DEV-07 §5-5/5-6 に注記）。初回 `db:generate` → `0000_grey_vector.sql`。規約テスト 12 件 pass |
| 2b-2 | ⬜ | Cloudflare 側（TBD-04 / TBD-31）は人間作業。`wrangler.jsonc` には `triggers.crons` と `main: ./src/worker.ts` を追加済み |
| 2b-3 | ✅ | 定義スナップショットは **回答保存時の遅延生成**（`lib/server/services/diagnosis-definitions.ts`）。ハッシュ対象は判定に効く構造のみ（ID・配点・フラグ・閾値）。文言だけの修正は版据え置きで通り、配点変更で版を上げ忘れると `DEFINITION_HASH_MISMATCH`（500）で保存を止める |
| 2b-4 | ✅ | public Service: `diagnosis-tokens.ts`（`resolveActiveToken` / `findUsableToken`）、`diagnosis-responses.ts`（サーバー再採点、`client_mismatch` フラグ、`use_count` と失効を同一 batch）、`leads.ts`（リード・response の `lead_id`・briefing・`activity_log` を同一 batch。サブクエリで lead の id を引く） |
| 2b-5 | ✅ | `GET /api/v1/diagnosis-tokens/{token}/`、`POST /api/v1/diagnosis-responses/`、`POST /api/v1/leads/`（Turnstile + ハニーポット。メールは `waitUntil`） |
| 2b-6 | ✅ | SCR-31 `/d/[token].astro`（SSR、noindex、キャンペーン文言・同意説明）。`questions.js` が `?t=` で保存 API を呼び `r=` を付けて遷移。`result.js` が `initLeadForm()`（`lib/diagnosis/lead-form.ts` + `components/diagnosis/LeadForm.astro`）。相互誘導リンクにも `t` を引き継ぐ。**結果 URL の `a=` は訪問者の URL には残す**（判定理由の描画に必要）。サーバーが返す `resultUrl` には載せない |
| 2b-7 | ✅ | admin Service + API: campaigns（CRUD・activate/close・tokens 発行/一覧/revoke）、diagnosis-responses（一覧・詳細）、leads（一覧・詳細・PATCH・5 遷移）、briefing-requests（一覧・schedule/unschedule/hold/no-show/cancel。`hold` はリードの遷移関数を別トランザクションで呼ぶ）、diagnosis-definitions、admin/dashboard |
| 2b-8 | ✅ | ADM-12: `/campaigns/`・`/campaigns/new/`・`/campaigns/<id>/`（トークン発行と CSV）・`/responses/`・`/responses/<id>/`・`/leads/`・`/leads/<id>/`・`/briefings/`、`/dashboard/` の KPI カード。`layouts/AdminLayout.astro` にナビ。Svelte アイランドは API を呼んで reload（楽観更新なし） |
| 2b-9 | ✅ | `lib/server/mail/client.ts`（Resend 送信を共通化。`contact.ts` も移行）、`mail/leads.ts`（通知 + 受付確認。briefing なら予約 URL を添える） |
| 2b-10 | ✅ | `apps/admin/src/worker.ts` + `lib/server/jobs/daily.ts`（トークン失効・セッション削除・保持期限削除 + `data.purged`）。ビルドで `scheduled` が `dist/server/entry.mjs` に含まれることを確認。`astro dev` では発火しない |
| 2b-11 | ✅ | 単体: public `tests/unit/diagnosis-outbound.test.ts` 14 件、admin `campaigns` / `leads` / `jobs` 計 23 件。E2E: public `diagnosis-outbound.spec.ts` 5 件（global-setup がキャンペーンとトークン 2 本を seed）、admin `login.spec.ts` の 401 リストに 2b の全ルートを追加 |
| 2b-12 | ⬜ | 法務（§3）。`middleware.ts` の noindex（`/d/`、`/api/v1`）は済み |

暫定で決めたこと（承認時に見直す）:

- トークンは outbound 90 日・最大 3 回、宛先 1 件単位（TBD-20 推奨案）。
- 「複数課題」CTA・有料診断リンクは 2a と同じく Phase 3 まで非表示。
- リードの `notes` 初期値に訪問者の「ご質問・ご要望」を入れる（別列を増やさない）。
- 訪問者が同じ回答に 2 回連絡先を入れても、`lead_id` は最初のリードのまま（2 件目のリードは作る）。
- 日次バッチの保持期限（`RETENTION`）: トークン失効後 90 日 / 匿名回答 730 日 / リード 365 日、`converted` は削除しない（TBD-33 の暫定値）。
- 管理画面の表示ラベルは `apps/admin/src/lib/format.ts` に集約。

確認済み（2026-09-26）: `pnpm check` 緑（schema 12 / public 22 + 42 / admin 56）。public E2E 41 件中、`member-auth.spec.ts` の「logging out revokes the session」だけが 2b と無関係に落ちていた（ログアウトボタンのハイドレーション前クリック）→ `logout-button.svelte` に `hydrated` ガードを追加して対処。管理画面はブラウザでキャンペーン作成 → トークン発行 → 公開側 `/d/<token>/` → 設問 → 結果（`r=` 付き）→ 連絡先フォームまで確認。フォーム送信は `.dev.vars` 無しのため Turnstile で 403（設計どおり）。

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

読み方: 満点比は最大点が小さいタイプ（I = 2、B = 3）が 1 問で 100% に達するため強く出る。**配点をいじるなら I・B の最大点を上げる（情報源を増やす）か、C・E の +1 を整理する方向**が候補。配点を変えたら `tests/scoring/business.test.ts` の最大点の期待値も変える。

## 7. メモ

- Phase 3 に入る前に決めること: TBD-14/15/27/28/29/30/32。着手順は DEV-11 §12-3。3-2 のテーブル追加は増分マイグレーションになる。
- 予約ツール名（TBD-25）が決まったら DEV-01 §2 と DEV-10 §8-6 に追記し、`PUBLIC_BRIEFING_BOOKING_URL` をビルド変数に設定する。
- 管理画面のトークン URL は `PUBLIC_SITE_ORIGIN`（admin のビルド変数、既定 `https://naturaling.jp`）で組み立てる。
- Mermaid の ERD（DEV-07 §2）は GitHub 上で描画確認が未実施。
- `pnpm dev` はこのシェルでは `APP_PORT_DEV_*` が渡らず 5173/5174 で上がることがある。`astro dev status` の表示より `ss -ltnp` を信じる。
