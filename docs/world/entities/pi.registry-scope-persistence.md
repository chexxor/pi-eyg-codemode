---
id: pi.registry-scope-persistence
type: entity
owner: delegate
status: current
verified_at: 2026-11-25
verify: "t=$(mktemp -d) && h=$(mktemp -d) && printf inside > $t/inside.txt && node bin/agent/refusal-probe.mjs --roots $t --program test/fixtures/registry-plant-probe.eyg 2>&1 | grep -q 'PLANTED IN REGISTRY SCOPE' && node bin/agent/registry-walk.mjs --cwd $t --home $h --no-package 2>&1 | grep -qF 'persist_probe [workspace]' && node bin/agent/refusal-probe.mjs --roots $t --program test/fixtures/registry-bind-probe.eyg 2>&1 | grep -q 'outside: read_file denied by policy' && node bin/agent/registry-walk.mjs --cwd $t --home $h --no-package 2>&1 | grep -qF 'entry persist_probe [workspace] this project wrote it' && grep -q 'export function scopeOwner' lib/render-helpers.mjs && grep -q 'export function registryScopeLegend' lib/render-helpers.mjs && grep -q 'owner: ' extensions/eyg-codemode.ts && grep -q 'registryScopeLegend' extensions/eyg-codemode.ts && grep -q 'the registry labels: whose module an entry is' test/render-helpers.test.mjs && rm -rf $t $h"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, bin/agent/refusal-probe.mjs, bin/agent/registry-walk.mjs, guides/how-to-share-functions.md, test/fixtures/registry-plant-probe.eyg, test/fixtures/registry-bind-probe.eyg, host/guard.eyg, policies/agent-roots.eyg, docs/world/entities/pi.variable-scopes.md, docs/world/entities/host.guard-boundary.md, notes/pi-codemode-threat-model.md]
supersedes: null
superseded_by: null
---
# Persistence between calls: a planted module runs, and its effects are decided again

A session's roots contain the two directories a call can leave code in for a later call: the
function-registry scope `<cwd>/.pi/eyg-functions` (the scope list is `registryScopes`,
`extensions/eyg-codemode.ts:261`) and the kept-binding scope `<cwd>/.pi/eyg-variables/`
(`fileVariableBindings`, `extensions/eyg-codemode.ts:403`, whose prelude `keptBindings` builds at
`:430`). Neither is in `ctx.protected`, which names the package's `host/` and `policies/` and a
policy module outside them (`hostProtectedPaths`, `lib/render-helpers.mjs:379`). Measured
2026-11-24: the plant lands, a later call lists it, binds it and runs it, and the run is decided
again.

## The plant, the listing, the run

Offline pair, 0.43 s for the three commands (`$t` a scratch root, `$h` a scratch home, the program
runs in its own scratch directory outside `$t`):

| step | answer |
| --- | --- |
| `node bin/agent/refusal-probe.mjs --roots $t --program test/fixtures/registry-plant-probe.eyg` - the program performs `MakeDirectory` and `WriteFile` of a module carrying a `metadata` record, inside its own root | `PLANTED IN REGISTRY SCOPE`, `exit=0` |
| `node bin/agent/registry-walk.mjs --cwd $t --home $h --no-package` - the tool's own `buildRegistry` (`lib/render-helpers.mjs:2023`) over the planted tree, reading nothing else | `entry persist_probe [workspace] <t>/.pi/eyg-functions/persist-probe.eyg persist_probe_lib.marker(path) -> Result(Binary, String) - planted by the probe: reads the path the caller names` |
| `node bin/agent/refusal-probe.mjs --roots $t --program test/fixtures/registry-bind-probe.eyg` - a **later** call imports that module and calls `lib.marker` twice | `inside: landed` and `outside: read_file denied by policy: <scratch>/outside.txt`, `exit=0` |

The same three steps run live through the `eyg` tool, under `policies/agent-roots.eyg` with this
package as the root (2026-11-24, 0.18 s, 0.50 s, 0.18 s): the plant call answered `mkdir: ok` and
`write: ok`; the next call, `action: list_functions`, listed `live_probe [workspace]` and printed
the planted module's own signature and description; the third call named
`libraries: ["live_probe"]` and the planted `marker` ran - `inside: landed` for a file under the
root, `outside: read_file denied by policy: /tmp/live-persistence-outside.txt` with the grant rows
for the one outside it.

**Planted code runs inside the guard.** The entry imports the program module *inside* the guarded
body (`entryProgram`, `lib/render-helpers.mjs:458`), so every effect a planted function performs
goes through `host/guard.eyg` and the policy in force for the call that binds it. Persistence plants
code, a name, and listing text; it adds no reach. `docs/world/entities/gap.one-host-check-not-transitive.md`
is the record of the route where a planted module hosts its own effects instead, and what that costs.

**The listing is a channel into a later session's context.** `action: list_functions` and
`action: describe_function` print the planted module's `description` and `signature` verbatim: what
one call wrote becomes text a later model reads as this tool's own documentation of a function.
The listing labels whose module each entry is, so the channel is at least attributed: `scopeOwner`
and `registryScopeLegend` (`lib/render-helpers.mjs`) feed one line per entry whose scope is not
`package` and three header lines, and the offline walk prints the same strings:
`entry persist_probe [workspace] this project wrote it: not shipped with this package`. The live
rows are quoted in the section below.

**A name clash resolves to the workspace, and the home scope reaches every workspace.** With both
scopes planted, the walk prints the `[workspace]` entry and reports the other
(`buildRegistry`, `lib/render-helpers.mjs:2023`, `:2031`):
`shadow: <home>/.pi/eyg-functions/persist-probe.eyg: persist_probe is shadowed by <t>/.pi/eyg-functions/persist-probe.eyg`.
With only the scratch home planted, the same walk prints `entry persist_probe [home]`. So a module
planted under `$HOME/.pi/eyg-functions` is offered in every workspace on the machine, and who may
plant one is decided by that session's roots alone. UNVERIFIED for the real home:
`$HOME/.pi/eyg-functions` does not exist here and no probe wrote in the operator's home.

**Nothing in either scope is gitignored.** `git check-ignore -v .pi/eyg-functions/persist_probe.eyg`
answers nothing (`exit=1`) and `git ls-files .pi` answers only `.pi/eyg-variables/PURPOSE` and
`.pi/settings.json` (`@measured 2026-11-24`): a planted module is a committable artifact of the
tree, so it outlives the session that wrote it and travels with the repository.

## The listing names whose module each entry is

A fresh one-shot session in a scratch project that declares this package (`pi --print --mode json
--tools eyg`, one session, two calls - `list_functions` and `describe_function` on a module planted
in that project's workspace scope), whose rows the session printed verbatim:

```
onboarding_probe  [workspace] <project>/.pi/eyg-functions/onboarding-probe.eyg
  owner: this project wrote it: not shipped with this package
```

and the three legend lines the listing header prints before the entries:

```
a tag other than [package] is not this package's module: [workspace] is this project's
and [home] is $HOME's, read by every project on this machine - read the module before
binding a name that resolves to either.
```

The shipped `search` entry under `[package]` carries no owner line; `describe_function` prints the
line for every scope, including `owner: this machine wrote it: every project here reads it` for a
`[home]` entry (that string is pinned by the unit group `the registry labels: whose module an entry
is` in `test/render-helpers.test.mjs`, not by a plant in the operator's home). The running session
cannot show these rows: pi resolved the extension at session start, so a session sees the listing
shape it started with (`docs/world/traps.md`).

## A kept binding whose value is an effect stops every later call in the workspace

A call with `extern: "workspace"` that kept three bindings - one of them a performed effect,
`let out1 = perform StandardOut("...")` - wrote `.pi/eyg-variables/out1.eyg`, and every later call
in that workspace then died before its own program ran: `error: unhandled effect
StandardOut("kept-binding leg planted: the tool writes this source into a scope file")`, `exit=1`,
0.24 s, at `let {out1} = import "<pkg>/.pi/eyg-variables/out1.eyg` (`program.eyg:2`). The prelude
line is an `import` at the top of the program module, outside the guarded body the entry wraps
(`entryProgram`, `lib/render-helpers.mjs:458`), so a top-level effect in a scope file answers
`unhandled effect` exactly as boundary fact 4 of `docs/world/entities/host.guard-boundary.md` says:
fail-closed, nothing performed. What it costs is the workspace - the tool prepends the import of
every visible binding to every call, so the call that would `DeleteFile` the module dies on the same
import. Clearing it took a run through `bin/agent/refusal-probe.mjs`, which writes a program module
with no kept-binding prelude: three `DeleteFile` answers, each `ok`, `exit=0`. Measured for
`StandardOut`; that any effect-valued binding behaves the same is boundary fact 4, not a second run.

## Not this

- the mechanism of a kept binding - what the store holds, the three scopes, the two-half rule for a
  keep, the session scope as a branch replay: `docs/world/entities/pi.variable-scopes.md`; this
  record is about what a call can leave in those scopes and what a later call then does with it;
- the registry as a read-only listing and the `metadata` record it reads:
  `docs/world/entities/pi.codemode-tool.md`;
- whether a planted module can host its own effects:
  `docs/world/entities/gap.one-host-check-not-transitive.md`;
- what a session may ask the operator for, and how the ask is produced:
  `docs/world/entities/pi.session-grants.md`;
- the per-vector rating of this route: `notes/pi-codemode-threat-model.md`.

@measured 2026-11-24 by the three-command chain in this record's `verify` (0.43 s), by
`bin/agent/registry-walk.mjs` over scratch roots and a scratch `$HOME`, and by three live `eyg`
calls in this workspace whose rows are quoted above; all offline.
