#!/usr/bin/env bash

# Fail-open Codex hook wrapper for the BongoCat ambient indicator.
#
# The development executable is the default until a packaged installation path
# is explicitly supplied through CODEX_AMBIENT_BONGOCAT_EXE. The Python adapter
# normalizes the input, and the Windows dispatcher only contacts an already
# running instance at that exact path.

mode="${1-}"

case "$mode" in
  lifecycle|notify) ;;
  *) exit 0 ;;
esac

export CODEX_AMBIENT_BONGOCAT_EXE="${CODEX_AMBIENT_BONGOCAT_EXE:-/mnt/d/VibeTool/BongoCat/target/debug/bongo-cat.exe}"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
/usr/bin/python3 "$script_dir/codex_ambient_adapter.py" "$@" >/dev/null 2>&1 || true

exit 0
