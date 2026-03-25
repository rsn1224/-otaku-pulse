pub mod bbcode_parser;
pub mod graphql_parser;
pub mod rss_parser;
pub mod schedule_parser;

// parsers/ — Data transformation layer.
// RSS→Article, GraphQL→Article, BBCode→text, etc.
// Pure functions with no side effects.
