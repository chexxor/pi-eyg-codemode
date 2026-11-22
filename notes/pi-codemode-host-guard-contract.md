---
name: pi-codemode-host-guard-contract
description: Why the shipped guard answers a refusal in each effect's own shape, why Now/Random/Flip refusals end the program, why `search` is its own policy field, why a policy module takes `rules(ctx)` instead of reading the environment, and why the guard walks the tree for a search
date: 2026-11-22
---

The host moved from the CLI's `--policy` flag to `host/guard.eyg`, a program this
package ships. Five decisions came with it, each measured on the installed
`eyg v0.1.0` with no flag; the probes are in
`.ai-work/host-live/` and the proof that re-runs them is `.ai-work/host-live/proof/run.sh`.

**A rule answers `Pass(value)` or `Mock(reason)`, not a whole reply value.** The
CLI's rule vocabulary let a rule hand back the exact value the program would
receive (`Mock(Error("read_file denied by policy: /tmp/x"))`, `Mock(None({}))`,
`Mock(Error({}))`). Inside an EYG handler the answer must type against that one
effect's reply, so a single record of same-typed rules cannot carry 19 different
reply shapes: the guard reads the reason and builds the shape the effect allows -
`Error(reason)` where the reply is a `Result`, `None({})` for `Env`, `Error({})`
for `CWD` (this host's `CWD` reply has no text in its `Error`, measured with
`eyg check`: `[Ok: String | Error: {}]`), the unit value for `Sleep`,
`StandardOut` and `StandardError`. The preset text survives everywhere it can.

**A refused `Now`, `Random` or `Flip` ends the program.** Their replies are
`Integer` and `True({}) | False({})`, which cannot carry a refusal, and inventing
a value would tell the program something false. The guard answers
`resume(!never(perform Abort(reason)))`, which the binary reports as
`Aborted with reason: "<field> denied by policy: ..."` and stops (`eyg run` on
`.ai-work/host-live/proof`, spawner-effects row, 2026-11-22). This is only
reachable from `spawner-effects.eyg`, which refuses a pass-through field the
spawner did not name; `agent-roots.eyg` and `deny-all.eyg` pass all three.

**`search` is its own policy field.** The CLI folded `Search` into the `read_file`
field (`test/fixtures/rule_mapping.gleam`), and one rule value used by two
handlers does not type-check in a guard chain: a `handle Search` clause that calls
`policy.read_file(...)` next to a `handle ReadFile` clause that calls the same
field fails with `error: Recursive / this expression has a recursive type which is
not supported` (`eyg check`, 2026-11-22; the shortest case is two handlers whose
bodies each call one shared record field). So a policy writes its roots rule twice,
once per field. Consequence for the spawner: naming `read_file` no longer lets a
child search, so a child surface that wants both names both. That is a narrowing,
never a widening, and it removes a wart the old record had - the pair was one
field, so a spawner could not refuse a search while allowing reads.

**A policy module exports `rules(ctx)` and asks for nothing.** The old
`agent-roots.eyg` read its roots with `perform Env("EYG_ALLOWED_ROOTS")` at the top
of the module. Under an EYG host that module is imported by the generated entry,
and an effect at an imported module's top level is refused before any handler is
installed (`error: unhandled effect Env(...)` with no guard in the program at all,
measured 2026-11-22), so the values have to arrive as arguments: the tool writes
`{roots: [...], cwd: "...", fields: [...]}` as a literal into the entry it generates
for the call and passes it to both `rules` and the guard. This also drops two
environment variables from the contract (`EYG_ALLOWED_ROOTS`, `EYG_SUBAGENT_EFFECTS`)
in favour of that one record.

**The guard is the host for `Search`.** The installed binary has no `Search`
effect: `perform Search({...})` answers `unhandled effect` under `run`, `script`
and `eval` alike (measured 2026-11-22), because the label arrives with the CLI's
policy layer rather than with the plain harness. Keeping the documented surface
means implementing it here: the guard decides the root through the `search` rule,
then lists the tree with `ReadDirectory` - a guarded effect, so a directory the
`read_directory` rule refuses is never listed - and matches the pattern the way the
language's own search effect does (`*` inside a segment, `**` as a whole segment,
equality otherwise, one `*` per segment), returning absolute paths up to `limit`.
The cost over the CLI's version: a search is one decision for the root plus one
per directory it walks, instead of a single decision for the whole walk.

**The guard resolves paths itself.** A path reaches a handler exactly as the
program wrote it - `./out.txt`, not the absolute path the CLI would have handed a
policy - so `absolute(ctx.cwd, path)` runs before any rule, and the effect is
performed with the resolved path. A refusal therefore names an absolute path, as
the guides already say it does.
