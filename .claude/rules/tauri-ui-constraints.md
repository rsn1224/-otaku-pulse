---
description: Tauri v2 WebView UI 固有の制約・CSS パターン・イベントシステム
globs: "src/**/*.{ts,tsx,css}"
---

# Tauri v2 WebView UI 制約

## ウィンドウ装飾とドラッグ領域

ネイティブタイトルバーを無効にした場合、ドラッグ移動のための要素に `data-tauri-drag-region` を付与する。

```tsx
// タイトルバー相当の要素にのみ付与（全画面NG）
<div data-tauri-drag-region className="h-8 flex items-center" />
```

**禁止:** メインコンテンツ領域に `data-tauri-drag-region` を付与しない（クリックイベントが奪われる）。

## スクロールバーのスタイリング

WebView は OS ネイティブスクロールバーを使うため、CSS でのカスタマイズが必要：

```css
/* Tailwind v4 の @layer utilities に追加 */
@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin; /* Firefox */
    scrollbar-color: var(--color-base-600) transparent; /* Firefox */
  }
  .scrollbar-thin::-webkit-scrollbar { width: 4px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: var(--color-base-600);
    border-radius: 2px;
  }
}
```

## CSS アニメーションと GPU 負荷

WebView での過度なアニメーションはシステムリソースを消費する。

- `transform` / `opacity` ベースのアニメーションのみ許可（GPU アクセラレーション）
- `width` / `height` / `margin` のアニメーションは禁止（CPU レイアウト再計算）
- `will-change: transform` は必要な要素のみ（VRAM 使用に注意）

## Tauri Event System

バックエンドからフロントエンドへのイベント送信は `emit` を使う。React hooks での受け取りパターン：

```typescript
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

function useBackendEvent<T>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    const unlisten = listen<T>(event, (e) => handler(e.payload));
    return () => { unlisten.then(fn => fn()); };
  }, [event, handler]);
}
```

**必須:** `useEffect` の cleanup で `unlisten` を呼ぶ（メモリリーク防止）。

## 右クリックメニュー

デフォルトでブラウザの右クリックメニューが表示される。本番環境では無効化が推奨：

```javascript
// src/main.tsx に追加
document.addEventListener('contextmenu', (e) => e.preventDefault());
```

ただし、テキスト選択が必要な箇所では選択的に有効化する。
