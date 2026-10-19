#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
if [ ! -x .venv/bin/python ] || [ ! -f web/dist/index.html ]; then
  echo 'Run bash scripts/setup.sh first.' >&2
  exit 1
fi
exec .venv/bin/python -m uvicorn gp.server:app --host "${GP_HOST:-127.0.0.1}" --port "${GP_PORT:-8000}"
