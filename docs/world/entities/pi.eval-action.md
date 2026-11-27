---
id: pi.eval-action
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "node bin/agent/eval-entry-probe.mjs | grep -q 'eval answers 3 for' && grep -qF 'pure: mode === \"eval\"' extensions/eyg-codemode.ts && grep -qF 'pure = false' lib/render-helpers.mjs"
confidence: high
sources: [bin/agent/eval-entry-probe.mjs, lib/render-helpers.mjs, extensions/eyg-codemode.ts, notes/pi-codemode-eval-entry.md, test/fixtures/eval-shape.eyg, docs/world/entities/gap.eval-mode-answers-no-value.md]
supersedes: gap.eval-mode-answers-no-value
superseded_by: null
---
# An `eval` call prints the value the program computed

`action: eval` answers what the program computed, not what the guard refused. `entryProgram`
takes `pure` and, for it, writes two lines - import the program module, then `program.run({})` -
so the entry's last expression is the program's own value, which is the only thing `eyg eval`
prints. `runGuarded` passes `pure: mode === "eval"`, the same condition that decides the record
path.

The probe below is the whole chain, offline, in under half a second:

| step | answer |
| --- | --- |
| `node bin/agent/eval-entry-probe.mjs` - the entry `entryProgram` writes for an eval call, run as `eyg check` then `eyg eval` of the same file | `check: exit=0 in 0.268 s wall` / `Integer` / `eval: exit=0 in 0.128 s wall` / `3` / `eval answers 3 for !int_add(1,2)`, `exit=0` |

Before the change the same program answered `[]` in a live session, and the fresh one-shot
sessions that proved the difference printed `eyg eval: ran in 0.45 s wall` over `[]` before and
`eyg eval: ran in 0.22 s wall` over `3` after, both for `code: "!int_add(1,2)"`,
`action: "eval"` in a scratch project that declares this package.

**The eval entry is the one entry with no guard**, and that adds no reach: `eyg eval` has no
host for any effect, so a program that performs one gets `error: unhandled effect` and
performs nothing - the fixture asked for a `WriteFile` and the path it named does not exist
after (`@measured 2026-11-27`). The check of the same entry still runs first, so a mis-shape
inside an eval program is still named before the call answers.

## Not this

- what a `run` call prints, and what stdout text becomes: `guides/tool-reference.md`;
- the refusal record the entry writes in run mode: `docs/world/entities/gap.policy-record-extension.md`;
- the hole this closed, and what it cost before: `docs/world/entities/gap.eval-mode-answers-no-value.md`;
- why an eval entry needs no guard and what that leaves unbought: `notes/pi-codemode-eval-entry.md`;
- an ask whose types do not line up: `docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md`.
