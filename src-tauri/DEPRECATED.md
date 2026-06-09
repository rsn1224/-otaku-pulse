# DEPRECATED — src-tauri (Tauri v2 + Rust)

OtakuPulse は **Node/TypeScript + ブラウザ**構成へ移行しました → [ADR-0002](../docs/adr/0002-platform-node-browser.md)。

このディレクトリ（Rust バックエンド + Tauri シェル）は **凍結**されています:

- ビルド対象外。バックエンドは `server/`（Node + Fastify + `node:sqlite`）が担います。
- フロントは同一スタックのまま、`src/lib/api.ts`（fetch）/ `src/lib/events.ts`（SSE）経由で `server/` に接続。
- 参照用に残置（移植元として有用）。安定稼働後の削除はユーザー判断（破壊的操作のため自動実行しない）。

## 起動（新スタック）

```
launch\start-otakupulse.cmd      # 本番: SPA ビルド + サーバ起動 + ブラウザ
launch\dev.cmd                   # 開発: Vite(1420) + Node(5180)
```

→ `http://localhost:5180`
