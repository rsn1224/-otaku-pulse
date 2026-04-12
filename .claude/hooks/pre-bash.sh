#!/bin/bash
# .claude/hooks/pre-bash.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except Exception as e:
    print(f'[pre-bash] JSON parse error: {e}', file=sys.stderr)
")

[[ -z "$COMMAND" ]] && exit 0

if echo "$COMMAND" | grep -qE 'cargo (build|test|clippy|run)' \
    && [[ ! -f "Cargo.toml" ]] \
    && [[ ! -f "src-tauri/Cargo.toml" ]]; then
    echo "[pre-bash] Cargo.toml が存在しません。" >&2
    exit 1
fi

exit 0
