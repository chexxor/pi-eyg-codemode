---
id: runbook.check-a-change
type: runbook
owner: delegate
status: current
verified_at: 2026-11-21
verify: "test -f pi-simple-world-model/bin/world_verify.mjs && grep -q 'world_verify.mjs' AGENTS.md"
confidence: high
sources: [AGENTS.md, pi-simple-world-model/README.md, docs/world/invariants.md]
supersedes: null
superseded_by: null
---

# Checking a change in this workspace

Costs are in `AGENTS.md`'s command table, dated where each was measured; they are not repeated
here.

1. Run the unit test: `node --test 'test/*.mjs'`. It compares `POLICY_FIELDS` in
   `lib/render-helpers.mjs` against the recorded `test/fixtures/rule_mapping.gleam`.
2. Type-check the shipped modules: `for f in policies/*.eyg libraries/*.eyg; do eyg check
   "$f"; done`. `eyg check` reads only this tree.
3. Commit the change before verifying claims: `world_verify.mjs --changed-from <ref>` diffs
   a ref to `HEAD`, so uncommitted edits select 0 claims.
4. Verify: `node pi-simple-world-model/bin/world_verify.mjs --all` - it prints how many claims
   it checked - or
   `--changed-from <baseline>` for the claims the diff moved.
5. If any claim moved, regenerate the index: `node pi-simple-world-model/bin/world_map.mjs`.
6. A claim whose command fails is `status: suspect` with the date it was caught; only a
   human promotes it back.

What this workspace can check: an effect running or being refused, through a runner that accepts
`--policy` - seen here on 2026-11-20 (`cli.checked-runner-on-this-host`), and the command is in
`AGENTS.md`'s table. What it cannot check is the release route: the prebuilt CLI on `PATH` has no
`--policy` (`cli.prebuilt-binary`, `gap.runner-release-lacks-policy`), so on a machine with only
that binary nothing runs at all and every statement about run behaviour must be reported
UNVERIFIED there, never as a PASS.
