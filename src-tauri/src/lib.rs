mod commands;
mod error;
mod infra;
mod models;
mod parsers;
mod services;
mod state;

pub use error::AppError;

use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

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
        .setup(|app| {
            tracing::info!("OtakuPulse starting up");

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("otaku_pulse.db");

            // Use block_on for async DB init inside sync setup closure
            let db_pool = tauri::async_runtime::block_on(async {
                infra::database::init_pool(&db_path).await
            })
            .expect("Failed to initialize database");

            let db_arc = std::sync::Arc::new(db_pool);
            app.manage((*db_arc).clone());

            let http_client = infra::http_client::build_http_client();
            let http_arc = http_client.clone();
            app.manage(http_client);

            let app_state = state::AppState::new(db_arc, http_arc);
            let app_state_for_scheduler = app_state.clone();
            app.manage(app_state);

            // スケジューラーを起動
            let scheduler_config = crate::services::scheduler::SchedulerConfig::default();
            crate::services::scheduler::start(
                app.handle().clone(),
                scheduler_config,
                app_state_for_scheduler.db.clone(),
                app_state_for_scheduler.http.clone(),
            );

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
            // LLM
            commands::llm::get_llm_settings,
            commands::llm::set_llm_provider,
            commands::llm::set_perplexity_api_key,
            commands::llm::set_ollama_settings,
            commands::llm::check_ollama_status,
            // Scheduler
            commands::scheduler::get_scheduler_config,
            commands::scheduler::set_scheduler_config,
            // Filters
            commands::filters::get_keyword_filters,
            commands::filters::add_keyword_filter,
            commands::filters::remove_keyword_filter,
            // Discover
            commands::discover::get_user_profile,
            commands::discover::update_user_profile,
            commands::discover::reset_learning_data,
            commands::discover::get_discover_feed,
            commands::discover::get_library_articles,
            commands::discover::record_interaction,
            commands::discover::rescore_articles,
            commands::discover::get_or_generate_summary,
            commands::discover::get_deepdive_questions,
            commands::discover::ask_deepdive,
            commands::discover::get_daily_highlights,
            commands::discover::batch_generate_summaries,
            commands::discover::get_unread_counts,
            commands::discover::mark_all_read_category,
            commands::discover::get_related_articles,
            commands::discover::adjust_feed_preference,
            commands::discover::ai_search,
            commands::discover::suggest_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run OtakuPulse");
}
