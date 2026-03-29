# /self-improve — CLAUDE.md 定期最適化

CLAUDE.md の包括的な自己最適化を実行してください。

## Step 1: サイズ監査

`wc -c CLAUDE.md` でサイズを確認。20KB 超なら圧縮が必要。
GSD 挿入ブロック（`<!-- GSD:*-start -->`）が再膨張していないか確認する。

## Step 2: LEARNED RULES 整理

- 10件超: 古いルールを `.claude/rules/learned-archive.md` にアーカイブ
- コードベースに既に定着したルール: `.claude/rules/` の該当ファイルに昇格させ、LEARNED RULES から削除
- 重複・矛盾するルール: 統合

## Step 3: ARCHITECTURAL DECISIONS 整理

- 5件超: `docs/adr/` に ADR として正式化し、CLAUDE.md からは参照のみ残す
- 既に覆された決定: Deprecated マークを付与

## Step 4: ルールファイル検証

`.claude/rules/` の各ファイルについて:
- ルールに反するパターンがコードベースに存在しないか `grep` で確認
- 陳腐化したルールに更新提案

## Step 5: 品質チェック

- LEARNED RULES の各エントリが 3 行以内か
- ARCHITECTURAL DECISIONS の各エ���トリが 4 行以内か
- SESSION CONTINUITY が最新か
- メタ認知ルールと LEARNED RULES に矛盾がないか

## Step 6: レポート

追加・削除・更新した件数のサマリーを日本語で報告する。
