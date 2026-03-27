# /review — フルスタックコードレビュー

以下のステップでフロントエンドとバックエンドのコードレビューを並列実行してください。

1. **rust-reviewer エージェントを起動**して `src-tauri/` 配下の変更ファイルをレビューする
2. **ts-reviewer エージェントを起動**して `src/` 配下の変更ファイルをレビューする
3. 両エージェントの結果を統合し、**Critical → Warning → Suggestion** の順で日本語でまとめる
4. `CLAUDE.md` の完了要件チェックリスト（lint/typecheck/clippy/test）を確認する

**対象**: $ARGUMENTS（未指定の場合は直近の変更ファイル全体）
