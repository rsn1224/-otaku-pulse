use crate::error::CmdResult;
use crate::services::pc_status_service::{self, PcStatusView};

/// PC/システム状態 (機能A) を取得する。
/// article 収集パイプラインを経由しない読み取り専用コマンド。
/// Dashboard 設定が見つからない環境ではエラーを返す (フロントで未設定表示にフォールバック)。
#[tauri::command]
pub async fn get_pc_status() -> CmdResult<PcStatusView> {
    pc_status_service::get_pc_status().await
}
