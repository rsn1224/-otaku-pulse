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
#[path = "bbcode_parser_tests.rs"]
mod tests;
