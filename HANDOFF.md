# OtakuPulse — HANDOFF: P5 全機能強化

<!-- ステータス: pending -->
<!-- 作成: 2026-03-25 by Claude Code -->
<!-- 対象: Cascade -->

## 前提

- テスト: 58/58 パス、tsc clean、biome 0 エラー
- プロジェクトパス: `c:\Users\rsn12\dev\otaku-pulse`
- 既存: `useKeyboardShortcuts.ts`, `is_bookmarked` カラム, `toggle_bookmark` コマンド, `notification.rs`, AniList クライアント (季節アニメ + トレンドマンガ)

## AI 開発ルール (全 Phase 共通)

1. `unwrap()` 禁止 → `?` + `AppError`
2. `console.log` / `any` 型禁止
3. 全ファイル 200 行以下（超過は分割）
4. `<button>` に必ず `type="button"`
5. SVG に `aria-hidden="true"`
6. `listen<T>()` でジェネリクス型を明示
7. 各 Phase 後に `cargo test` + `tsc --noEmit` + `npm run check`
8. API キーをログに出力しない
9. `@tauri-apps/api/core` を使用（`/tauri` は禁止）
10. ダークモード: `bg-gray-800/900/950`, `text-gray-100/300/400`

---

## P5-A: キーボードナビゲーション強化

**既存の `src/hooks/useKeyboardShortcuts.ts` を拡張する。新ファイル不要。**

### 追加するショートカット

| キー | 動作 | 依存 |
|------|------|------|
| `J` | 次の記事にフォーカス移動 | useArticleStore |
| `K` | 前の記事にフォーカス移動 | useArticleStore |
| `O` | フォーカス中の記事を外部リンクで開く | shell.open() |
| `M` | フォーカス中の記事を既読/未読トグル | markRead() |
| `B` | フォーカス中の記事をブックマークトグル | toggle_bookmark |
| `?` | ショートカットヘルプモーダル表示 | appStore |

### useArticleStore に追加

```typescript
focusedIndex: number;   // -1 = フォーカスなし
setFocusedIndex: (i: number) => void;
focusNext: () => void;  // min(focusedIndex + 1, articles.length - 1)
focusPrev: () => void;  // max(focusedIndex - 1, 0)
```

### ArticleCard.tsx に追加

- `isFocused` prop → `ring-2 ring-blue-500` ハイライト
- フォーカス時に `scrollIntoView({ block: 'nearest' })` で自動スクロール

### KeyboardHelpModal（新規: `src/components/common/KeyboardHelpModal.tsx`）

- ショートカット一覧テーブル
- `?` キーまたは UI ボタンで開閉
- `Escape` で閉じる

→ **品質ゲート**: `npx tsc --noEmit` + `npm run check`

---

## P5-B: SAVED Wing（ブックマーク専用画面）

**`is_bookmarked` カラムと `toggle_bookmark` コマンドは既存。新 Wing のみ追加。**

### BE: ブックマーク記事取得コマンド

**`src-tauri/src/commands/feed.rs` に追加:**

```rust
#[tauri::command]
pub async fn get_bookmarked_articles(
    db: State<'_, SqlitePool>,
) -> CmdResult<Vec<ArticleDto>> {
    // SELECT ... FROM articles a JOIN feeds f ON a.feed_id = f.id
    //   WHERE a.is_bookmarked = 1
    //   ORDER BY a.created_at DESC
}
```

lib.rs に登録。

### FE: SAVED Wing

**`src/components/wings/SavedWing.tsx`（新規）**

- ブックマーク済み記事一覧
- 各記事にブックマーク解除ボタン
- 0 件時: 「ブックマークした記事がここに表示されます」
- 既存の ArticleCard コンポーネントを再利用

### Sidebar に SAVED Wing を追加

```
📰 NEWS  (unread badge)
📝 DIGEST
🔖 SAVED  ← 新規追加
⚙️ SETTINGS
```

`appStore` の `WingId` 型に `'saved'` を追加。
`types/index.ts` の `WingId` に `'saved'` を追加。
`AppShell.tsx` に SavedWing のルーティングを追加。

→ **品質ゲート**: `cargo check` + `cargo test` + `tsc --noEmit`

---

## P5-C: キーワードフィルタ（ミュート + ハイライト）

### BE: DB マイグレーション

**`src-tauri/migrations/002_keyword_filters.sql`（新規）**

```sql
CREATE TABLE IF NOT EXISTS keyword_filters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword    TEXT NOT NULL,
    filter_type TEXT NOT NULL CHECK(filter_type IN ('mute', 'highlight')),
    category   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_keyword_filters_type ON keyword_filters(filter_type);
```

### BE: コマンド

**`src-tauri/src/commands/filters.rs`（新規）**

```rust
#[tauri::command]
pub async fn get_keyword_filters(db: State<'_, SqlitePool>) -> CmdResult<Vec<KeywordFilter>>

#[tauri::command]
pub async fn add_keyword_filter(
    db: State<'_, SqlitePool>,
    keyword: String, filter_type: String, category: Option<String>,
) -> CmdResult<KeywordFilter>

#[tauri::command]
pub async fn remove_keyword_filter(db: State<'_, SqlitePool>, id: i64) -> CmdResult<()>
```

`commands/mod.rs` に `pub mod filters;` 追加。lib.rs に登録。

### FE: フィルタ適用ロジック（純粋関数）

**`src/lib/articleFilter.ts`（新規）**

```typescript
export function applyMuteFilters(
  articles: ArticleRow[],
  muteKeywords: string[],
): ArticleRow[] {
  // タイトル or summary にミュートキーワードを含む記事を除外
}

export function getHighlightKeywords(
  article: ArticleRow,
  highlightKeywords: string[],
): string[] {
  // 該当するハイライトキーワード一覧を返す
}
```

### FE: 設定 UI

**`src/components/settings/KeywordFilterSection.tsx`（新規）**

- ミュートワード一覧 + 追加/削除
- ハイライトワード一覧 + 追加/削除
- カテゴリ指定（任意）

SettingsWing に `<KeywordFilterSection />` を追加。

→ **品質ゲート**: `cargo check` + `cargo test` + `tsc --noEmit`

---

## P5-D: アニメ放送スケジュール Wing

**OtakuPulse のキラー差別化機能。他の RSS リーダーにない。**

### BE: AniList 放送スケジュール取得

**`src-tauri/graphql/airing_schedule.graphql`（新規）**

```graphql
query AiringSchedule($airingAtGreater: Int, $airingAtLesser: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    airingSchedules(airingAt_greater: $airingAtGreater, airingAt_lesser: $airingAtLesser, sort: TIME) {
      id
      episode
      airingAt
      media {
        id
        title { native romaji }
        coverImage { medium }
        episodes
        siteUrl
      }
    }
  }
}
```

**`src-tauri/src/infra/anilist_client.rs` に追加:**

```rust
pub async fn fetch_airing_schedule(
    &self,
    days_ahead: i64,
) -> Result<Vec<AiringEntry>, AppError> {
    // 今日の0時から days_ahead 日後の23:59 までの放送一覧を取得
}
```

**`src-tauri/src/commands/schedule.rs`（新規）**

```rust
#[tauri::command]
pub async fn get_airing_schedule(
    http: State<'_, Arc<reqwest::Client>>,
    days_ahead: Option<i64>,  // デフォルト 7
) -> CmdResult<Vec<AiringEntry>>
```

`commands/mod.rs` に `pub mod schedule;` 追加。lib.rs に登録。

### FE: SCHEDULE Wing

**ファイル構成:**
```
src/components/wings/ScheduleWing.tsx    ← 週間カレンダー
src/components/schedule/AiringCard.tsx   ← 1 作品カード
```

**レイアウト:**
```
┌──────────────────────────────────────────┐
│ 📺 今週の放送スケジュール   [← ▶] [更新] │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│  月  │  火  │  水  │  木  │  金  │  土  │  日  │
│ 3/24 │ 3/25 │ 3/26 │ 3/27 │ 3/28 │ 3/29 │ 3/30│
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│[作品]│      │[作品]│      │      │      │     │
│ #89  │      │ #10  │      │      │      │     │
│25:05 │      │23:00 │      │      │      │     │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

### Sidebar に SCHEDULE Wing を追加

```
📰 NEWS
📝 DIGEST
🔖 SAVED
📺 SCHEDULE  ← 新規追加
⚙️ SETTINGS
```

→ **品質ゲート**: `cargo check` + `cargo test` + `tsc --noEmit`

---

## P5-G: OS 通知をスケジューラに統合

**`notification.rs` は既存。スケジューラのイベント発火時に呼ぶだけ。**

### 実装

`src-tauri/src/services/scheduler.rs` の収集完了時・ダイジェスト生成時に:

```rust
// 収集完了時 (saved > 0 の場合のみ)
crate::infra::notification::notify_important_article(
    app_handle, "新着記事", &format!("{}件の新着記事", saved)
);

// ダイジェスト生成時
crate::infra::notification::notify_digest_ready(
    app_handle, &category, article_count
);
```

**`tauri.conf.json`**: `"plugins": {}` のまま（notification プラグインは設定不要で動作確認済み）

→ **品質ゲート**: `cargo check` + `cargo test`

---

## P5-H: ダーク/ライトテーマ切替

**現状はダークモード固定。CSS 変数基盤なし。最小限で実装。**

### 方針

Tailwind CSS v4 の `dark:` バリアントを使用。`<html class="dark">` の切替で制御。
CSS 変数は使わない（Tailwind のユーティリティクラスで十分）。

### FE 実装

**`src/stores/useThemeStore.ts`（新規）**

```typescript
type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  initTheme: () => void;  // アプリ起動時に呼ぶ
}

// tauri-plugin-store で永続化
// initTheme() で document.documentElement.classList に 'dark' を追加/削除
```

**コンポーネントの色クラスを `dark:` バリアント対応に更新:**

既存: `className="bg-gray-800 text-gray-100"`
変更: `className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"`

**主要コンポーネントのみ対応（全ファイル一括変更は不要）:**
- AppShell.tsx
- Sidebar.tsx
- TitleBar.tsx
- ArticleCard.tsx
- DigestCard.tsx

**`src/components/settings/AppearanceSection.tsx`（新規）**

- ダーク / ライト / システム の 3 択ラジオボタン
- SettingsWing に追加

→ **品質ゲート**: `tsc --noEmit` + `npm run check`

---

## ナビゲーション最終構成

```
Sidebar:
  📰 NEWS       (unread badge)
  📝 DIGEST
  🔖 SAVED      ← P5-B 新規
  📺 SCHEDULE   ← P5-D 新規
  ⚙️ SETTINGS

Settings Wing:
  ├── 🤖 AI プロバイダー設定（既存）
  ├── ⏰ スケジューラ設定（既存）
  ├── 🔇 キーワードフィルタ（P5-C 新規）
  ├── 🎨 表示設定（P5-H 新規）
  └── 🔧 メンテナンス（既存）
```

`types/index.ts` の `WingId` を更新:
```typescript
export type WingId = 'dashboard' | 'news' | 'digest' | 'saved' | 'schedule' | 'settings';
```

---

## 実装順序

```
P5-A (キーボード強化)  ← FE のみ、他に依存なし
   ↓
P5-B (SAVED Wing)     ← BE 1 コマンド + FE Wing 追加
   ↓
P5-C (キーワードフィルタ) ← BE 新テーブル + コマンド + FE 設定 UI
   ↓
P5-D (放送スケジュール)  ← BE AniList 拡張 + FE 新 Wing（最大タスク）
   ↓
P5-G (OS 通知統合)     ← BE のみ、scheduler に 2 行追加
   ↓
P5-H (テーマ切替)      ← FE のみ、主要コンポーネント更新
```

---

## 完了条件

```
✅ P5-A: J/K で記事移動、O で開く、M で既読、B でブックマーク、? でヘルプ
✅ P5-B: SAVED Wing でブックマーク記事一覧表示
✅ P5-C: ミュートワードで記事非表示、ハイライトワードで強調
✅ P5-D: 週間放送スケジュール表示（AniList API）
✅ P5-G: 収集完了・ダイジェスト生成時に OS 通知
✅ P5-H: ダーク/ライト/システムテーマ切替
✅ cargo test 全パス
✅ tsc --noEmit clean
✅ biome 0 エラー
✅ 全ファイル 200 行以下
```
