#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
if [ -f /workspace/.gp-tools/activate.sh ]; then
  . /workspace/.gp-tools/activate.sh
fi
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$repo_root/.cache/pip}"
export npm_config_cache="${npm_config_cache:-$repo_root/.cache/npm}"
python3 -m venv .build-venv
.build-venv/bin/python -m pip install --disable-pip-version-check defusedxml==0.7.1
npm --prefix web ci --no-audit --no-fund
npm --prefix web run build:static
.build-venv/bin/python scripts/build_browser.py
