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
TARGET="$PKG/node_modules/use-callback-ref/node_modules/react"
BACKUP="/tmp/ai-kit-nested-react-backup-$(date +%s)"

if [ ! -d "$TARGET" ]; then
  echo "nothing to do: $TARGET is already gone"
  exit 0
fi

echo "moving $TARGET aside to $BACKUP"
mv "$TARGET" "$BACKUP"

echo "running ai-kit tests"
if (cd "$PKG" && npx vitest run >/tmp/ai-kit-after-fix.log 2>&1); then
  echo "OK: ai-kit tests pass; the stray copy stays at $BACKUP (delete it when convenient)"
  exit 0
fi

echo "tests still fail; restoring the copy" >&2
mv "$BACKUP" "$TARGET"
echo "see /tmp/ai-kit-after-fix.log" >&2
exit 1
