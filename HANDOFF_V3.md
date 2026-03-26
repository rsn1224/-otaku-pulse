# OtakuPulse v3 — ゼロからの再構築設計書

<!-- ステータス: pending -->
<!-- 作成: 2026-03-26 by Claude Code -->
<!-- 対象: Claude Code (次セッション) -->

## 背景と目的

v2 (13,900行) は機能的に完成しているが、以下の技術的負債が蓄積:

- **28ファイルが200行超** (discover.rs は528行)
- **FEテスト 0件** (vitest 導入済みだが未使用)
- **スタイリング混在** (CSS変数 + Tailwind + inline styles)
- **silent catch が10箇所以上** (`catch (_) { /* silent */ }`)
- **useDiscoverStore が319行** (14 state + 17 actions)
- **コンポーネントライブラリなし** (Button/Modal/Input が毎回インライン)

v3 では**同じ機能**を**最新ベストプラクティス**で再実装する。

---

## アーキテクチャ方針

### 技術スタック (変更なし)

| レイヤー | 技術 |
|---------|------|
| デスクトップ | Tauri 2 |
| フロントエンド | React 19 + TypeScript 5.8 |
| 状態管理 | Zustand 5 |
| スタイル | Tailwind v4 + CSS変数 (inline style 禁止) |
| バックエンド | Rust + SQLx + SQLite |
| LLM | Perplexity Sonar / Ollama |
| リント | Biome + Clippy |
| テスト | Vitest (FE) + cargo test (BE) |

### 設計原則

1. **全ファイル 200行以下** — 超えたら分割必須
2. **unwrap() 禁止** — `?` + `AppError` のみ
3. **console.log / println! 禁止** — tracing / pino のみ
4. **inline style 禁止** — Tailwind クラス + CSS変数のみ
5. **silent catch 禁止** — エラーは Toast で表示
6. **テストカバレッジ 80%以上**
7. **コンポーネントは 1責任** — 表示 or ロジック、混在禁止

---

## Phase 1: プロジェクト基盤 (Day 1)

### 1-1: v3 ブランチ作成

```bash
git checkout -b v3-rebuild
```

### 1-2: FE 基盤

```
src/
├── components/
│   ├── ui/              ← 共通UIコンポーネント (新規)
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   ├── Card.tsx
│   │   └── ToggleGroup.tsx
│   ├── layout/
│   │   ├── AppShell.tsx     ← 100行以下
│   │   ├── Sidebar.tsx      ← 抽出
│   │   ├── TopBar.tsx       ← 抽出
│   │   └── WindowControls.tsx
│   ├── discover/
│   │   ├── DiscoverWing.tsx       ← 150行以下
│   │   ├── DiscoverCard.tsx       ← 100行以下
│   │   ├── CardHeader.tsx         ← 抽出
│   │   ├── CardSummary.tsx        ← 抽出
│   │   ├── CardActions.tsx        ← 抽出
│   │   ├── DeepDivePanel.tsx
│   │   ├── HighlightsSection.tsx
│   │   ├── SearchResults.tsx      ← 抽出
│   │   └── UniversalTabs.tsx
│   ├── schedule/
│   │   ├── ScheduleWing.tsx       ← 150行以下
│   │   ├── ScheduleHeader.tsx     ← 抽出
│   │   ├── WeekGrid.tsx           ← 抽出
│   │   ├── MonthGrid.tsx          ← 抽出
│   │   ├── DayView.tsx            ← 抽出
│   │   ├── AiringCard.tsx
│   │   └── GameReleaseCard.tsx
│   ├── reader/
│   │   ├── ArticleReader.tsx      ← 100行以下
│   │   ├── ReaderHeader.tsx       ← 抽出
│   │   ├── AiSummaryBlock.tsx     ← 抽出
│   │   ├── ArticleBody.tsx        ← 抽出
│   │   └── RelatedArticles.tsx
│   ├── saved/
│   │   └── SavedWing.tsx
│   ├── profile/
│   │   ├── ProfileWing.tsx
│   │   ├── ProfileSection.tsx
│   │   ├── FeedsSection.tsx
│   │   └── AdvancedSection.tsx
│   ├── settings/
│   │   ├── LlmSettings.tsx        ← 分割
│   │   ├── SchedulerSettings.tsx   ← 統合
│   │   ├── KeywordFilters.tsx
│   │   └── AppearanceSettings.tsx
│   ├── onboarding/
│   │   ├── OnboardingWizard.tsx   ← 150行以下
│   │   ├── StepGenres.tsx         ← 抽出
│   │   ├── StepFeeds.tsx          ← 抽出
│   │   └── StepProfile.tsx        ← 抽出
│   └── common/
│       ├── ErrorBoundary.tsx
│       ├── Toast.tsx
│       └── KeyboardHelpModal.tsx
├── stores/
│   ├── useArticleStore.ts      ← discover の記事部分
│   ├── useSearchStore.ts       ← discover の検索部分
│   ├── useReaderStore.ts       ← discover のリーダー部分
│   ├── useProfileStore.ts
│   ├── useFilterStore.ts
│   ├── useSchedulerStore.ts
│   ├── useThemeStore.ts
│   └── useKeyboardStore.ts     ← focusedIndex + showHelp
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useTauriCommand.ts      ← invoke ラッパー (新規)
│   └── useDwellTracking.ts     ← dwell ロジック抽出 (新規)
├── lib/
│   ├── textUtils.ts
│   ├── articleFilter.ts
│   ├── sanitize.ts             ← HTML サニタイズ (分離)
│   └── dateUtils.ts            ← 日付ユーティリティ (新規)
├── types/
│   └── index.ts
└── styles/
    ├── globals.css             ← CSS変数 + ベーススタイル
    ├── components.css          ← コンポーネントスタイル
    └── animations.css          ← アニメーション
```

### 1-3: useTauriCommand フック (invoke ラッパー)

```typescript
// エラーハンドリング + Toast 通知を統一
export function useTauriCommand<T>(command: string) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (args?: Record<string, unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(command, args);
      setData(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      showToast('error', msg); // グローバル Toast
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [command]);

  return { data, isLoading, error, execute };
}
```

### 1-4: CSS 統一

```css
/* globals.css — Stitch デザインシステム */
:root {
  /* Surface */
  --surface: #0e0e13;
  --surface-container: #19191f;
  --surface-container-high: #1f1f26;
  --surface-container-highest: #25252d;
  /* Content */
  --on-surface: #f9f5fd;
  --on-surface-variant: #acaab1;
  --outline: #76747b;
  --outline-variant: #48474d;
  /* Accent */
  --primary: #bd9dff;
  --secondary: #699cff;
  --tertiary: #ff97b2;
  --error: #ff6e84;
}

/* inline style 禁止: 全て Tailwind + CSS変数 */
```

---

## Phase 2: BE リビルド (Day 2-3)

### 2-1: コマンドモジュール分割

```
src-tauri/src/commands/
├── mod.rs
├── articles.rs        ← mark_read のみ (50行以下)
├── collect.rs         ← run_collect_now + init_default_feeds (150行以下)
├── feeds.rs           ← CRUD + OPML (150行以下)
├── discover.rs        ← フィード取得のみ (100行以下) ← 528→100行
├── discover_ai.rs     ← AI summary + deepdive + search (150行以下) ← 新規分割
├── discover_profile.rs ← profile + preferences (100行以下) ← 新規分割
├── filters.rs         ← キーワードフィルタ (80行以下)
├── llm.rs             ← LLM 設定 (100行以下)
├── schedule.rs        ← airing + game releases (100行以下)
└── scheduler.rs       ← スケジューラ設定 (50行以下)
```

### 2-2: サービス層リファクタ

```
src-tauri/src/services/
├── mod.rs
├── collector.rs       ← フィード収集 (150行以下)
├── scoring.rs         ← importance + personal 統合 (150行以下) ← 2ファイル統合
├── dedup.rs           ← 重複検出 (100行以下)
├── discover.rs        ← クエリ (150行以下)
├── digest.rs          ← ダイジェスト生成 (150行以下)
├── summary.rs         ← AI要約 (100行以下)
├── deepdive.rs        ← DeepDive QA (100行以下)
├── highlights.rs      ← 日次ハイライト (100行以下)
├── opml.rs            ← OPML import/export (80行以下)
├── fts.rs             ← 全文検索 (50行以下)
└── scheduler.rs       ← バックグラウンドタスク (150行以下)
```

### 2-3: エラーハンドリング改善

```rust
// AppError に Display 実装改善
// 全 unwrap() を ? に置換
// LLM lock パターンをヘルパーに抽出
fn read_llm_settings(state: &AppState) -> CmdResult<LlmSettings> {
    state.llm.read()
        .map(|g| g.clone())
        .map_err(|e| AppError::Internal(format!("LLM lock: {e}")))
}
```

---

## Phase 3: FE リビルド (Day 3-5)

### 3-1: ストア分割

**useDiscoverStore (319行) → 4ストアに分割:**

| 新ストア | 責務 | 状態 |
|---------|------|------|
| `useArticleStore` | 記事一覧・ページネーション | tab, articles, offset, hasMore |
| `useSearchStore` | AI検索 | searchQuery, searchResults, aiAnswer |
| `useReaderStore` | 記事リーダー | readerArticle, readerLoading |
| `useKeyboardStore` | キーボードナビ + ヘルプ | focusedIndex, showHelp |

### 3-2: UI コンポーネントライブラリ

```typescript
// Button.tsx — 全ボタンの基盤
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

// Modal.tsx — 全モーダルの基盤
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Card.tsx — DiscoverCard/AiringCard/GameReleaseCard の基盤
interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}
```

### 3-3: DiscoverCard 分割 (348行 → 4ファイル)

```
DiscoverCard.tsx (100行) — 外枠 + 状態管理のみ
├── CardHeader.tsx (40行) — ソース・時間・カテゴリ・ブックマーク
├── CardSummary.tsx (60行) — AI サマリー + 展開/折りたたみ
└── CardActions.tsx (30行) — もっと詳しく・開く・既読
```

### 3-4: スタイリング統一

**Before (inline style):**
```tsx
<div style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
```

**After (Tailwind + CSS変数):**
```tsx
<div className="bg-[var(--surface-container)] text-[var(--on-surface)]">
```

---

## Phase 4: テスト追加 (Day 5-6)

### 4-1: FE テスト

```
src/__tests__/
├── stores/
│   ├── useArticleStore.test.ts
│   ├── useSearchStore.test.ts
│   └── useFilterStore.test.ts
├── lib/
│   ├── textUtils.test.ts
│   ├── articleFilter.test.ts
│   └── sanitize.test.ts
└── hooks/
    └── useTauriCommand.test.ts
```

### 4-2: BE テスト追加

```rust
// 各サービスに #[cfg(test)] mod tests を追加
// 目標: scoring, dedup, fts, opml, discover queries
```

---

## Phase 5: UI/UX 仕上げ (Day 6-7)

### 5-1: Stitch デザイン完全適用

- Space Grotesk + Inter フォント適用
- Material Symbols Outlined アイコン導入
- グラスモーフィズム (backdrop-blur) 統一
- アニメーション: Framer Motion or CSS transitions

### 5-2: レスポンシブ対応

- サイドバー: モバイルではボトムナビに
- カードグリッド: 1-3カラム自動調整
- スケジュール: Week ビューのスクロール最適化

### 5-3: アクセシビリティ

- 全 `<button>` に `type="button"` (既存ルール)
- 全 `<svg>` に `aria-hidden="true"` (既存ルール)
- キーボードナビゲーション改善
- スクリーンリーダー対応 (aria-label)

---

## マイグレーション戦略

DB スキーマは変更なし (既存の 6 マイグレーションをそのまま使用)。
ユーザーデータ (記事・ブックマーク・プロフィール) は保持される。

---

## 品質ゲート (全フェーズ共通)

```bash
# Rust
cargo check
cargo test
cargo clippy -- -D warnings
cargo fmt --check

# TypeScript
npx tsc --noEmit
npm run check          # biome
npm run test           # vitest

# ファイルサイズ
find src/ src-tauri/src/ -name "*.tsx" -o -name "*.ts" -o -name "*.rs" \
  | xargs wc -l | awk '$1 > 200 {print "OVER 200:", $0}'
```

---

## ファイル数・行数目標

| 項目 | v2 現在 | v3 目標 |
|------|--------|--------|
| 総行数 | 13,900 | 10,000以下 |
| 200行超ファイル | 28 | 0 |
| FE テスト | 0 | 20+ |
| BE テスト | 67 | 100+ |
| コンポーネント数 | 34 | 45+ (粒度細分化) |
| ストア数 | 5 | 8 (責務分離) |

---

## 実装順序

```
v3-rebuild ブランチ作成
  ↓
Phase 1: プロジェクト基盤 (UI lib + hooks + CSS)
  ↓
Phase 2: BE リビルド (commands + services 分割)
  ↓
Phase 3: FE リビルド (stores + components)
  ↓
Phase 4: テスト追加
  ↓
Phase 5: UI/UX 仕上げ
  ↓
品質ゲート全通過 → master マージ → v3.0.0 タグ
```
