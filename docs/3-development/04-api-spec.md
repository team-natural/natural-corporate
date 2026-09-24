---
doc-id: DEV-04
title: API 仕様
phase: 3
status: draft-ai
owner: Tech Lead / PdM（兼務前提）
last-updated: 2026-09-24
related-docs:
  - DEV-02: 認証認可
  - DEV-05: バックエンド実装
  - DEV-06: フロントエンド実装
  - DEV-07: DB 物理設計（§5・§6-1 が §5-6〜5-9 のテーブル）
  - DEV-09: 状態遷移（遷移ごとのルート）
  - DEV-10: 統合・外部 API
  - PRD-03: 機能要件
  - PRD-08: ユーザーフロー・権限マトリクス
  - 実装規約: `CLAUDE.md`（DEV-01 §9 参照）
---

# 04-api-spec.md — API 仕様テンプレート

## このセクションの目的

RESTful API の設計規約、認証方式、エラー体系、バージョニング方針、**複数エンドポイントを一覧形式で記述する標準パターン** を定義する。

## 0-H. ハイブリッド編集ガイド（要点）

- 推奨モード: Hybrid（AI 定型化 + Tech Lead 確定）
- 人間確認必須: 認証方式、破壊的変更方針、命名一貫性、セキュリティ影響

---

## 1. API 設計原則

- RESTful 設計を遵守
- 全エンドポイントを `/api/v1/` でバージョニング
- リソース名は複数形（`/inquiries`、`/media`）
- ネスト 1 段まで（例: 軽量 EC 採用時の `/orders/{id}/items`）。2 段以上は別エンドポイント
- HTTP メソッドの意味を尊重（GET / POST / PUT / PATCH / DELETE）
- レスポンスは共通のレスポンス整形関数/型（plain な TypeScript 関数。Laravel API Resource 相当のフレームワーク機能はないため自前実装、DEV-01 参照）経由のみで生成する
- 権限違反は 403、存在しないリソースは 404 で明確に区別（本テンプレは単一運営が前提のためテナント境界違反という区分は存在しない。403 は `admin` / `editor` のロール不足を指す — DEV-02 §2-3）
- **パスは末尾スラッシュ付きで叩く。** `apps/public` は `trailingSlash: "always"`（DEV-06 §1-2）で、
  これはページだけでなく API ルートにも効く。`/api/contact` は 404、`/api/contact/` が正しい。
  新しいエンドポイントを足すときもクライアント側の `fetch` に末尾スラッシュを付ける

**本サイトにおける例外（`/api/contact/`）**: naturaling.jp のお問い合わせ送信だけは `/api/v1/`
配下でもリソース名複数形でもなく、レスポンス封筒も `{data}` ではない（§5-3b）。Astro 5 の静的
サイト + 単体 Worker から移行した際に、既存のフォームスクリプトが叩いていたパスと応答形式を
そのまま維持したもの。外部に公開された URL ではないので、フォームスクリプトと同時に直せば
規約側へ寄せられる。

---

## 2. 認証

| 項目 | 方針 |
| --- | --- |
| 方式 | D1 セッション + httpOnly 署名クッキー（`admin_session`）に決定済み（DEV-01 §2、DEV-02 §1-1）。`jose`/JWT は不採用 |
| クッキー | `admin_session`（httpOnly、Secure、SameSite=Lax）。ブラウザからの呼び出しはクッキーのみを使う。外部 API クライアント向けには同じセッション ID を `Authorization` ヘッダで受け渡すことも可（DEV-02 §1-1、DEV-07 §3-1）。いずれの場合も JWT は発行しない |
| セッション発行 | `POST /api/v1/auth/login`（`admin_sessions` テーブルに行を作成し `admin_session` クッキーを発行。DEV-07 §4-5） |
| セッション失効 | `POST /api/v1/auth/logout`（`admin_sessions` の該当行を削除しクッキーを失効） |
| 認証必須範囲 | `/api/v1/*` 全エンドポイント。認証不要の除外は次の通り：AdminUser 系 4 本（`/auth/login`、`/auth/password/forgot`、`/auth/password/reset`、`/admin-users/invite-accept`）、ヘルスチェック 3 本（`/health`・`/health/db`・`/health/kv` — DEV-08 §9。`/health/queue` は Queues 不採用のため無し — DEV-01 §1）、および Member 機能（FG-07）採用時のみ Member 系 4 本（`/members/register`、`/members/auth/login`、`/members/password/forgot`、`/members/password/reset` — §5-5）。標準構成では 7 本、Member 採用時は 11 本 |
| 検証の実施箇所 | 各 API ルートハンドラ（`apps/admin/src/pages/api/**/*.ts`）の冒頭で `admin_session` クッキーを検証する（`Confirmed`。`apps/admin/src/middleware.ts` はセキュリティヘッダー付与専用で認証は行わない — DEV-05 §2 が正本）。レート制限は役割分担：IP ベースの汎用制限は Cloudflare 側（WAF / Rate Limiting Rules）で実施しアプリコードには実装しない。認証エンドポイントの失敗回数ロックアウトのみアプリ側（KV カウンタ）で実装する（DEV-02 §7 が正本） |
| ロール判定 | ログイン時に `admin_users.role`（DEV-07 §4-1）をセッションへ埋め込み、Service 層の入口で `requireRole(session, "admin"｜"editor")`（DEV-02 §3-2）により検証する。本テンプレは単一運営が前提のため、テナントスコープや組織切替という概念は存在しない（DEV-01 §4「認可チェックの徹底」） |
| Member 認証（`apps/public`） | `member_session` クッキー（DEV-02 §1-2）。有料診断の申込者が `/api/v1/paid-diagnoses/{id}/…` と `/mypage/…` で使う。**本人所有の案件のみ**（`paid_diagnoses.member_id` が一致）を Service 層で検証する（§5-7） |
| パートナー認証（`apps/public`） | `partner_session` クッキー（DEV-02 §1-3）。`/api/v1/partner/**` 全体で必須。**すべての Service で `partner_id` を条件に含める**（`requirePartnerScope` — DEV-02 §3-4）。他パートナーの資源は 403 ではなく **404** で答える（存在を明かさない） |
| トークン認証（`apps/public`） | 営業版・パートナー版の回答保存は `diagnosis_tokens.token` で識別する（ログイン無し）。トークンが無効・期限切れ・失効なら 404。個人情報を受け取るのは `POST /api/v1/leads/` だけで、そこは Turnstile + ハニーポットで守る（§5-6） |

---

## 3. レスポンス形式

### 3-1. 成功（単一リソース）

```json
{
  "data": {
    "id": "01HXXXX...",
    "name": "サンプル",
    ...
  }
}
```

### 3-2. 成功（コレクション）

ページ番号方式（件数が少なく安定しているリスト。例: `admin_users`）とカーソル方式（§8 が指定する大規模リスト。例: `inquiries` / `media` / `activity_log`）で envelope の形が異なる — どちらを使うかは §8 のリスト側で決まり、両方を同時に持つエンドポイントは無い。

**ページ番号方式**

```json
{
  "data": [{ "id": "01HXXXX..." }, { "id": "01HYYYY..." }],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 100,
    "last_page": 5
  },
  "links": {
    "first": "...",
    "last": "...",
    "prev": null,
    "next": "..."
  }
}
```

**カーソル方式**（`total`/`last_page` は持たない — カーソル走査では総件数を数えない）

```json
{
  "data": [{ "id": "01HXXXX..." }, { "id": "01HYYYY..." }],
  "meta": {
    "per_page": 20,
    "next_cursor": "eyJpZCI6MTAwfQ"
  }
}
```

> 実装済みの参照実装: `packages/server-kit/src/http/response.ts`（`jsonCursorCollection`）、`packages/server-kit/src/http/pagination.ts`（`encodeCursor`/`decodeCursor`）。両アプリが `@app/server-kit/http` から使う。

### 3-3. エラー

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email field is required."]
  },
  "error_code": "VALIDATION_FAILED"
}
```

> バリデーション実装ライブラリは Zod に決定済み（DEV-01 §2）。Drizzle スキーマから `drizzle-zod` で自動導出することを優先する。上記の `errors` 形状は Zod の `flatten()`/`format()` 相当の出力に合わせて調整する。

---

## 4. エラーコード体系（標準）

| HTTP | error_code | 意味 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 一般的なリクエスト不正 |
| 401 | `UNAUTHENTICATED` | 未認証 |
| 403 | `FORBIDDEN` | 認証済みだが権限不足（`admin` / `editor` のロール不足を含む） |
| 404 | `NOT_FOUND` | リソース不存在 |
| 409 | `CONFLICT` | リソースの状態と操作が矛盾 |
| 409 | `INVALID_STATE_TRANSITION` | StateMachine の不正遷移 |
| 422 | `VALIDATION_FAILED` | バリデーションエラー |
| 422 | `USAGE_LIMIT_EXCEEDED` | サイト単位の利用上限到達（AI 機能採用時。PRD-05 §8-1） |
| 429 | `RATE_LIMIT_EXCEEDED` | レート制限超過 |
| 500 | `INTERNAL_ERROR` | サーバー内部エラー |
| 503 | `SERVICE_UNAVAILABLE` | 外部サービス全滅（LLM 等） |

---

## 5. エンドポイント一覧

### 5-1. AdminUser 認証

AdminUser はセルフサーブの新規登録を持たない（招待制、§5-2 の `invite-accept`）。

| メソッド | パス | 用途 | 認証 |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | ログイン | 不要 |
| POST | `/api/v1/auth/logout` | ログアウト | 必須 |
| POST | `/api/v1/auth/password/forgot` | パスワードリセット要求 | 不要 |
| POST | `/api/v1/auth/password/reset` | パスワードリセット実行 | 不要 |
| GET | `/api/v1/auth/me` | 現在のユーザー | 必須 |

> テンプレートの参照実装は login / logout / me の 3 本（+ ログインのロックアウト — DEV-02 §7）。password/forgot・password/reset と invite-accept はメール送信（Resend 導入 — DEV-01 §1）を伴うため、実装パターンのみ確定済み（`password_reset_tokens` テーブル + Web Crypto HMAC トークン — DEV-02 §1-1）で、実装は Resend を設定する案件側で行う。

### 5-2. AdminUser 管理（`admin` 限定 — PRD-01 §1-2、DEV-02 §2-3 F-04-07）

本テンプレは単一運営（マルチテナントではない）が前提のため、Organization の作成・切替・メンバー管理という概念は存在しない。管理画面ログインユーザー（`admin_users`）の追加・ロール変更・無効化のみを扱う。

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/v1/admin-users` | AdminUser 一覧 |
| POST | `/api/v1/admin-users` | AdminUser 追加（招待） |
| GET | `/api/v1/admin-users/{id}` | 詳細 |
| PATCH | `/api/v1/admin-users/{id}` | ロール（`admin`/`editor`）・状態変更 |
| DELETE | `/api/v1/admin-users/{id}` | 無効化 |
| POST | `/api/v1/admin-users/invite-accept` | 招待受諾（`invitations` テーブルは持たない。トークンは Web Crypto の HMAC 署名で招待先メールアドレス・有効期限を検証のみで完結させる方式に決定済み — DEV-01 §2、DEV-02 §1-1） |

### 5-3. プロダクト固有エンドポイント

<!-- TEMPLATE: プロダクト固有のエンドポイントをここに列挙 -->
**2026-09-24 時点で実装済みのものは無い。** naturaling.jp が持つエンドポイントは §5-1（AdminUser 認証）・§5-3b（お問い合わせ）・§5-5 の一部（Member 認証）のみ。お知らせは Content Collections で持つため API を持たない（DEV-06 §1-1、GOV-01 D-008）。無料診断の一般公開版も質問データ・判定ロジックがビルド時とクライアント側で完結し、API を呼ばない。

**診断プラットフォーム（BIZ-04）の設計済み・未実装エンドポイント**を §5-6（公開側）・§5-7（申込者）・§5-8（パートナー）・§5-9（管理側）に定義する。テーブルは DEV-07 §5・§6-1、状態遷移は DEV-09 §2-3〜2-11。すべて末尾スラッシュ付きで叩く（§1）。

新しいリソースを追加する際は、テーブルを DEV-07 に定義したうえで `scaffold` スキルが参照実装（Inquiry）に倣って以下の形で生成する。

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/v1/[resources]` | 一覧 |
| POST | `/api/v1/[resources]` | 作成 |
| GET | `/api/v1/[resources]/{id}` | 詳細 |
| PATCH | `/api/v1/[resources]/{id}` | 更新 |
| DELETE | `/api/v1/[resources]/{id}` | 削除 |
| POST | `/api/v1/[resources]/{id}/[action]` | 状態遷移アクション |

#### AI / 外部連携

AI 機能は**未採用**（GOV-02 §2-4）。採用する場合のパス設計は `/api/v1/ai/[action]`・`/api/v1/ai/usage`・`/api/v1/ai/jobs/{job}` を想定する（PRD-05）。

#### Media アップロード（`apps/admin`。F-04-04 / ADM-04）

実体は R2、メタ情報は `media` テーブル（DEV-07 §4-2）。**Worker が multipart を直接受け、
`env.BUCKET.put()` してから `media` に INSERT する**（`Confirmed`）。presigned URL 方式は
採らない — 署名発行・完了通知・孤立オブジェクトの回収が増え、標準構成には過剰。

| メソッド | パス | 用途 |
| --- | --- | --- |
| POST | `/api/v1/media` | アップロード（`multipart/form-data`。R2 キーは `media/<ULID>/<filename>`） |
| GET | `/api/v1/media` | 一覧（カーソル方式 — §8） |
| GET | `/api/v1/media/{id}` | 詳細（`public_id`） |
| PATCH | `/api/v1/media/{id}` | `alt_text` 等のメタ更新 |
| DELETE | `/api/v1/media/{id}` | R2 オブジェクトと `media` 行を同時に削除 |

- **`scaffold` の `resource` ジェネレータは使えない**（純粋な D1 CRUD しか生成しないため）。
  一覧・詳細・メタ更新は生成物を流用できるが、POST と DELETE は R2 操作を含むので手実装する。
- Workers のリクエストサイズ上限（有料プラン 100MB）がそのまま上限。それを超える要件が出た
  場合は presigned URL 方式へ切り替える（新規 GOV-01 決定として記録する）。
- R2 の削除は D1 の削除と原子的にできない。行を消してからオブジェクトを消し、失敗時は孤立
  オブジェクトを許容する（逆順にすると参照先の無い行が残り、画面が壊れる）。

### 5-3b. 公開側エンドポイント（`apps/public` に置く。認証不要）

公開サイトから D1 への書き込みが必要な標準機能はお問い合わせ送信のみ（SCR-05 / F-06-03）。
**これは `apps/public` 側の API ルートとして実装する**（`Confirmed`）。管理側のエンドポイントへ
クロスオリジンで投げる形は採らない — 管理サブドメインを未認証リクエストに開けることになり、
CORS 設定とオリジン検証を恒久的に抱えるため。したがって `apps/public/src/lib/server/` は
この時点で存在する（DEV-01 §5、DEV-05 §1 参照。AdminUser 認証コードは一切共有しない）。

| メソッド | パス | 用途 | 認証 |
| --- | --- | --- | :---: |
| POST | `/api/contact/` | お問い合わせ送信（**本サイトの現行実装**。D1 には書かない — 下記） | 不要 |

テンプレート標準は `POST /api/v1/inquiries`（`inquiries` へ `status='new'` で INSERT。運営者宛通知と
自動返信メールは `ctx.waitUntil()` で送る — DEV-05 §4-1）だが、**本サイトの公開側からは削除済み**。
`/api/contact/` と役割が重複する未認証の書き込み口を 2 つ開けておく理由がなく、マイグレーション
未生成の状態では叩かれると 500 を返すだけだったため。D1 保存が必要になったら、ルートを復活させる
のではなく `contact.ts` サービス内に INSERT を足す（フォームの送信先を変えずに済む）。管理側の
`apps/admin` の `/api/v1/inquiries`（一覧・詳細・状態遷移）はそのまま残してある。

**本サイトの現行実装**は `apps/public/src/pages/api/contact.ts` →
`apps/public/src/lib/server/services/contact.ts` で、旧サイトの単体 Worker から移植したもの。
テンプレート標準と次の 3 点が異なる。

| 項目 | テンプレート標準 | 本サイト | 理由 |
| --- | --- | --- | --- |
| 永続化 | `inquiries` へ INSERT | **保存しない**（メール送信のみ） | 移行時点では現行動作の再現を優先。`inquiries` テーブルと管理画面は温存してあるので、後からマイグレーション 1 本で追加できる |
| ボット対策 | Cloudflare 側（WAF / Turnstile） | Turnstile の `siteverify` を Service 内で実行 + ハニーポット | 旧実装から継承。ハニーポットが埋まっていた場合は送信せずに 200 を返す |
| 応答封筒 | `{ data: { id } }` / エラーは §3-3 | `{ ok: true }` / `{ ok: false, error: "…" }` | 公開済みのフォームスクリプトがこの 2 フィールドを読む |

- 自動返信の失敗はリクエスト全体を失敗させない。通知メールが届いた時点でお問い合わせは会社に
  到達しているため、そこで 5xx を返すと利用者が再送信してしまう。
- バリデーションは `apps/public/src/lib/contact/schema.ts` の Zod スキーマをクライアントスクリプトと
  API ルートで共有する。片側だけ直して食い違うことを防ぐため。
- **一覧・詳細・更新は公開側に置かない。** 送信記録の閲覧と対応状況変更は管理側の `admin` 限定
  操作（DEV-02 §2-3 で `editor: ✕`）であり、`apps/admin` の `/api/v1/inquiries` が担う。
- マイページ機能（FG-07）・軽量 EC（FG-05）を採用する場合、§5-4・§5-5 のエンドポイントも
  同様に `apps/public` 側へ置く。

### 5-4. 軽量 EC（採用時のみ — PRD-03 FG-05、DEV-07 §3-5・§7）

ゲストチェックアウト（顧客アカウント不要）と Member への任意紐付け（FG-07 採用時、`orders.member_id`）の両方をサポートする（PRD-01 §1-1・§1-3、DEV-07 §7-1）。サブスクリプション課金は本テンプレに存在しない（BIZ-03、00_README §2-2）。

| メソッド | パス | 用途 |
| --- | --- | --- |
| POST | `/api/v1/checkout/session` | 注文の Stripe Checkout Session 作成（ログイン中の Member がいればセッションから `member_id` を紐付け、いなければゲスト注文） |
| POST | `/api/v1/payments/webhook` | Stripe Webhook（署名検証必須） |
| GET | `/api/v1/orders/{id}` | 注文詳細（`public_id` で参照。注文確認ページ用） |

> 通知（FG-06）に一覧・既読 API は無い。Inquiry/Order 受信時の運営者宛メール・利用者宛自動返信は Service 層から同期的にトリガーされるのみで、アプリ内通知の基盤（ベル・バッジ等）は本テンプレ標準では持たない（PRD-03 FG-06）。

### 5-5. Member 認証・マイページ（採用時のみ — PRD-03 FG-07）

Member はセルフサーブの新規登録を持つ（AdminUser とは異なる。DEV-02 §1-2）。認証は `member_session`（httpOnly 署名クッキー）で AdminUser の `admin_session` とは完全に分離する。

| メソッド | パス | 用途 | 認証 |
| --- | --- | --- | --- |
| POST | `/api/v1/members/register` | 新規会員登録 | 不要 |
| POST | `/api/v1/members/auth/login` | ログイン | 不要 |
| POST | `/api/v1/members/auth/logout` | ログアウト | 必須 |
| POST | `/api/v1/members/password/forgot` | パスワードリセット要求 | 不要 |
| POST | `/api/v1/members/password/reset` | パスワードリセット実行 | 不要 |
| GET | `/api/v1/members/me` | マイページ情報（登録情報 + 注文履歴、Order 採用時） | 必須 |
| PATCH | `/api/v1/members/me` | 登録情報の編集 | 必須 |

### 5-6. 診断プラットフォーム — 公開側・未認証（`apps/public`、Phase 2b）

営業版・パートナー版の入口とリードの受け口。ログイン無し。Astro の Origin チェック（DEV-02 §6）が効くため `Content-Type: application/json` を明示する。

| メソッド | パス | 用途 | 認証 / 保護 |
| --- | --- | --- | --- |
| GET | `/api/v1/diagnosis-tokens/{token}/` | トークン検証。`{ diagnosis, kind, introCopy, consentRequired, definitionVersion }` を返す。無効・期限切れ・失効・上限到達は **404**。初回は `first_clicked_at` を記録 | トークン |
| POST | `/api/v1/diagnosis-responses/` | 回答保存。`{ token, diagnosis, definitionVersion, answers, clientResult }`。サーバー側で同じ `scoring.ts` を再計算し、`clientResult` と食い違えばサーバー値を採用して `flags_json` に `client_mismatch` を記録。`use_count` を +1（上限到達で Token を `expired` に。同一 batch） | トークン。**パートナー版は `partner_customers.consent_share_at` が無ければ 409** |
| POST | `/api/v1/leads/` | 連絡先入力（確定紐付け）。`{ responseId?, token?, purpose, company, name, email, phone?, privacyAgree, turnstileToken, website }`。`responseId` があれば `diagnosis_responses.lead_id` を設定（同一 batch）。`purpose = briefing` なら `briefing_requests` を `requested` で作成 | Turnstile + ハニーポット（`/api/contact/` と同じ） |

公開側の一般公開版（`mode = public`）はこれらを一切呼ばない（回答を保存しない — BIZ-04 §6-1）。

### 5-7. 診断プラットフォーム — 申込者（`apps/public`、Member 認証、Phase 3）

`member_session`（§5-5）。申込は未認証で始まり、申込完了時に Member を作る（`members/register` を内包する）。

| メソッド | パス | 用途 | 認証 |
| --- | --- | --- | --- |
| POST | `/api/v1/paid-diagnoses/` | 申込（SCR-22）。`{ company, name, email, phone?, employeeBand, preferredTiming, paymentMethod, consentTerms, consentAi, consentPartnerShare?, partnerToken?, sourceResponseId?, turnstileToken, website }`。`members` に行を作り（初期パスワードは設定せず、**パスワード設定リンクをメール送信** — `password_reset_tokens` 相当の Member 版）、`leads` と `paid_diagnoses`（`applied`）を同一 batch で作成 | 不要（Turnstile） |
| GET | `/api/v1/paid-diagnoses/{id}/` | 自分の案件（状態・回答進捗・納品物） | Member 本人 |
| GET | `/api/v1/paid-diagnoses/{id}/questions/` | 有料版の質問定義（`definition_id` の版）と無料版から引き継いだ回答の初期値 | Member 本人 |
| PUT | `/api/v1/paid-diagnoses/{id}/answers/` | 途中保存（UPSERT。`answering` 以外は 409） | Member 本人 |
| POST | `/api/v1/paid-diagnoses/{id}/submit/` | 提出（必須未回答があれば 422 で質問 ID を返す） | Member 本人 |
| GET | `/api/v1/paid-diagnoses/{id}/result/` | 承認済み（`approved` 以降）の分析結果。未承認なら 404 | Member 本人 |
| GET | `/api/v1/paid-diagnoses/{id}/report/` | PDF（R2 から `env.BUCKET.get()` を返す。`Content-Disposition: attachment`） | Member 本人 |
| PATCH | `/api/v1/paid-diagnoses/{id}/consents/` | パートナー共有同意の付与・撤回 | Member 本人 |

Member 認証系（`/api/v1/members/…` — §5-5）のうち Phase 3 で実装するのは `auth/login`・`auth/logout`・`password/forgot`・`password/reset`・`me`。`register` は上記の申込に内包し、単独では開けない（申込無しの会員登録を作らない）。

### 5-8. 診断プラットフォーム — ビジネスパートナー（`apps/public`、`partner_session`、Phase 4）

すべて `/api/v1/partner/` 配下。**返す資源は常に自パートナーの分だけ**。他パートナーの ID を指定した場合は 404。

| メソッド | パス | 用途 |
| --- | --- | --- |
| POST | `/api/v1/partner/auth/login/` | ログイン（ロックアウトは AdminUser と同じ KV カウンタ。キーの接頭辞を分ける） |
| POST | `/api/v1/partner/auth/logout/` | ログアウト |
| GET | `/api/v1/partner/auth/me/` | 自分とパートナー会社 |
| POST | `/api/v1/partner/auth/password/forgot/` / `…/reset/` | パスワード再設定 |
| GET | `/api/v1/partner/customers/` | 顧客一覧（カーソル） |
| POST | `/api/v1/partner/customers/` | 顧客登録 |
| GET | `/api/v1/partner/customers/{id}/` | 顧客詳細（回答・案件の要約を含む） |
| PATCH | `/api/v1/partner/customers/{id}/` | 顧客情報の編集 |
| POST | `/api/v1/partner/customers/{id}/consent/` | 共有同意の記録（`consent_share_at`。対面で口頭同意を得た場合もここで記録し、同意文の版を `notes` に残す） |
| POST | `/api/v1/partner/customers/{id}/tokens/` | 顧客専用 URL の発行（`{ diagnosis }` → `{ url, expiresAt }`） |
| POST | `/api/v1/partner/customers/{id}/tokens/{token}/revoke/` | 失効 |
| GET | `/api/v1/partner/customers/{id}/responses/` | 顧客の回答一覧 |
| GET | `/api/v1/partner/responses/{id}/` | 回答詳細（全文結果 + 簡易優先順位 + 次に確認すべきこと） |
| POST | `/api/v1/partner/responses/{id}/report/` | 簡易 PDF 生成（共同名義。`reports.kind = partner_light`） |
| GET | `/api/v1/partner/reports/{id}/` | 簡易 PDF 取得 |
| GET / POST | `/api/v1/partner/deals/` | 案件一覧 / 登録（`{ customerId, plannedContribution, serviceCategory?, notes }`） |
| GET / PATCH | `/api/v1/partner/deals/{id}/` | 案件詳細（当社が確定した区分・率・額を含む）/ メモ編集 |
| PUT | `/api/v1/partner/deals/{id}/checklist/` | チェックリスト 9 項目の更新（`registered` のみ可） |
| POST | `/api/v1/partner/deals/{id}/submit/` | 当社へ提出（DEV-09 §2-9-3） |
| GET | `/api/v1/partner/paid-diagnoses/{id}/result/` | 顧客が同意した有料診断の承認済み結果（`consent_partner_share_at` が無ければ 404） |

### 5-9. 診断プラットフォーム — 管理側（`apps/admin`、`admin_session`、Phase 2b〜4）

ロール列は `editor` = 診断担当者、`admin` = 承認・確定権限（DEV-02 §2-2）。

| メソッド | パス | 用途 | ロール | Phase |
| --- | --- | --- | --- | :---: |
| GET / POST | `/api/v1/campaigns/` | キャンペーン一覧 / 作成 | editor | 2b |
| GET / PATCH | `/api/v1/campaigns/{id}/` | 詳細 / 編集（`draft` のみ） | editor | 2b |
| POST | `/api/v1/campaigns/{id}/activate/` / `…/close/` | 状態遷移 | editor | 2b |
| POST | `/api/v1/campaigns/{id}/tokens/` | トークン一括発行（`{ count, recipientRefs?[] }` → URL 一覧。CSV は画面側で生成） | editor | 2b |
| GET | `/api/v1/campaigns/{id}/tokens/` | トークン一覧（クリック・回答・完了の状況付き。**企業名は表示しない**） | editor | 2b |
| POST | `/api/v1/campaigns/{id}/tokens/{token}/revoke/` | 失効 | editor | 2b |
| GET | `/api/v1/diagnosis-responses/` | 回答一覧（`mode` / `campaign` / `partner` / 期間 / 結果タイプで絞込。`lead_id` が無い行は匿名表示） | editor | 2b |
| GET | `/api/v1/diagnosis-responses/{id}/` | 回答詳細 | editor | 2b |
| GET / PATCH | `/api/v1/leads/` `/api/v1/leads/{id}/` | リード一覧 / 詳細・担当・メモ編集 | editor | 2b |
| POST | `/api/v1/leads/{id}/{contact\|qualify\|nurture\|convert\|lose}/` | 状態遷移（DEV-09 §2-4） | editor | 2b |
| GET | `/api/v1/briefing-requests/` | 15 分解説 一覧 | editor | 2b |
| POST | `/api/v1/briefing-requests/{id}/{schedule\|hold\|no-show\|cancel}/` | 状態遷移（`hold` は `outcome` 必須） | editor | 2b |
| GET | `/api/v1/paid-diagnoses/` `/{id}/` | 有料診断 一覧 / 詳細（回答・ロジック結果・AI 分析の版一覧） | editor | 3 |
| PATCH | `/api/v1/paid-diagnoses/{id}/` | 担当者・日程・ヒアリング記録の編集 | editor | 3 |
| POST | `/api/v1/paid-diagnoses/{id}/{invoice\|reopen-answers\|mark-interviewed\|analyze\|close}/` | 状態遷移（DEV-09 §2-8） | editor | 3 |
| POST | `/api/v1/paid-diagnoses/{id}/{confirm-payment\|cancel}/` | 入金確認 / 取消（入金後） | admin | 3 |
| POST | `/api/v1/paid-diagnoses/{id}/ai-jobs/` | AI 分析の（再）実行。`{ type: "analysis" \| "regenerate" }`。`consent_ai_at` 無しは 409、月次上限超過は 422 `USAGE_LIMIT_EXCEEDED` | editor | 3 |
| GET | `/api/v1/ai-jobs/{id}/` | ジョブ状態（ポーリング） | editor | 3 |
| GET / PATCH | `/api/v1/ai-analyses/{id}/` | 分析の取得 / 編集（`draft` のみ。`edited_json` をスキーマ検証） | editor | 3 |
| POST | `/api/v1/ai-analyses/{id}/{request-review\|revise}/` | 状態遷移 | editor | 3 |
| POST | `/api/v1/ai-analyses/{id}/{approve\|reject\|unapprove\|deliver}/` | 承認系遷移（DEV-09 §2-7） | admin | 3 |
| POST | `/api/v1/ai-analyses/{id}/reports/` | PDF 生成（`approved` 以降。Browser Rendering → R2） | editor | 3 |
| GET | `/api/v1/reports/{id}/` | PDF 取得 | editor | 3 / 4 |
| GET / POST | `/api/v1/prompts/` | プロンプト一覧 / 新版作成 | admin | 3 |
| POST | `/api/v1/prompts/{id}/{activate\|retire}/` | 版の切替 | admin | 3 |
| GET | `/api/v1/diagnosis-definitions/` | 定義スナップショット一覧（版・hash・公開日） | editor | 2b |
| GET / POST | `/api/v1/partners/` `/{id}/` | パートナー一覧 / 登録 / 詳細 | admin | 4 |
| POST | `/api/v1/partners/{id}/{suspend\|activate}/` | 状態遷移 | admin | 4 |
| POST | `/api/v1/partners/{id}/users/` | パートナーユーザー招待（パスワード設定リンクをメール） | admin | 4 |
| GET | `/api/v1/partner-customers/` | 全パートナーの顧客一覧（当社のみ横断閲覧可） | editor | 4 |
| GET | `/api/v1/deals/` `/{id}/` | 案件一覧 / 詳細（チェックリスト・回答・有料診断を含む） | editor | 4 |
| POST | `/api/v1/deals/{id}/{start-proposal\|lose}/` | 状態遷移 | editor | 4 |
| POST | `/api/v1/deals/{id}/{accept\|reject\|mark-contracted\|mark-paid\|confirm-commission\|unconfirm-commission}/` | 受付・契約・入金・**手数料確定**（DEV-09 §2-9） | admin | 4 |
| GET / POST | `/api/v1/commission-payments/` | 支払一覧 / 追加 | admin | 4 |
| POST | `/api/v1/commission-payments/{id}/{mark-paid\|cancel}/` | 状態遷移 | admin | 4 |
| GET | `/api/v1/admin/dashboard/` | KPI 集計（BIZ-04 §14 の KPI-08〜20 を `mode` / `campaign` / `partner` で集計） | editor | 2b〜 |

### 5-10. 管理ダッシュボード（`admin` 限定 — テンプレート標準）

| メソッド | パス | 用途 |
| --- | --- | --- |
| GET | `/api/v1/admin/dashboard` | KPI 集計 |
| GET | `/api/v1/admin/audit-logs` | 監査ログ（`activity_log`、DEV-07 §4-4） |
| GET | `/api/v1/admin/reports` | 利用状況レポート |

---

## 6. リクエスト・レスポンス例

### 6-1. お問い合わせ送信（公開側・未認証）

本サイトの現行実装（§5-3b）。唯一の未認証エンドポイントである。Cookie は不要だが、Astro の
CSRF チェックにより `Origin` の無い POST は 403 になる（DEV-02 §3）。

**Request**

```http
POST /api/contact/
Content-Type: application/json
Origin: https://naturaling.jp

{
  "inquiryType": "システム開発について",
  "company": "株式会社サンプル",
  "name": "山田太郎",
  "email": "taro@example.com",
  "phone": "022-000-0000",
  "message": "料金について教えてください。",
  "privacyAgree": true,
  "turnstileToken": "0.xxxxx",
  "website": ""
}
```

> `website` はハニーポット。人間には見えない位置に置いてあり、値が入っていれば送信せずに
> `200 {"ok": true}` を返す（ボットに失敗を学習させない）。`company` と `phone` は任意。

**Response 200**

```json
{ "ok": true }
```

**Response 400 / 403 / 502**

```json
{ "ok": false, "error": "認証に失敗しました。ページを再読み込みしてお試しください。" }
```

| ステータス | 条件 |
| --- | --- |
| 400 | JSON として壊れている、または Zod バリデーション不合格（最初の 1 件のメッセージを返す） |
| 403 | Turnstile の `siteverify` が失敗 |
| 502 | 運営者宛の通知メール送信に失敗（自動返信の失敗はここに含めない — §5-3b） |

> `error` は利用者にそのまま表示される日本語文である。エラーコード体系（§4）には乗らない。

### 6-1b. 回答保存（営業版・パートナー版。§5-6）

**Request**

```http
POST /api/v1/diagnosis-responses/
Content-Type: application/json
Origin: https://naturaling.jp

{
  "token": "k7Qm…（32 バイト base64url）",
  "diagnosis": "business",
  "definitionVersion": 2,
  "answers": { "q0": 3, "q1": 0, "q2": 1, "q3": 0, "q4": 1, "q5": 0, "q6": 1, "q7": 0, "q8": 1, "q9": 1 },
  "clientResult": { "resultId": "e", "secondaryResultId": "c" }
}
```

**Response 201**

```json
{ "data": { "id": "01J9…", "resultId": "e", "secondaryResultId": "c", "resultUrl": "/diagnosis/business/result/e/?v=2&second=c&concern=4&s=1.0.3.1.5.0.2.0.0&r=01J9…" } }
```

`r` は回答の公開 ID。結果ページはこれを `POST /api/v1/leads/` の `responseId` に引き継ぐ。**回答本体は URL に載せない**（`s` は集計点のみ）。

| ステータス | 条件 |
| --- | --- |
| 404 | トークンが無い・期限切れ・失効・上限到達（区別しない） |
| 409 | パートナー版で顧客の共有同意が未記録 |
| 422 | `answers` が定義の版と合わない（質問 ID・選択肢範囲） |

### 6-1c. 手数料確定（§5-9）

**Request**

```http
POST /api/v1/deals/01JA…/confirm-commission/
Cookie: admin_session=…
Content-Type: application/json

{ "confirmedContribution": "sales_support", "note": "チェックリスト 9 項目確認済み" }
```

**Response 200**

```json
{ "data": { "id": "01JA…", "status": "commission_confirmed", "confirmedContribution": "sales_support", "commissionRate": 20, "paidAmount": 1200000, "commissionAmount": 240000, "confirmedAt": "2026-12-01T09:00:00.000Z" } }
```

率と額はサーバーが計算する。リクエストで `commissionRate` や `commissionAmount` を送っても無視する（`.pick()` で落ちる — DEV-02 §6 マスアサインメント）。

### 6-2. ロール権限不足（`editor` が `admin` 専用操作を実行）

本テンプレは単一運営が前提のためテナント境界違反という区分は無く、権限不足は常に `admin` / `editor` のロール判定で表現する（DEV-02 §2-3・§3、DEV-01 §4「認可チェックの徹底」）。

**Response 403**

```json
{
  "message": "この操作には admin ロールが必要です。",
  "error_code": "FORBIDDEN"
}
```

---

## 7. Webhook

| 提供元 | エンドポイント | 用途 |
| --- | --- | --- |
| Stripe | `POST /api/v1/payments/webhook` | 決済完了 / 失敗 / 返金通知 |
| GitHub（任意） | `POST /api/v1/webhooks/github` | GitHub Actions 連携 |

すべて署名検証必須。詳細は DEV-10 §2-4。

---

## 8. ページネーション

- デフォルト 20 件 / ページ
- 最大 100 件 / ページ
- クエリパラメータ: `?page=2&per_page=50`
- 大規模リスト（Post・Inquiry・activity_log 等）はカーソルベース：`?cursor=eyJpZCI6MTAwfQ`
- 実装: Laravel の `paginate()` のようなフレームワーク組み込みページネータは無いため、D1 への `LIMIT`/`OFFSET`（または cursor ベースは `WHERE id > ?` 等）クエリと、§3-2 の `meta`/`links` envelope をアプリ側（Service 層）で組み立てる（DEV-01 参照）

---

## 9. バージョニング・破壊的変更方針

- バージョンは URL パスに含める（`/api/v1/`、`/api/v2/`）
- v1 は最低 12 ヶ月サポート
- 破壊的変更は v2 として新規バージョンで提供
- フィールド追加は非破壊変更（既存クライアント無視）
- フィールド削除・型変更は破壊変更

---

## 10. レート制限

レート制限値の正本: DEV-02 §7 参照（本書では値を再掲しない）。

認証エンドポイント（ログイン / パスワードリセット等）にはブルートフォース対策として特に厳しい制限を適用すること（DEV-02 §7）。

---

## 11. 記入時チェックポイント

- 全エンドポイントが認証要否・ロール要否（`admin` / `editor`）で分類されているか
- エラーコード体系が網羅的か
- リクエスト / レスポンス例が型レベルまで具体化されているか
- AI / Webhook の特殊な認証パターンが明示されているか
- 破壊的変更時のバージョニング方針が明確か
