---
id: pi.config-action
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -qF 'const ACTIONS = [\"run\", \"eval\", \"effects\", \"config\"' extensions/eyg-codemode.ts && grep -q 'if (action === \"config\")' extensions/eyg-codemode.ts && grep -q 'export function configLines' lib/render-helpers.mjs && grep -q 'configLines' extensions/eyg-codemode.ts && grep -q 'export function policySlots' lib/render-helpers.mjs && grep -q 'const steps = policySlots' lib/render-helpers.mjs && grep -q 'const { base } = rootSlots' lib/render-helpers.mjs && grep -q 'action config:' test/render-helpers.test.mjs && grep -q 'action: \"config\"' guides/tool-reference.md && node pi-simple-world-model/bin/world_lint.mjs"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, guides/tool-reference.md, notes/pi-codemode-config-action.md]
supersedes: null
superseded_by: null
---

# The tool answers "what would my next call run under" in one row

`action: "config"` (`code: ""`) prints the configuration of the call that would come next: the
runner candidate and where it came from, the policy in force **plus the whole slot list with what
each slot holds**, what the call may narrow to, the roots in force and the roots-slot list, the
grants still in force on this branch, the registry scopes that exist, the guard and the per-call
timeout. It spawns no process, performs no effect and asks the policy no question, so the answer
costs one call and prints on a machine where no runner was found.

The rows are fed by `policySlots`, `rootSlots`, `runnerCandidates`, `registryScopes` and
`grantStatusLine` in `lib/render-helpers.mjs`, printed by `configLines` there; `resolvePolicy`
and `resolveRoots` now read the same slot lists rather than restating the order, so the answer
cannot drift from what the next call runs. `resolvePolicy`'s return shape is unchanged
(`{policy, source, refusedArgument}`), which is what the older renderer tests assert against it.

The slot list is what makes the answer actionable: a session that set `EYG_POLICY` and saw a
different policy in force can read "a grant or a spawner's policy sits above it and wins" off the
rows instead of guessing. `this call may narrow to` names the in-force policy and
`NARROWEST_POLICY_FILE` only - the rule the call's own `policy` argument is held to - and it
matches by **stem** (basename minus `.eyg`), because `shippedPolicies` in `extensions/eyg-codemode.ts`
hands over names with the extension stripped while the narrowest constant keeps it; comparing raw
strings made the row answer `nothing` for a session that really can narrow, a wrong answer rather
than a cosmetic one.

The branch sits after the guard-exists check, so a package whose `host/guard.eyg` is missing
refuses `config` with the guard message: naming a configuration nothing will run under is not an
answer. A config call counts against a grant's call budget (`ran: true` in its details), like
`reference`, `effects` and `list_functions`.

## What one live call measured

Two fresh one-shot sessions on scratch projects whose `.pi/settings.json` differ only in the
project keys, 2026-11-25 (`@measured 2026-11-25 by pi --print --mode json --tools eyg
--offline --no-session '<one config call>'`, run in parallel from each scratch project, 3 min
wall for the pair, both stderr files empty; the sessions are in `.ai-work/config-proof/`, which
the tree keeps untracked):

| project | the row that changed |
| --- | --- |
| no policy key, no roots | `policy in force: <pkg>/policies/agent-roots.eyg (the slot that chose it: package default)`, roots `(from the working directory)`, `may narrow to: agent-roots or deny-all` |
| `eyg.policy: "deny-all"` + one `eyg.roots` entry | `policy in force: <pkg>/policies/deny-all.eyg (the slot that chose it: project settings)`, the slot list showing `EYG_POLICY (unset)` below it, roots `(from project eyg.roots)`, `may narrow to: deny-all` only |

Only those rows differ between the two answers; both print the same runner, guard, grants and
timeout rows. The unit group `action config: the rows that name the runner, the policy slot that
chose it and the roots` in `test/render-helpers.test.mjs` pins the row shapes, including that a
grant beats `EYG_POLICY`, that a spawner's roots replace the project's and print what the
replaced slot held, that the `deny-all` answer offers only `deny-all`, and that the
grant-roots row appears only when a grant adds roots.

UNVERIFIED: n=1 round, one model, one thinking level. No live session had a grant in force, so
the grants row printed `no grant is in force now` both times; the grant interaction is pinned by
the unit test only. Whether a session asks the action on its own is untested here.

## Not this

- the order itself and what is configurable per project: `pi.policy-config`, and the table
  "Which policy a call gets" in `guides/how-to-write-a-policy.md`;
- what the policy decides for one effect: `overlay.policy-rules`, and `action: effects` live;
- the names the runtime has: `pi.reference-action`;
- the knobs and the environment variables: `guides/tool-reference.md`.
