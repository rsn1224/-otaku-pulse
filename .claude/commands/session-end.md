# /session-end — セッション終了時の構造化振り返り

以下の 6 ステップを順番に実行してください。

## Step 1: セッション棚卸し

今回のセッションで行った作業を 5 行以内でまとめる。

## Step 2: 技術判断の記録

プロジェクト全体に影響する設計判断があれば、CLAUDE.md の ARCHITECTURAL DECISIONS に追記する。
フォーマット: `#### [YYYY-MM-DD] 決定内容` — ��択 / 理由 / 却下案（各1行）
**判断基準**: 6ヶ月後に「なぜこうした？」と聞かれそうな決定のみ。日常的な実装選択は不要。

## Step 3: ミスからの学習

繰り返しパターンのあるエラー・失敗アプローチがあれば、CLAUDE.md の LEARNED RULES に��記する。
フォーマット: `#### [YYYY-MM-DD] タイトル` — NEVER/ALWAYS + なぜ + コード例（3行以内）
**判断基準**: 偶発的な1回限りのミスは不要。パターン化されたものだけ記録。

## Step 4: reflector エージェント委譲

`.claude/agents/reflector.md` の手順に従い、`.claude/rules/` の該当ファイルを更新する。

## Step 5: SESSION CONTINUITY 更新

CLAUDE.md の SESSION CONTINUITY セクションを更新する:
- 今回の作業内容
- 次回最初にやるべきこと
- ブロッカーになっている未解決問題

## Step 6: メモリシステム同期

今回のセッションで発見した「プロジェクト外の知見」（ユーザーの好み、外部ツール情報等）があれば、
`~/.claude/projects/c--dev-otaku-pulse/memory/` に保存する。

**最後に**: 振り返りサマリーを日本語で報告する。CLAUDE.md の更新差分を明示すること。
