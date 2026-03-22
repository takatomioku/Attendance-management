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

```
ブラウザ（スマホ/PC）
  └─ fetch('/api/...') のみ でサーバーと通信
       └─ APIルート（app/api/**/route.ts）
            └─ createServiceClient() でSupabase操作（service_roleキー使用）
```

フロントエンドから Supabase へ直接アクセスしない。すべてAPIルート経由。

### Supabaseクライアントの使い分け

| 関数 | ファイル | 用途 |
|------|---------|------|
| `createServiceClient()` | `lib/supabase/server.ts` | APIルート・Server Componentsでのデータ操作（RLSをバイパス） |
| `createSessionClient()` | `lib/supabase/server.ts` | ミドルウェアでの認証チェック |
| `createClient()` | `lib/supabase/client.ts` | ブラウザ側のSupabase Auth（ログイン/ログアウトのみ） |

### 認証

- 管理者のみ Supabase Auth（email/password）でログイン
- `middleware.ts` が `/admin/*` を保護（`/admin/login` は除外）
- 職員の打刻画面（`/`）は認証なし

### 打刻のステートマシン

`lib/utils.ts` の `ACTION_FLOW` で定義。最後の打刻アクションから次に可能なアクションが決まる:

```
none → clock_in
clock_in → break_start | go_out | clock_out
break_start → break_end
break_end → break_start | go_out | clock_out
go_out → return
return → break_start | go_out | clock_out
clock_out → clock_in  （複数セッション対応）
```

### タイムゾーン

- DBには UTC で保存
- 表示・`work_date` の計算はすべて JST（UTC+9）に変換
- `lib/utils.ts` の `getJSTDateString()` / `formatTime()` / `formatLiveClock()` を使用
- タイムゾーンライブラリは使わず `+9h` のオフセット手動計算

### 勤務時間計算

`lib/utils.ts` の `calculateWorkHours(records)`:
- `clock_in → clock_out` の差分を合計
- `break_start → break_end` と `go_out → return` の時間を差し引く
- 戻り値: 時間単位（小数点1桁）

## UIデザイン方針

- スタイル: ミニマル・クリニカル（医療系）
- カラー: ホワイト背景、アクセントにティールグリーン（#009688）
- フォント: 日本語は Noto Sans JP、英数字は DM Sans
- アニメーション: 控えめ、フェードイン中心
- **絶対に使わないもの**: 汎用的な紫グラデーション、Inter / Arial

## UIコーディングルール

- カラーは CSS変数で管理し、**直書き禁止**
  - `bg-primary` / `bg-primary-dark` / `text-primary`（`tailwind.config.ts` で CSS変数にマッピング済み）
  - `bg-[#009688]` のような直書きは違反
- ボタンには `hover:` / `focus-visible:` のマイクロインタラクションを入れる
- リアルタイム時計など「サーバーとクライアントで値が変わる要素」は `useState(null)` で初期化し、`useEffect` 内でセット（Hydrationエラー防止）

## 環境変数（.env.local）

| 変数名 | 種別 | 用途 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 公開可 | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開可 | 匿名キー（Auth用） |
| `SUPABASE_SERVICE_ROLE_KEY` | **秘密** | サービスロールキー（APIルートのみ） |

`NEXT_PUBLIC_` なし変数はブラウザに露出しない。`SUPABASE_SERVICE_ROLE_KEY` は絶対に `NEXT_PUBLIC_` をつけない。

## Supabaseスキーマ

`supabase/schema.sql` に定義。テーブル:
- `staff`: 職員マスタ（id, name, display_order）
- `attendance_records`: 打刻記録（staff_id, action, timestamp, work_date, note）

`action` の値: `clock_in` / `clock_out` / `break_start` / `break_end` / `go_out` / `return`

## アーキテクチャルール

- ディレクトリ構成は `app/` ベースの App Router を使用する
- コンポーネントは **Server Components を基本** とする
- ユーザー操作・状態管理が必要なUIのみ `"use client"` を付ける
- 型定義は `types/index.ts` にまとめる

## 注意事項

- Node.js v22 では `next.config.ts` が非対応のため `next.config.js` を使用する
- `package.json` の依存関係はバージョンを明示（`^` による自動更新防止）
