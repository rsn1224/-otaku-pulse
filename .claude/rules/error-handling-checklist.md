---
description: otaku-pulse エラーハンドリング（AppError 統一・silent error 排除・LLM エラーログ）
globs: "{src/**/*.{ts,tsx},src-tauri/src/**/*.rs}"
---

# エラーハンドリング チェックリスト（otaku-pulse）

## 背景

git log を分析すると「AppError 未統一」「silent error handling 排除」「LLM エラーログ追加」等の
修正が複数セッションで繰り返されている。このチェックリストは同じミスの再発防止を目的とする。

---

## Rust バックエンド

### 必須チェック項目

- [ ] **`unwrap()` / `expect()` を本番コードで使っていないか**
  - `Option` → `ok_or_else(|| AppError::Internal("..."))?`
  - `Result` → `?` 演算子を使う
  - テストコードのみ許可（理由コメント必須）

- [ ] **すべての `#[tauri::command]` が `Result<T, AppError>` を返しているか**
  - `()` や `T`（非Result）を返すコマンドは禁止

- [ ] **エラーに `AppError` の適切な variant を使っているか**
  - 新しいエラー種別が必要なら `error.rs` に variant を追加する
  - `AppError::Internal("...")` の乱用は禁止（種別を明確にする）

  | 状況 | 使う variant |
  |------|-------------|
  | DB クエリ失敗 | `AppError::Database` (From impl あり) |
  | HTTP 通信失敗 | `AppError::Http` (From impl あり) |
  | フィードパース失敗 | `AppError::FeedParse` |
  | レートリミット 429 | `AppError::RateLimit` |
  | LLM API エラー | `AppError::Llm` |
  | スケジューラ失敗 | `AppError::Scheduler` |
  | 入力バリデーション失敗 | `AppError::InvalidInput` |
  | その他 | `AppError::Internal` |

- [ ] **エラーを `tracing::error!` でログしているか（silent failure 禁止）**
  ```rust
  // NG: エラーを黙って握り潰す
  let _ = some_operation();
  if let Err(_) = result { return Ok(()); }
  
  // OK: ログしてから伝播または処理
  let result = some_operation().map_err(|e| {
      tracing::error!("操作失敗: {e}");
      AppError::Internal(e.to_string())
  })?;
  ```

- [ ] **`commands/` にエラー処理ロジックを書いていないか**
  - エラーの変換・ラップは `services/` または `infra/` で行う
  - `commands/` は `?` で伝播するだけ

---

## TypeScript フロントエンド

- [ ] **`invoke` 呼び出しが `src/lib/tauri-commands.ts` 経由になっているか**

- [ ] **`catch` ブロックで `console.error` でなく `logger.error` を使っているか**
  ```typescript
  // NG
  } catch (e) {
    console.error(e);
  }
  
  // OK
  } catch (e) {
    logger.error({ err: e }, 'コマンド失敗');
  }
  ```

- [ ] **`catch (e)` で `e` を `unknown` として扱っているか**
  ```typescript
  // NG: 型なしで直接 .message アクセス
  } catch (e: any) { alert(e.message); }
  
  // OK: extractErrorMessage ヘルパー経由
  } catch (e: unknown) {
    const msg = extractErrorMessage(e);
    logger.error({ err: e }, msg);
  }
  ```

- [ ] **エラーをユーザーに表示する際、スタックトレースや内部情報を露出していないか**

---

## コードレビュー時の確認コマンド

```bash
# Rust: unwrap 残存チェック（テスト外）
grep -rn "\.unwrap()\|\.expect(" src-tauri/src/ --include="*.rs" \
  | grep -v "#\[cfg(test)\]" | grep -v "// safe:"

# Rust: エラーを握り潰しているパターン検出
grep -rn "let _ = \|Err(_) =>" src-tauri/src/ --include="*.rs"

# TypeScript: console.error 残存チェック
grep -rn "console\.error\|console\.log" src/ --include="*.ts" --include="*.tsx"

# TypeScript: catch (e: any) チェック
grep -rn "catch (e: any)" src/ --include="*.ts" --include="*.tsx"
```

---

## 参考: AppError シリアライズ形式

```json
{ "kind": "database", "message": "no rows returned by a query that expected to return at least one row" }
```

フロントエンドでは常に `error.kind` と `error.message` の両方を参照できる。
