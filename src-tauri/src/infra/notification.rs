use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_important_article(app: &AppHandle, title: &str, summary: &str) {
    if let Err(e) = app
        .notification()
        .builder()
        .title(title)
        .body(summary)
        .show()
    {
        tracing::warn!("Failed to send notification: {}", e);
    }
}

pub fn notify_digest_ready(app: &AppHandle, category: &str, article_count: usize) {
    if let Err(e) = app
        .notification()
        .builder()
        .title(format!("{}ダイジェスト完成", category))
        .body(format!("{}件の記事を要約しました", article_count))
        .show()
    {
        tracing::warn!("Failed to send notification: {}", e);
    }
}
