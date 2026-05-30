//! ダイジェスト Markdown エクスポート (機能E)
//!
//! 設定 `digest_export_enabled` が有効なとき、生成済みダイジェストを
//! `<dir>/<YYYY-MM-DD>/<category>_<id>.md` として書き出して蓄積する。
//! `digest_export_dir` が空文字なら `<app_data_dir>/digests` を既定の出力先とする。
//!
//! 書き出し失敗は呼び出し元の処理を止めない (warn ログのみ)。設定値は
//! lib.rs の `strip_json_quotes` と同じく JSON クォートを剥がして解釈する。

use crate::error::AppError;
use crate::models::Digest;
use crate::services::settings_queries;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

const SETTING_ENABLED: &str = "digest_export_enabled";
const SETTING_DIR: &str = "digest_export_dir";

/// 設定が有効ならダイジェストを Markdown として書き出す。
///
/// - `default_base_dir`: `digest_export_dir` が空のときの基準ディレクトリ (通常 app_data_dir)
/// - 戻り値 `Ok(Some(path))` = 書き出し成功 / `Ok(None)` = 無効でスキップ
pub async fn export_if_enabled(
    db: &SqlitePool,
    default_base_dir: &Path,
    digest: &Digest,
) -> Result<Option<PathBuf>, AppError> {
    let settings = settings_queries::load_settings(db).await?;

    let enabled = settings
        .get(SETTING_ENABLED)
        .map(|v| is_truthy(&strip_quotes(v)))
        .unwrap_or(false);
    if !enabled {
        return Ok(None);
    }

    let dir_setting = settings
        .get(SETTING_DIR)
        .map(|v| strip_quotes(v))
        .unwrap_or_default();

    let base = if dir_setting.trim().is_empty() {
        default_base_dir.join("digests")
    } else {
        PathBuf::from(dir_setting.trim())
    };

    let path = write_digest(&base, digest).await?;
    Ok(Some(path))
}

/// ファイル I/O は async ランタイムをブロックしないよう `tokio::fs` を使う
/// (`rust-conventions.md`: async 内で std::fs を直接使わない)。
async fn write_digest(base: &Path, digest: &Digest) -> Result<PathBuf, AppError> {
    let date = digest.generated_at.get(0..10).unwrap_or("undated");
    let dir = base.join(date);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| AppError::Internal(format!("digest export: create_dir failed: {e}")))?;

    let file = dir.join(format!("{}_{}.md", sanitize(&digest.category), digest.id));
    tokio::fs::write(&file, render_markdown(digest))
        .await
        .map_err(|e| AppError::Internal(format!("digest export: write failed: {e}")))?;

    Ok(file)
}

fn render_markdown(digest: &Digest) -> String {
    format!(
        "# {title}\n\n\
         - category: `{category}`\n\
         - generated_at: {generated_at}\n\
         - model: {model}\n\n\
         ---\n\n\
         {body}\n",
        title = digest.title,
        category = digest.category,
        generated_at = digest.generated_at,
        model = digest.model_used.as_deref().unwrap_or("-"),
        body = digest.content_markdown,
    )
}

/// JSON クォート (`"..."`) を剥がす。lib.rs の strip_json_quotes と同等。
fn strip_quotes(s: &str) -> String {
    let t = s.trim();
    t.strip_prefix('"')
        .and_then(|t| t.strip_suffix('"'))
        .unwrap_or(t)
        .to_string()
}

fn is_truthy(s: &str) -> bool {
    matches!(s.trim(), "1" | "true" | "TRUE" | "True")
}

/// ファイル名に使えない文字を `_` に置換する。
fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::test_helpers::setup_test_db;

    fn sample_digest() -> Digest {
        Digest {
            id: 42,
            category: "tech".to_string(),
            title: "テックダイジェスト".to_string(),
            content_markdown: "・記事A\n・記事B".to_string(),
            content_html: None,
            article_ids: "1,2".to_string(),
            model_used: Some("qwen3:14b".to_string()),
            token_count: None,
            generated_at: "2026-05-29T08:00:00+00:00".to_string(),
        }
    }

    #[test]
    fn strip_quotes_handles_json_and_raw() {
        assert_eq!(strip_quotes("\"1\""), "1");
        assert_eq!(strip_quotes("1"), "1");
        assert_eq!(strip_quotes("  \"/tmp/x\"  "), "/tmp/x");
    }

    #[test]
    fn is_truthy_only_for_enabled_values() {
        assert!(is_truthy("1"));
        assert!(is_truthy("true"));
        assert!(!is_truthy("0"));
        assert!(!is_truthy(""));
    }

    #[test]
    fn render_markdown_contains_body_and_meta() {
        let md = render_markdown(&sample_digest());
        assert!(md.contains("# テックダイジェスト"));
        assert!(md.contains("category: `tech`"));
        assert!(md.contains("・記事A"));
    }

    #[tokio::test]
    async fn export_skips_when_disabled() {
        let db = setup_test_db().await;
        settings_queries::upsert_setting(&db, SETTING_ENABLED.into(), "0".into())
            .await
            .unwrap();
        let tmp = std::env::temp_dir().join("otaku_export_disabled_test");
        let result = export_if_enabled(&db, &tmp, &sample_digest())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn export_writes_file_when_enabled() {
        let db = setup_test_db().await;
        settings_queries::upsert_setting(&db, SETTING_ENABLED.into(), "1".into())
            .await
            .unwrap();
        settings_queries::upsert_setting(&db, SETTING_DIR.into(), String::new())
            .await
            .unwrap();

        let tmp = std::env::temp_dir().join("otaku_export_enabled_test");
        let _ = std::fs::remove_dir_all(&tmp);

        let path = export_if_enabled(&db, &tmp, &sample_digest())
            .await
            .unwrap()
            .expect("export should produce a path");

        assert!(path.exists());
        let body = std::fs::read_to_string(&path).unwrap();
        assert!(body.contains("テックダイジェスト"));
        assert!(path.ends_with("tech_42.md"));

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
