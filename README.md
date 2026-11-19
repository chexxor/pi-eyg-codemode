# pi-eyg-codemode

**EYG** is a small scripting language: everything is an expression, there are no statements,
and the only route a program has to the outside world is a named effect -
`perform ReadFile({path: "/abs/file", offset: 0, limit: 60})`. It has no effect that runs a
shell command. **This package makes an EYG program a pi agent's coding tool**: the built-in
JavaScript codemode is disabled, one tool `eyg` replaces `read`, `edit`, `write`, `bash`,
`grep` and `ls`, and the tool starts a runner begun with `--policy <module.eyg>`, so the host -
not the program - decides every effect, per call, before the host performs it. A refused
effect is a value (`Error("write_file denied by policy: /abs/path")`), so the model reads the
permission it was refused and acts on it; nothing happened on disk.

The language, its compiler, its test suite and **its documentation** live elsewhere: the code
is a separate repository - the language workspace, checked out somewhere on the operator's
machine - and the prose is on the **EYG website, <https://eyg.run>** (guides, references, the
policy vocabulary). This package is the tool in front of that check; it decides nothing about
what an effect may do, reads nothing from that repository at run time, and **replicates no
install steps** - the section below says what has to be true on your machine.

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
| runner | the EYG CLI this package starts; it is the only thing that can answer for an effect |
| preset | the EYG program the runner loads first, with one rule per effect it decides; this package ships `policies/agent-roots.eyg` and `policies/deny-all.eyg` |
| roots | the directories a session may reach; the shipped preset reads them from `EYG_ALLOWED_ROOTS` |
| the checks | a preset's decision for one effect, made before the host performs it |
| checked, unchecked | an effect a preset answers for, and an effect no preset can forbid |
| registry scope | a directory of function-sets the tool reads: the workspace, the home, this package's `libraries/` |

## Read next

| you want | read |
| --- | --- |
| one call to try, and how to read a refusal | `guides/first-session.md` - the tutorial |
| to point the tool at a CLI you built or downloaded | `guides/how-to-point-the-tool-at-your-runner.md` |
| to change what a session may reach: roots, one host, secrets | `guides/how-to-write-another-preset.md` |
| to read a file bigger than one result | `guides/how-to-read-in-slices.md` |
| to reuse a function rather than write a helper | `guides/how-to-share-functions.md` |
| the tool's knobs, rows, probes, limits and the seam it cannot check | `guides/tool-reference.md` |
| the language itself: surface syntax, builtins, every effect | <https://eyg.run/guides>, mirrored offline in `guides/syntax.md`, `guides/builtins_reference.md`, `guides/cli_effects_reference.md` |
| to run a whole pi agent in EYG rather than one call | `guides/pi_codemode_agent.md`, with `skills/eyg-codemode/SKILL.md` loaded for the model |
| what this tree claims about itself, and the command that re-checks each claim | `docs/world/00-map.md` |
| the commands a session here runs, with measured costs and the hard rules | `AGENTS.md` |

## What you need before it does anything

**The EYG CLI is not in this package** - nothing here builds it, and the check lives in it:
the tool starts a runner begun with `--policy <module.eyg>`, and only that runner can answer
for an effect. Install one from
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

**The prebuilt route is not enough on the machine this package was developed on.** On 2026-11-18
the release found by `command -v eyg` answered `v0.1.0`, that check printed `0`, and the release
published on the language repository the next day (`gleam_cli-v0.1.0`, fetched from
<https://github.com/CrowdHailer/eyg-lang/releases/latest>) predates the `--policy` flag. Until a
release carries it: build from source (the other guide) and point `EYG_CODEMODE_RUNNER` at that
binary, or read this package as documentation - installing the tool and getting a refusal for
every call is the honest outcome, not a bug to chase. Until such a runner runs here, **end-to-end
policy behaviour in this tree is UNVERIFIED** (`docs/world/entities/cli.prebuilt-binary.md`,
`notes/pi_codemode_runner_probe.md`): what holds the presets is `eyg check` on the modules and
the drift guard against `test/fixtures/rule_mapping.gleam`, never an observed refusal.

## What it changes, and what it does not

- **One channel, decided per call.** Files, network and processes are reached only by effects the
  preset in force allows. Roots are a configuration line rather than a capability patch: `read_file`
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
  <https://eyg.run/guides/cli-effects-reference> (offline copies of both live here as
  `guides/syntax.md` and `guides/cli_effects_reference.md`). The language *skill* is the separate
  pi package `pi-eyg-expressions`, a sibling of this tree; `pi list` prints the absolute path a
  declaration of it resolves to on your machine.
- **When not to use it:** a workspace whose agent must run arbitrary host commands - builds, git,
  a compiler - or a session whose job is editing this package's own source.
- **Costs** live in `AGENTS.md`'s command table, dated where they were measured; the language
  workspace's own runs are marked as its.

## What it installs

| path | what it is |
| --- | --- |
| `extensions/eyg-codemode.ts` | the one pi extension: registers `eyg`, resolves policy/roots/runner from inside the package, starts the runner that checks every effect through argv, renders the rows, reads the registry scopes |
| `policies/agent-roots.eyg` | the default preset: files under `EYG_ALLOWED_ROOTS`, nothing else, `.env.eyg` never readable |
| `policies/deny-all.eyg` | the narrowest preset: a session that may only compute |
| `libraries/search.eyg` | the search helper bound as `search_lib` by the `libraries` parameter; carries the `metadata` record the registry reads |
| `lib/render-helpers.mjs` | the pure shapes the tool and its test share (plain JS: jiti does not transform a `.mjs`, so annotations in it are a parse error at load) |
| `test/render-helpers.test.mjs` | the unit test over those shapes and the drift guard |
| `test/fixtures/rule_mapping.gleam` | the runtime's `rule_mapping` recorded verbatim, so the guard runs without the language workspace next door (`test/fixtures/rule_mapping.PROVENANCE.md`: where it came from, its checksums, how to refresh it) |
| `skills/eyg-codemode/SKILL.md` | the pi skill loaded when a model writes EYG: the forms, what a refusal means, how to ask the registry |
| `guides/` | the reference copied from the language workspace, and this package's tutorial, how-tos and reference |
| `notes/`, `docs/world/`, `pi-simple-world-model/` | the decision record, the claims with the tool that checks them |

## Commands that run here

`AGENTS.md` carries the command table with measured costs: `node --test 'test/*.mjs'`,
`eyg check` on the shipped modules, `node pi-simple-world-model/bin/world_{lint,map,verify}.mjs`,
and `pi --world-model-check`. Do not run `node --test test/` - node takes a file or a glob,
not a directory (`docs/world/traps.md`).
