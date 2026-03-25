use sqlx::SqlitePool;
use crate::error::AppError;
use crate::infra::llm_client::{LlmClient, LlmRequest};
use crate::services::digest_queries;

#[derive(serde::Serialize)]
pub struct DigestResult {
    pub category: String,
    pub summary: String,
    pub article_count: usize,
    pub generated_at: String,
    pub is_ai_generated: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub fallback_reason: Option<String>,
}

/// ダイジェストを生成する（フォールバック付き）
pub async fn generate(
    db: &SqlitePool,
    client: &dyn LlmClient,
    category: &str,
    _hours: i64,
) -> Result<DigestResult, AppError> {
    // 1. DBから直近hours時間の記事を取得（最大10件、published_at DESC）
    let articles = digest_queries::unsummarized_articles(db, category, 10).await?;
    
    // 2. 記事が0件 → stubを返す
    if articles.is_empty() {
        return Ok(create_stub_digest(category, 0, Some("記事がありません".to_string())));
    }
    
    // 3. LlmClient::complete()を呼ぶ
    let system_prompt = build_system_prompt(category);
    let user_prompt = build_user_prompt(&articles);
    
    let request = LlmRequest {
        system_prompt,
        user_prompt,
        max_tokens: 1000,
    };
    
    match client.complete(request).await {
        Ok(response) => {
            // 4. 成功時 → AI生成済みダイジェスト
            Ok(DigestResult {
                category: category.to_string(),
                summary: response.content,
                article_count: articles.len(),
                generated_at: chrono::Utc::now().to_rfc3339(),
                is_ai_generated: true,
                provider: Some(format!("{:?}", response.provider)),
                model: Some(response.model),
                fallback_reason: None,
            })
        }
        Err(e) => {
            // 4. 失敗時 → tracing::warn!でログ → stubにフォールバック
            tracing::warn!("LLM生成失敗（{}）: {}", category, e);
            Ok(create_stub_digest(category, articles.len(), Some(format!("AI生成失敗: {}", e))))
        }
    }
}

fn create_stub_digest(category: &str, article_count: usize, fallback_reason: Option<String>) -> DigestResult {
    let summary = match category {
        "anime" => "・新作アニメ情報が更新されました\n・人気シリーズの最新話が配信開始\n・声優関連ニュースが話題に",
        "manga" => "・連載漫画の最新刊が発売\n・新人作家のデビュー作が注目\n・電子書籍限定コンテンツ追加",
        "game" => "・新作タイトルの発売情報\n・人気ゲームのアップデート実施\n・eスポーツ大会の開催決定",
        "pc" => "・最新PCパーツの価格動向\n・新グラフィックボード発表\n・ソフトウェアのセキュリティ更新",
        _ => "関連ニュースが複数報道されています",
    };
    
    DigestResult {
        category: category.to_string(),
        summary: summary.to_string(),
        article_count,
        generated_at: chrono::Utc::now().to_rfc3339(),
        is_ai_generated: false,
        provider: None,
        model: None,
        fallback_reason,
    }
}

fn build_system_prompt(category: &str) -> String {
    format!(
        "あなたはアニメ・ゲーム情報のキュレーターです。\
         提供されたニュース記事のタイトルとサマリーを読み、\
         日本語で簡潔なダイジェストを生成してください。\
         カテゴリ: {}。\
         箇条書きで上位3〜5件の重要ニュースをまとめてください。\
         各項目は「・タイトル: 内容の要点」の形式で記述してください。",
        category
    )
}

fn build_user_prompt(articles: &[crate::models::Article]) -> String {
    articles
        .iter()
        .take(10)
        .map(|article| {
            if let Some(ref summary) = article.summary {
                format!("・{}: {}", article.title, summary)
            } else {
                format!("・{}", article.title)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}
