//! PC/システム状態サービス (機能A)
//!
//! `dashboard_reader` のスナップショットを serde 可能なビューモデルへ変換する純粋層。
//! PC 状態は「記事」ではないため、article 収集パイプライン (dedup / scoring / digest /
//! LLM 要約) は一切経由しない。フロントは `get_pc_status` コマンドで直接この view を取得する。

use crate::error::AppError;
use crate::infra::dashboard_reader::{self, DashboardSnapshot};
use serde::Serialize;

/// 1 フレームワークの状態 (フロント表示用)。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameworkStatusDto {
    pub name: String,
    pub kind: String,
    pub priority: String,
    pub note: Option<String>,
    pub applied: bool,
    pub last_apply: Option<String>,
}

/// PC/システム状態のビューモデル。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PcStatusView {
    pub frameworks: Vec<FrameworkStatusDto>,
    pub pending_plans: usize,
    pub applied_count: usize,
    pub total_count: usize,
}

/// Dashboard スナップショットを取得して view に変換する。
pub async fn get_pc_status() -> Result<PcStatusView, AppError> {
    Ok(to_view(dashboard_reader::read_snapshot().await?))
}

/// スナップショット → view の純粋変換 (テスト可能)。
fn to_view(snapshot: DashboardSnapshot) -> PcStatusView {
    let total_count = snapshot.frameworks.len();
    let applied_count = snapshot.frameworks.iter().filter(|f| f.applied).count();
    let frameworks = snapshot
        .frameworks
        .into_iter()
        .map(|f| FrameworkStatusDto {
            name: f.name,
            kind: f.kind,
            priority: f.priority,
            note: f.note,
            applied: f.applied,
            last_apply: f.last_apply,
        })
        .collect();

    PcStatusView {
        frameworks,
        pending_plans: snapshot.pending_plans,
        applied_count,
        total_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::dashboard_reader::FrameworkStatus;

    #[test]
    fn to_view_counts_applied_frameworks() {
        let snapshot = DashboardSnapshot {
            frameworks: vec![
                FrameworkStatus {
                    name: "GamingOpt".into(),
                    kind: "full".into(),
                    priority: "active".into(),
                    note: Some("note".into()),
                    applied: true,
                    last_apply: Some("2026-05-01T10:00:00Z".into()),
                },
                FrameworkStatus {
                    name: "ChromeOpt".into(),
                    kind: "full".into(),
                    priority: "normal".into(),
                    note: None,
                    applied: false,
                    last_apply: None,
                },
            ],
            pending_plans: 3,
        };

        let view = to_view(snapshot);
        assert_eq!(view.total_count, 2);
        assert_eq!(view.applied_count, 1);
        assert_eq!(view.pending_plans, 3);
        assert_eq!(view.frameworks[0].name, "GamingOpt");
    }
}
