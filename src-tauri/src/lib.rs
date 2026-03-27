mod commands;
mod error;
mod infra;
mod models;
mod parsers;
mod services;
mod state;

pub use error::AppError;

use tauri::Manager;
use tracing_subscriber::{EnvFilter, fmt};

/// セットアップロジック本体。エラーは `?` 演算子で伝播する。
/// WebView がマウントされる前に呼ばれるため、エラー表示は呼び出し元の
/// OS ネイティブダイアログに委ねる（D-01, D-02, D-03）。
fn run_setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("OtakuPulse starting up");

    let app_data_dir = app.path().app_data_dir().map_err(|e| {
        tracing::error!(error = %e, "致命的: app_data_dir 取得失敗");
        Box::<dyn std::error::Error>::from(
            format!("アプリのデータフォルダが取得できませんでした: {e}")
        )
    })?;

    if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
        tracing::warn!(path = %app_data_dir.display(), error = %e, "Failed to create app data dir");
    }
    let db_path = app_data_dir.join("otaku_pulse.db");

    // Use block_on for async DB init inside sync setup closure
    let db_pool = tauri::async_runtime::block_on(async {
        infra::database::init_pool(&db_path).await
    })
    .map_err(|e| {
        tracing::error!(error = %e, "致命的: データベース初期化失敗");
        Box::<dyn std::error::Error>::from(
            format!("データベースの初期化に失敗しました: {e}")
        )
    })?;

    let db_arc = std::sync::Arc::new(db_pool);
    app.manage((*db_arc).clone());

    let http_client = infra::http_client::build_http_client();
    let http_arc = http_client.clone();
    app.manage(http_client);

    let app_state = state::AppState::new(db_arc, http_arc);

    // Load persisted API key from OS credential store
    match infra::credential_store::load_credential(
        infra::credential_store::PERPLEXITY_ACCOUNT,
    ) {
        Ok(Some(key)) => {
            // D-11: lock poisoning は map_err でハンドリングし、panic しない
            let mut llm = app_state.llm.write().map_err(|e| {
                Box::<dyn std::error::Error>::from(
                    format!("LLM 設定の書き込みロックが汚染されています: {e}")
                )
            })?;
            llm.perplexity_api_key = Some(key);
            tracing::info!("Perplexity API key loaded from credential store");
        }
        Ok(None) => {
            tracing::debug!("No Perplexity API key found in credential store");
        }
        Err(e) => {
            tracing::warn!(error = %e, "Failed to load API key from credential store");
        }
    }

    let app_state_for_scheduler = app_state.clone();
    app.manage(app_state);

    // 起動時にキャッシュクリーンアップ
    let db_for_cleanup = app_state_for_scheduler.db.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = crate::services::deepdive_service::cleanup_expired_cache(&db_for_cleanup).await {
            tracing::warn!(error = %e, "Failed to clean up deepdive cache");
        }
    });

    // スケジューラーを起動
    let scheduler_config = crate::services::scheduler::SchedulerConfig::default();
    crate::services::scheduler::start(
        app.handle().clone(),
        scheduler_config,
        app_state_for_scheduler.db.clone(),
        app_state_for_scheduler.http.clone(),
        app_state_for_scheduler,
    );

    Ok(())
}

/// Application entry point. Called from main.rs.
pub fn run() {
    // Initialize structured logging (tracing)
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
            tracing::info!("Another instance attempted to launch; focusing existing window");
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // D-02: セットアップが失敗した場合、WebView がマウントされる前に
            // OS ネイティブダイアログでエラーを表示してからアプリを終了する
            if let Err(e) = run_setup(app) {
                rfd::MessageDialog::new()
                    .set_level(rfd::MessageLevel::Error)
                    .set_title("致命的なエラー")
                    .set_description(&format!("OtakuPulse 起動エラー\n\n{e}"))
                    .show();
                return Err(e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Collection
            commands::collect::run_collect_now,
            commands::collect::init_default_feeds,
            // Articles
            commands::articles::mark_read,
            // Feeds
            commands::feed::refresh_feed,
            commands::feed::get_feeds,
            commands::feed::reenable_feed,
            commands::feed::toggle_bookmark,
            commands::feed::export_opml,
            commands::feed::import_opml,
            commands::feed::get_article_detail,
            commands::feed::delete_feed,
            commands::feed::cleanup_old_articles,
            commands::feed::get_bookmarked_articles,
            // LLM
            commands::llm::get_llm_settings,
            commands::llm::set_llm_provider,
            commands::llm::set_perplexity_api_key,
            commands::llm::clear_perplexity_api_key,
            commands::llm::set_ollama_settings,
            commands::llm::check_ollama_status,
            // Digest
            commands::digest::get_digests,
            commands::digest::get_latest_digest,
            commands::digest::delete_digest,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_setting,
            // Scheduler
            commands::scheduler::get_scheduler_config,
            commands::scheduler::set_scheduler_config,
            commands::scheduler::run_digest_now,
            // Schedule
            commands::schedule::get_airing_schedule,
            commands::schedule::get_game_releases,
            commands::schedule::set_rawg_api_key,
            commands::schedule::clear_rawg_api_key,
            commands::schedule::is_rawg_api_key_set,
            // Filters
            commands::filters::get_keyword_filters,
            commands::filters::add_keyword_filter,
            commands::filters::remove_keyword_filter,
            // Discover (feed / interactions / unread)
            commands::discover::get_discover_feed,
            commands::discover::get_library_articles,
            commands::discover::record_interaction,
            commands::discover::rescore_articles,
            commands::discover::get_unread_counts,
            commands::discover::mark_all_read_category,
            commands::discover::get_related_articles,
            // Discover AI (summary / deepdive / search)
            commands::discover_ai::get_or_generate_summary,
            commands::discover_ai::get_deepdive_questions,
            commands::discover_ai::ask_deepdive,
            commands::discover_ai::get_daily_highlights,
            commands::discover_ai::batch_generate_summaries,
            commands::discover_ai::get_trending_keywords,
            commands::discover_ai::ai_search,
            commands::discover_ai::search_discover,
            // Discover Profile (profile / preferences)
            commands::discover_profile::get_user_profile,
            commands::discover_profile::update_user_profile,
            commands::discover_profile::reset_learning_data,
            commands::discover_profile::adjust_feed_preference,
            commands::discover_profile::suggest_preferences,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!(error = %e, "Failed to run OtakuPulse");
            panic!("Failed to run OtakuPulse: {e}");
        });
}
