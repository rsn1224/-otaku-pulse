use super::llm::{as_llm_client, build_llm_client, clone_llm_settings};
use crate::error::CmdResult;
use crate::models::UserProfileDto;
use crate::services::{personal_scoring, profile_service};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_user_profile(state: tauri::State<'_, AppState>) -> CmdResult<UserProfileDto> {
    profile_service::get_profile(&state.db).await
}

#[tauri::command]
pub async fn update_user_profile(
    state: tauri::State<'_, AppState>,
    profile: UserProfileDto,
) -> CmdResult<()> {
    profile_service::update_profile(&state.db, &profile).await?;
    personal_scoring::rescore_all(&state.db).await?;
    Ok(())
}

#[tauri::command]
pub async fn reset_learning_data(state: tauri::State<'_, AppState>) -> CmdResult<()> {
    profile_service::reset_learning_data(&state.db).await
}

// ---------------------------------------------------------------------------
// Feed Preference
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn adjust_feed_preference(
    state: tauri::State<'_, AppState>,
    feed_id: i64,
    delta: f64,
) -> CmdResult<()> {
    profile_service::adjust_feed_preference(&state.db, feed_id, delta).await
}

// ---------------------------------------------------------------------------
// Preference Suggestions (AI)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferenceSuggestion {
    pub suggested_titles: Vec<String>,
    pub suggested_genres: Vec<String>,
    pub suggested_creators: Vec<String>,
    pub reason: String,
}

fn parse_json_string_array(value: &serde_json::Value, key: &str) -> Vec<String> {
    value[key]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn suggest_preferences(
    state: tauri::State<'_, AppState>,
) -> CmdResult<PreferenceSuggestion> {
    let stats = profile_service::get_interaction_stats(&state.db).await?;
    let top_titles = profile_service::get_top_interaction_titles(&state.db, 20).await?;

    if top_titles.is_empty() {
        return Ok(PreferenceSuggestion {
            suggested_titles: vec![],
            suggested_genres: vec![],
            suggested_creators: vec![],
            reason: "まだ十分な閲覧データがありません".to_string(),
        });
    }

    let stats_text = stats
        .iter()
        .map(|(cat, cnt)| format!("{}: {}件", cat, cnt))
        .collect::<Vec<_>>()
        .join(", ");

    let titles_text = top_titles.join("\n");

    let settings = clone_llm_settings(&state)?;
    let client = build_llm_client(&settings, &state.http)?;

    let req = crate::infra::llm_client::LlmRequest::simple(
        "ユーザーの閲覧行動データから趣味嗜好を推定してください。\
         JSON形式で返してください:\n\
         {\"titles\": [\"作品名1\", \"作品名2\"], \"genres\": [\"ジャンル1\"], \"creators\": [\"クリエイター名1\"], \"reason\": \"推定理由\"}\n\
         各配列は3件以内。reason は20文字以内。"
            .to_string(),
        format!(
            "カテゴリ別閲覧数: {}\n\nブックマーク/深堀りした記事:\n{}",
            stats_text, titles_text
        ),
        300,
    );

    let response = as_llm_client(&client).complete(req).await;

    match response {
        Ok(resp) => {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&resp.content) {
                let reason = parsed["reason"]
                    .as_str()
                    .unwrap_or("行動パターンから推定")
                    .to_string();
                return Ok(PreferenceSuggestion {
                    suggested_titles: parse_json_string_array(&parsed, "titles"),
                    suggested_genres: parse_json_string_array(&parsed, "genres"),
                    suggested_creators: parse_json_string_array(&parsed, "creators"),
                    reason,
                });
            }
            Ok(PreferenceSuggestion {
                suggested_titles: vec![],
                suggested_genres: vec![],
                suggested_creators: vec![],
                reason: "推定に失敗しました".to_string(),
            })
        }
        Err(_) => Ok(PreferenceSuggestion {
            suggested_titles: vec![],
            suggested_genres: vec![],
            suggested_creators: vec![],
            reason: "AI 接続エラー".to_string(),
        }),
    }
}
