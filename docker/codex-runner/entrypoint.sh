#!/usr/bin/env sh
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

CODEX_PROMPT="${CODEX_PROMPT:-Review the document and summarize the implementation changes needed.}"
DOCUMENT_PATH="${DOCUMENT_PATH:-}"

if [ -n "$DOCUMENT_PATH" ]; then
  case "$DOCUMENT_PATH" in
    /*) DOCUMENT_FILE="$DOCUMENT_PATH" ;;
    *) DOCUMENT_FILE="/documents/$DOCUMENT_PATH" ;;
  esac

  if [ ! -f "$DOCUMENT_FILE" ]; then
    echo "Document not found: $DOCUMENT_FILE" >&2
    exit 66
  fi

  FINAL_PROMPT="$(printf '%s\n\nDocument path: %s\nRepository path: /workspace\nUse the document as input context for this run.' "$CODEX_PROMPT" "$DOCUMENT_FILE")"
else
  FINAL_PROMPT="$CODEX_PROMPT"
fi

cd /workspace
exec codex exec "$FINAL_PROMPT"
