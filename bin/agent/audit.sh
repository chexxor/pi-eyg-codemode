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

# Every EYG module this package ships has to parse and type-check: a policy that does not
# compile decides nothing, a library that does not compile is a function nobody can call, and
# a guard that does not compile runs no call at all. The CLI on `PATH` type-checks a module
# without running one, so this row needs no entry file.
eyg_modules() {
  local f
  for f in policies/*.eyg libraries/*.eyg host/*.eyg; do
    eyg check "$f" > /dev/null || return 1
  done
  return 0
}

# The policy's answer, asked of the installed CLI exactly the way a session asks it: the entry,
# the policy import and the program module this package writes, run as `eyg run <entry>`.
# `bin/agent/refusal-probe.mjs` always exits 0, so the grep is the check: the row fails when a
# policy stopped refusing, and also when the guard stopped naming the label.
refusal_probe() {
  node bin/agent/refusal-probe.mjs | grep -q 'write_file denied by policy: /tmp/' || return 1
  node bin/agent/refusal-probe.mjs --with-policy deny-all | grep -q 'write_file denied by policy' || return 1
  node bin/agent/refusal-probe.mjs --program test/fixtures/secret-probe.eyg --inside-roots |
    grep -q 'read_file denied by policy: .*\.env\.eyg' || return 1
  node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg |
    grep -q 'unhandled effect Foo' || return 1
  node bin/agent/refusal-probe.mjs --with-policy spawner-effects --program test/fixtures/refusal-abort.eyg |
    grep -q 'write_file denied by policy: EYG_SUBAGENT_EFFECTS=' || return 1
  node bin/agent/refusal-probe.mjs --program test/fixtures/inner-handler.eyg |
    grep -q 'what the program was answered: read_file denied by policy: /tmp/' || return 1
  return 0
}

# One host per call: the tool parses a program before it runs it and refuses one that handles
# an effect for itself. The scan shares `handledEffectLabels` and `parseArguments` with the
# tool, so this row proves the mechanism the refusal rests on: the fixture with a clause is
# named, the fixture without one is not.
handler_scan() {
  node bin/agent/handler-scan.mjs test/fixtures/inner-handler.eyg | grep -qx ReadFile || return 1
  node bin/agent/handler-scan.mjs test/fixtures/refusal-probe.eyg | grep -q . && return 1
  return 0
}

# The hidden-name rule in `policies/agent-roots.eyg` refuses a path that passes through a named
# secret directory, for all seven path effects. The probe builds its own root in the system
# temporary directory, prints one row per ask, and exits non-zero when a refusal stops happening -
# which it does when `--policy` points at a copy whose `hidden` answers False, so the row can fail.
secret_rule() {
  node bin/agent/secret-rule-probe.mjs | tail -1 | grep -q '16/16 rows hold' || return 1
  return 0
}

# The same asks under the spawner's narrowing policy, with its allowlist open on the seven path
# fields and `standard_out`. This is the row that closes the child hole: the copy used to carry
# only a file-suffix test, so asked of the older file it prints 11 `DRIFT` rows and writes the
# planted file, and it is a whole-file rewrite of `policies/spawner-effects.eyg` that put the
# directory-name rule in place of that test.
spawner_secret_rule() {
  node bin/agent/secret-rule-probe.mjs --policy "$pkg/policies/spawner-effects.eyg" \
    --fields read_file,write_file,append_file,delete_file,make_directory,read_directory,search,standard_out |
    tail -1 | grep -q '16/16 rows hold' || return 1
  return 0
}

# The effect set is closed: a label the language does not have - `Bash`, say - reaches no
# command line at any of the five places a program can try it. The probe prints one row per
# wall and exits non-zero when a wall stops holding, so the row needs no grep; it is written
# so that planting a real effect in its fixture makes it fail (docs/world/entities/
# host.closed-effect-set.md).
invented_effect() {
  node bin/agent/invented-effect-probe.mjs | tail -1 | grep -q 'all 5 walls hold' || return 1
  return 0
}

# The alternative policy shape - the decision content in named lists, the rules composed from
# derivations - decides the same rows as the shipped one: `test/fixtures/policy-data-shape.eyg`
# through the same probe. The row fails when the alternative loosens a rule, and a copy of that
# fixture with `hidden` returning `False({})` shows it: 12 `DRIFT` rows, exit 1, two of them a
# file that landed on disk.
policy_shape() {
  node bin/agent/secret-rule-probe.mjs --policy "$pkg/test/fixtures/policy-data-shape.eyg" | tail -1 | grep -q '16/16 rows hold' || return 1
  return 0
}

# A refusal the program never printed still reaches the call: `build` returns the refusals the
# guard answered as its own value, the entry writes them to the call's fourth file after the guarded
# body, and the tool reads that file. The probe runs ONE guarded run of a program that binds the
# refusal to `_` and prints nothing - stdout 0 bytes, exit 0, nothing landed - and prints the rows
# the tool builds; it exits non-zero when the record stops naming the refusal, which is what a run
# with `--no-record` shows (`notes/pi-codemode-refusal-record.md`).
swallowed_refusal() {
  node bin/agent/swallowed-refusal-probe.mjs | tail -1 | grep -q '1 swallowed refusal(s) named by the guard' || return 1
  return 0
}

# A mis-shaped ask costs a named answer, not the spawn cap: the tool checks the entry it wrote
# before it starts the run (`entryCheckArguments`, `entryCheckMisshapeRows`, `misshapedAskRows`
# in `lib/render-helpers.mjs`, used by `runGuarded` in `extensions/eyg-codemode.ts`). The probe runs
# that check of the same fixture whose guarded RUN prints 0 bytes for 20 s (`notes/pi-codemode-misshaped-ask.md`
# carries that figure and the mechanism); the row fails when the check stops naming the type mismatch.
# The four fixtures named below are the effects no policy field decides - their guard clauses state
# their argument shape (`notes/pi-codemode-unchecked-effect-pins.md`), which is what lets this check
# name a wrong ask against them instead of starting a run that prints nothing for the whole cap.
misshaped_ask() {
  node bin/agent/misshape-probe.mjs | tail -1 | grep -q '1 mis-shaped ask(s) named by the check' || return 1
  node bin/agent/misshape-probe.mjs --program test/fixtures/refusal-probe.eyg | tail -1 |
    grep -q '0 mis-shaped ask(s) named by the check' || return 1
  for f in test/fixtures/unchecked-ask-misshape.eyg test/fixtures/unchecked-ask-misshape-eygparse.eyg test/fixtures/unchecked-ask-misshape-hash.eyg test/fixtures/unchecked-ask-misshape-sign.eyg; do
    node bin/agent/misshape-probe.mjs --program "$f" | tail -1 |
      grep -q '1 mis-shaped ask(s) named by the check' || return 1
  done
  node bin/agent/refusal-probe.mjs --program test/fixtures/unchecked-ask-wellshaped.eyg |
    grep -q 'the four unchecked effects answered' || return 1
  return 0
}

echo "audit in $pkg"
run_check "surface file current" node bin/agent/gen-surface.mjs --check
run_check "unit test and drift guard" node --test 'test/*.mjs'
run_check "shipped EYG modules check" eyg_modules
run_check "guard covers every effect row" node --test test/host-coverage.test.mjs
run_check "refusals the shipped policies owe" refusal_probe
run_check "a program that handles an effect is named" handler_scan
run_check "an invented effect reaches nothing" invented_effect
run_check "the hidden-name rule refuses in every direction" secret_rule
run_check "the spawner policy hides the same names" spawner_secret_rule
run_check "the alternative policy shape decides the same rows" policy_shape
run_check "a swallowed refusal still gets named" swallowed_refusal
run_check "a mis-shaped ask costs a named answer, not the spawn cap" misshaped_ask
run_check "an eval call prints the value it computed" node bin/agent/eval-entry-probe.mjs
run_check "kept binding shapes" node bin/agent/check-variable-shapes.mjs
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
# A mechanism that was replaced has to stay replaced in the prose nobody else reads: `notes/` is
# outside the doc checks and outside the world-model lint, so the only check over it is this one.
# The sweep reports a retired command line that a reader could run today; a mention under a dated
# heading is history and passes (notes/retired-mechanism-sweep.md).
run_check "the retired CLI flag stays retired" node bin/agent/policy-flag-sweep.mjs

moved=$(git status --porcelain docs/world | head -5)
if [[ -n "$moved" ]]; then
  echo "records moved by the verify (commit them or revert them):"
  printf '  %s\n' "$moved"
fi

echo "audit: $((rows - failures))/$rows passed, $failures failed, $((SECONDS - started)) s wall"
[[ $failures -eq 0 ]] || exit 1
