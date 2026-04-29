---
description: otaku-pulse 固有 TypeScript / React 規約（共通は workspace typescript-common.md 参照）
globs: "src/**/*.{ts,tsx}"
---

# TypeScript / React 規約

<!-- OtakuPulse 専用: React 19 + TypeScript strict + Tailwind v4 + Zustand v5 + Biome v2 -->

## 🔴 絶対禁止（otaku-pulse 固有追加）

> 共通禁止（`any` / `console.log` / インラインスタイル / `default export` / `@ts-ignore` / `React.FC`）は
> グローバル `typescript-common.md` を参照。

- `as` キャストによる型回避禁止
- `console.log` 禁止 → **pino を使用する**（`// DEBUG:` コメント置換ではなく pino 必須）

## 🟡 Tauri インテグレーション（invoke ラッパーの配置先）

> グローバル `typescript-common.md` の invoke ラッパー規約に従う。
> otaku-pulse のラッパーは `src/lib/tauri-commands.ts` に集約する。

```typescript
// OK: src/lib/tauri-commands.ts に集約
export async function fetchFeeds(): Promise<Feed[]> {
  return await invoke<Feed[]>('fetch_feeds');
}
```

- `invoke` の引数と返値型は必ず型定義する

## 🟡 状態管理（Zustand v5）
- ストアはドメインごとに分割する（`useFeedStore`, `useDigestStore`, `useSettingsStore`等）
- 1つのストアが50行を超えたらスライス分割を検討する
- Context API はDI目的のみ使用する（状態管理には使わない）

## 🟡 コンポーネント設計
- 1コンポーネント1責務の原則を守る
- `useEffect` は副作用目的のみ使用する（データフェッチには使わない）

## 🟢 パフォーマンス
- 再レンダリングが問題になった場合のみ `React.memo` / `useMemo` / `useCallback` を使用する（早期最適化禁止）
- 大きなリストレンダリングには `react-virtual` などの仮想化を検討する

## 📝 セッション学習メモ（Claude Code が追記）
<!-- 上記ルール通りにしたら解決した事例や新発見をここに蓄積 -->
