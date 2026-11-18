#!/usr/bin/env bash
# Remove the stray React copy that breaks ai-kit's component tests.
#
# `use-callback-ref` (a Radix dependency) ships its own `node_modules/react` at 16.14.0 while ai-kit
# runs React 18. Its hook calls resolve to that copy, so every Radix component throws
# "Invalid hook call" -- and `tsc` plus the build still pass, which is why it went unnoticed.
#
# Five vitest/vite configuration fixes were tried and none of them reach it: the nested copy is
# resolved by node, not by Vite. The durable fix is a `pnpm.overrides` entry plus a reinstall; this
# script is the surgical version for a working tree someone is already using.
#
# It backs the directory up first and restores it if the tests still fail, so it is safe to run.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PKG="$HERE/packages/ai-kit"
BACKUP="/tmp/ai-kit-nested-react-backup-$(date +%s)"

# Sweep *every* nested React, not one hardcoded path: the copy appears under whichever
# Radix dependency pnpm happened to auto-install peers for, and that set changes with the
# lockfile. 2026-11-18: use-callback-ref *and* use-sidecar both carried 16.14.0, so moving
# only the first one left the suite red.
mapfile -t TARGETS < <(find "$PKG/node_modules" -mindepth 3 -maxdepth 4 -type d -name react \
  -path "*/node_modules/*/node_modules/react" 2>/dev/null)

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "nothing to do: no nested React copies under $PKG/node_modules"
  exit 0
fi

mkdir -p "$BACKUP"
moved=()
for target in "${TARGETS[@]}"; do
  label=$(printf '%s' "${target#"$PKG/node_modules/"}" | tr '/' '_')
  echo "moving $target aside"
  mv "$target" "$BACKUP/$label"
  moved+=("$target")
done

echo "running ai-kit tests"
(cd "$PKG" && npx vitest run >/tmp/ai-kit-after-fix.log 2>&1) || true

# Judge on the test counts, not the exit code. Vitest also exits non-zero for *unhandled*
# errors: 2026-11-18 CodeMirror's measure pass called getClientRects from a jsdom animation
# frame after the test finished, so all 243 tests passed and the run still exited 1.
# Restoring the React copies over that would re-break the 9 real failures.
if grep -qE "^ +Tests +[0-9]+ passed" /tmp/ai-kit-after-fix.log && ! grep -qE "^ +Tests .*failed" /tmp/ai-kit-after-fix.log; then
  echo "OK: ai-kit tests pass; the stray copies stay at $BACKUP (delete them when convenient)"
  if grep -qE "^ +Errors +[0-9]+ error" /tmp/ai-kit-after-fix.log; then
    echo "note: vitest reported unhandled errors (jsdom/CodeMirror); see /tmp/ai-kit-after-fix.log"
  fi
  exit 0
fi

echo "tests still fail; restoring the copies" >&2
for target in "${moved[@]}"; do
  label=$(printf '%s' "${target#"$PKG/node_modules/"}" | tr '/' '_')
  mkdir -p "$(dirname "$target")"
  mv "$BACKUP/$label" "$target"
done
echo "see /tmp/ai-kit-after-fix.log" >&2
exit 1