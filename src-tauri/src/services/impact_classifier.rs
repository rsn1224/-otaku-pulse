/// Impact level classification for articles.
///
/// Classifies articles into three tiers without LLM calls,
/// using keyword matching against title and summary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImpactLevel {
    /// Confirmed news: release date, official announcement, etc.
    Confirmed,
    /// Rumour / leak: unverified information
    Rumor,
    /// General news
    General,
}

impl ImpactLevel {
    /// Returns the DB string value.
    pub fn as_str(&self) -> &'static str {
        match self {
            ImpactLevel::Confirmed => "confirmed",
            ImpactLevel::Rumor => "rumor",
            ImpactLevel::General => "general",
        }
    }
}

// Keywords that indicate confirmed / high-impact news
const CONFIRMED_KEYWORDS: &[&str] = &[
    // Japanese
    "発売決定",
    "発売日",
    "発売確定",
    "正式発表",
    "公式発表",
    "情報解禁",
    "アニメ化決定",
    "映画化決定",
    "ドラマ化決定",
    "実写化決定",
    "連載開始",
    "新作発表",
    "最終回",
    "完結",
    "PV公開",
    "MV公開",
    "トレーラー公開",
    "キャスト発表",
    "主題歌発表",
    "放送開始",
    "配信開始",
    "発売",
    // English
    "release date",
    "officially announced",
    "confirmed",
    "launches",
    "now available",
    "officially revealed",
    "trailer released",
    "final episode",
    "season confirmed",
    "greenlit",
];

// Keywords that indicate rumours or leaks
const RUMOR_KEYWORDS: &[&str] = &[
    // Japanese
    "リーク",
    "噂",
    "らしい",
    "予定か",
    "検討中",
    "未発表",
    "フライング",
    "流出",
    "内部情報",
    "匿名情報",
    "関係者によると",
    "とのこと",
    "とされる",
    "との報道",
    "未確認",
    // English
    "leak",
    "leaked",
    "rumor",
    "rumour",
    "reportedly",
    "reportedly confirmed",
    "might",
    "could be",
    "unconfirmed",
    "sources say",
    "according to sources",
    "insider",
];

/// Classify a single article based on title and optional content/summary.
///
/// Classification priority: Confirmed > Rumor > General.
/// Both title and content are searched; title takes precedence only in the
/// sense that a shorter corpus still yields a clear signal.
pub fn classify_impact(title: &str, content: Option<&str>) -> ImpactLevel {
    let title_lower = title.to_lowercase();
    let content_lower = content
        .map(|c| c.to_lowercase())
        .unwrap_or_default();

    // Check confirmed keywords first (higher priority)
    for kw in CONFIRMED_KEYWORDS {
        let kw_lower = kw.to_lowercase();
        if title_lower.contains(kw_lower.as_str())
            || content_lower.contains(kw_lower.as_str())
        {
            return ImpactLevel::Confirmed;
        }
    }

    // Check rumor keywords
    for kw in RUMOR_KEYWORDS {
        let kw_lower = kw.to_lowercase();
        if title_lower.contains(kw_lower.as_str())
            || content_lower.contains(kw_lower.as_str())
        {
            return ImpactLevel::Rumor;
        }
    }

    ImpactLevel::General
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_confirmed_keywords() {
        assert_eq!(
            classify_impact("鬼滅の刃 映画化決定！公式発表", None),
            ImpactLevel::Confirmed
        );
        assert_eq!(
            classify_impact("Release Date Confirmed for New Game", None),
            ImpactLevel::Confirmed
        );
    }

    #[test]
    fn test_rumor_keywords() {
        assert_eq!(
            classify_impact("新作アニメが来年放送との噂", None),
            ImpactLevel::Rumor
        );
        assert_eq!(
            classify_impact("Leaked footage reportedly shows new season", None),
            ImpactLevel::Rumor
        );
    }

    #[test]
    fn test_general() {
        assert_eq!(
            classify_impact("アニメの感想まとめ", None),
            ImpactLevel::General
        );
    }

    #[test]
    fn test_confirmed_beats_rumor() {
        // Title has rumor keyword but content has confirmed keyword → Confirmed
        assert_eq!(
            classify_impact("噂レベルだったが発売日が公式発表", None),
            ImpactLevel::Confirmed
        );
    }

    #[test]
    fn test_content_fallback() {
        assert_eq!(
            classify_impact("ゲーム新情報", Some("発売日が公式に発表された")),
            ImpactLevel::Confirmed
        );
    }
}
