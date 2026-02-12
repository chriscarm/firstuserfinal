#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/post-commit

echo "Git hooks installed."
echo "Commit flow is now: compile check -> commit -> auto-push."
