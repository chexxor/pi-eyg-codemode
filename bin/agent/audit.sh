#!/usr/bin/env bash
# Run the checks this package answers with, and print what each one cost.
#
# A human, or a script a human runs, runs this. Nothing inside the package runs it:
# the package has no effect that starts a shell command (AGENTS.md, "Bash is not the
# work"), so the checks are run from outside it and reported here in one place. The
# list is the one AGENTS.md's command table prices; the point of the script is that a
# session need not re-derive it three times.
#
# Order matters in one place: world_verify.mjs REWRITES the records it checks (a pass
# moves verified_at, a failure writes status: suspect), so run it before committing and
# diff what it changed (docs/world/traps.md, 2026-11-18). This script prints whether any
# record moved.
#
# Usage: bin/agent/audit.sh [--changed-from <ref>]
#   --changed-from <ref>  verify only the claims the diff from <ref> to HEAD moved,
#                         instead of --all. Requires a committed tree: an uncommitted
#                         edit selects no claims (docs/world/traps.md, 2026-11-14).
set -uo pipefail

pkg=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd -- "$pkg"

verify_args="--all"
if [[ "${1:-}" == "--changed-from" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "audit: --changed-from needs a ref" >&2
    exit 2
  fi
  verify_args="--changed-from $2"
elif [[ -n "${1:-}" ]]; then
  echo "audit: unknown argument: $1" >&2
  exit 2
fi

failures=0
rows=0
started=$SECONDS

# run_check <label> <command...>: run one check, print its wall time and its exit code,
# and remember a failure without stopping the run - an operator wants every answer, not
# the first one that failed.
run_check() {
  local label=$1
  shift
  local from to cost status
  rows=$((rows + 1))
  from=$(date +%s%3N)
  "$@" >"/tmp/eyg-audit.$$.out" 2>&1
  local code=$?
  to=$(date +%s%3N)
  cost=$(( (to - from) ))
  if [[ $code -eq 0 ]]; then
    status="pass"
  else
    status="FAIL"
    failures=$((failures + 1))
  fi
  printf '%-4s %8s %s\n' "$status" "$(awk -v ms="$cost" 'BEGIN { printf "%.2f s", ms / 1000 }')" "$label"
  if [[ $code -ne 0 ]]; then
    sed 's/^/       /' "/tmp/eyg-audit.$$.out" | head -20
  fi
  rm -f "/tmp/eyg-audit.$$.out"
  return 0
}

# The sweep: no tracked file may name another workspace, as a path or as a name. The
# pattern is written with brackets so this file never matches its own sweep
# (docs/world/traps.md, 2026-11-20). .pi/settings.json is the one legitimate exception:
# it declares the language-skill package by path.
sweep() {
  local hits
  hits=$(git ls-files -z | xargs -0 grep -lE \
    '/home/[a-z]+/|/Users/[a-z]+/|Git/[a-z]|C:[\\]Users|[~]/Git|eyg[-_]lang|pi-eyg[-_]expressions|social[-_]event|pi[-_]durable|next[ _]door|language[ _]workspace' \
    2>/dev/null | grep -v '^\.pi/settings\.json$')
  if [[ -n "$hits" ]]; then
    printf '%s\n' "$hits"
    return 1
  fi
  return 0
}

echo "audit in $pkg"
run_check "surface file current" node bin/agent/gen-surface.mjs --check
run_check "unit test and drift guard" node --test 'test/*.mjs'
run_check "world lint" node pi-simple-world-model/bin/world_lint.mjs
run_check "world verify $verify_args" node pi-simple-world-model/bin/world_verify.mjs $verify_args
run_check "world map current" node pi-simple-world-model/bin/world_map.mjs --check
run_check "tool sees the world model" pi --world-model-check
run_check "tracked paths and names" sweep
# The doc checks: one word per concept, citations that resolve, headings that name their
# subject, no upstream page copied into guides/, no dated stamp in the prose. Each one is
# `bin/agent/doc-checks.mjs <name>`; the fixtures that prove they bite are in
# `test/doc-checks.test.mjs`, which the unit row above runs.
run_check "doc check: one term" node bin/agent/doc-checks.mjs one-term
run_check "doc check: citations" node bin/agent/doc-checks.mjs citations
run_check "doc check: headings" node bin/agent/doc-checks.mjs headings
run_check "doc check: mirrors" node bin/agent/doc-checks.mjs mirrors
run_check "doc check: dated prose" node bin/agent/doc-checks.mjs dated-prose

moved=$(git status --porcelain docs/world | head -5)
if [[ -n "$moved" ]]; then
  echo "records moved by the verify (commit them or revert them):"
  printf '  %s\n' "$moved"
fi

echo "audit: $((rows - failures))/$rows passed, $failures failed, $((SECONDS - started)) s wall"
[[ $failures -eq 0 ]] || exit 1
