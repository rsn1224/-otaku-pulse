# TypeScript / React 規約

<!-- OtakuPulse 専用: React 19 + TypeScript strict + Tailwind v4 + Zustand v5 + Biome v2 -->

## 🔴 絶対禁止
- `any` 型禁止 → `unknown` + 型ガードを使用する
- `console.log` 禁止 → pino を使用する
- インラインスタイル禁止 → Tailwind CSS class のみ
- default export 禁止 → named export のみ使用する
- `as` キャストによる型回避禁止

## 🟡 Tauri インテグレーション
- Tauriの `invoke` 呼び出しはすべて `src/lib/tauri-commands.ts` に集約する
- コンポーネント内で直接 `invoke` しないこと
- `invoke` の戳と返値型は必ず型定義する

```typescript
// OK: src/lib/tauri-commands.ts に集約
export async function fetchFeeds(): Promise<Feed[]> {
  return await invoke<Feed[]>('fetch_feeds');
}

// NG: コンポーネント内直接 invoke
import { invoke } from '@tauri-apps/api/core'; // コンポーネント内禁止
```

## 🟡 状態管理（Zustand v5）
- ストアはドメインごとに分割する（`useFeedStore`, `useDigestStore`, `useSettingsStore`等）
- 1つのストアが50行を超えたらスライス分割を検討する
- Context API はDI目的のみ使用する（状態管理には使わない）

## 🟡 コンポーネント設計
- 1コンポーネント1責務の原則を守る
- `React.FC` 使用禁止 → 関数宣言を使用する

```typescript
// OK
export function FeedCard({ feed }: { feed: Feed }) { ... }

// NG
const FeedCard: React.FC<{ feed: Feed }> = ({ feed }) => { ... }
export default FeedCard; // default export 也禁止
```

- `useEffect` は副作用目的のみ使用する（データフェッチには使わない）

## 🟢 パフォーマンス
- 再レンダリングが問題になった場合のみ `React.memo` / `useMemo` / `useCallback` を使用する（激単な先貸り最適化をしない）
- 大きなリストレンダリングには `react-virtual` などの仮想化を検討する

## 📝 セッション学習メモ（Claude Code が追記）
<!-- 上記ルール通りにしたら解決した事例や新は発見をここに蓄積 -->
