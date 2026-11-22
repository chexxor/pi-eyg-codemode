# The tool: knobs, rows, probes and the seam

*This page is this package's own reference - it is not a copy of a website page. It states
what the extension does, where in the package each fact comes from, and what stays UNVERIFIED.
The language's own effect and syntax references are `guides/cli_effects_reference.md` and
`guides/syntax.md`; the sections here are linked by the README and by the how-to pages.*

The sections:

- [What the tool decides, and in what order](#what-the-tool-decides-and-in-what-order)
- [What a policy handler answers with](#what-a-policy-handler-answers-with)
- [Plan first, then act, with the same program](#plan-first-then-act-with-the-same-program)
- [The effect surface, answered rather than remembered](#the-effect-surface-answered-rather-than-remembered)
- [The language surface, answered rather than remembered](#the-language-surface-answered-rather-than-remembered)
- [How a call is shown, and how long it took](#how-a-call-is-shown-and-how-long-it-took)
- [A refusal, as it looked](#a-refusal-as-it-looked)
- [Captures, and how they are marked](#captures-and-how-they-are-marked)

## What the tool decides, and in what order

| knob | default | resolved from |
| --- | --- | --- |
| policy module | `policies/agent-roots.eyg` inside the installed package, the path taken from `import.meta.url` | `lib/render-helpers.mjs` (`resolvePolicy`), used by `extensions/eyg-codemode.ts`; the order is stated in `guides/how-to-write-a-policy.md` |
| project key | nothing set: the package default and the working directory | `eyg.policy` (a shipped policy name such as `agent-roots`, or an absolute module path) and `eyg.roots` (absolute paths) in `.pi/settings.json`; pi merges global and project settings and keeps keys it does not know, and the tool re-reads both keys on every call |
| roots | the session working directory, exported as `EYG_ALLOWED_ROOTS` for the call and restored after it | `lib/render-helpers.mjs` (`resolveRoots`): the roots a spawner narrowed this session to, then `eyg.roots`, then `EYG_ALLOWED_ROOTS`, then the working directory, plus the roots of a grant in force; the policy reads the variable |
| widening for the rest of the session | nothing widened: a refusal stays a refusal | the operator's `/eyg-grant` command (`extensions/eyg-codemode.ts`), whose record `replayGrants` in `lib/render-helpers.mjs` reads back off the session branch; the order is in `guides/how-to-write-a-policy.md` |
| a second session | none started | the `eyg_subagent` tool (`extensions/eyg-codemode.ts`): `pi --print --mode json --tools <tools>` built as argv, its boundary from `childEnvOverrides` and checked by `rootsInside` and `childTools`, its effect allowlist enforced by `policies/spawner-effects.eyg`, its call budget by `callBudget`, its report parsed by `childCalls`/`childAnswer`; `guides/how-to-spawn-a-subagent.md` |
| runner | `EYG_CODEMODE_RUNNER` (an absolute path) when set, else `eyg` on PATH | `lib/render-helpers.mjs` (`runnerCandidates`, and `runnerFailureLine` for a binary that does not know `--policy`), used by `extensions/eyg-codemode.ts` |
| mode | `run`; `eval` is pure and prints the value | `extensions/eyg-codemode.ts`. `action` selects what the call does - `run`, `eval`, `effects`, `reference`, `list_functions`, `describe_function` (`ACTIONS`) - and `prepareCallArguments` in `lib/render-helpers.mjs` maps `mode` from sessions resumed before the rename |
| timeout | 30 s default, 120 s cap; the parameter is `timeout` in **seconds** | `extensions/eyg-codemode.ts` |
| argv | `[mode, "--policy", policy, "-c", code]`, spawned with no shell in between | `extensions/eyg-codemode.ts` |

| environment | meaning |
| --- | --- |
| `EYG_POLICY` | absolute path to another policy module for the session |
| `EYG_ALLOWED_ROOTS` | comma-separated absolute roots, replacing the session directory |
| `EYG_CODEMODE_RUNNER` | absolute path to the binary the tool starts; it must know `run --policy <module.eyg>` |
| `EYG_CODEMODE_TIMEOUT` | milliseconds for one call (the variable keeps its unit; the parameter does not) |
| `EYG_CODEMODE_PI` | absolute path to the `pi` CLI, for the session `eyg_subagent` starts; default `pi` on PATH |
| `EYG_SUBAGENT_POLICY` | the policy a spawner chose for a child session, read only when the depth marker says this package started the process |
| `EYG_SUBAGENT_EFFECTS` | the comma-separated policy **fields** a child may perform, set for one spawn and read by `policies/spawner-effects.eyg`; unset names nothing and refuses every gateable field |
| `EYG_SUBAGENT_MAX_CALLS` | how many `eyg` calls the child's own tool will answer for, read at depth >= 1 |
| `EYG_CODEMODE_DEPTH` | set by `eyg_subagent` for the child: `1` in a child, and a child at depth 1 is refused a child of its own |

The orders - which policy a call gets, and which roots it reads - are stated once, in
`guides/how-to-write-a-policy.md`. Both are printed in every expanded row, and a refused
call adds what the collapsed row shows too: the path it was denied, the policy that denied it,
and the `/eyg-grant` that would have allowed it.

A policy module may read the environment; the program under it may not. The module's own
`perform Env("EYG_ALLOWED_ROOTS")` runs at the top of the file, outside the checks the
program is under (`policies/agent-roots.eyg:144`), and that is why a token belongs in a
policy module rather than in a program (`guides/pi_codemode_agent.md`).

## What a policy handler answers with

`policies/agent-roots.eyg` is the default (files under the roots, nothing else).
`policies/deny-all.eyg` is the narrowest record there is: it refuses every effect except
`Now`, `Random`, `Sleep`, `Flip`, `StandardOut`, `StandardError` and `Exit`.
`policies/spawner-effects.eyg` is `agent-roots.eyg` with an allowlist over its fields, installed for a child
session whose spawner named `effects`; it is the third shipped policy and the only one that is not
chosen by an operator (`docs/world/entities/pi.spawner-policy.md`). All three are **written out in
full and import nothing**; the vocabulary used to be imported from the language repository and was
inlined so
the package owns its whole decision (`notes/pi-codemode-policy-inlining.md`, and `docs/world/traps.md`
for the trap inlining prevents). `guides/how-to-write-a-policy.md` is the how-to over
changing one of them.

A handler is a function the host calls with the value the program asked for. It answers one of
three things:

- **`Pass(value)`** - perform, with what you hand back. The value may be rewritten, which is
  how a handler substitutes a jailed path, a normalised URL, or a header carrying a token the
  module read from the environment. `exit` is the field where rewriting matters upward: `Pass`
  may rewrite the status, and `Mock` cannot answer `Exit` at all, since `Exit` has no return value.
- **`Mock(x)`** - do not perform; answer the program with `x` and let it carry on. A refusal is
  `Mock(Error("<effect> denied by policy: <path>"))`, and `Mock` is not only a veto:
  `env: (_) -> { Mock(None({})) }` answers "unset" instead of refusing, because `Env` returns an
  `Option` and refusing it would tell the program about the caller's environment. `Mock` must
  hand back a value of the effect's own type - `deny-all.eyg` refuses `cwd` with
  `Mock(Error({}))` because `CWD` returns a `Result`.
- **a wrapper** - a function that takes a rule and returns one, for example
  `hide_secrets(under("read_file", roots, request_path))`, which refuses `.env.eyg` before the
  roots are consulted. Handlers compose by application, and the composed handler is still one field.

The path a handler inspects differs by effect: `read_directory`, `delete_file` and `make_directory`
carry a bare path string; `read_file`, `write_file` and `append_file` carry a record with a
`path` field. Each effect has exactly one field in the record a policy builds - the 18 of them,
as mapped in the language repository's `rule_mapping` and recorded for this package in
`POLICY_FIELDS` (`lib/render-helpers.mjs`): `append_file`, `create_key`, `cwd`, `delete_file`,
`env`, `exit`, `fetch`, `flip`, `make_directory`, `now`, `random`, `read_directory`, `read_file`,
`sleep`, `standard_error`, `standard_in`, `standard_out`, `write_file`. `Search` is a 19th
effect under the `read_file` field.

Four effects have no policy field at all - `DecodeJSON`, `EYGParse`, `Hash`, `Sign` - so no
policy, this package's or any other, can forbid them (`docs/world/traps.md`,
`docs/world/entities/codemode.effect-surface.md`).

Two vocabularies, and only one of them is this package's. The **host layer** is the record this
tool loads: one field per effect, handlers answering `Pass`/`Mock`. The **language layer** is
documented on the website (<https://eyg.run/guides/effect-access-policies>, read 2026-11-18):
an `overlay.access` package applied *inside* a program - `access.apply(policy, (_) -> { perform ... })`
- whose fields answer `Allow({})`, `Mock(value)` or `Deny(reason)`, with helpers such as
`access.read_file.allow_under(["data"])`, `max_bytes`, `access.fetch.allow_get_hosts` and
`access.write_file.mock_success`. The website marks that package as "currently unpublished",
and it manages six effects; the CLI's policy decides the 18 fields above.

One seam this tree cannot check: `guides/syntax.md:383` documents `handle EffectName` in two
lines - "used to install custom effect handlers in advanced embedding scenarios" - and those
are the only two lines about it. The website expands it
(<https://eyg.run/guides/advanced-effects>, read 2026-11-18): `handle EffectName(handler_fn, fallback)`
builds **stateful computations inside a program**, and every example handles an effect the
program itself designed (`Increment`, `Update`, `State`, `Get`, `Increase`) - no example re-handles
one of the CLI's computer effects, so whether such a handler can shadow the host's decision stays
**UNVERIFIED from here**
(`docs/world/traps.md`); nothing in this package relies on it, and a policy module is host-authored
by construction, since the tool starts the runner with `--policy <module.eyg>` before the program
runs.

## Plan first, then act, with the same program

Staging needs no tooling: it is two policy modules over one session. Run the program once with
`policies/deny-all.eyg`, which performs only `Now`, `Random`, `Sleep`, `Flip`, `StandardOut`,
`StandardError` and `Exit`, so every file, network and process effect comes back as a refusal
value and the program prints its plan and reports what it would have needed. Run the same
program with `policies/agent-roots.eyg` to act. A refusal is a value rather than a crash, so
one program is correct in both phases and says which one it is in.

This is the cheap shape of "think before you touch": the model writes the plan as a program, the
collapsed row names the effects it may ask before the source appears, the operator reads it, and
the second call is the one that changes anything. A staged session is also the honest place for a
`Mock` that *simulates* a working effect: the plan policy may answer, the act policy may not.
The language's own docs name the same pattern from inside a program
(<https://eyg.run/guides/effect-access-policies>, read 2026-11-18: "Mock helpers are available
for dry runs and tests", `access.write_file.mock_success`); this package dry-runs the whole
session by loading the narrower record. `docs/world/decisions/ADR-002-handler-seam.md` records
why the seam sits in the policy module and what was rejected; `notes/pi-codemode-handler-seam.md`
carries the trade-offs.

## The effect surface, answered rather than remembered

`action: "effects"` (`code: ""`) asks the **policy in force**: one probe program per effect, one
row per policy field, `<effect> | <field or none> | allowed | refused | not implemented |
unknown`, plus a header naming the policy, where it came from and the roots. Probes are chosen so
they fail at the host before they could change anything (a read and a delete name
`<root>/.eyg-codemode-probe`, a write names `<root>` itself, a directory, `Fetch` points at the
reserved TLD `.invalid`); `Env`, `Exit` and `StandardIn` report `unknown` because they would read
the caller's environment, stop the probe, or swallow stdin. A row that checks a path answers for
the probe value, not for every path.

Two search routes and one boundary. The `Search` effect lives in the CLI runtime and is checked
by the existing `read_file` field, one decision for the whole walk. `libraries/search.eyg`, bound
as `search_lib` by the `libraries` parameter, walks with `ReadDirectory` and is therefore checked
one directory at a time. Both report **names** under an allowed root, including the name of a file
a read of that path would be refused for, and contents never come through. So a secret is not
readable through a search, but its existence and name are; hide names by rooting searches
narrower, or by giving `Search` its own rule wrapped the way `hide_secrets` wraps `read_file` in
`policies/agent-roots.eyg`. Pattern semantics - one `*` per segment, a whole `**` segment spans
depths, `limit` is a budget spent while walking, 32 directories deep - are in the `Search`
section of `guides/cli_effects_reference.md`.

**Adding an effect is a change to the language, not to this package**, and it is an escalation in
the language repository's own rules. What this package does when the language lands one is follow
the mapping: `Search` was landed on 2026-11-16 and mapped to `read_file`, so no new policy field
exists here. `docs/world/entities/overlay.policy-rules.md` carries the claim over the whole mapping.

## The language surface, answered rather than remembered

`action: "reference"` (`code: ""`) answers the other question a session asks twice: what may I call,
and what may I ask for. Its first line counts what it prints - `eyg reference: 29 builtins, 23
effects, nothing performed` - then one line per builtin with its signature and notes, grouped under
the sections of `guides/builtins_reference.md`, then one line per effect with the policy field that
decides it (`none` for the four no policy can forbid). It spawns no process and asks the policy
nothing, so it answers on a machine where no runner was found; the builtins come from the shipped
copy, so the answer says the compiler is the source, and it names `action: "effects"` as the call
that asks the policy what it decides.

A program that named a builtin the runtime does not have gets the same pointer in its rows. The
runner prints `error: builtin undefined: !str_len` with a hint that names no path; the tool adds
`no such builtin: !str_len`, the path of the builtins guide and of the syntax guide, `action
"reference"` as the way to print them without leaving the tool, and that pi's own `read` tool is not
policy-gated while `ReadFile` reaches only the roots. `builtinErrors` and `builtinHintRows` in
`lib/render-helpers.mjs` build those rows and the unit test pins them;
`notes/reference-answer-shape.md` carries why the answer reads the shipped copy rather than asking
the runner, and `docs/world/entities/pi.reference-action.md` carries what one run measured.

## How a call is shown, and how long it took

Collapsed (the default): the effect names the program uses, in order, then the first four source
lines, then `... N more lines`. The result row is the status line plus `(N output lines)`.
Expanded (`Ctrl+O`): every line of the program, every line of output, and a
`policy: <path> (<source>) runner: <path> roots: <path>` provenance line. The effect-name scan
is textual (`perform` plus a capitalised name), so a comment naming `perform ReadFile` counts too
- the safe direction, since an over-estimate never hides an effect.

Wall time is stated wherever a duration appears, always labelled: `eyg run: ran in 0.81 s wall`,
`eyg run: exit 1 in 0.12 s wall`, `eyg run: timed out after 2 s in 2.01 s wall`, and
`eyg running, 4.20 s so far` while a run is going. `formatDuration` in `lib/render-helpers.mjs`
prints `1.24 s`, `2:03`, `1:02:03`. pi's `exec` answers a killed run with `code === 0` *and*
`killed`, so the tool tests `killed` first (`docs/world/traps.md`).

`timeout` is in **seconds** (`timeout: 90` is ninety seconds, like the bash tool);
`EYG_CODEMODE_TIMEOUT` stays in milliseconds because it has shipped since 1.1.0 and renaming its
unit would break sessions that already set it. `timeout_ms` and `mode` are what a session resumed
from an earlier version sends; `prepareArguments` maps them before schema validation, so the schema
the model sees carries no deprecated field.

The offline loop for the renderer is the unit test, which pins the shapes `callLines` and `resultLines`
return - the same rows the extension paints, so neither can drift from the other. What the test
cannot show is that pi paints the row from those shapes; that needs a human session and `Ctrl+O`.

The registry is documented as a how-to, `guides/how-to-share-functions.md`: three scopes read in
order, first match wins, one `let metadata` record per function-set. One fact sits better here
than there: the availability beside an effect is probed against the first root the session
advertises, not a fixed path. An earlier version probed at `/dev/null` and listed everything as
"refused" in a session that can read (`notes/pi_codemode_registry_probe.md`).

## A refusal, as it looked

A read inside the roots and a write outside them, in one program:

*[2026-11-16 · the language repository]*

```
eyg run: ran
READ FIRST LINE: ![penelopea mascot for EYG](https://eyg.run/assets/pea.8C463682609CAA4A5A638D66BWRITE REFUSED: write_file denied by policy: /tmp/eyg-codemode-outside-root/probe.txt
```

Nothing exists at `/tmp/eyg-codemode-outside-root`. `eyg run: ran` is the status of the *program*,
not evidence that the write happened, and the path and the first line belong to the machine that
took the capture.

The second boundary, same marking:

*[2026-11-16 · the language repository]*

```
read_file denied by policy: <that checkout>/.search-proof/.env.eyg
<that checkout>/.search-proof/.env.eyg
```

The first line is a refused `ReadFile`, the second is `Search` naming the same path. The
path is masked: the capture named a checkout outside this tree, and nothing tracked here
quotes such a path.

## Captures, and how they are marked

A block under an italic tag `*[date · the language repository]*` is a capture taken there
on that date - paths masked where they name a checkout outside this tree, otherwise never
re-run here and never rewritten, so the paths in it mean nothing
on your machine. Untagged blocks are instructions, or captures taken in this workspace. On 2026-11-18
this README was rewritten shorter: captures that carried a decision a reader still needs were kept
(the refusal above, the `.env.eyg` name boundary, the status lines), and the rest - the language
workspace's policy transcripts, the `Search` landing, the registry listing - were dropped rather
than shortened, and live in `CHANGELOG.md`, `docs/world/traps.md` and the `notes/` set. The command
and the date for each remaining claim are beside it.

## Not this

- Not the language's reference: `guides/syntax.md`, `guides/builtins_reference.md` and
  `guides/cli_effects_reference.md` carry the surface, the builtins and the effects.
- Not the how-tos: the runner, the policy, the slices and the registry are the `guides/how-to-*.md`
  set, and `guides/first-session.md` is the tutorial.
- Not the claims: every re-checkable statement about this tree is in `docs/world/` with the command
  that re-checks it.
