# pi-eyg-codemode

**EYG** is a small scripting language: everything is an expression, there are no
statements, and the only route a program has to the outside world is a named
effect - `perform ReadFile({path: "/abs/file", offset: 0, limit: 60})`. It has no
effect that runs a shell command. **This package makes an EYG program a pi agent's
coding tool**: built-in JavaScript codemode is disabled, one tool `eyg` replaces
`read`, `edit`, `write`, `bash`, `grep`, `ls`, and the tool spawns a runner started
with `--policy <module.eyg>`, so the host - not the program - decides every effect,
per call, before the host performs it. A refused effect is a value
(`Error("write_file denied by policy: /abs/path")`), so the model reads the
permission it was refused and acts on it; nothing happened on disk.

The language itself, its compiler, its test suite and **its documentation** live elsewhere:
the code is in a separate repository - the language repository, checked out somewhere on the
operator's machine and referred to here as the *language workspace* - and the prose is on the
**EYG website, <https://eyg.run>** (guides, references, the policy vocabulary). This package is
the tool in front of that check; it decides nothing about what an effect may do, reads nothing
from that repository at run time, and **replicates no install steps** - the next section says
what has to be true on your machine.

## Who reads this page

Three readers, and each needs one thing from this tree:

- **You, installing the package.** You need what has to be true on your machine, one call to
  try, and what to do when every call is refused. This page answers the first; `guides/first-session.md`
  answers the other two.
- **The model this package runs.** It reads `skills/eyg-codemode/SKILL.md` and the tool's own rows
  before it writes EYG; it needs the forms, the shape of a refusal, and where to ask for a function
  it can reuse.
- **The agent working in this repository.** It reads `AGENTS.md` and `docs/world/`, and needs the
  commands with their costs and the rules a change must satisfy.

## The words this package uses

| word | what it means here |
| --- | --- |
| runner | the EYG CLI this package starts; it is the only thing that can answer for an effect |
| preset | the EYG program the runner loads first, with one rule per effect it decides; this package ships `policies/agent-roots.eyg` and `policies/deny-all.eyg` |
| roots | the directories a session may reach; the shipped preset reads them from `EYG_ALLOWED_ROOTS` |
| the checks | a preset's decision for one effect, made before the host performs it |
| checked, unchecked | an effect a preset answers for, and an effect no preset can forbid |
| registry scope | a directory of function-sets the tool reads: the workspace, the home, this package's `libraries/` |

## What you need before it does anything

**The EYG CLI is not in this package** - nothing here builds it, and the check lives in
it: the tool spawns a runner started with `--policy <module.eyg>`, and only that runner can
answer for an effect. Install it from
<https://eyg.run/guides/install-a-prebuilt-binary> or
<https://eyg.run/guides/install-from-source> (Gleam >= 1.7 and Bun).
`guides/install_prebuilt.md` and `guides/install_from_source.md` are copies of those two
pages, taken 2026-11-18, for a session that cannot load a page; the paths inside the second
belong to the language workspace, not to this tree.

Then the tool has to find what you installed. It looks in exactly three places, in this order
(`extensions/eyg-codemode.ts:387-390`, `resolveRunner` at `:219`):

1. **`EYG_CODEMODE_RUNNER`** - the absolute path to the runner. Set it and nothing else is
   probed, so installing the compiler somewhere off `PATH` is fine as long as you name it here.
2. **`eyg` on `PATH`** - whatever `command -v eyg` finds.
3. **`<cwd>/packages/gleam_cli/dist/eyg`** - the language workspace's own layout, which only
   helps if you run pi sessions inside a checkout of that repository.

A candidate counts only when `<candidate> --help` mentions `--policy` - the probe runs once per
session and the refusal names the remedy, so a tool that assumed a path or a version would be a
tool with no check (`notes/pi_codemode_runner_probe.md`). Check the candidate, not merely that a
binary exists:

    <the eyg you installed> --help 2>&1 | grep -c -- --policy   # 0 => every call will be refused

**The prebuilt route is not enough on this host.** On the machine this workspace was developed
on, 2026-11-18, the release found by `command -v eyg` answers `v0.1.0` and that check printed
`0` - it predates the `--policy` flag and mis-parses the argv this tool passes. Until a release
with `--policy` is published: build from source (the other guide) and point `EYG_CODEMODE_RUNNER`
at that binary, or read this package as documentation - installing the tool and getting a
refusal for every call is the honest outcome, not a bug to chase. Until such a runner runs here,
**end-to-end policy behaviour in this tree is UNVERIFIED**
(`docs/world/entities/cli.prebuilt-binary.md`, `notes/pi_codemode_runner_probe.md`): what holds
the presets is `eyg check` on the modules and the drift guard against
`test/fixtures/rule_mapping.gleam`, never an observed refusal.

## What you get, and what it costs

- **One channel, decided per call.** Files, network and processes are reached only by
  effects the policy in force allows. Roots are a configuration line, not a capability
  patch: `read_file` under one root, `write_file` under a narrower one, `fetch` refused.
- **A refusal is not a crash and not a half-step.** The program continues with
  `Error(reason)`; the host never performed the effect, so there is no partial file and
  no window in which the tool trusted something that was not there.
- **What you give up:** the model writes EYG instead of JavaScript and `bash`. The forms
  it needs are in `skills/eyg-codemode/SKILL.md` (loaded automatically); the surface
  syntax is <https://eyg.run/guides/eyg-syntax-guide> and the effect reference is
  <https://eyg.run/guides/cli-effects-reference> (offline copies of both live here as
  `guides/syntax.md` and `guides/cli_effects_reference.md`); the
  language *skill* is the separate package `pi-eyg-expressions` (a sibling pi package, not in
  this tree; `pi list` prints the absolute path a declaration of it resolves to on your
  machine).
- **A store outside the history, read in slices.** `ReadFile` takes `offset`/`limit` and
  `Search` takes a `limit` spent while walking, so a big knowledge base or instruction set can
  live under a root and a session pulls the slice it needs - the store costs the runner
  (0.06-0.07 s a call), the window costs whatever the slice is. This tree is the working
  example: every claim in `docs/world/` re-runs in 0.65 s, and no lines are in the prompt until
  a session asks for one. What that does **not** buy you: a read is not free, and a claim
  whose verify command fails moves to `status: suspect` with the date it was caught, so stale
  context is visible rather than silently trusted.
- **Costs**, measured where a `--policy` runner exists (the language workspace,
  `@measured 2026-11-15`): one run under a policy 0.06-0.07 s (runner start-up dominates), one
  effect listing 1.15-1.62 s (16 spawns), one live one-shot session
  `pi --print --mode json` 44-142 s - an event, not a loop. This workspace's own costs are in
  `AGENTS.md`'s command table.
- **When not to use it:** a workspace whose agent must run arbitrary host commands -
  builds, git, a compiler - or a session whose job is editing this package's own source.

## First session, nothing to configure

```bash
pi install . -l        # from inside the package directory; the declaration pi writes is ".."
pi list                # prints the absolute path every declaration resolves to
```

Install from wherever the package sits on your machine (`pi install /your/path/pi-eyg-codemode
-l` does the same thing); a local declaration is written relative to `.pi/settings.json` and reads
as `..` (`docs/world/traps.md`).

With no `policy` argument and no `EYG_POLICY` the tool uses the preset this package ships,
`policies/agent-roots.eyg`, over the session working directory: a program may read and
write inside that directory and nowhere else. `.env.eyg` files are refused even inside a
root, and both shipped presets refuse the network. A program is never run without a policy.

One call, verbatim, from the language workspace this package was split out of (paths are
that workspace's) - a read inside the roots and a write outside them, in one program:

*[2026-11-16 · the language workspace]*

```
eyg run: ran
READ FIRST LINE: ![penelopea mascot for EYG](https://eyg.run/assets/pea.8C463682609CAA4A5A638D66BWRITE REFUSED: write_file denied by policy: /tmp/eyg-codemode-outside-root/probe.txt
```

Nothing exists at `/tmp/eyg-codemode-outside-root`; `eyg run: ran` is the status of the
*program*, not evidence that the write happened.

## What the tool decides

| knob | default | resolved from |
| --- | --- | --- |
| policy module | `policies/agent-roots.eyg` inside the installed package, path taken from `import.meta.url` | `extensions/eyg-codemode.ts` (`packageDir`, `defaultPolicy`) |
| roots | the session working directory, exported as `EYG_ALLOWED_ROOTS` for the call and restored after it | `extensions/eyg-codemode.ts`; the preset reads the variable |
| runner | first candidate whose `--help` advertises `--policy`: `eyg` on PATH, then `<cwd>/packages/gleam_cli/dist/eyg` (the language workspace's layout) | `extensions/eyg-codemode.ts` (`resolveRunner`) |
| mode | `run`; `eval` is pure and prints the value | `extensions/eyg-codemode.ts` |
| timeout | 30 s default, 120 s cap; the parameter is `timeout` in **seconds** | `extensions/eyg-codemode.ts` |
| argv | `[mode, "--policy", policy, "-c", code]`, spawned with no shell in between | `extensions/eyg-codemode.ts` |

| environment | meaning |
| --- | --- |
| `EYG_POLICY` | absolute path to another policy module for the session |
| `EYG_ALLOWED_ROOTS` | comma-separated absolute roots, replacing the session directory |
| `EYG_CODEMODE_RUNNER` | absolute path to a runner that accepts `--policy` |
| `EYG_CODEMODE_TIMEOUT` | milliseconds for one call (the variable keeps its ms; the parameter does not) |

Order is: the `policy` argument, then `EYG_POLICY`, then the package default, then refuse.
Resolution order, roots and runner are printed in every call's expanded row, so a refusal
names the path it was denied and the policy that denied it.

## The presets, and writing another

`policies/agent-roots.eyg` is the default (files under the roots, nothing else) and
`policies/deny-all.eyg` is the narrowest record there is: it refuses every failable effect
except `Now`, `Sleep`, `StandardOut`, `StandardError`. Both are one record, one rule per
refusable effect, **written out in full and importing nothing** - the preset vocabulary used to
be imported from the language workspace (`import "../../eyg_packages/overlay/policy.eyg"`)
and was inlined on 2026-11-18 so the package owns its whole decision
(`notes/pi-codemode-preset-inlining.md`, and `docs/world/traps.md` for the trap that
inlining prevents).

To write another preset, edit one of those: **a rule is a function**, the host calls it with
the value the program asked for, and it answers with one of three things:

- `Pass(value)` - perform, with what you hand back. The value may be **rewritten**, which is
  how a handler substitutes the model's argument (a jailed path, a normalised URL, a header
  with a token it reads from the environment). `exit` is the one field where this matters
  upward: `Pass` may rewrite the status, `Mock` cannot answer `Exit` at all (no return value).
- `Mock(x)` - do not perform; answer the program with `x` and let it carry on. A refusal is
  `Mock(Error("<effect> denied by policy: <path>"))`, and `Mock` is not only a veto: `env: (_)
  -> { Mock(None({})) }` answers "unset" instead of refusing, because `Env` returns an
  `Option` and refusing it would tell the program something about the caller's environment.
  **`Mock` must return a value of the effect's own type** - `deny-all.eyg` refuses `cwd` with
  `Mock(Error({}))` because `CWD` returns a `Result`. Reach for `Mock` to *simulate* a working
  effect only in a plan preset, never in an act preset: an act preset that mocks `write_file`
  reports success while nothing landed on disk.
- a **wrapper** - a function that takes a rule and returns one, e.g. `hide_secrets(under("read_file",
  roots, request_path))`, which refuses `.env.eyg` before the roots are consulted. Handlers
  compose by application, and the composed rule is still one field in one record.

The policy module is itself an EYG program, run by the runner **outside those checks** - it may
`perform Env(...)`, and it does read the roots from `EYG_ALLOWED_ROOTS` that way
(`policies/agent-roots.eyg:144`). The program under it may not: that is why a token belongs in
a policy module and never in a program (`guides/pi_codemode_agent.md:169`).

The path a rule inspects differs by effect - `read_directory`, `delete_file`, `make_directory`
carry a bare path string; `read_file`, `write_file`, `append_file` carry a record with a `path`
field; `env` answers `None({})` rather than an error. Each effect has exactly one field in the
record a preset builds - the 18 of them, as mapped in the language repository's `rule_mapping`
and recorded for this package in `POLICY_FIELDS` (`lib/render-helpers.mjs`): `append_file`,
`create_key`, `cwd`, `delete_file`, `env`, `exit`, `fetch`, `flip`, `make_directory`, `now`,
`random`, `read_directory`, `read_file`, `sleep`, `standard_error`, `standard_in`,
`standard_out`, `write_file`. Point a session at your file with `EYG_POLICY` (absolute path;
a relative one is refused) or the `policy` argument.

Four effects have no policy field at all - `DecodeJSON`, `EYGParse`, `Hash`, `Sign` - so no
preset, this package's or any other, can forbid them
(`docs/world/traps.md`, `docs/world/entities/codemode.effect-surface.md`).

Two vocabularies, and only one of them is this package's. The **host layer** is what the
`--policy` module this tool loads builds: one record, one field per effect the policy decides,
rules that answer `Pass`/`Mock`. The **language layer** is documented on the website
(<https://eyg.run/guides/effect-access-policies>, read 2026-11-18): an `overlay.access` package
applied *inside* a program - `access.apply(policy, (_) -> { perform ... })` - whose fields
answer `Allow({})` (perform), `Mock(value)` (resume with `Ok(value)`) or `Deny(reason)`
(resume with `Error(reason)`), with helpers such as `access.read_file.allow_under(["data"])`,
`max_bytes`, `access.fetch.allow_get_hosts`, and `access.write_file.mock_success` for dry runs.
The website marks that package as "currently unpublished", and it manages six effects
(`Fetch`, `ReadFile`, `ReadDirectory`, `WriteFile`, `AppendFile`, `DeleteFile`); the CLI's own
policy decides the 19 fields above.

One seam this tree cannot check, and it is worth knowing rather than discovering: `guides/syntax.md:383`
documents `handle EffectName` - a *program* taking the handler for an effect, "used to install
custom effect handlers in advanced embedding scenarios", and those are the only two lines about
it. The website expands it (<https://eyg.run/guides/advanced-effects>, read 2026-11-18):
`handle EffectName(handler_fn, fallback)` builds **stateful computations inside a program**, and
every example handles an effect the program itself designed (`Increment`, `Update`, `State`,
`Get`, `Increase`) - no example re-handles one of the CLI's computer effects, so whether such a
handler can shadow the host's policy decision stays **UNVERIFIED from here**
(`docs/world/traps.md`); nothing in this package relies on it, and a policy module is host-authored
by construction - the tool spawns the runner with `--policy <module.eyg>` before the program runs.

## Plan first, then act, with the same program

Staging needs no tooling: it is **two policy modules over one session**. Run the program once
with `policies/deny-all.eyg` - which performs only `Now`, `Random`, `Sleep`, `Flip`,
`StandardOut`, `StandardError`, `Exit` - and every file, network and process effect comes back
as a refusal value, so the program prints its plan and reports what it would have needed. Run
the same program with `policies/agent-roots.eyg` to act. A refusal is a value, not a crash,
so one program is correct in both phases and says which one it is in.

This is the cheap shape of "think before you touch": the model writes the plan as a program
(the renderer shows the effect names it may ask, in the collapsed row, before the source), the
operator reads it, and the second call is the one that changes anything. A staged session is
also the honest place for a `Mock` that simulates an effect: the plan preset may answer, the
act preset may not. The language's own docs name this pattern the same way
(<https://eyg.run/guides/effect-access-policies>, read 2026-11-18: "Mock helpers are available
for dry runs and tests", `access.write_file.mock_success`) - they dry-run inside a program with
the access package; this package dry-runs the whole session by loading the narrower record.
`docs/world/decisions/ADR-002-handler-seam.md` records why the seam sits in the policy module and
what was rejected; `notes/pi-codemode-handler-seam.md` carries the trade-offs, including the one
thing this workspace cannot check about it.

## The effect surface, answered by the policy rather than from memory

`action: "effects"` (`code: ""`) asks the **policy in force**: one probe program per effect, one row
per policy field, `<effect> | <field or none> | allowed | refused | not implemented |
unknown`, plus a header naming the policy, where it came from and the roots. Probes are
chosen so they fail at the host before they could change anything (a read and a delete
name `<root>/.eyg-codemode-probe`, a write names `<root>` itself, a directory, `Fetch`
points at the reserved TLD `.invalid`); `Env`, `Exit`, `StandardIn` report `unknown`
because they would read the caller's environment, stop the probe or swallow stdin. The
rows that check a path answer for the probe value, not for every path.

Two search routes, and one boundary that surprises people. The `Search` effect (in the
CLI runtime, checked by the existing `read_file` field - one decision per walk) and
`libraries/search.eyg`, bound as `search_lib` by the `libraries` parameter, which walks
with `ReadDirectory` and so is checked one directory at a time. Both report **names**
under an allowed root, including the name of a file a read of that path would be refused
for; contents never come through:

*[2026-11-16 · the language workspace]*

```
read_file denied by policy: /home/chexxor/Git/eyg-lang/.search-proof/.env.eyg
/home/chexxor/Git/eyg-lang/.search-proof/.env.eyg
```

The first line is a refused `ReadFile`, the second is `Search` naming the same path. A
secret is not readable through a search, but its existence and name are; hide names by
rooting searches narrower, or by giving `Search` its own rule wrapped the way
`hide_secrets` wraps `read_file` in `policies/agent-roots.eyg`. Pattern semantics
(`*` per segment, a whole `**` segment spans depths, `limit` is a budget spent while
walking, 32 directories deep) are in that file's `Search` section of
`guides/cli_effects_reference.md`.

**Adding an effect is a change to the language, not to this package**, and it is an
escalation in the language repository's own rules. What this package does when the
language lands one is follow the mapping: `Search` was landed on 2026-11-16 and mapped to
`read_file`, so no new policy field exists here. The claim over the whole mapping is
`docs/world/entities/overlay.policy-rules.md`; the full record of that landing - the files,
the manifest resolution, the check's output - is in the language workspace and in
`CHANGELOG.md`.

## How a call is shown, and how long it took

Collapsed (default): the effect names the program uses, in order, then the first 4 source
lines, then `... N more lines`; the result row is the status line plus `(N output lines)`.
Expanded (`Ctrl+O`): every line of the program, every line of output, and a
`policy: <path> (<source>) runner: <path> roots: <path>` provenance line. The effect-name
scan is textual (`perform` plus a capitalised name), so a comment naming `perform ReadFile`
counts too - the safe direction, an over-estimate never hides an effect.

Wall time is stated wherever a duration appears, always labelled:
`eyg run: ran in 0.81 s wall`, `eyg run: exit 1 in 0.12 s wall`,
`eyg run: timed out after 2 s in 2.01 s wall`, and `eyg running, 4.20 s so far` while a
run is going. `formatDuration` in `lib/render-helpers.mjs` prints `1.24 s`, `2:03`,
`1:02:03`. pi's `exec` answers a killed run with `code === 0` *and* `killed`, so the tool
tests `killed` first (`docs/world/traps.md`).

`timeout` is in **seconds** (`timeout: 90` is ninety seconds, like the bash tool);
`EYG_CODEMODE_TIMEOUT` stays in milliseconds because it has shipped since 1.1.0 and
renaming its unit would break sessions that already set it. `timeout_ms` and `mode` are
what a session resumed from an earlier version sends; `prepareArguments` maps them before
schema validation, so the schema the model sees carries no deprecated field.

The offline loop for the renderer is the unit test, which pins the shapes `callLines` and
`resultLines` return - the same rows the extension paints, so neither can drift from the
other. Re-run here:

```
$ node --test test/render-helpers.test.mjs   # from the package root
✔ test/render-helpers.test.mjs (39.94ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 47.54
```

What the test cannot show is that pi paints the row from those shapes; that needs a human
session and `Ctrl+O`.

## Re-usable functions (the registry, read-only)

A function-set is a module someone wrote - one `.eyg` file, one `let metadata` record:

```eyg
let tidy = (text) -> {
  !string_replace(!string_replace(text, "\n\n", "\n"), "  ", " ")
}

let metadata = {
  name: "tidy",
  description: "Collapse doubled spaces and blank lines in `text`; a pure computation, so it needs no effects.",
  signature: "tidy_lib.tidy(text) -> String",
  effects: []
}

{tidy}
```

The tool **reads** three scopes and never writes, moves or creates anything in them:

| scope | directory | for |
| --- | --- | --- |
| workspace | `<cwd>/.pi/eyg-functions/` | the default scope: a function the agent wrote here |
| home | `$HOME/.pi/eyg-functions/` | the same sets, in every workspace on this machine |
| package | `<the installed package>/libraries/` | what this package ships, e.g. `search` |

Scopes are read in that order and **first match wins**, and a shadowed module is reported
rather than dropped. `action: "list_functions"` lists them (`code: ""` is enough),
`action: "describe_function"` with `function: "<name>"` prints one. The metadata `name` is
the entry point: `libraries: ["tidy"]` binds `tidy_lib` through the same scope order, so
`libraries: ["search"]` keeps working and a workspace module shadows the package one. A
name that resolves in no scope is refused, never silently unbound.

Per function-set the listing also answers: the **effects it needs**, cross-checked against
the `perform` names in the module's own text in both directions (a stale annotation or an
undeclared effect is an error, not a silent pass), and **whether the policy in force can
perform them** - `available`, `refused by the policy in force`, `not implemented by this
runner`, `unknown` with the reason. Availability is **advisory and re-probed at every
query**, because the policy in force can change between calls; it is not a second check -
running a function whose effect the probe called refused gets the ordinary
`Error("<field> denied by policy: ...")` value, the same answer the program gets. The
probes are written against the first advertised root, not a fixed path: an earlier version
probed at `/dev/null` and read as "refused" in a session that can read
(`notes/pi_codemode_registry_probe.md`).

## Evidence, and how it is marked

The rule of this README: a block under an italic tag `*[date · the language workspace]*` is a
verbatim capture taken there on that date - paths and all, never re-run here and never edited,
so the paths in it are the operator's machine and mean nothing on yours. Since 2026-11-18 the tag
names that workspace generically and the blocks themselves stay unchanged. Untagged blocks
are instructions, or captures taken in this workspace. On 2026-11-18 this README was rewritten shorter: captures that carried a decision a
reader still needs were kept (the refusal above, the `.env.eyg` name boundary, the status lines),
and the rest - the language workspace's policy transcripts, the `Search`-effect landing, the
registry listing - were dropped rather than shortened, and live in `CHANGELOG.md`,
`docs/world/traps.md` and the `notes/` set. The command and date for each remaining claim are
beside it.

## Commands that run here

`AGENTS.md` carries the command table with measured costs:
`node --test 'test/*.mjs'`, `eyg check` on the shipped modules,
`node pi-simple-world-model/bin/world_{lint,map,verify}.mjs`, and
`pi --world-model-check`. Do not run `node --test test/` - node takes a file or a glob,
not a directory (`docs/world/traps.md`).

## What it installs

| path | what it is |
| --- | --- |
| `extensions/eyg-codemode.ts` | the one pi extension: registers `eyg`, resolves policy/roots/runner from inside the package, spawns the runner that checks every effect through argv, renders the rows, reads the registry scopes |
| `policies/agent-roots.eyg` | the default preset: files under `EYG_ALLOWED_ROOTS`, nothing else, `.env.eyg` never readable |
| `policies/deny-all.eyg` | the narrowest preset: a session that may only compute |
| `libraries/search.eyg` | the search helper bound as `search_lib` by the `libraries` parameter; carries the `metadata` record the registry reads |
| `lib/render-helpers.mjs` | the pure shapes the tool and its test share (plain JS: jiti does not transform a `.mjs`, so annotations in it are a parse error at load) |
| `test/render-helpers.test.mjs` | the unit test over those shapes and the drift guard |
| `test/fixtures/rule_mapping.gleam` | the runtime's `rule_mapping` recorded verbatim, so the guard runs without the language workspace next door (`test/fixtures/rule_mapping.PROVENANCE.md`: where it came from, its checksums, how to refresh it) |
| `skills/eyg-codemode/SKILL.md` | the pi skill loaded when a model writes EYG: the forms, what a refusal means, how to ask the registry |
| `guides/`, `notes/`, `docs/world/`, `pi-simple-world-model/` | the ported reference, the decision record, the claims and the tool that checks them |
