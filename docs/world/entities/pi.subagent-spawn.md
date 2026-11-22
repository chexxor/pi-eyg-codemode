---
id: pi.subagent-spawn
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "grep -q 'name: .eyg_subagent.' extensions/eyg-codemode.ts && grep -q SPAWNER_POLICY_ENV lib/render-helpers.mjs && grep -q rootsInside extensions/eyg-codemode.ts && grep -q DEPTH_ENV extensions/eyg-codemode.ts && grep -q childTools extensions/eyg-codemode.ts && grep -q CHILD_TOOL_ALLOWLIST lib/render-helpers.mjs && grep -q EFFECT_ALLOWLIST_ENV lib/render-helpers.mjs && grep -q MAX_CALLS_ENV lib/render-helpers.mjs && grep -q callBudget extensions/eyg-codemode.ts && grep -q getActiveTools extensions/eyg-codemode.ts && node --test test/render-helpers.test.mjs"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, policies/spawner-effects.eyg, guides/how-to-spawn-a-subagent.md, notes/pi-codemode-subagent-spawn.md, notes/spawner-effect-allowlist.md, docs/world/entities/pi.session-grants.md, docs/world/entities/pi.spawner-policy.md]
---
# A session can spawn one child session, inside its own reach

`eyg_subagent`, registered by `extensions/eyg-codemode.ts`, starts a second pi session in the
same working directory and reports what it did. The invariant: the child can do nothing the
spawner could not do itself, so delegating work never widens reach.

- **How it is started.** `pi.exec("pi", argv, {signal, timeout, cwd})` with
  `childArgv({task, model, trusted, tools})` = `["--print","--mode","json","--tools",
  <the names joined>, (--model <id>)?,(--approve)?, task]` - argv, no shell between, the spawner's
  working directory. `tools` defaults to `["eyg"]`, and `CHILD_TOOL_ALLOWLIST` is `["eyg", "read"]`,
  so the child never gets `bash`, `edit`, `write` or `eyg_subagent`; `--approve` is passed only when
  the spawner's project is already trusted, because an untrusted project loads no packages. The model
  is passed on as a `--model` pattern.
- **What it runs under.** `childEnvOverrides` sets `EYG_POLICY`, `EYG_SUBAGENT_POLICY`,
  `EYG_ALLOWED_ROOTS` and `EYG_CODEMODE_DEPTH = depth + 1` on the process for the spawn and
  restores them afterwards (`pi.exec` takes no `env`, so this is the only channel).
  `resolvePolicy` gained a spawner slot between the grant and the project key and `resolveRoots`
  one above the project roots; both are read only when the depth marker says this package started
  the process, which is why a project cannot claim a spawner's standing by setting the variables
  itself (`sessionDepth`, `spawnerPolicy`, `spawnerRoots`).
- **The child's three knobs, each checked against what the parent already has.** `tools` must be
  inside `CHILD_TOOL_ALLOWLIST`, must include `eyg`, and must be a subset of `pi.getActiveTools()` - a
  tool this session does not have is refused by name (`childTools` → `unknown`, `withoutEyg`,
  `parentMissing`). `effects` is validated by the existing `action: "effects"` probe under the policy
  *and the roots this session actually has*, and is enforced by a shipped narrowing policy, not by a
  promise (`docs/world/entities/pi.spawner-policy.md`). `max_calls` travels as
  `EYG_SUBAGENT_MAX_CALLS` (`MAX_CALLS_ENV`) because pi has no flag that caps tool calls, and is
  enforced inside the child's own copy of the `eyg` tool: `callBudget(process.env, chain.depth)`
  compares the budget with `eygCallCount(sessionBranch(pi, ctx))`, the same scan a grant is spent by,
  so a call that never reached a policy spends nothing of the budget.
- **The three guards, refused before anything starts.** Roots: every one passed must satisfy
  `rootsInside(child, parent)`, the outside ones named back. Policy: `argumentPolicyPath` again,
  a policy this package ships and nothing else, so "a policy the spawner names" never means a
  module the model wrote. Depth: a session at `EYG_CODEMODE_DEPTH >= 1` is refused a child, so the
  tree is one level deep. Wall time: 120 s default, 300 s cap - wider than a checked call, because
  a whole session answers slower than one program.
- **A grant is not inherited.** The child's policy and roots are computed with the parent's
  session grant deliberately excluded, because a grant covers calls in the session where the
  operator said yes and a child has no call limit; a one-call grant could otherwise be spent over
  and over through a child. The refusal rows say so (`childRefusalRows`).
- **What comes back.** `childAnswer` is the child's final message; `childCalls` is one row per
  `eyg` call it made - module, where that module came from, its roots, its exit, and the budget on
  the rows where the budget stopped the call - and the deduplicated `refusals` are how the parent
  learns where the boundary fell without reading the child's transcript. A `deny-all` refusal names
  the field and no path, so there `refusals` is empty and the child's own answer is the evidence.
  The header row names what the child was given: `child under <policy> (<source>), roots <roots>,
  tools <tools>, call budget: N, spent|not spent`, and a spent budget adds `the child spent its call
  budget and was told to report what it has: raise max_calls, give it a smaller task, or do the rest
  here` (`subagentResultRows`, `budgetRefusal`).

Measured 2026-11-20 in a scratch project (gitignored under `.ai-work/`) whose `.pi/settings.json`
declared this package and named `agent-roots` with no roots, one parent `pi --print --mode json`
session per row. A spawn with no arguments answered `argv: --print --mode json --tools eyg
--model <id> --approve <task>`, 11 child calls every one of them `policySource: spawner`,
`childRoots` = the project directory, `exit 0`, 1:01 wall: the child wrote `child-inside.txt`
(6 bytes, read back as `inside`) and reported
`Error("write_file denied by policy: /tmp/child-outside.txt")`, and no such file existed; the same
run's parent `eyg` calls still worked (`parent-inside.txt`, 6 bytes, `policySource: project
settings`). A spawn with `roots: ["<project>/sub"]` gave `childRoots` = the slice, wrote
`sub/inside-slice.txt` and was refused at `<project>/outside-slice.txt` with
`refusals: [{write_file, .../outside-slice.txt}]`, and no such file existed. A spawn with
`policy: "deny-all"` reported the child policy as `policies/deny-all.eyg` (`policySource:
argument` to the parent, `spawner` inside the child) and wrote nothing. A spawn with
`roots: ["/tmp"]` was refused: `these are outside: /tmp`, nothing started. A session started with
`EYG_CODEMODE_DEPTH=1` was refused the spawn itself: `this session is itself a subagent (depth 1)
... the tree this package spawns is one level deep`. `pi list` in that project resolves the
declaration `../../../..` to this package, which is how the child gets the `eyg` tool with no
extra flag, and the child recorded its own session file under pi's session directory for that
working directory (64 KB, model `strata/qwen3.8-flash-next-iq3_s`).

## Two more runs, with the child's surface named

The same scratch project, this time `.pi/settings.json` naming `agent-roots` and `eyg.roots` = the
project directory, so the roots the spawner narrows are a project's own roots rather than the
default working directory. Parent started with `--tools eyg,eyg_subagent,read` so the tool check has
something to check (`parentTools` came back `["eyg","eyg_subagent","read"]`).

| spawn | what the child got | what the run showed |
| --- | --- | --- |
| `tools: ["eyg","read"]`, `effects: ["ReadFile","StandardOut"]`, `max_calls: 6`, `timeout: 150`, `roots: [<project>/data]` | `--tools eyg,read` in argv; `policies/spawner-effects.eyg` as the child policy (`policySource: "project settings narrowed to the fields named"`, `basePolicy` agent-roots); `effectFields: [read_file, standard_out]`; every child call recorded `roots <project>/data` with `parentRoots <project>` | 154 s wall exit 0, 3 child `eyg` calls of budget 6 (not spent), 1 child `read` call. A read inside the slice printed the file; a `WriteFile` **inside** the slice came back `write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out`; a read of a file inside the parent's root but outside the slice came back `read_file denied by policy: <abs path>`; the `read` tool read that same file. Both refusals were listed in the parent's report. `builtin undefined` in the parent's results: 0 |
| `max_calls: 2`, four identical reads | budget 2, `spent` | 123 s wall exit 0, child answered in 1:03: calls 1-2 ran (`exit 0`), calls 3-4 answered `this session has made 2 eyg calls and its spawner set a budget of 2...` and the rows read `out of calls (budget 2)`, and the parent's header said `call budget: 2, spent` plus the raise-max_calls row |

The earlier session of this set (`max_calls: 6`, 120 s child timeout) died at the child timeout with
exit 143 and `refusals: []` while the child wrote its own EYG: it spent calls on syntax errors and
never reached the steps that would have been refused. A proof whose child must hit a boundary hands
the child programs to paste (`guides/how-to-spawn-a-subagent.md`).

A third run `@measured 2026-11-22` re-took that row through the guard this package ships and the
three results came back the same; that table now lives in `docs/world/entities/pi.spawner-policy.md`.

UNVERIFIED:
`EYG_CODEMODE_PI`, which was never needed because `pi` is on PATH here; a spawn from an untrusted
project (the `--approve` path was only reached from a trusted one); the rendered rows in a TUI - the
proofs ran `--print`, and only the row shapes in `lib/render-helpers.mjs` are asserted; and a child
refused by the *tools* check or by a `Fetch`-in-`effects` request - both are pinned by the unit test
and by the refusal text in `extensions/eyg-codemode.ts`, never asked for live.

## Not this

- the grant the operator gives this session: `docs/world/entities/pi.session-grants.md`;
- the order a call's policy and roots come from: `docs/world/entities/pi.policy-config.md` and
  `guides/how-to-write-a-policy.md`;
- why the child's boundary is built the way it is: `notes/pi-codemode-subagent-spawn.md`, and for the
  allowlist, budget and tool set: `notes/spawner-effect-allowlist.md`;
- what the effect allowlist enforces and how it was probed: `docs/world/entities/pi.spawner-policy.md`;
- how to use the tool: `guides/how-to-spawn-a-subagent.md`.

@measured 2026-11-20 by five one-shot parent sessions under `.ai-work/subagent/` (`pi --print
--mode json --tools eyg,eyg_subagent --approve`, recorded stdout in `.ai-work/subagent/*.jsonl`) and
two more under `.ai-work/spawn-surface/` (`pi --print --mode json --offline --approve --no-session
--no-context-files --tools eyg,eyg_subagent,read --model <id> --thinking low`, transcripts
`run1c.json` and `run2.json`, all gitignored), by `ls` of the scratch project's files and of `/tmp`,
and by `node --test 'test/*.mjs'` (pass 1, fail 0, 0.12 s: argv including `--tools`, the env
overrides including the allowlist and the budget, the depth slots, the roots slice rule, the tool
allowlist, the effect-name mapping and both render shapes are asserted). Every session above ran
through a development build of the language CLI this tree no longer has
(`docs/world/entities/cli.runner-official-install-only.md`), so the child's writes and refusals are
a dated record here, not a command that runs today; the argv, env and budget assertions still run.
