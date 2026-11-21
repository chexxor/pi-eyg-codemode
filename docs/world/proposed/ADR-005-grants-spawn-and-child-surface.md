---
id: ADR-005-grants-spawn-and-child-surface
type: adr
owner: delegate
status: proposed
verified_at: 2026-11-21
verify: "grep -q 'eyg-grant' extensions/eyg-codemode.ts && grep -q 'replayGrants' lib/render-helpers.mjs && grep -q childTools extensions/eyg-codemode.ts && grep -q callBudget extensions/eyg-codemode.ts && grep -q getActiveTools extensions/eyg-codemode.ts && test -f policies/spawner-effects.eyg && test -f docs/world/proposed/ADR-005-grants-spawn-and-child-surface.md"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, policies/spawner-effects.eyg, docs/world/entities/pi.session-grants.md, docs/world/entities/pi.subagent-spawn.md, docs/world/entities/pi.spawner-preset.md, notes/pi-codemode-session-grants.md, notes/pi-codemode-subagent-spawn.md, notes/spawner-effect-allowlist.md, docs/world/decisions/ADR-002-handler-seam.md]
supersedes: null
superseded_by: null
---

# ADR-005: widening is the operator's, narrowing is the spawner's

## Context

Three mechanisms went in during 2026-11-20, each answering a different question the code could not
answer for itself:

1. **`/eyg-grant`** - the operator widens *one session* after a refusal, for one tool call, N calls or
   the rest of the session (`docs/world/entities/pi.session-grants.md`).
2. **`eyg_subagent`** - a session delegates a chunk of work to a second pi session whose boundary is
   built from the spawner's own reach (`docs/world/entities/pi.subagent-spawn.md`).
3. **the child's surface** - the spawner names the child's tools, the effects its policy allows, and a
   call budget, enforced by a third shipped preset and by the child's own tool
   (`docs/world/entities/pi.spawner-preset.md`).

Read together they answer one question an operator asks before trusting an agent with tools: *who may
make a call wider, and who may make it narrower.* ADR-002 settled where the decision lives (the policy
module, host-side); this record settles who may change it, and it is one record because the three
mechanisms fail or hold together - a grant that reached a child, or an allowlist that could add reach,
would each undo the other two.

## Why

A delegate owns `proposed/`, not `decisions/` (`docs/world/roster.yaml`), so this record is a draft for
the human rather than a decision this agent recorded. It is written now because the mechanisms are in
the tree, measured, and about to be relied on by the next session, and an unrecorded decision gets
re-litigated. It groups all three because their interaction *is* the decision: every widening route was
closed by hand, one at a time, and a reader who changes one without the other reopens a hole.

## Decision

- **A widening is given by the operator, in a session, with a duration.** A call cannot widen itself:
  its `policy` argument may only name a preset this package ships. A wider module arrives through
  `/eyg-grant` (this session only, and its record is read back off the session branch), `eyg.policy` in
  the project settings, or `EYG_POLICY`. A program has no effect that changes any of that, and no new
  effect was added to make this work.
- **A grant does not travel.** It is not inherited by a child session, and it is not re-spent by a child
  that has no call limit. A session running under a grant does the granted work itself.
- **A narrowing is the spawner's to make, and it is checked against what the spawner already has.**
  Roots must sit inside the spawner's roots (`rootsInside`); the policy may only be a shipped preset;
  `effects` is probed against the reach this session actually has; `tools` must be a subset of
  `pi.getActiveTools()` and of `[eyg, read]`; a session at depth 1 gets no children.
- **A child's effect allowlist is enforced by a preset, not by the child's good behaviour.**
  `policies/spawner-effects.eyg` is `agent-roots.eyg` written out whole with an allowlist check per
  field, reading `EYG_SUBAGENT_EFFECTS`; unset names nothing and
  refuses every gateable effect; it cannot grant `fetch`, `standard_in` or `create_key`; and it
  combines with `agent-roots` only, so a project policy narrower than agent-roots is never replaced by
  something wider.
- **The call budget belongs to whoever spawned the session.** `max_calls` travels as
  `EYG_SUBAGENT_MAX_CALLS` and is enforced in the child's own copy of the `eyg` tool, counted off the
  session records, so a call that never reached a policy spends nothing. The child is stopped with a
  refusal that tells it to report what it has.
- **`read` may be given to a child, and that is the one deliberate exception to "every channel is
  checked".** pi's own `read` tool is not decided by any policy module. It is allowed because an
  effect-only child cannot open this package's guides otherwise, and it is bounded because it is off by
  default and cannot exceed the tools the parent session already has.

## Alternatives rejected

- **`ctx.executeTool` for the child.** Cheaper, and rejected: it runs with this session's policy, roots
  and environment, so a "subagent" would be this session with a longer prompt.
- **Inheriting a grant into a child.** One yes would buy unlimited calls in a session with no operator
  in front of it.
- **One preset per set of effects.** 512 subsets over nine gateable fields; the copied preset plus one
  environment variable keeps the decision in the policy module and the file count at one.
- **Treating an unset allowlist as "no opinion" (allow everything the base preset allows).** That makes
  the wide behaviour the default and the narrowing the thing you have to remember.
- **A budget enforced by a policy rule or by a new "how many calls have I made" effect.** A policy module
  has no per-session counter, and a new effect is a change to the language, not to this package.
- **Refusing `read` outright.** The child then cannot read the reference and spends its budget guessing
  builtins - the measured cost of not reading the reference is 41-93 calls and 16-57 invented builtins
  (`docs/world/entities/usability.without-language-skill.md`).

## What it costs

The narrowing preset is a copy of `agent-roots.eyg` and can drift from it (recorded in
`notes/spawner-effect-allowlist.md` with its trigger). A session under a grant cannot delegate granted
work. The budget binds a session this package started, not a `pi` a human starts by hand. A child given
`read` reads with the parent's `read` reach, which is wider than the roots - stated in the guide rather
than hidden.

## Verification performed

All commands run in this workspace, 2026-11-20, exit code in parentheses.

- `bin/agent/audit.sh` - six gates, `6/6 passed, 0 failed, 5 s wall`, of which
  `node --test 'test/*.mjs'` 0.10 s (pass 1, fail 0: the tool allowlist, the effect-name mapping, the
  budget, the env names, argv and both render shapes), `world_verify.mjs --all` 2.14 s (77 claims,
  0 failing), the tracked-path-and-name sweep 0.01 s (no file printed). Exit 0.
- `test -x .local/eyg-checked && .local/eyg-checked check policies/spawner-effects.eyg && EYG_ALLOWED_ROOTS=$PWD
  EYG_SUBAGENT_EFFECTS=read_file,standard_out .local/eyg-checked run --policy $PWD/policies/spawner-effects.eyg
  test/fixtures/refusal-probe.eyg 2>&1 | grep -q 'write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out'
  && env -u EYG_SUBAGENT_EFFECTS EYG_ALLOWED_ROOTS=$PWD .local/eyg-checked run --policy $PWD/policies/spawner-effects.eyg
  test/fixtures/refusal-probe.eyg 2>&1 | grep -q 'standard_out denied by policy: EYG_SUBAGENT_EFFECTS=$'`
  - the preset type-checks with 18 fields, an allowlist refusal names the whole list, and an unset list
    refuses the first gateable effect the program asks for. Exit 0 (0.33 s).
- One live parent session with `tools`, `effects`, `max_calls: 6` and roots narrowed to a slice:
  154 s wall, exit 0, child answered in 53.61 s with 3 `eyg` calls, budget unspent; a read inside the
  slice printed the file, a write inside it was refused by the allowlist, a read outside the slice was
  refused by path, and the child's `read` tool read that same file. Both refusals came back in the
  parent's report. Exit 0.
- One live parent session with `max_calls: 2`: 123 s wall, exit 0, child answered in 1:03; calls 1-2 ran,
  calls 3-4 answered `this session has made 2 eyg calls and its spawner set a budget of 2`, and the
  parent's header said `call budget: 2, spent`. Exit 0.

## Not this

- what a policy rule may return, and why a refusal is a value: `docs/world/decisions/ADR-002-handler-seam.md`;
- the mechanism's shape as built: `docs/world/entities/pi.session-grants.md`,
  `docs/world/entities/pi.subagent-spawn.md`, `docs/world/entities/pi.spawner-preset.md`;
- the per-decision trade-offs: `notes/pi-codemode-session-grants.md`,
  `notes/pi-codemode-subagent-spawn.md`, `notes/spawner-effect-allowlist.md`;
- how to use any of it: `guides/how-to-spawn-a-subagent.md`, `guides/tool-reference.md`.
