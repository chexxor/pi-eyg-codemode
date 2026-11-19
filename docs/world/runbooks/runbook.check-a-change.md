---
id: runbook.check-a-change
type: runbook
owner: delegate
status: current
verified_at: 2026-11-19
verify: "test -f pi-simple-world-model/bin/world_verify.mjs && grep -q 'world_verify.mjs' AGENTS.md"
confidence: high
sources: [AGENTS.md, pi-simple-world-model/README.md, docs/world/invariants.md]
supersedes: null
superseded_by: null
---

# Checking a change in this workspace

1. Run the unit test: `node --test 'test/*.mjs'` (49 ms). It compares `POLICY_FIELDS` in
   `lib/render-helpers.mjs` against the recorded `test/fixtures/rule_mapping.gleam`.
2. Type-check the shipped modules: `for f in policies/*.eyg libraries/*.eyg; do eyg check
   "$f"; done` (0.43 s). `eyg check` reads only this tree.
3. Commit the change before verifying claims: `world_verify.mjs --changed-from <ref>` diffs
   a ref to `HEAD`, so uncommitted edits select 0 claims.
4. Verify: `node pi-simple-world-model/bin/world_verify.mjs --all` (0.37 s, 24 claims) or
   `--changed-from <baseline>` for the claims the diff moved.
5. If any claim moved, regenerate the index: `node pi-simple-world-model/bin/world_map.mjs`.
6. A claim whose command fails is `status: suspect` with the date it was caught; only a
   human promotes it back.

What this workspace cannot check: an effect actually running or being refused. The runner
probe fails here (see `cli.prebuilt-binary`), so gate behaviour stays UNVERIFIED - say so,
do not report a PASS.
