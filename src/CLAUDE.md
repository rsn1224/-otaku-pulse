# CLAUDE.md — フロントエンド層

<!-- src/ 配下のファイルを編集中に自動ロードされる -->

## ディレクトリ構成

```
src/
├── components/   — 再利用可能なUIコンポーネント（1コンポーネント1責務）
├── hooks/        — カスタムフック（UIロジックの分離）
├── lib/          — ユーティリティ・共通ロジック
├── stores/       — Zustandストア（ドメインごとに分割）
├── types/        — TypeScript型定義（共通利用型）
└── styles/       — グローバルスタイル（Tailwind CSS v4）
```

## 重要ルール（詳細は `.claude/rules/typescript.md` 参照）

- **`invoke` 集約** — Tauri呼び出しは必ず `src/lib/tauri-commands.ts` に集約
- **named export のみ** — `export default` 禁止
- **`any` 型禁止** — `unknown` + 型ガードを使う
- **`console.log` 禁止** — pino ロガーを使う
- **Zustand** — `src/stores/` 内でドメインごとに分割。Context API はDI目的のみ

## コンポーネント設計原則

```tsx
// OK: 関数宣言 + named export
export function FeedCard({ feed }: { feed: Feed }) {
  return <div className="...">...</div>  // Tailwindのみ
}

// NG
const FeedCard: React.FC<...> = ...      // React.FC 禁止
export default FeedCard                  // default export 禁止
const el = <div style={{ color: 'red' }}>  // inline style 禁止
```

## コマンド

```bash
npm run dev         # Vite dev server
npm run check       # Biome lint + format check
npm run typecheck   # tsc --noEmit
```

## 4 Wings 局所ルール

| Wing | 主要コンポーネント | Zustand Store |
|------|-----------------|--------------|
| Dashboard | ガラスカード・概要パネル | `useFeedStore` |
| Feed | フィードリスト・記事カード | `useFeedStore` |
| Digest | AI要約・ダイジェスト | `useDigestStore` |
| Settings | 設定フォーム | `useSettingsStore` |
