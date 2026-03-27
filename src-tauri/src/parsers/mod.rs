pub mod bbcode_parser;
pub mod graphql_parser;
pub mod graphql_types;
pub mod rss_helpers;
pub mod rss_parser;

// parsers/ — Data transformation layer.
// RSS→Article, GraphQL→Article, BBCode→text, etc.
// Pure functions with no side effects.
