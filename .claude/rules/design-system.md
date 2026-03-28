# デザインシステム規約

## CSS 変数命名パターン

OtakuPulse は Material Design 3 の命名体系に準拠する。

| パターン | 用途 | 例 |
|----------|------|-----|
| `--surface-*` | 背景色 | `--surface`, `--surface-container` |
| `--on-surface-*` | テキスト色 | `--on-surface`, `--on-surface-variant` |
| `--primary-*` | アクセント色 | `--primary`, `--primary-soft`, `--primary-glow` |
| `--outline-*` | ボーダー・区切り | `--outline`, `--outline-variant` |
| `--surface-hover-*` | ホバーオーバーレイ | `--surface-hover`, `--surface-hover-strong` |
| `--shadow-*` | ドロップシャドウ | `--shadow-md`, `--shadow-lg` |

新しい CSS 変数を追加する場合は、この命名パターンに従うこと。

## 禁止パターン

| 禁止 | 代替 |
|------|------|
| ハードコード HEX/RGB (`#bd9dff`, `rgba(...)`) | CSS 変数 (`--primary`) |
| Tailwind デフォルトカラー (`blue-500`, `gray-200`) | CSS 変数 (`--secondary`, `--outline`) |
| インラインスタイル (`style={{ }}`) | Tailwind クラス |
| Legacy aliases を新規コードで使用 | 推奨トークン（`design.md` の対応表参照） |
| ライトモード分岐 (`dark:`, `@media (prefers-color-scheme)`) | ダーク専用 |

## Legacy Aliases 移行ルール

`globals.css` の Legacy aliases セクションは Phase 3 で削除予定。
新規コードでは使用禁止。既存コードは見つけ次第、推奨トークンに置換する。

```css
/* NG: Legacy alias */
color: var(--text-primary);
background: var(--bg-card);

/* OK: 推奨トークン */
color: var(--on-surface);
background: var(--surface-container);
```

Tailwind 記法でも同様:

```tsx
// NG
className="text-(--text-primary) bg-(--bg-card)"

// OK
className="text-(--on-surface) bg-(--surface-container)"
```

## カスタム UI コンポーネント設計原則

`src/components/ui/` のコンポーネントに適用:

- **Props 型を interface で定義し export する**（`interface ButtonProps extends ...`）
- **forwardRef** が必要な場合は使用（Input 等のフォーム要素）
- **displayName** を forwardRef コンポーネントに設定
- **variant/size パターン**: `as const` オブジェクトでクラスマッピングを定義
- **className prop** を受け取り、末尾に追加してカスタマイズ可能にする
- **アクセシビリティ**: `role`, `aria-*` 属性を適切に設定
- **`React.FC` 禁止**: 関数宣言または `const` + アロー関数を使用

## Stitch / Figma MCP ワークフロー

→ グローバルルール `~/.claude/rules/design-workflow.md` に準拠する
