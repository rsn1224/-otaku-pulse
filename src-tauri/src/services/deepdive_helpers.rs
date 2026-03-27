/// JSON配列のパース（エラー耐性あり）
pub(crate) fn parse_question_array(raw: &str) -> Vec<String> {
    // まず JSON として直接パース
    if let Ok(arr) = serde_json::from_str::<Vec<String>>(raw) {
        return arr;
    }
    // JSON 部分を抽出
    if let Some(start) = raw.find('[')
        && let Some(end) = raw.rfind(']')
        && let Ok(arr) = serde_json::from_str::<Vec<String>>(&raw[start..=end])
    {
        return arr;
    }
    // フォールバック: 行分割
    raw.lines()
        .filter(|l| !l.trim().is_empty())
        .take(3)
        .map(|l| {
            l.trim()
                .trim_matches(|c: char| c == '"' || c == '[' || c == ']' || c == ',')
                .to_string()
        })
        .collect()
}

/// 回答 + フォローアップ質問をパース
pub(crate) fn parse_answer_with_followups(raw: &str) -> (String, Vec<String>) {
    if let Some(idx) = raw.find("---FOLLOWUP---") {
        let answer = raw[..idx].trim().to_string();
        let followup_part = &raw[idx + 14..];
        let follow_ups = parse_question_array(followup_part);
        (answer, follow_ups)
    } else {
        (raw.trim().to_string(), vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_question_array_valid() {
        let input = r#"["質問1", "質問2", "質問3"]"#;
        let result = parse_question_array(input);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], "質問1");
    }

    #[test]
    fn test_parse_question_array_embedded() {
        let input = "Here are questions:\n[\"Q1\", \"Q2\", \"Q3\"]\nDone.";
        let result = parse_question_array(input);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_parse_answer_with_followups() {
        let input = "回答です。\n\n---FOLLOWUP---\n[\"追加1\", \"追加2\"]";
        let (answer, follow_ups) = parse_answer_with_followups(input);
        assert_eq!(answer, "回答です。");
        assert_eq!(follow_ups.len(), 2);
    }

    #[test]
    fn test_parse_answer_no_followups() {
        let input = "回答のみです。フォローアップなし。";
        let (answer, follow_ups) = parse_answer_with_followups(input);
        assert_eq!(answer, "回答のみです。フォローアップなし。");
        assert!(follow_ups.is_empty());
    }

    #[test]
    fn test_parse_question_array_malformed() {
        let input = "not json at all";
        let result = parse_question_array(input);
        assert!(!result.is_empty()); // fallback to line split
    }

    #[test]
    fn test_parse_question_array_empty() {
        let input = "";
        let result = parse_question_array(input);
        assert!(result.is_empty());
    }
}
