//! Dashboard 状態リーダー (機能A)
//!
//! `C:\Dashboard\config\frameworks.json` (フレームワークカタログ) と各フレームワークの
//! `.last-apply.json` マーカー、`plansDir` の pending plans 数を読み取り、PC/システム状態の
//! スナップショットを返す。Dashboard は JSON 出力モードを持たないため markdown はパースせず、
//! カタログ JSON とマーカーを直読みする。
//!
//! ファイル I/O はブロッキングのため `spawn_blocking` 経由で実行する
//! (`rust-conventions.md`: async 内で std::fs を直接使わない)。

use crate::error::AppError;
use serde::Deserialize;
use std::path::Path;

/// 既定の Dashboard カタログパス (このマシン固有)。
const DASHBOARD_CONFIG: &str = r"C:\Dashboard\config\frameworks.json";

/// `.last-apply.json` から拾うタイムスタンプ候補キー。
const TS_KEYS: [&str; 5] = ["timestamp", "appliedAt", "applied_at", "lastApply", "date"];

#[derive(Debug, Deserialize)]
struct FrameworksFile {
    #[serde(rename = "plansDir")]
    plans_dir: Option<String>,
    frameworks: Vec<FwEntry>,
}

#[derive(Debug, Deserialize)]
struct FwEntry {
    name: String,
    path: String,
    #[serde(rename = "type")]
    kind: String,
    priority: String,
    note: Option<String>,
}

/// 1 フレームワークの状態スナップショット。
#[derive(Debug, Clone)]
pub struct FrameworkStatus {
    pub name: String,
    pub kind: String,
    pub priority: String,
    pub note: Option<String>,
    /// `.last-apply.json` マーカーが存在するか。
    pub applied: bool,
    /// 最終適用日時 (rfc3339)。マーカー内 timestamp かファイル更新時刻。
    pub last_apply: Option<String>,
}

/// Dashboard 全体のスナップショット。
#[derive(Debug, Clone)]
pub struct DashboardSnapshot {
    pub frameworks: Vec<FrameworkStatus>,
    pub pending_plans: usize,
}

/// 既定パスから Dashboard スナップショットを読み取る。
pub async fn read_snapshot() -> Result<DashboardSnapshot, AppError> {
    tokio::task::spawn_blocking(|| read_snapshot_blocking(Path::new(DASHBOARD_CONFIG)))
        .await
        .map_err(|e| AppError::Internal(format!("dashboard reader join error: {e}")))?
}

fn read_snapshot_blocking(config_path: &Path) -> Result<DashboardSnapshot, AppError> {
    let raw = std::fs::read_to_string(config_path).map_err(|e| {
        AppError::Internal(format!(
            "dashboard config 読み込み失敗 ({}): {e}",
            config_path.display()
        ))
    })?;
    let parsed: FrameworksFile = serde_json::from_str(&raw)
        .map_err(|e| AppError::Parse(format!("frameworks.json パース失敗: {e}")))?;

    let frameworks = parsed
        .frameworks
        .iter()
        .map(|fw| {
            let marker = Path::new(&fw.path).join(".last-apply.json");
            let (applied, last_apply) = read_apply_marker(&marker);
            FrameworkStatus {
                name: fw.name.clone(),
                kind: fw.kind.clone(),
                priority: fw.priority.clone(),
                note: fw.note.clone(),
                applied,
                last_apply,
            }
        })
        .collect();

    let pending_plans = parsed
        .plans_dir
        .as_deref()
        .map(|d| count_pending_plans(Path::new(d)))
        .unwrap_or(0);

    Ok(DashboardSnapshot {
        frameworks,
        pending_plans,
    })
}

/// マーカーを読み、`(存在するか, 最終適用日時)` を返す。
fn read_apply_marker(marker: &Path) -> (bool, Option<String>) {
    let Ok(meta) = std::fs::metadata(marker) else {
        return (false, None);
    };

    let json_ts = std::fs::read_to_string(marker)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|v| {
            TS_KEYS
                .iter()
                .find_map(|k| v.get(*k).and_then(|x| x.as_str()).map(String::from))
        });

    let ts = json_ts.or_else(|| meta.modified().ok().map(systime_to_rfc3339));
    (true, ts)
}

fn systime_to_rfc3339(t: std::time::SystemTime) -> String {
    let dt: chrono::DateTime<chrono::Utc> = t.into();
    dt.to_rfc3339()
}

/// plansDir 直下の `.md` 数を数える (サブディレクトリ `_archive` 等は対象外)。
fn count_pending_plans(dir: &Path) -> usize {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return 0;
    };
    rd.filter_map(Result::ok)
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .is_some_and(|x| x.eq_ignore_ascii_case("md"))
        })
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_catalog_and_counts_plans() {
        let tmp = std::env::temp_dir().join("otaku_dashboard_reader_test");
        let _ = std::fs::remove_dir_all(&tmp);
        let fw_dir = tmp.join("FwA");
        let plans_dir = tmp.join("plans");
        std::fs::create_dir_all(&fw_dir).unwrap();
        std::fs::create_dir_all(&plans_dir).unwrap();
        std::fs::write(
            fw_dir.join(".last-apply.json"),
            r#"{"timestamp":"2026-05-01T10:00:00Z"}"#,
        )
        .unwrap();
        std::fs::write(plans_dir.join("a.md"), "x").unwrap();
        std::fs::write(plans_dir.join("b.md"), "y").unwrap();
        std::fs::write(plans_dir.join("c.txt"), "z").unwrap();

        let config = tmp.join("frameworks.json");
        let json = format!(
            r#"{{"plansDir":{plans:?},"frameworks":[
                {{"name":"FwA","path":{fwa:?},"type":"full","priority":"active","note":"n"}},
                {{"name":"FwB","path":{fwb:?},"type":"doc","priority":"normal"}}
            ]}}"#,
            plans = plans_dir.to_string_lossy(),
            fwa = fw_dir.to_string_lossy(),
            fwb = tmp.join("FwB").to_string_lossy(),
        );
        std::fs::write(&config, json).unwrap();

        let snap = read_snapshot_blocking(&config).unwrap();
        assert_eq!(snap.frameworks.len(), 2);
        assert_eq!(snap.pending_plans, 2);

        let fwa = snap.frameworks.iter().find(|f| f.name == "FwA").unwrap();
        assert!(fwa.applied);
        assert_eq!(fwa.last_apply.as_deref(), Some("2026-05-01T10:00:00Z"));

        let fwb = snap.frameworks.iter().find(|f| f.name == "FwB").unwrap();
        assert!(!fwb.applied);

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn missing_config_is_error() {
        let result = read_snapshot_blocking(Path::new(r"C:\nonexistent\frameworks.json"));
        assert!(result.is_err());
    }
}
