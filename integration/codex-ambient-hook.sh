#!/usr/bin/env bash

# Fail-open Codex hook wrapper for the BongoCat ambient indicator.
#
# The Python adapter normalizes the input, and the Windows dispatcher writes it
# to the local named pipe owned by an already running BongoCat instance.

mode="${1-}"

case "$mode" in
  lifecycle) ;;
  *) exit 0 ;;
esac

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
/usr/bin/python3 "$script_dir/codex_ambient_adapter.py" "$@" >/dev/null 2>&1 || true

exit 0
