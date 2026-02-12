#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

git add -A

if git diff --cached --quiet; then
  echo "No staged changes. Nothing to commit."
  exit 0
fi

if [ "$#" -gt 0 ]; then
  COMMIT_MESSAGE="$*"
else
  COMMIT_MESSAGE="chore: auto-save $(date '+%Y-%m-%d %H:%M:%S')"
fi

git commit -m "$COMMIT_MESSAGE"

echo "Commit created. Auto-push is handled by the post-commit hook."
