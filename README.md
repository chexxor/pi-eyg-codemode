# pi-eyg-codemode

**Status: a first draft.** The package is written and unit-tested, and no officially installed
EYG build carries the flag that carries a policy into a run, so a fresh install refuses every
call until the language ships one (`docs/world/entities/cli.runner-official-install-only.md`).
It has not been proved in use: no long-running session, and no comparison against the built-in
JavaScript codemode measured. Treat the design as settled and the use as unproven
(`docs/world/entities/pi.first-draft.md`).

**EYG** is a small scripting language: everything is an expression, there are no statements,
and the only route a program has to the outside world is a named effect -
`perform ReadFile({path: "/abs/file", offset: 0, limit: 60})`. It has no effect that runs a
shell command. **This package makes an EYG program a pi agent's coding tool**: the built-in
JavaScript codemode is disabled, one tool `eyg` replaces `read`, `edit`, `write`, `bash`,
`grep` and `ls`, and the tool starts a runner begun with `--policy <module.eyg>`, so the host -
not the program - decides every effect, per call, before the host performs it. A refused
effect is a value (`Error("write_file denied by policy: /abs/path")`), so the model reads the
permission it was refused and acts on it; nothing happened on disk.

The language, its compiler, and **its documentation** live elsewhere. Check the
**EYG website, <https://eyg.run>** for details.

## Who reads this page

Three readers, and each needs one thing from this tree:

- **You, installing the package.** You need what has to be true on your machine, one call to
  try, and what to do when every call is refused. This page answers the first;
  `guides/first-session.md` answers the other two.
- **The model this package runs.** It reads `skills/eyg-codemode/SKILL.md` and the tool's own
  rows before it writes EYG; it needs the forms, the shape of a refusal, and where to ask for a
  function it can reuse.
- **The agent working in this repository.** It reads `AGENTS.md` and `docs/world/`, and needs
  the commands with their costs and the rules a change must satisfy.

## The words this package uses

| word | what it means here |
| --- | --- |
| runner | the EYG CLI this package starts; the checks live in it, so a build that does not know `--policy` cannot run a program with checks in it |
| policy | a record of effect-handlers, one per effect the CLI decides: `Pass` is the handler an effect keeps when the policy leaves it at its default. The runner loads it before the program runs. This package ships `policies/agent-roots.eyg`, `policies/deny-all.eyg`, and `policies/spawner-effects.eyg` for a child session whose spawner named an effect allowlist |
| roots | the directories a session may reach; the shipped policy reads them from `EYG_ALLOWED_ROOTS` |
| the checks | a policy's decision for one effect, made before the host performs it |
| checked, unchecked | an effect a policy decides, and an effect no policy can forbid |
| registry scope | a directory of function-sets the tool reads: the workspace, the home, this package's `libraries/` |
| kept binding | a top-level `let` a call keeps by name under `extern` - in `session`, `workspace` or `user` scope; the store holds its source text, so the call that names it evaluates it |

## Read next

| you want | read |
| --- | --- |
| one call to try, and how to read a refusal | `guides/first-session.md` - the tutorial |
| to point the tool at a CLI you built or downloaded | `guides/how-to-point-the-tool-at-your-runner.md` |
| to change what a session may reach: roots, one host, secrets | `guides/how-to-write-a-policy.md` |
| to read a file bigger than one result | `guides/how-to-read-in-slices.md` |
| to reuse a function rather than write a helper | `guides/how-to-share-functions.md` |
| to keep a name between calls instead of pasting its source again | `guides/how-to-keep-bindings.md` |
| to hand a chunk of work to a second session that cannot reach more than you can | `guides/how-to-spawn-a-subagent.md` |
| the tool's knobs, rows, probes, limits and the seam it cannot check | `guides/tool-reference.md` |
| the language itself: surface syntax, builtins, every effect | <https://eyg.run/guides>; the machine-readable surface this package ships is `guides/eyg-surface.tsv` |
| to run a whole pi agent in EYG rather than one call | `skills/eyg-codemode/SKILL.md` loaded for the model, and the `policies/` records written out in full |
| to compare this package with the language's own agent harness (Overlay) and choose between them | `docs/world/entities/overlay.agent-harness.md` for what each owns, `notes/pi-eyg-codemode-vs-overlay.md` for the trade-off |
| what this tree claims about itself, and the command that re-checks each claim | `docs/world/00-map.md` |
| the commands a session here runs, with measured costs and the hard rules | `AGENTS.md` |

## What you need before it does anything

Install the package itself first, from wherever it sits on your machine:

```bash
pi install <the path to this package> -l   # installed from inside it, the declaration pi writes is ".."
pi list                                    # prints the absolute path every declaration resolves to
```

A local declaration is written relative to `.pi/settings.json`, which lives one level down, so
it reads as `..` (`docs/world/traps.md`). The same command installed *inside* a copy of this
repository also declares the vendored `pi-simple-world-model/` package, which is what checks
the claims in `docs/world/`.

**The EYG CLI is not in this package** - nothing here builds it, and the check lives in it:
the tool starts a runner begun with `--policy <module.eyg>`, and only that runner can answer
for an effect. Install one from
<https://eyg.run/guides/install-a-prebuilt-binary> or
<https://eyg.run/guides/install-from-source> (Gleam >= 1.7 and Bun). Neither page names
`--policy`: it is this package's requirement of the binary it starts, and the sentence above
and `guides/how-to-point-the-tool-at-your-runner.md` are where this package answers it.

Then the tool has to find what you installed. It starts one binary, from exactly two places,
in this order (`runnerCandidates` in `lib/render-helpers.mjs`):

1. **`EYG_CODEMODE_RUNNER`** - the absolute path to the runner. Set it and nothing else is
   considered, so installing the compiler somewhere off `PATH` is fine as long as you name it here.
2. **`eyg` on `PATH`** - whatever `command -v eyg` finds.

The binary has to know the command the tool builds, which always carries `--policy`. Check that
it does, rather than merely that a binary exists:

    <the eyg you installed> --help 2>&1 | grep -c -- --policy   # 0 => every call will be refused

**Neither install route is enough today.** The published release predates the flag
(`docs/world/entities/gap.runner-release-lacks-policy.md` carries the command that re-checks it),
and the language repository's published default branch has no build that knows it either
(`docs/world/entities/gap.policy-runner-not-on-main.md`). Installing this package and getting a
refusal for every call is the honest outcome, not a bug to chase: the tool reaches `eyg` on
`PATH` or a binary you name, and no other binary
(`docs/world/entities/cli.runner-official-install-only.md`); the one line a refused call ends
with names the remedy.

What stays unproven is the package in use, not the checks: no long-running session
(`docs/world/entities/pi.first-draft.md`), and the drift guard against
`test/fixtures/rule_mapping.gleam` is a record of the language's security suite rather than a
run of it.

## What it changes, and what it does not

- **One channel, decided per call.** Files, network and processes are reached only by effects the
  policy in force allows. Roots are a configuration line rather than a capability patch: `read_file`
  under one root, `write_file` under a narrower one, `fetch` refused. Four effects - `DecodeJSON`,
  `EYGParse`, `Hash`, `Sign` - are checked by nothing, since they compute over values they were given.
- **A refusal is not a crash and not a half-step.** The program continues with `Error(reason)`, and
  the host never performed the effect, so there is no partial file and no window in which the tool
  trusted something that was not there.
- **A store outside the history, read in slices.** `ReadFile` takes `offset`/`limit` and `Search`
  takes a `limit` spent while walking, so a knowledge base or an instruction set can live under a
  root while a session pulls the slice it needs. `guides/how-to-read-in-slices.md` is the how-to;
  this tree is the working example, since every claim in `docs/world/` re-runs in well under a
  second and nothing enters the prompt until a session asks for it.
- **What you give up:** the model writes EYG rather than JavaScript and `bash`. The forms it needs
  are in `skills/eyg-codemode/SKILL.md` (loaded automatically); the surface syntax is
  <https://eyg.run/guides/eyg-syntax-guide> and the effect reference is
  <https://eyg.run/guides/cli-effects-reference>; `action: "reference"` prints the builtin
  names and the effect surface without performing an effect. The language *skill* is the separate
  pi package, declared in `.pi/settings.json`; `pi list` prints the absolute path a
  declaration of it resolves to on your machine.
- **When not to use it:** a workspace whose agent must run arbitrary host commands - builds, git,
  a compiler - or a session whose job is editing this package's own source. If the harness itself
  should be written in EYG - its own loop, its own model client, a project config file - that is
  the language repository's Overlay harness, not this package
  (`docs/world/entities/overlay.agent-harness.md`).
- **Costs** live in `AGENTS.md`'s command table, dated where they were measured; a capture taken
  outside this workspace names where it came from (`guides/tool-reference.md`).

## What it installs

Each path this package ships, and what it is for:

| path | what it is |
| --- | --- |
| `extensions/eyg-codemode.ts` | the one pi extension: registers `eyg`, the `eyg_subagent` spawner and the operator's `/eyg-grant`, resolves policy/roots/runner from inside the package, starts the runner that checks every effect through argv, renders the rows, reads the registry scopes |
| `policies/agent-roots.eyg` | the default policy: files under `EYG_ALLOWED_ROOTS`, nothing else, `.env.eyg` never readable |
| `policies/deny-all.eyg` | the narrowest policy: a session that may only compute |
| `policies/spawner-effects.eyg` | `agent-roots` with an allowlist over each of its fields, for a child session: `EYG_SUBAGENT_EFFECTS` names the fields it may perform, unset refuses every gateable one |
| `libraries/search.eyg` | the search helper bound as `search_lib` by the `libraries` parameter; carries the `metadata` record the registry reads |
| `lib/render-helpers.mjs` | the pure shapes the tool and its test share (plain JS: jiti does not transform a `.mjs`, so annotations in it are a parse error at load) |
| `test/render-helpers.test.mjs` | the unit test over those shapes and the drift guard |
| `bin/agent/gen-surface.mjs` | generates `guides/eyg-surface.tsv` and drift-checks it: `--check` against four inputs, `--builtins <the page as markdown> --write` to re-capture the builtin rows |
| `bin/agent/doc-checks.mjs` | the doc checks over this package's prose: one term, resolving citations, headings, no mirrors, no dated prose; one row each in `bin/agent/audit.sh` |
| `test/fixtures/surface.PROVENANCE.md` | where the surface file's builtin rows were captured, when, their checksum, and how to re-capture them |
| `test/fixtures/rule_mapping.gleam` | the runtime's `rule_mapping` recorded verbatim, so the guard runs without the language repository present (`test/fixtures/rule_mapping.PROVENANCE.md`: where it came from, its checksums, how to refresh it) |
| `skills/eyg-codemode/SKILL.md` | the pi skill loaded when a model writes EYG: the forms, what a refusal means, how to ask the registry |
| `guides/` | this package's tutorial, how-tos and tool reference, plus `eyg-surface.tsv`: the builtin rows and one effect row per name with the policy field that decides it |
| `notes/`, `docs/world/`, `pi-simple-world-model/` | the decision record, the claims with the tool that checks them |

## Commands that run here

`AGENTS.md` carries the command table with measured costs: `node --test 'test/*.mjs'`,
`eyg check` on the shipped modules, `node pi-simple-world-model/bin/world_{lint,map,verify}.mjs`,
and `pi --world-model-check`. Do not run `node --test test/` - node takes a file or a glob,
not a directory (`docs/world/traps.md`).
