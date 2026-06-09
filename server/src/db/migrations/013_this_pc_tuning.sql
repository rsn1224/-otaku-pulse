-- Migration 013: このマシン固有チューニング (M1)
--   1. Ollama 既定モデル/エンドポイントを実機 (qwen3:14b @127.0.0.1:11434) に追従。
--      旧既定値のときだけ更新し、ユーザーが Settings で設定した値は保護する。
--   2. 到達不可 / 404 の死亡フィードを除去する。
--      feeds は articles から ON DELETE CASCADE で参照されるが、ここは DROP ではなく
--      行 DELETE なので該当フィードの記事のみが連動削除される (意図どおり)。

-- 1. Ollama 既定をこのマシンの実機モデルへ
UPDATE settings
   SET value = '"qwen3:14b"', updated_at = datetime('now')
 WHERE key = 'ollama_model'
   AND value IN ('"qwen2.5:7b-instruct"', '"llama3.2"');

UPDATE settings
   SET value = '"http://127.0.0.1:11434"', updated_at = datetime('now')
 WHERE key = 'ollama_endpoint'
   AND value = '"http://localhost:11434"';

-- 2. 死亡フィード除去 (実機収集ログで 404 / 到達不可を確認済み)
DELETE FROM feeds WHERE url IN (
    'https://natalie.mu/comic/feed/news/manga',
    'https://gamersnexus.net/rss.xml',
    'https://otakuusamagazine.com/anime/feed',
    'https://rss.itmedia.co.jp/rss/2.0/topstory.xml'
);
