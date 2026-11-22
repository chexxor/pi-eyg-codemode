# Run a pi agent whose side effects are EYG effects only

*Reference copied from the language repository on 2026-11-18 and re-pointed to this
workspace: the costs in it were measured there (`@measured 2026-11-15`) and stay as
they were; commands marked "here" were re-measured in this tree on 2026-11-18. On
2026-11-19 the word "gate" was replaced with "the checks" throughout, so this page's
wording is this tree's and not the website's.*

A pi agent normally codes in JavaScript (`builtin:codemode`) and can call `bash`,
`edit`, `write` and `read`. This workspace runs the agent in EYG instead, through
this package: the model gets one tool, `eyg`, and an EYG program reaches the
outside world **only** through effects, each decided by a host-side policy module
before the host performs it. A denied effect is an EYG error such as
`write_file denied by policy: /abs/path` and nothing happened on disk, so the
model can read the permission it was refused and act on it.

The runner that makes this possible is in the language repository
(`packages/gleam_cli/src/eyg/cli/policy_runner.gleam`, `eyg run --policy <module.eyg>`);
this tree carries its rule table as a snapshot (`test/fixtures/rule_mapping.gleam`) and
the claim over it in `docs/world/entities/overlay.policy-rules.md`. The checks already
existed; what this adds is running the runner with them on the host side of a one-shot run,
because a policy written inside the program cannot constrain that program (see
`notes/pi_codemode_host_gate.md` for why).

## The gap, before the fix

A one-shot evaluation is not checked, and that is the trap this whole design works
around: `eyg run -c 'perform WriteFile({path: "/tmp/eyg-gap-proof/outside/escape.txt", ...})'` wrote
the file (8 bytes, 0.06 s wall `@measured 2026-11-15`) and an unchecked `Fetch` through
`eyg_packages/http` wrote 577 bytes from `example.com` (1.46 s wall). Put in front of a
model, that is a program that can write anywhere this user can. The fix is not a policy
inside the program - the program that checks itself is the program that can skip the
check - it is starting the runner with rules: `--policy <module.eyg>`. `docs/world/traps.md`
carries the same fact with the command that re-proves it.

## Configure the session

`.pi/settings.json` picks the tools; the policy, the roots and the runner are set per
session, and each has a default inside the package: the policy defaults to this
package's `policies/agent-roots.eyg` resolved from the package directory, the runner is
probed for one whose `--help` advertises `--policy`, and the roots default to the
session working directory, exported as `EYG_ALLOWED_ROOTS` for the call and restored
after it. Nothing has to be configured for a first session to run with the checks in force.

The **EYG-only** shape - the model gets nothing but `eyg` - is:

```json
{
  "packages": [".."],
  "extensions": ["-builtin:codemode"],
  "defaultTools": []
}
```

`defaultTools: []` removes every built-in tool (`read`, `bash`, `edit`, `write`,
`grep`, `find`, `ls`) - an empty array disables built-ins but not extension tools,
so the `eyg` tool from the package stays. `-builtin:codemode` disables the built-in
JavaScript codemode, so no script can reach a tool that checks nothing. What this workspace
actually declares on 2026-11-18 is the wider shape - the package itself (`..`), the
vendored world model, `npm:@woksin/pi-context-budget`, a language-skill package declared
outside this tree, compaction off, and `defaultTools` left at
`read, edit, write, bash, codemode, grep` - so a session here still has the plain
file tools alongside `eyg`.

From this workspace root the package *is* the root, so the declaration is the
workspace itself (0.3 s wall in the language repository; `pi install . -l` here writes
`..`, measured 2026-11-18):

```bash
pi install . -l                       # writes ".." into .pi/settings.json
pi install ./pi-simple-world-model -l # writes "../pi-simple-world-model"
pi list                               # Project packages: .. -> this repository's root
                                      # ../pi-simple-world-model -> the vendored copy inside it
                                      # plus whatever the language-skill declaration resolves to
```

`pi list` prints the resolved absolute path; the entries read `..` and
`../pi-simple-world-model` because a local package is written relative to
`.pi/settings.json`, which lives one level down (see `docs/world/traps.md`).

Then point the tool at one policy for the session:

```bash
# the runner that checks effects is built in the language repository; it is NOT vendored here,
# so from this tree these lines are the shape to set, with your own paths, not a run.
export EYG_CODEMODE_RUNNER=<absolute path to a --policy-capable eyg>
export EYG_POLICY=<absolute path to this package>/policies/agent-roots.eyg
export EYG_ALLOWED_ROOTS=<absolute path to this package>,/tmp/agent-workspace
```

The `EYG_POLICY` path is this workspace's shipped policy; the default is the same
file resolved from the package, so setting nothing works. The prebuilt `eyg` on
`PATH` here is v0.1.0 and predates `--policy` (re-measured 2026-11-21: its help has no
`--policy`), so that candidate is never chosen and the probe finds no runner: the tool refuses
every call. A checked call was seen on 2026-11-20 through a development build of the language
CLI that this tree no longer points at and no longer has
(`docs/world/entities/cli.checked-runner-on-this-host.md`, superseded).

## One-shot session, and what it costs

`--print` is what makes pi run once; `pi --mode json` without it stays interactive
and never exits (see `docs/world/traps.md`). A session with a real model call is an
event, not a loop: 44 s (two calls), 55 s (one refusal), 99 s (a refusal plus a
read-back), 142 s (four calls), `@measured 2026-11-15` with `/usr/bin/time`.

```bash
pi --print --mode json --approve "write /tmp/agent-workspace/outside/probe.txt containing hello"
```

The tool call and its result are events in the stream; a refusal looks like:

```json
{"type":"tool_execution_end","toolName":"eyg",
 "result":{"content":[{"text":"eyg run: exit 1\nwrite_file denied by policy: /tmp/agent-workspace/outside/probe.txt"}],
 "details":{"gated":true,"ran":true,"exit":1,"policy":".../agent-roots.eyg"}}}
```

and the file does not exist, while a write under an allowed root returns
`eyg run: ran` and leaves the bytes on disk.

## The loops, with their cost

Rows marked *language repository* are commands that run in that repository,
not here: nothing here builds the CLI or runs the language suite, and their costs were
measured there `@measured 2026-11-15`. Rows marked *here* were re-measured in this tree
on 2026-11-18.

| loop | command | cost, wall |
| --- | --- | --- |
| one EYG expression (here, the CLI on PATH) | `eyg eval -c '!int_add(1, 1)'` | 0.06 s, measured there |
| one run with checks in force (refusal) (language repository) | `<a --policy runner> run --policy <module> -c '<write outside root>'` | 0.06-0.07 s measured there; not runnable on this machine today - no named runner carries the flag, and this tree starts no build (`AGENTS.md`) |
| one unchecked write (language repository, the gap) | `eyg run -c '<WriteFile>'` | 0.06 s - do not run it here |
| the codemode package suite (language repository) | `eyg script eyg_packages/codemode_policy/entry.eyg` | 2.3 s - not runnable here |
| the whole EYG suite (language repository) | `eyg script entry.eyg` | 5.7 s (100 tests, 0 failed) - not runnable here |
| every committed policy rule needed? (language repository) | `node scripts/mutation-check.mjs` | 13.5-15.4 s (6 suite runs) - not here: no such script in this tree |
| one type-check of this package's modules (here) | `for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done` | in `AGENTS.md`'s command table |
| this package's unit test (here) | `node --test 'test/*.mjs'` | in `AGENTS.md`'s command table |
| the world model checks (here) | `node pi-simple-world-model/bin/world_lint.mjs`, `world_map.mjs --check`, `pi --world-model-check` | in `AGENTS.md`'s command table |
| a live agent session | `pi --print --mode json --approve '<prompt>'` | 44-142 s - an event |

`gleam_cli` supports the javascript/bun target on this host; `erl` and `escript`
are absent, so a beam run of that suite is a missing Erlang runtime, not a code fault
(`docs/world/traps.md`).

## Reading a result

| result line | meaning |
| --- | --- |
| `eyg run: ran` | the program performed effects the policy allowed |
| `eyg run: exit 1` + `write_file denied by policy: <path>` | the policy refused; nothing on disk changed |
| `eyg run: exit 1` + `error: ...` | the program did not parse or failed; fix the program |
| `eyg refused: no policy module was configured` | the tool refuses to run a program it cannot check |

A refusal is a fact about the permission, not a crash: do not look for another
channel, there is none in this session. Change the path, the host, or report it.
A program that keeps going after a refusal must check its evidence with a later
`ReadFile`/`ReadDirectory` rather than assume either outcome.

## Writing the program

`skills/eyg-codemode/SKILL.md` carries the forms the model needs (`perform` with one
argument record, `let _ =` binding before a following expression, no infix operators).
`guides/syntax.md` and `guides/cli_effects_reference.md` are the language and effect
reference; the policy vocabulary is written out inside this package's policies
(`policies/agent-roots.eyg`, `policies/deny-all.eyg`) rather than imported - see
`notes/pi-codemode-policy-inlining.md` for why, and for the fact that the language
workspace's policy library and its security suite are no longer reachable from here.

The policies this package ships are those two. The language repository's richer set
(`agent(roots)`, `reader(roots)`, `fetching(roots, hosts)`, `service(...)`, `nothing`)
lives in `eyg_packages/codemode_policy/index.eyg` there; to get a policy with that
shape here, write it in a policy module of your own, one rule per effect, and point
`EYG_POLICY` at it. A token belongs in the policy module - the policy is host authored
and may read the environment, the program may not.

## Proving it

From this workspace root, in this order (costs are in `AGENTS.md`'s command table):

```bash
node --test 'test/*.mjs'                              # the shapes, and the drift guard
for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done   # the modules parse and type-check
node pi-simple-world-model/bin/world_verify.mjs --all  # every claim, re-run
node pi-simple-world-model/bin/world_lint.mjs          # the records themselves
pi --world-model-check                                 # the same checks as a pi session sees them
```

What a checked call proves is the decision, not its coverage. The rows recorded
`@measured 2026-11-20` in `docs/world/entities/cli.checked-runner-on-this-host.md` show one
write performed inside the roots and one refused outside them. What stays UNVERIFIED is that
**every** rule decides as recorded: that proof is the language repository's - a runner built
there (`bin/agent/gate.sh gleam_cli`), the suite in `eyg_packages/codemode_policy/`, and
`scripts/mutation-check.mjs`, which loosens one rule of the policy library at a time
and requires the security suite to fail. This tree carries the *record* of those results
(`test/fixtures/rule_mapping.gleam` plus `notes/pi-codemode-policy-inlining.md`), not the
test. Point the tool at a runner of your own, re-run the probes, and let the claims move with
the output.

## Limits

- The security suite asserts the decision each rule makes, by calling the same policy
  functions and checking real fixture evidence on disk; the host-side proof
  is the transcript above.
- `DecodeJSON`, `EYGParse`, `Hash` and `Sign` are `Unchecked` in the language
  workspace's `rule_mapping`, recorded here at `test/fixtures/rule_mapping.gleam`: they
  are performed without asking the policy, so no policy - this package's included - can
  forbid them (`docs/world/traps.md`).
- Publishing a package, cutting a release or pushing remains the operator's act.
