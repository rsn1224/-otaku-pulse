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
