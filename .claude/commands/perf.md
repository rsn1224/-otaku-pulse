# /perf — パフォーマンス調査

`.claude/rules/rust-perf.md` のルールを展開して、以下を実行してください。

1. `cargo clippy -- -W clippy::perf` を実行してパフォーマンス警告を取得する
2. 対象ファイルで `.clone()` `Vec::new()` `unwrap()` `HashMap::new()` のホットパス使用を grep で列挙する
3. `Arc<Mutex<T>>` で置き換え可能な `DashMap` 候補を指摘する
4. 優先度（高・中・低）を付けて日本語で改善提案を返す
5. コードは変更しない。提案のみ行う。

**対象**: $ARGUMENTS（未指定の場合は `src-tauri/src/` 全体）
