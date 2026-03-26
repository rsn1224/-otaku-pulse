/// Default feed entries: (name, url, category, feed_type)
pub const DEFAULT_FEEDS: &[(&str, &str, &str, &str)] = &[
    // Anime
    (
        "AnimeNewsNetwork JP",
        "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=jp",
        "anime",
        "rss",
    ),
    (
        "アニメ!アニメ!",
        "https://animeanime.jp/rss/index.rdf",
        "anime",
        "rss",
    ),
    (
        "MyAnimeList News",
        "https://myanimelist.net/rss/news.xml",
        "anime",
        "rss",
    ),
    (
        "Anime Corner",
        "https://animecorner.me/feed",
        "anime",
        "rss",
    ),
    (
        "Crunchyroll News",
        "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss",
        "anime",
        "rss",
    ),
    // Manga
    (
        "コミックナタリー",
        "https://natalie.mu/comic/feed/news",
        "manga",
        "rss",
    ),
    (
        "Otaku USA",
        "https://otakuusamagazine.com/anime/feed",
        "manga",
        "rss",
    ),
    // Game
    (
        "4Gamer",
        "https://www.4gamer.net/rss/index.xml",
        "game",
        "rss",
    ),
    ("Gematsu", "https://www.gematsu.com/feed", "game", "rss"),
    ("PC Gamer", "https://www.pcgamer.com/rss/", "game", "rss"),
    // PC Hardware
    (
        "PC Watch",
        "https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf",
        "pc",
        "rss",
    ),
    (
        "Tom's Hardware",
        "https://www.tomshardware.com/feeds/all",
        "pc",
        "rss",
    ),
    (
        "ITmedia",
        "https://rss.itmedia.co.jp/rss/2.0/topstory.xml",
        "pc",
        "rss",
    ),
];

/// Category corrections: (url_domain_pattern, correct_category)
pub const CATEGORY_CORRECTIONS: &[(&str, &str)] = &[
    // PC/Tech
    ("gigazine.net", "pc"),
    ("pc.watch.impress.co.jp", "pc"),
    ("tomshardware.com", "pc"),
    ("gamersnexus.net", "pc"),
    ("igorslab.de", "pc"),
    ("pcgamer.com", "game"),
    // Anime
    ("animenewsnetwork.com", "anime"),
    ("animeanime.jp", "anime"),
    ("myanimelist.net", "anime"),
    ("animecorner.me", "anime"),
    ("crunchyrollsvc.com", "anime"),
    // Manga
    ("natalie.mu/comic", "manga"),
    ("otakuusamagazine.com", "manga"),
    // Game
    ("4gamer.net", "game"),
    ("gematsu.com", "game"),
    // Reddit
    ("reddit.com/r/anime", "anime"),
    ("reddit.com/r/manga", "manga"),
    ("reddit.com/r/pcgaming", "game"),
    ("reddit.com/r/steam", "game"),
    ("reddit.com/r/hardware", "pc"),
    // Other
    ("itmedia.co.jp", "pc"),
];
