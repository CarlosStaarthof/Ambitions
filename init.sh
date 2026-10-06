#!/usr/bin/env bash
# init.sh — the verification gate (POSIX twin of init.ps1).
# Every agent runs this. The reviewer may not approve unless it prints [OK].
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo; echo "[FAIL] $*" >&2; exit 1; }

echo "=== Ambitions verification gate ==="

# 1. Dependencies
if [ ! -d node_modules ]; then
  echo "-> installing dependencies (npm ci)"
  npm ci || fail "npm ci failed"
else
  echo "-> dependencies present"
fi

# 2. Build — no type-checker here, so the build is what catches bad imports/JSX.
echo "-> npm run build"
npm run build >/dev/null || fail "build failed - run 'npm run build' to see the error"

# 3. Tests
echo "-> npm test"
npm test || fail "tests failed"

# 4. Scope discipline — exactly one feature may be in flight.
[ -f feature_list.json ] || fail "feature_list.json is missing"
in_progress=$(node -e "
  const fl=require('./feature_list.json');
  const p=(fl.features||[]).filter(f=>f.status==='in_progress');
  console.log(p.length + '|' + p.map(f=>f.id+' '+f.name).join(', '));
")
count=${in_progress%%|*}
names=${in_progress#*|}
if [ "$count" -gt 1 ]; then fail "more than one feature is in_progress: $names"; fi
if [ "$count" -eq 1 ]; then echo "-> in progress: $names"; else echo "-> no feature in progress"; fi

echo
echo "[OK] build green, tests green, scope clean"
