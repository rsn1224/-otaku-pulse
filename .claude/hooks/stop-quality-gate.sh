#!/bin/bash
echo "━━━ 完了前チェックリスト ━━━" >&2
echo "□ npm run check         (Biome lint + format)" >&2
echo "□ npm run typecheck     (tsc --noEmit)" >&2
echo "□ npm test              (Vitest)" >&2
echo "□ cd src-tauri && cargo clippy -- -D warnings" >&2
echo "□ cd src-tauri && cargo test" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
exit 0
