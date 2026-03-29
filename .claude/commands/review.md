# /review — フルスタックコードレビュー（Agent Teams 対応）

以下のステップでフロントエンドとバックエンドのコードレビューを **並列実行** してください。

## 並列レビュー（Agent tool で同時起動）

1. **rust-reviewer** エージェントを起動 → `src-tauri/` 配下の変更ファイル
2. **ts-reviewer** エージェントを起動 → `src/` 配下の変更ファイル

両エージェントは独立したコンテキストで同時実行すること（Agent Teams パターン）。

## 統合レポート

両エージェントの結果を統合し:
- **Critical → Warning → Suggestion** の順で日本語でまとめる
- クロスレイヤーの問題（型の不一致、コマンド登録漏れ等）を別途指摘する
- `CLAUDE.md` の完了要件チェックリスト（lint/typecheck/clippy/test）を確認する

**対象**: $ARGUMENTS（未指定の場合は `git diff --name-only HEAD~1` の変更ファイル）
