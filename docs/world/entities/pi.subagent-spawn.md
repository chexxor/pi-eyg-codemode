---
id: pi.subagent-spawn
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "grep -q 'name: .eyg_subagent.' extensions/eyg-codemode.ts && grep -q SPAWNER_POLICY_ENV lib/render-helpers.mjs && grep -q rootsInside extensions/eyg-codemode.ts && grep -q DEPTH_ENV extensions/eyg-codemode.ts && node --test test/render-helpers.test.mjs"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, guides/how-to-spawn-a-subagent.md, notes/pi-codemode-subagent-spawn.md, docs/world/entities/pi.session-grants.md]
---
# A session can spawn one child session, inside its own reach

`eyg_subagent`, registered by `extensions/eyg-codemode.ts`, starts a second pi session in the
same working directory and reports what it did. The invariant: the child can do nothing the
spawner could not do itself, so delegating work never widens reach.

- **How it is started.** `pi.exec("pi", argv, {signal, timeout, cwd})` with
  `childArgv({task, model, trusted})` = `["--print","--mode","json","--tools","eyg",
  (--model <id>)?,(--approve)?, task]` - argv, no shell between, the spawner's working
  directory. `--tools eyg` leaves the child no `bash`, `read`, `edit` or `write`, and not even
  `eyg_subagent`; `--approve` is passed only when the spawner's project is already trusted,
  because an untrusted project loads no packages. The model is passed on as a `--model` pattern.
- **What it runs under.** `childEnvOverrides` sets `EYG_POLICY`, `EYG_SUBAGENT_POLICY`,
  `EYG_ALLOWED_ROOTS` and `EYG_CODEMODE_DEPTH = depth + 1` on the process for the spawn and
  restores them afterwards (`pi.exec` takes no `env`, so this is the only channel).
  `resolvePolicy` gained a spawner slot between the grant and the project key and `resolveRoots`
  one above the project roots; both are read only when the depth marker says this package started
  the process, which is why a project cannot claim a spawner's standing by setting the variables
  itself (`sessionDepth`, `spawnerPolicy`, `spawnerRoots`).
- **The three guards, refused before anything starts.** Roots: every one passed must satisfy
  `rootsInside(child, parent)`, the outside ones named back. Policy: `argumentPolicyPath` again,
  a preset this package ships and nothing else, so "a policy the spawner names" never means a
  module the model wrote. Depth: a session at `EYG_CODEMODE_DEPTH >= 1` is refused a child, so the
  tree is one level deep. Wall time: 120 s default, 300 s cap - wider than a checked call, because
  a whole session answers slower than one program.
- **A grant is not inherited.** The child's policy and roots are computed with the parent's
  session grant deliberately excluded, because a grant covers calls in the session where the
  operator said yes and a child has no call limit; a one-call grant could otherwise be spent over
  and over through a child. The refusal rows say so (`childRefusalRows`).
- **What comes back.** `childAnswer` is the child's final message; `childCalls` is one row per
  `eyg` call it made - module, where that module came from, its roots, its exit - and the
  deduplicated `refusals` are how the parent learns where the boundary fell without reading the
  child's transcript. A `deny-all` refusal names the field and no path, so there `refusals` is
  empty and the child's own answer is the evidence.

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

UNVERIFIED: the case where the project's `eyg.roots` name more than the slice and a spawner
narrows them - the scratch project named no roots, so only the unit test pins that ordering;
`EYG_CODEMODE_PI`, which was never needed because `pi` is on PATH here; a spawn from an untrusted
project (the `--approve` path was only reached from a trusted one); and the rendered rows in a
TUI - the proofs ran `--print`, and only the row shapes in `lib/render-helpers.mjs` are asserted.

## Not this

- the grant the operator gives this session: `docs/world/entities/pi.session-grants.md`;
- the order a call's preset and roots come from: `docs/world/entities/pi.policy-config.md` and
  `guides/how-to-write-another-preset.md`;
- why the child's boundary is built the way it is: `notes/pi-codemode-subagent-spawn.md`;
- how to use the tool: `guides/how-to-spawn-a-subagent.md`.

@measured 2026-11-20 by five one-shot parent sessions under `.ai-work/subagent/` (`pi --print
--mode json --tools eyg,eyg_subagent --approve`, recorded stdout in `.ai-work/subagent/*.jsonl`),
by `ls` of the scratch project's files and of `/tmp`, and by
`node --test 'test/*.mjs'` (pass 1, fail 0, 0.07 s: argv, the env overrides, the depth slots, the
roots slice rule and both render shapes are asserted).
