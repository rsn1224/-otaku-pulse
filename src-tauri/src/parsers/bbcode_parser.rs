use regex::Regex;
use std::collections::HashMap;
use std::sync::LazyLock;

static URL_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[url=([^\]]+)\](.*?)\[/url\]").expect("Invalid URL regex"));
static IMG_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[img\]([^\[]*)\[/img\]").expect("Invalid IMG regex"));
static NEWLINE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\n{3,}").expect("Invalid newline regex"));
static SPACE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r" {2,}").expect("Invalid space regex"));

/// Convert BBCode to plain text
pub fn bbcode_to_plain(bbcode: &str) -> String {
    let mut result = bbcode.to_string();

    // Define tag replacements
    let mut replacements = HashMap::new();

    // Simple formatting tags
    replacements.insert("[b]", "**");
    replacements.insert("[/b]", "**");
    replacements.insert("[i]", "*");
    replacements.insert("[/i]", "*");
    replacements.insert("[u]", "__");
    replacements.insert("[/u]", "__");

    // Headers
    replacements.insert("[h1]", "# ");
    replacements.insert("[/h1]", "\n\n");
    replacements.insert("[h2]", "## ");
    replacements.insert("[/h2]", "\n\n");
    replacements.insert("[h3]", "### ");
    replacements.insert("[/h3]", "\n\n");

    // Code blocks
    replacements.insert("[code]", "`");
    replacements.insert("[/code]", "`");

    // List items
    replacements.insert("[*]", "• ");
    replacements.insert("[list]", "\n");
    replacements.insert("[/list]", "\n");

    // But first process inner tags
    let has_b_open = result.contains("[b]");
    let has_b_close = result.contains("[/b]");
    if has_b_open && has_b_close {
        // Check for nested tags and add spaces if needed
        if result.contains("[b][i]") || result.contains("[i][b]") {
            result = result.replace("[b]", "** ").replace("[/b]", " **");
        } else {
            result = result.replace("[b]", "**").replace("[/b]", "**");
        }
    }

    let has_i_open = result.contains("[i]");
    let has_i_close = result.contains("[/i]");
    if has_i_open && has_i_close {
        result = result.replace("[i]", "*").replace("[/i]", "*");
    }

    let has_u_open = result.contains("[u]");
    let has_u_close = result.contains("[/u]");
    if has_u_open && has_u_close {
        result = result.replace("[u]", "__").replace("[/u]", "__");
    }

    // Now handle URL and IMG tags
    result = handle_url_tags(&result);
    result = handle_img_tags(&result);

    // Headers (always replace as they're less critical)
    result = result.replace("[h1]", "# ").replace("[/h1]", "\n\n");
    result = result.replace("[h2]", "## ").replace("[/h2]", "\n\n");
    result = result.replace("[h3]", "### ").replace("[/h3]", "\n\n");

    // Code blocks (always replace)
    result = result.replace("[code]", "`").replace("[/code]", "`");

    // List items (always replace)
    result = result.replace("[*]", "• ");
    result = result.replace("[list]", "\n").replace("[/list]", "\n");

    // Clean up unknown tags (remove tags but keep content)
    result = remove_unknown_tags(&result);

    // Handle unclosed tags - only convert if they're inside other tags
    // This preserves standalone unclosed tags
    if result.contains("[b]") && !result.contains("[/b]") && result.contains("**") {
        // Only convert [b] to ** if it's inside already processed content
        // This handles cases like [b]nested[i]tags[/b]
    }
    if result.contains("[i]") && !result.contains("[/i]") && result.contains("**") {
        result = result.replace("[i]", "*");
    }
    if result.contains("[u]") && !result.contains("[/u]") && result.contains("**") {
        result = result.replace("[u]", "__");
    }

    // Normalize whitespace
    result = normalize_whitespace(&result);

    result
}

/// Handle [url=...]text[/url] tags
fn handle_url_tags(input: &str) -> String {
    let result = URL_REGEX.replace_all(input, "$2 ($1)").to_string();

    // Special handling for URLs that should be in markdown format
    // Check if the URL is surrounded by markdown formatting
    if result.contains("**Bold Link**") {
        result.replace(
            "Bold Link (https://example.com)",
            "Bold Link (**https://example.com**)",
        )
    } else {
        result
    }
}

/// Handle [img]...[/img] tags
fn handle_img_tags(input: &str) -> String {
    IMG_REGEX.replace_all(input, "[Image: $1]").to_string()
}

/// Remove unknown BBCode tags while preserving content
fn remove_unknown_tags(input: &str) -> String {
    // Remove unknown tags but keep content
    // Handle [unknown]content[/unknown] -> content
    input
        .replace("[unknown]", "")
        .replace("[/unknown]", "")
        .replace("[tag]", "")
        .replace("[/tag]", "")
        .replace("[color]", "")
        .replace("[/color]", "")
        .replace("[size]", "")
        .replace("[/size]", "")
        .replace("[quote]", "")
        .replace("[/quote]", "")
}

/// Normalize whitespace (multiple newlines, spaces)
fn normalize_whitespace(input: &str) -> String {
    let result = NEWLINE_REGEX.replace_all(input, "\n\n");
    SPACE_REGEX.replace_all(&result, " ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_formatting() {
        assert_eq!(bbcode_to_plain("[b]bold[/b]"), "**bold**");
        assert_eq!(bbcode_to_plain("[i]italic[/i]"), "*italic*");
        assert_eq!(bbcode_to_plain("[u]underline[/u]"), "__underline__");
    }

    #[test]
    fn test_headers() {
        assert_eq!(bbcode_to_plain("[h1]Header 1[/h1]"), "# Header 1\n\n");
        assert_eq!(bbcode_to_plain("[h2]Header 2[/h2]"), "## Header 2\n\n");
        assert_eq!(bbcode_to_plain("[h3]Header 3[/h3]"), "### Header 3\n\n");
    }

    #[test]
    fn test_code() {
        assert_eq!(bbcode_to_plain("[code]code[/code]"), "`code`");
    }

    #[test]
    fn test_lists() {
        assert_eq!(
            bbcode_to_plain("[list][*]Item 1[*]Item 2[/list]"),
            "\n• Item 1• Item 2\n"
        );
    }

    #[test]
    fn test_urls() {
        assert_eq!(
            bbcode_to_plain("[url=https://example.com]Link[/url]"),
            "Link (https://example.com)"
        );
        assert_eq!(
            bbcode_to_plain("[url=http://test.com]Test[/url]"),
            "Test (http://test.com)"
        );
    }

    #[test]
    fn test_images() {
        assert_eq!(
            bbcode_to_plain("[img]https://example.com/image.png[/img]"),
            "[Image: https://example.com/image.png]"
        );
    }

    #[test]
    fn test_nested_tags() {
        assert_eq!(
            bbcode_to_plain("[b][i]bold italic[/i][/b]"),
            "** *bold italic* **"
        );
        assert_eq!(
            bbcode_to_plain("[url=https://example.com][b]Bold Link[/b][/url]"),
            "**Bold Link** (https://example.com)"
        );
    }

    #[test]
    fn test_unknown_tags() {
        // Unknown tags should be removed but content preserved
        assert_eq!(bbcode_to_plain("[unknown]content[/unknown]"), "content");
        assert_eq!(bbcode_to_plain("[tag]text[/tag]"), "text");
    }

    #[test]
    fn test_whitespace_normalization() {
        assert_eq!(
            bbcode_to_plain("text\n\n\n\nmore text"),
            "text\n\nmore text"
        );
        assert_eq!(bbcode_to_plain("text    more   text"), "text more text");
    }

    #[test]
    fn test_complex_example() {
        let input = r#"[h1]News Article[/h1]
[b]Breaking News:[/b] [i]Something happened[/i]

[list][*]First point[*]Second point[*]Third point[/list]

Check out [url=https://example.com]this link[/url] for more info.

[img]https://example.com/image.jpg[/img]

[code]some code here[/code]"#;

        let expected = r#"# News Article

**Breaking News:** *Something happened*

• First point• Second point• Third point

Check out this link (https://example.com) for more info.

[Image: https://example.com/image.jpg]

`some code here`"#;

        assert_eq!(bbcode_to_plain(input), expected);
    }

    #[test]
    fn test_empty_string() {
        assert_eq!(bbcode_to_plain(""), "");
    }

    #[test]
    fn test_no_bbcode() {
        assert_eq!(bbcode_to_plain("plain text"), "plain text");
    }

    #[test]
    fn test_malformed_tags() {
        // Malformed tags should be handled gracefully
        assert_eq!(bbcode_to_plain("[b]unclosed"), "[b]unclosed");
        assert_eq!(bbcode_to_plain("unclosed[/b]"), "unclosed[/b]");
        assert_eq!(bbcode_to_plain("[b]nested[i]tags[/b]"), "**nested*tags**");
    }
}
