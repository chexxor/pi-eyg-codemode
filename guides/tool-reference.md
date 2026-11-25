# The tool: knobs, rows, probes and the seam

*This page is this package's own reference - it is not a copy of a website page. It states
what the extension does, where in the package each fact comes from, and what stays UNVERIFIED.
The language's own effect and syntax prose is at <https://eyg.run/guides>; the surface this
package ships is one generated file, `guides/eyg-surface.tsv`. The sections here are linked by
the README and by the how-to pages.*

The sections:

- [What the tool decides, and in what order](#what-the-tool-decides-and-in-what-order)
- [Who decides an effect: one host per call](#who-decides-an-effect-one-host-per-call)
- [What a policy rule answers with](#what-a-policy-rule-answers-with)
- [Plan first, then act, with the same program](#plan-first-then-act-with-the-same-program)
- [The effect surface, answered rather than remembered](#the-effect-surface-answered-rather-than-remembered)
- [The language surface, answered rather than remembered](#the-language-surface-answered-rather-than-remembered)
- [How a call is shown, and how long it took](#how-a-call-is-shown-and-how-long-it-took)
- [A refusal, as it looked](#a-refusal-as-it-looked)
- [Captures, and how they are marked](#captures-and-how-they-are-marked)

## What the tool decides, and in what order

| knob | default | resolved from |
| --- | --- | --- |
| policy module | `policies/agent-roots.eyg` inside the installed package, the path taken from `import.meta.url` | `lib/render-helpers.mjs` (`resolvePolicy`), used by `extensions/eyg-codemode.ts`; the path reaches the program through the entry, which imports the module (`entryProgram`); the order of the slots is stated in `guides/how-to-write-a-policy.md` |
| project key | nothing set: the package default and the working directory | `eyg.policy` (a shipped policy name such as `agent-roots`, or an absolute module path) and `eyg.roots` (absolute paths) in `.pi/settings.json`; pi merges global and project settings and keeps keys it does not know, and the tool re-reads both keys on every call |
| roots | the session working directory | `lib/render-helpers.mjs` (`resolveRoots`): the roots a spawner narrowed this session to, then `eyg.roots`, then `EYG_ALLOWED_ROOTS`, then the working directory, plus the roots of a grant in force; the entry writes the resolved list into the `ctx` the policy reads (`contextLiteral`) |
| widening for one call, N calls or the session | nothing widened: a refusal stays a refusal | the operator's `/eyg-grant` command (`extensions/eyg-codemode.ts`): `/eyg-grant <agent-roots \| deny-all \| an absolute module path> <one \| N \| session> [roots=/abs,/abs]`, typed arguments asked once; `/eyg-grant status` lists what is in force, `/eyg-grant revoke [id]` ends one early; whose record `replayGrants` in `lib/render-helpers.mjs` reads back off the session branch. The order is in `guides/how-to-write-a-policy.md` |
| a second session | none started | the `eyg_subagent` tool (`extensions/eyg-codemode.ts`): `pi --print --mode json --tools <tools>` built as argv, its boundary from `childEnvOverrides` and checked by `rootsInside` and `childTools`, its effect allowlist enforced by `policies/spawner-effects.eyg`, its call budget by `callBudget`, its report parsed by `childCalls`/`childAnswer`; `guides/how-to-spawn-a-subagent.md` |
| kept bindings | none kept: a `let` defined in one call is not in scope on the next | the `extern` argument (`session`, `workspace`, `user`): `keptBindings` in `extensions/eyg-codemode.ts` reads the two directories and this session's records into the prelude, and a file scope is kept by a program built by `variableWriteProgram` and reported by `variableWriteOutcomes` (`lib/render-helpers.mjs`); `guides/how-to-keep-bindings.md` |
| runner | `EYG_CODEMODE_RUNNER` (an absolute path) when set, else `eyg` on PATH | `lib/render-helpers.mjs` (`runnerCandidates`), used by `extensions/eyg-codemode.ts`; a binary that is missing, or that reads the mode word as a file name, gets one line naming the install and quoting the command that was run (`runnerFailureLine`) |
| mode | `run`; `eval` is pure and prints the value | `extensions/eyg-codemode.ts`. `action` selects what the call does - `run`, `eval`, `effects`, `config`, `reference`, `list_functions`, `describe_function` (`ACTIONS`) - and `prepareCallArguments` in `lib/render-helpers.mjs` maps `mode` from sessions resumed before the rename; `action: "config"` answers what the next call runs under (`configLines`) |
| timeout | 30 s default, 120 s cap; the parameter is `timeout` in **seconds** | `extensions/eyg-codemode.ts` |
| argv | `[mode, entryPath]`: the entry this package wrote in a scratch directory of its own, which imports the guard, the policy and the model's program, and writes the refusal record as its last line; the directory is removed when the run ends | `runGuarded` in `extensions/eyg-codemode.ts`; the two files come from `entryProgram` and `programModule`, and the record path the entry writes last from `RECORD_FILE`, all in `lib/render-helpers.mjs` |
| a parse of the program | always, before the run, for `run` and `eval` | `[parse, -c, code]` through the same binary (`parseArguments` in `lib/render-helpers.mjs`); a program that names a `handle` clause is refused with its labels, and a binary that cannot answer the parse stops the call rather than running an unchecked program |
| a check of the entry | always, for the model's own `run`/`eval` call, after the parse and before the run; the tool's own probe programs skip it | `[check, entryPath]` through the same binary (`entryCheckArguments` in `lib/render-helpers.mjs`), 5 s of its own (`ENTRY_CHECK_TIMEOUT_MS`); only an `error: type mismatch` row stops the call, and the answer quotes the CLI's line, points at `guides/eyg-surface.tsv` and the language docs, and says nothing ran (`entryCheckMisshapeRows`, `misshapedAskRows`); a mis-shaped ask otherwise spends the whole spawn timeout printing nothing (`notes/pi-codemode-misshaped-ask.md`) |

| environment | meaning |
| --- | --- |
| `EYG_POLICY` | absolute path to another policy module for the session |
| `EYG_ALLOWED_ROOTS` | comma-separated absolute roots, replacing the session directory |
| `EYG_CODEMODE_RUNNER` | absolute path to the binary a call runs in; it must take a mode word and then a file this package wrote |
| `EYG_CODEMODE_TIMEOUT` | milliseconds for one call (the variable keeps its unit; the parameter does not) |
| `EYG_CODEMODE_PI` | absolute path to the `pi` CLI, for the session `eyg_subagent` starts; default `pi` on PATH |
| `EYG_SUBAGENT_POLICY` | the policy a spawner chose for a child session, read only when the depth marker says this package started the process |
| `EYG_SUBAGENT_EFFECTS` | the comma-separated policy **fields** a child may perform, set for one spawn and read by `policies/spawner-effects.eyg`; unset names nothing and refuses every gateable field |
| `EYG_SUBAGENT_MAX_CALLS` | how many `eyg` calls the child's own tool will answer for, read at depth >= 1 |
| `EYG_CODEMODE_DEPTH` | set by `eyg_subagent` for the child: `1` in a child, and a child at depth 1 is refused a child of its own |

The orders - which policy a call gets, and which roots it reads - are stated once, in
`guides/how-to-write-a-policy.md`. `action: "config"` answers both, and the runner, the guard,
the grants and the registry scopes, off the same functions the next call reads rather than a copy
of them, so the rows cannot disagree with what that call will run; it performs nothing, and a
package with no guard refuses it rather than naming a configuration nothing runs under
(`docs/world/entities/pi.config-action.md`). Both are printed in every expanded row, and a refused
call adds what the collapsed row shows too: what the policy was given, the policy that denied it,
the `/eyg-grant` that would have allowed it, and the template an ask follows - the addition, the
reason for it and the intended use (`guides/what-a-call-does.md`).

The policy is imported before the guard is installed, and an effect raised at a module's top
level is never performed, guard or no guard (`unhandled effect`, `docs/world/entities/host.guard-boundary.md`),
so a policy cannot ask the host for its own configuration. The tool hands it over instead: the
entry writes `ctx = {roots, cwd, fields, protected}` as a literal, which `contextLiteral` in
`lib/render-helpers.mjs` builds. `protected` names the paths that decide the call - the package's
own `host/` and `policies/`, plus the policy module resolved for the call when it lives outside
the package (`hostProtectedPaths`) - and the guard refuses the four change effects under them
before any rule runs (`shield` in `host/guard.eyg`), so a session whose roots are this package
cannot rewrite the rules of its next call. What a *program* gets when it asks for the environment
is what the policy chooses - `env: refuse("env")` under `policies/agent-roots.eyg`, and the guard
hands the program `None({})` - which is why a token belongs in a policy the operator wrote
and never in a program.

## Who decides an effect: one host per call

A call has one host for its effects: the guard. Two rules keep that true, and both are checked
outside the program, where the program cannot reach them.

- **The program may not handle an effect itself.** Before a program runs, the tool asks the binary
  to parse it and refuses one that names a `handle` clause, naming the labels it handled
  (`parseArguments` and `handledEffectLabels` in `lib/render-helpers.mjs`, used by
  `extensions/eyg-codemode.ts`; `bin/agent/handler-scan.mjs` runs the same two steps on a file).
  A clause there could not have widened what the policy allows - the guard sits outside it, and an
  effect a clause re-performs is decided again - but it answers the program instead of asking the
  host, and that is the boundary this package exists to hold. Perform the effect and match its
  answer; widening what is decided is a grant, which is the operator's to give.
- **The program may not change the files that decide it.** The guard refuses `write_file`,
  `append_file`, `delete_file` and `make_directory` for a path under `ctx.protected`, before the
  policy rule for that effect is consulted, so no policy and no grant opens those paths. The
  refusal says `denied by the host` rather than `denied by policy`, which is how a program tells
  the two apart and knows a grant will not help. Reads of those paths are allowed: reading the
  guard and the policies is how a program learns what it may ask for.

`guides/what-a-call-does.md` walks one call from the argument to the printed row, with the
commands to run each step yourself in a terminal.

## What a policy rule answers with

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

A rule is a function the guard calls with the value the program asked for. It answers one of two
things, and a third shape is what a rule is built out of:

- **`Pass(value)`** - the guard performs the effect for real, with what you hand back. The value
  may be rewritten, which is how a rule substitutes a jailed path or a normalised URL. `exit` is
  the field where rewriting matters upward: `Pass` may rewrite the status, and a refusal of `Exit`
  cannot be answered at all, since `Exit` has no reply.
- **`Mock(reason)`** - the guard performs nothing and answers the program itself; `reason` is the
  text the program reads, and it is what makes a denial readable. The guard, not the rule, chooses
  the *shape* that answer takes, because the shape is the effect's own reply type: `Error(reason)`
  for the effects whose reply carries text, `None({})` for `Env` (an unset variable is the honest
  answer for a token, and it tells the program nothing about the caller's environment), `Error({})`
  for `CWD`, the unit value for `Sleep`, `StandardOut` and `StandardError`, and an abort naming the
  reason for `Now`, `Random`, `Flip` and `Exit`, whose replies carry no place for a refusal. The
  table is written out at the top of `host/guard.eyg`.
- **a wrapper** - a function that takes a rule and returns one, for example
  `hide_secrets("read_file", request_path, under("read_file", roots, request_path))`, which refuses
  a hidden name before the roots are consulted. Rules compose by application, and the composed rule
  is still one field.

The path a rule inspects differs by effect: `read_directory`, `delete_file` and `make_directory`
carry a bare path string; `read_file`, `write_file` and `append_file` carry a record with a
`path` field. The guard resolves either to an absolute path with no `.` or `..` segment before a
rule sees it, because the CLI hands over the path exactly as the program wrote it, and a rule that
compares whole paths is bypassed by `./` otherwise. Each effect has exactly one field in the record
a policy builds - the 19 of them, named in `POLICY_FIELDS` (`lib/render-helpers.mjs`):
`append_file`, `create_key`, `cwd`, `delete_file`, `env`, `exit`, `fetch`, `flip`,
`make_directory`, `now`, `random`, `read_directory`, `read_file`, `search`, `sleep`,
`standard_error`, `standard_in`, `standard_out`, `write_file`. `Search` has a field of its own
because the guard, not the CLI, is the host of that walk.

Four effects have no policy field at all - `DecodeJSON`, `EYGParse`, `Hash`, `Sign` - so no
policy, this package's or any other, can forbid them: the guard names a clause for each that
re-performs it and decides nothing (`docs/world/traps.md`,
`docs/world/entities/codemode.effect-surface.md`).

Two vocabularies, and only one of them is this package's. The **host layer** is the record a
policy module returns from `rules(ctx)`: one field per effect, rules answering `Pass`/`Mock`. The
**language layer** is
documented on the website (<https://eyg.run/guides/effect-access-policies>):
an `overlay.access` package applied *inside* a program - `access.apply(policy, (_) -> { perform ... })`
- whose fields answer `Allow({})`, `Mock(value)` or `Deny(reason)`, with helpers such as
`access.read_file.allow_under(["data"])`, `max_bytes`, `access.fetch.allow_get_hosts` and
`access.write_file.mock_success`. The website marks that package as "currently unpublished",
and it manages six effects; the guard this package ships decides the 19 fields above.

The one seam this page used to leave UNVERIFIED is now the mechanism. The language syntax page
documents `handle EffectName` in two lines - "used to install custom effect handlers in advanced
embedding scenarios" - and the website's examples handle only effects the program designed itself
(`Increment`, `Update`, `State`). `host/guard.eyg` installs a clause over each of the CLI's own
computer effects, and it holds: an effect raised inside the model's separately imported module
reaches the guard's clause; a clause that re-performs sends the effect to the host exactly once;
and a clause the model writes inside the guarded body can only decline, since its re-perform
reaches the outer guard, which decides. A label the guard does not name has no host, so
`perform Foo({})` answers `error: unhandled effect Foo({})`. The probes that proved each half are
recorded in `docs/world/entities/host.guard-boundary.md`.

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
(<https://eyg.run/guides/effect-access-policies>: "Mock helpers are available
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
reserved TLD `.invalid`). A refusal of an effect whose reply is a `Result` is that reply's `Error`
branch, and `run` prints no value, so such a probe binds the reply and aborts with it
(`!never(perform Abort(why))`) and the reason reaches the runtime's own error output whatever the
`standard_out` rule decides (`probeProgram` in `lib/render-helpers.mjs`). `Env`, `Exit` and
`StandardIn` report `unknown` because they would read the caller's environment, stop the probe, or
swallow stdin; `CWD`, `Sleep`, `StandardOut` and `StandardError` report `unknown` because a refusal
of one is answered with the same value a pass is, so no probe of them could tell the two apart
(`UNPROBED_EFFECTS`). A row that checks a path answers for the probe value, not for every path.

The same trap runs at the shell. `node bin/agent/refusal-probe.mjs --with-policy spawner-effects`
with no `--fields` prints nothing but `exit=0`: the write was refused and the program's one way of
saying so - `StandardOut` - is refused too. Ask the same question with a program that aborts with
the reason and the answer appears: `node bin/agent/refusal-probe.mjs --with-policy spawner-effects
--program test/fixtures/refusal-abort.eyg`.

Two search routes and one boundary. The `Search` effect lives in the CLI runtime and the guard is
its host: one clause under the policy's own `search` field, and then **one decision per directory
the walk lists**, under `read_directory` - so a spawner that names `read_file` does not hand a child
the walk, and one that names `search` does not hand it a read. The two decisions are visible apart:
allow `search` and refuse `read_directory` and the search is allowed and answers no paths
(`Ok([])`), because every listing it needed was refused. Re-run both halves:
`node bin/agent/refusal-probe.mjs --program test/fixtures/search-walk.eyg` lists five paths under
`policies/agent-roots.eyg`; the same program with `--with-policy spawner-effects --fields
search,standard_out` prints zero, and adding `read_directory` to that list makes it list again. `libraries/search.eyg`, bound
as `search_lib` by the `libraries` parameter, walks with `ReadDirectory` and is therefore checked
one directory at a time. Both report **names** under an allowed root, including the name of a file
a read of that path would be refused for, and contents never come through. So a secret is not
readable through a search, but its existence and name are; hide names by rooting searches
narrower; `policies/agent-roots.eyg` already wraps the `search` rule with the same hidden-name test
it wraps `read_file` with, so a hidden directory is not searchable under a root either. Pattern semantics - one `*` per segment, a whole `**` segment spans
depths, `limit` is a budget spent while walking, 32 directories deep - are in the `Search`
section of <https://eyg.run/guides/cli-effects-reference>.

**Adding an effect is a change to the language, not to this package**, and it is an escalation in
the language repository's own rules. What this package does when the language lands one is fail:
`test/host-coverage.test.mjs` compares the guard's handler list and `POLICY_FIELDS` against the
effect rows of `guides/eyg-surface.tsv`, so a label nobody names is a red test rather than an
unguarded effect. `docs/world/entities/overlay.policy-rules.md` carries the claim over the whole
mapping.

## The language surface, answered rather than remembered

`action: "reference"` (`code: ""`) answers the other question a session asks twice: what may I call,
and what may I ask for. Its first line counts what it prints - `eyg reference: 29 builtins, 23
effects, nothing performed` - then one line per builtin with its signature and notes, grouped under
the sections the language's page organises them by, then one line per effect with the policy field
that decides it (`none` for the four no policy can forbid), then the line naming `guides/eyg-surface.tsv`
and `node bin/agent/gen-surface.mjs --check`. It spawns no process and asks the policy nothing, so it
answers on a machine where no runner was found; the builtin rows are a dated capture, so the answer
says the compiler is the source, and it names `action: "effects"` as the call that asks the policy what
it decides.

A program that named a builtin the runtime does not have gets the same pointer in its rows. The
runner prints `error: builtin undefined: !str_len` with a hint that names no path; the tool adds
`no such builtin: !str_len`, the path of the builtins guide and of the syntax guide, `action
"reference"` as the way to print them without leaving the tool, and that pi's own `read` tool is not
decided by a policy while `ReadFile` reaches only the roots. `builtinErrors` and `builtinHintRows` in
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
advertises, not a fixed path - a fixed path such as `/dev/null` lists everything as "refused"
in a session that can read (`notes/pi_codemode_registry_probe.md` carries the trade-off).

## A refusal, as it looked

Both blocks are output from `node bin/agent/refusal-probe.mjs`, which writes the same entry, policy
import and program module a tool call writes and runs the installed CLI on them. The paths are this
machine's: read them as shapes, not as locations.

The shipped write probe - a relative `WriteFile`, from a working directory the roots do not cover:

```
write_file denied by policy: /tmp/eyg-refusal-probe-KsjDt9/eyg-probe-refused.txt
```

Nothing exists at that path, and the scratch directory the probe ran in is removed on the way out.
`exit=0` is the status of the *probe*, and the program ran to completion past the refusal.

`test/fixtures/secret-probe.eyg` - a `ReadFile` of a `.env.eyg` path inside the root, run with
`--inside-roots`. The path is masked, because the rule answers before the host is asked and no such
file is in this tree. `node bin/agent/secret-rule-probe.mjs` asks the same rule of all seven path
effects at once and prints `holds` or `DRIFT` per ask:

```
read_file denied by policy: <this tree>/.env.eyg
```

In a tool session the same refusal arrives with the ask rows added: what the policy was given, the
policy that refused it and the `/eyg-grant` that would have allowed it (`refusalHints`,
`describeRefusal` and `suggestGrant` in `lib/render-helpers.mjs`, rendered by `refusalRows` and
`grantRows`). A refusal that quotes no value - `policies/deny-all.eyg` answers `read_file denied by
policy` and nothing else - still gets them, and its ask says that no roots addition covers it instead
of naming a path it was never given.

## Captures, and how they are marked

Every block on this page was printed in this workspace by a command the page names, on the CLI the
operator installed; absolute paths in them belong to this machine and are masked where they would
name it. `docs/world/entities/overlay.policy-rules.md` carries the dates of the reads of the
language pages quoted here, and the one capture in this tree that was taken in another checkout.

## Not this

- Not the language's prose: that is at <https://eyg.run/guides>. `guides/eyg-surface.tsv` is
  the machine-readable surface this package ships, and this page is its prose.
- Not the how-tos: the runner, the policy, the slices and the registry are the `guides/how-to-*.md`
  set, and `guides/first-session.md` is the tutorial.
- Not the claims: every re-checkable statement about this tree is in `docs/world/` with the command
  that re-checks it.
