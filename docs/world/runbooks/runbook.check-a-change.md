---
id: runbook.check-a-change
type: runbook
owner: delegate
status: current
verified_at: 2026-11-26
verify: "test -f pi-simple-world-model/bin/world_verify.mjs && grep -q 'world_verify.mjs' AGENTS.md"
confidence: high
sources: [AGENTS.md, pi-simple-world-model/README.md, docs/world/invariants.md]
supersedes: null
superseded_by: null
---

# Checking a change in this workspace

Costs are in `AGENTS.md`'s command table, dated where each was measured; they are not repeated
here.

1. Run the unit test: `node --test 'test/*.mjs'`. It compares the effect labels and the
   runtime-`Unchecked` set in `lib/render-helpers.mjs` against the recorded
   `test/fixtures/rule_mapping.gleam`, and the policy field names against `host/guard.eyg`.
2. Type-check the shipped modules: `for f in policies/*.eyg libraries/*.eyg host/*.eyg; do eyg check
   "$f"; done`. `eyg check` reads only this tree.
3. Commit the change before verifying claims: `world_verify.mjs --changed-from <ref>` diffs
   a ref to `HEAD`, so uncommitted edits select 0 claims.
4. Verify: `node pi-simple-world-model/bin/world_verify.mjs --all` - it prints how many claims
   it checked - or
   `--changed-from <baseline>` for the claims the diff moved.
5. If any claim moved, regenerate the index: `node pi-simple-world-model/bin/world_map.mjs`.
6. A claim whose command fails is `status: suspect` with the date it was caught; only a
   human promotes it back.

What this workspace can check: an effect running or being refused, on the CLI installed on `PATH`,
because the checks are a program this package ships - `node bin/agent/refusal-probe.mjs` re-runs one
call in a fifth of a second (`docs/world/entities/host.guard-boundary.md`). What it cannot check is a
machine with no `eyg` on `PATH` and no `EYG_CODEMODE_RUNNER`: the tool says which command it looked
for and runs nothing (`cli.runner-official-install-only`), so on such a machine every statement about
run behaviour is reported UNVERIFIED there, never as a PASS.
