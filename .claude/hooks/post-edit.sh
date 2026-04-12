#!/bin/bash
# .claude/hooks/post-edit.sh

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception as e:
    print(f'[post-edit] JSON parse error: {e}', file=sys.stderr)
")

[[ -z "$FILE_PATH" ]] && exit 0

if [[ "$FILE_PATH" == *.rs ]]; then
    if ! command -v cargo &>/dev/null; then exit 0; fi
    if [[ ! -f "src-tauri/Cargo.toml" ]]; then exit 0; fi

    FMT_OUT=$( (cd src-tauri && cargo fmt) 2>&1)
    [[ $? -ne 0 ]] && { echo "[post-edit] cargo fmt failed" >&2; echo "$FMT_OUT" >&2; exit 1; }

    CLIPPY_OUT=$( (cd src-tauri && cargo clippy --message-format=short) 2>&1)
    if echo "$CLIPPY_OUT" | grep -q "^error"; then
        echo "[post-edit] cargo clippy errors:" >&2
        echo "$CLIPPY_OUT" | grep "^error" >&2
        exit 1
    fi
    exit 0
fi

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
    if [[ ! -d "node_modules" ]]; then exit 0; fi

    if [[ -f "biome.json" && "$FILE_PATH" == */src/* ]]; then
        npx biome check --write "$FILE_PATH" 2>&1 | head -5 >&2 || true
    fi

    TSC_OUT=$(npm run typecheck 2>&1)
    if [[ $? -ne 0 ]]; then
        echo "[post-edit] tsc --noEmit errors:" >&2
        echo "$TSC_OUT" | grep "error TS" | head -10 >&2
        exit 1
    fi
    exit 0
fi

exit 0
