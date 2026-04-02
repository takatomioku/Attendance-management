# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

医療クリニック向け勤怠管理Webアプリ。職員が休憩室のQRコードをスマホで読み取り打刻する。管理者はダッシュボードで勤怠を管理する。

## コマンド

```bash
npm run dev      # 開発サーバー起動（http://localhost:3000）
npm run build    # 本番ビルド
npm run lint     # ESLint
```

キャッシュ起因のエラーが出た場合:
```bash
rm -rf .next node_modules && npm install
```

## アーキテクチャ

### データフロー

**ブラウザ（クライアント）から Supabase へ直接アクセスしない。** アクセス経路は2種類：

```
① Server Components（app/page.tsx, app/admin/page.tsx など）
     └─ createServiceClient() で Supabase を直接操作
          └─ props として Client Components へ渡す

② Client Components のユーザー操作（打刻送信・レコード編集など）
     └─ fetch('/api/...') でAPIルートへ
          └─ createServiceClient() でSupabase操作（service_roleキー使用）
```

### APIルート一覧

| ルート | メソッド | 用途 |
|--------|---------|------|
| `/api/staff` | GET | 職員一覧取得 |
| `/api/attendance` | POST | 打刻送信 |
| `/api/attendance/status` | GET | 職員の最終打刻状態取得（単件、現在未使用） |
| `/api/admin/records` | GET / POST | 管理者用打刻記録の取得・追加 |
| `/api/admin/records/[id]` | PUT / DELETE | 個別レコードの編集・削除 |
| `/api/admin/export` | GET | Excelエクスポート（職員別シート、J列に連絡メモ） |
| `/api/admin/cleanup` | GET / DELETE | 古いデータの件数確認・一括削除 |
| `/api/memos` | GET / POST | 連絡メモの取得・投稿（`?month=YYYY-MM` でフィルタ） |

### 管理者画面一覧

| パス | 内容 |
|------|------|
| `/admin` | ダッシュボード（当日の職員ステータス一覧） |
| `/admin/monthly` | 月次集計 |
| `/admin/edit` | 打刻修正（レコードの追加・編集・削除） |
| `/admin/settings` | 設定（古いデータの一括削除） |

`app/admin/layout.tsx` が管理者共通レイアウト（ナビゲーション・ログアウトボタン）を提供。

### Supabaseクライアントの使い分け

| 関数 | ファイル | 用途 |
|------|---------|------|
| `createServiceClient()` | `lib/supabase/server.ts` | APIルート・Server Componentsでのデータ操作（RLSをバイパス） |
| `createSessionClient()` | `lib/supabase/server.ts` | ミドルウェアでの認証チェック |
| `createClient()` | `lib/supabase/client.ts` | ブラウザ側のSupabase Auth（ログイン/ログアウトのみ） |

**重要:** `createServiceClient()` は内部で `cache: 'no-store'` を指定したカスタム fetch を使う。Next.js 14 が Server Component 内の fetch を自動キャッシュするため、これを外すとダッシュボードが古いデータを返し続ける。

### 認証

- 管理者のみ Supabase Auth（email/password）でログイン
- `middleware.ts` が `/admin/*` を保護（`/admin/login` は除外）
- 職員の打刻画面（`/`）は認証なし

### 打刻画面のデータ取得とステータス管理

`app/page.tsx`（Server Component）がページ読み込み時に職員一覧と当日の全打刻記録を `Promise.all` で並列取得し、`initialStatuses: Record<string, ActionType | null>` として `PunchFlow` へ渡す。

`PunchFlow.tsx` はこれを `currentStatuses` ローカル状態に持ち、打刻成功のたびに該当職員のステータスを更新する。これによりページ再読み込みなしでも、連続打刻時に正しい次のアクションが表示される。`/api/attendance/status` はルートとして存在するが打刻画面からは呼ばれない。

### PunchFlow のステップ遷移

`components/PunchFlow.tsx` は打刻フローと連絡メモフローの2系統を持つ：

```
【打刻】 select_name → select_action → confirm → success → (3秒後) select_name
【メモ】 select_name → memo_name → memo_input → memo_success → (3秒後) select_name
```

- `currentStatuses`（ローカル状態）で職員ごとの最新アクションを管理
- 打刻成功時に `setCurrentStatuses` で該当職員のステータスを即時更新
- メモ送信は `POST /api/memos`

### 打刻のステートマシン

`lib/utils.ts` の `ACTION_FLOW` で定義。最後の打刻アクションから次に可能なアクションが決まる:

```
none → clock_in
clock_in → break_start | go_out | night_duty_start | clock_out
break_start → break_end
break_end → break_start | go_out | night_duty_start | clock_out
go_out → return
return → break_start | go_out | night_duty_start | clock_out
night_duty_start → night_duty_end
night_duty_end → break_start | go_out | night_duty_start | clock_out
clock_out → clock_in  （複数セッション対応）
```

### ダッシュボードのリアルタイム更新

`app/admin/page.tsx` は `export const dynamic = 'force-dynamic'` を設定したServer Component。ただしNext.js 14のクライアントサイドRouter Cacheにより、ナビゲーション時に30秒間古いデータが返る問題があるため：

- `next.config.js` で `experimental.staleTimes.dynamic = 0` を設定（Router Cache無効化）
- `components/admin/DashboardRefresher.tsx`（Client Component）がマウント時と30秒ごとに `router.refresh()` を呼ぶ

### タイムゾーン

- DBには UTC で保存
- 表示・`work_date` の計算はすべて JST（UTC+9）に変換
- `lib/utils.ts` の `getJSTDateString()` / `formatTime()` / `formatLiveClock()` を使用
- タイムゾーンライブラリは使わず `+9h` のオフセット手動計算

### 勤務時間計算

`lib/utils.ts` の `calculateWorkHours(records)`:
- `clock_in → clock_out` の差分を合計
- `break_start → break_end` と `go_out → return` の時間を差し引く
- `night_duty_start` / `night_duty_end` は時間計算に影響しない（マーカーのみ）
- 戻り値: 時間単位（小数点1桁）
- 退勤レコードがない日は勤務時間0として集計される

### Excelエクスポート

`/api/admin/export?month=YYYY-MM` が `.xlsx` を返す（`xlsx` ライブラリ使用）:
- 職員ごとに1シート（シート名 = 職員名）
- A列: 日付、B〜I列: 出勤・退勤・休憩開始・休憩終了・外出・帰院・夜間当番開始・夜間当番終了、**J列: 連絡メモ**（同日の `staff_memos` を「、」で結合）

## UIデザイン方針

- スタイル: Material Design 3 ベース、ミニマル・クリニカル（医療系）
- カラー: ホワイト背景、アクセントにティールグリーン（#009688）をMD3 primaryとして使用
- フォント: 日本語は Noto Sans JP、英数字は DM Sans
- アニメーション: Framer Motion（`components/PunchFlow.tsx` / `app/admin/**`）、控えめなフェードスライド中心
- **絶対に使わないもの**: 汎用的な紫グラデーション、Inter / Arial

## UIコーディングルール

### カラー管理（CSS変数 — 直書き禁止）

`app/globals.css` に2層構造で定義：

```
MD3トークン（--md-sys-color-*）
  └─ 後方互換エイリアス（--color-primary など）
       └─ Tailwindクラス（bg-primary, text-primary など）
```

- **MD3カラーロール**を使うこと: `bg-md-surface`, `text-md-on-surface-variant`, `bg-md-primary-container` など
- 夜間当番用に `bg-md-night-container` / `text-md-on-night-container`（ネイビー系）を定義済み
- `bg-[#009688]` のような直書きは違反
- 状態レイヤーは `var(--md-state-primary-hover)` / `var(--md-state-primary-focus)` を使う

### MD3シェイプ・エレベーション

```
角丸: rounded-md-sm(8px) / md-md(12px) / md-lg(16px) / md-xl(28px) / md-full(pill)
影:   shadow-md-1 / shadow-md-2 / shadow-md-3
```

### ボタンの種類

| 種類 | 実装 | 用途 |
|------|------|------|
| Filled Button | `bg-primary text-white rounded-md-full` | 主要アクション |
| Filled Tonal | `bg-md-primary-container text-md-on-primary-container rounded-md-full` | 副次アクション |
| Outlined Card | `border border-md-outline-variant rounded-md-lg` | 選択肢リスト |

### Hydrationエラー防止

リアルタイム時計など「サーバーとクライアントで値が変わる要素」は `useState(null)` で初期化し、`useEffect` 内でセット。

### Client ComponentでのAPIレスポンス処理

APIがエラーを返した場合 `{ error: "..." }` が返り、それを配列として扱おうとすると `.filter()` 等でクラッシュする。`fetch` 後は必ず `Array.isArray()` でガードする:

```ts
const data = await res.json();
setState(Array.isArray(data) ? data : []);
```

## 環境変数（.env.local）

| 変数名 | 種別 | 用途 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 公開可 | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開可 | 匿名キー（Auth用） |
| `SUPABASE_SERVICE_ROLE_KEY` | **秘密** | サービスロールキー（APIルートのみ） |

`SUPABASE_SERVICE_ROLE_KEY` は絶対に `NEXT_PUBLIC_` をつけない。

## Supabaseスキーマ

`supabase/schema.sql` に定義。テーブル:
- `staff`: 職員マスタ（id, name, display_order）
- `attendance_records`: 打刻記録（staff_id, action, timestamp, work_date, note）
- `staff_memos`: 連絡メモ（staff_id, memo_date, content）

`action` の値: `clock_in` / `clock_out` / `break_start` / `break_end` / `go_out` / `return` / `night_duty_start` / `night_duty_end`

## デプロイ

- ホスティング: Vercel（GitHub `main` ブランチへのpushで自動デプロイ）
- リポジトリ: `takatomioku/Attendance-management`（Public）
- Supabase の **Authentication → URL Configuration** に Vercel の URL を設定しないと管理者ログイン不可

## 注意事項

- Node.js v22 では `next.config.ts` が非対応のため `next.config.js` を使用する
- `package.json` の依存関係はバージョンを明示（`^` による自動更新防止）
- `.next/` と `node_modules/` は `.gitignore` で除外済み（大きいバイナリファイルがあるためGitHubの100MB制限に注意）
