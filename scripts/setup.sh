#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
if [ -f /workspace/.gp-tools/activate.sh ]; then
  . /workspace/.gp-tools/activate.sh
fi
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$repo_root/.cache/pip}"
export npm_config_cache="${npm_config_cache:-$repo_root/.cache/npm}"
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
npm --prefix web ci --no-audit --no-fund
npm --prefix web run build
