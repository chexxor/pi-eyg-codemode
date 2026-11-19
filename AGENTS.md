# AGENTS.md - pi-eyg-codemode

This workspace **is** the pi package: one package.json at the root, one pi extension,
its policies, its libraries, its tests. Read `README.md` for what the package does and
why its shape is the shape it is; this file carries the commands, the paths and the
rules, not the argument.

The package is one directory deep. Everything it loads at run time is inside it:
the extension resolves its own `policies/` and `libraries/` from `import.meta.url`
(`extensions/eyg-codemode.ts:104-121`, `packageDir()` then
`join(dir, "policies", "agent-roots.eyg")`), and the policy modules import nothing
outside the package (`invariant.policy-self-contained`). **Nothing in this tree reads
another workspace at run time.**

## Two neighbours, neither of them in here

- **The language itself** - the EYG compiler, its Gleam sources, its test suite, its
  hub - lives in `/home/chexxor/Git/eyg-lang`. This workspace was extracted from inside
  that repository on 2026-11-18 and never goes back: it is read-only from here, and a
  session here must not write, move or `git` into that tree. Its files are cited as
  "the language workspace", never as a path this tree can open.
- **The EYG language skill is not in this tree**: it is the separate pi package
  `pi-eyg-expressions` at `/home/chexxor/Git/pi-eyg-expressions`, declared by absolute
  path in `.pi/settings.json` (written relative as `../../pi-eyg-expressions`; `pi list`
  on 2026-11-18 resolves it to that absolute path). A session that needs the language
  reference loads that package; a session that needs the effect reference reads
  `guides/` here.

## The layout, and what each directory is for

`extensions/` the one pi extension (registers the `eyg` tool, resolves policy/roots/runner,
spawns the gated runner through argv) · `lib/` the plain-JavaScript shapes shared by the
tool and its tests · `libraries/` the EYG modules bound by the tool's `libraries`
parameter · `policies/` the policy presets, one record, one rule per gated effect, inlined
· `skills/` the pi skill a model reads before writing EYG · `test/` the unit test and the
recorded `rule_mapping` snapshot the drift guard compares against · `guides/` the prose
reference · `notes/` the trade-offs the code cannot show · `docs/world/` the claims with
their verify commands · `pi-simple-world-model/` the vendored tool over those claims ·
`.agents/skills/` the skills the coding agent loads. Every one carries a `PURPOSE` file.

## What the gate is, in facts

A program reaches the host only through effects, and this package has no effect that runs
shell commands; a policy module decides each effect before the host performs it.

- The tool spawns `<runner> <mode> --policy <module.eyg> -c <source>` through argv - no
  shell in between, so quoting cannot be a route around the gate.
- Policy resolution order: the `policy` argument, then `EYG_POLICY`, then the package's own
  `policies/agent-roots.eyg`, and if none exists the tool refuses rather than running
  ungated (`extensions/eyg-codemode.ts:372-377`).
- The runner is probed, not assumed: candidates `eyg` on PATH and
  `<cwd>/packages/gleam_cli/dist/eyg`, and a candidate only qualifies when its `--help`
  mentions `--policy` (`extensions/eyg-codemode.ts:387-404`).
- **On this host that probe fails.** `command -v eyg` answers `/home/chexxor/.local/bin/eyg`,
  `eyg --version` answers `eyg v0.1.0`, and `grep -c -- '--policy' <<< "$(~/.local/bin/eyg --help 2>&1)"`
  printed `0` (measured 2026-11-18). So from this workspace the CLI type-checks but cannot
  gate a run, and any statement about what a preset *allows at runtime* is UNVERIFIED here -
  never report it as PASS. The gated runner is built in the language workspace and is not
  vendored here.
- Env: `EYG_CODEMODE_RUNNER` (absolute runner path), `EYG_POLICY` (absolute module path),
  `EYG_ALLOWED_ROOTS` (comma-separated absolute roots, read by the default preset),
  `EYG_CODEMODE_TIMEOUT` (ms, default 30000, cap 120000); the tool's `timeout` parameter is
  in **seconds** (default 30, max 120).
- The effect surface: 23 effects, 19 named by a policy field, 4 unchecked
  (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) available under every preset including deny-all;
  `Search` shares the `read_file` field. The drift guard compares
  `POLICY_FIELDS` in `lib/render-helpers.mjs` against `test/fixtures/rule_mapping.gleam`
  (a recorded snapshot of the language workspace's `overlay.gleam`, md5
  `9cb5e8ace42e1df79083bab255ee9bb1` at capture).
- A **policy rule is a function** the host calls with the value the program asked for, and it
  answers `Pass(value)` (perform with what you hand back, so the argument may be rewritten) or
  `Mock(x)` (answer the program, the host performs nothing - a refusal is
  `Mock(Error("<effect> denied by policy: <path>"))`, and `Mock` must return a value of the
  effect's own type: `env: Mock(None({}))`, `cwd: Mock(Error({}))`, and `Mock` cannot answer
  `Exit`). Rules wrap each other (`hide_secrets(under(...))`), which is why one record is one
  composed decision (`policies/agent-roots.eyg`, read 2026-11-18; `ADR-002-handler-seam`).
- The tool's registry reads three scopes and never writes: `<cwd>/.pi/eyg-functions`
  (workspace), `$HOME/.pi/eyg-functions` (home), `<package>/libraries` (package).

## The commands a session runs here, and what each costs

| Do this | cost | measured |
| --- | --- | --- |
| `node --test 'test/*.mjs'` (or the single file) | 0.09 s wall, pass 1 fail 0 | 2026-11-18 |
| `for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done` | 0.43 s wall | 2026-11-18 |
| `node pi-simple-world-model/bin/world_lint.mjs` | 0.06 s wall | 2026-11-18 |
| `node pi-simple-world-model/bin/world_map.mjs --check` | 0.04 s wall | 2026-11-18 |
| `node pi-simple-world-model/bin/world_verify.mjs --all` | 0.37 s wall, 24 claims | 2026-11-18 |
| `pi --world-model-check` | 1.14 s wall | 2026-11-18 |
| `pi list` | registers the four project packages by absolute path | 2026-11-18 |

`node --test test/` is not a command that works: node takes a file or a glob, not a bare
directory (`docs/world/traps.md`). `verify` caps each claim's command at 20 s. The same four
are npm scripts: `npm run test`, `npm run world`, `npm run world:lint`, `npm run world:map`.
`world_verify.mjs` **rewrites the records it checks** - a passing check moves `verified_at`,
a failing one writes `status: suspect` in place - and it stamps the UTC date, so at 21:00 CST
here it writes the next day while `date` says this one (`docs/world/traps.md`). Run verify
before you commit, and diff what it changed.

## Skills: load on the trigger event, not on the topic

What is installed here, `@measured 2026-11-18 by ls .agents/skills`: `eyg-run` and
`note-keeping`, both in-tree; `project-world-model` comes from the vendored
`pi-simple-world-model` package, not from this directory.

| the event that just happened | the skill you open, now |
| --- | --- |
| an `eyg` command failed, or you need to type-check/measure a module | `eyg-run` |
| a session starts, or you are about to record a decision | `note-keeping` |
| a claim in `docs/world/` is about to be acted on, or the map and the tree disagree | `project-world-model` |
| a model is about to write EYG into the `eyg` tool | `skills/eyg-codemode/SKILL.md` (the package's own skill) |

**A skill that is wrong is a bug.** These are tracked in git, so a fix is a commit; record
the reason in `notes/` with front-matter. A skill whose path claim points outside this tree
is a stale claim - fix the claim in the same commit as the fact.

**Facts versus procedures.** This file holds facts: commands, paths, contracts, budgets,
rules. Procedures live in `guides/` and in the skill files. Never put a procedure here;
never put a workspace fact in a guide - a fact in two places drifts.

## Hard rules

- **Nothing tracked may contain credentials.** `.env.eyg` files are denied by both presets
  and must stay out of the tree; do not copy a token into a note, a claim, a commit message
  or a guide.
- **Say each fact once.** A sentence carries one new fact; when a neighbour only restates
  it - in other words, as emphasis, or as a gloss under a link whose URL already says it -
  delete the restatement and keep the link. `install from <url>`, not `install from the
  docs, not from this README, the website is the source`. Check it by hand: name the
  paragraph's key noun, grep the paragraph, a hit in two sentences is one too many.
- **EYG reaches the outside world only through effects**, and the gate is host-side: a
  program cannot opt out of it by writing different code. Do not loosen a preset to get
  past a boundary - name the boundary, and if a preset must change, say why in a note and
  change the whole preset, one rule per effect.
- **Bash is not the work.** EYG does not have an effect to run shell commands; bash here is
  for reading this tree and for work EYG cannot express, not for doing the work the operator
  asked for.
- **Do not touch the language workspace.** `/home/chexxor/Git/eyg-lang` is read-only from
  here: no edits, no moves, no `git` commands run in it.
- **Do not push, publish or release.** No remote is configured here (`git remote get-url
  origin` answers nothing, 2026-11-18); publishing this package is the operator's, and `npm
  publish` is out of scope. Local commits are fine.
- **Ground every claim** in a file read, a command run, or a fetched page, with a date and
  the command (`@measured 2026-11-18 by ...`). An unverified item is labelled UNVERIFIED.
- **A deferral names its trigger**, or it is not parked - it is lost.
- **Read the file before you edit it.**

## Clock out (before you stop)

1. Write a note in `notes/` for any trade-off the code does not show, with `name:`,
   `description:`, `date:` front-matter - and delete a note the code or a guide now covers.
2. Verify the claims you touched: `node pi-simple-world-model/bin/world_verify.mjs --all`
   (0.37 s), or `--changed-from <baseline commit>` for the claims the diff moved - after
   committing, since it diffs a ref to `HEAD` and selects 0 claims from uncommitted edits.
   A claim whose command fails is `status: suspect` with the date it was caught.
3. Append to `docs/world/traps.md` every obstacle this session hit: the wrong path taken,
   the command that fixes it, the time it costs - three lines at most, and an entry without
   a command is not a fix.
4. Regenerate the tier-0 index if any claim moved: `node pi-simple-world-model/bin/world_map.mjs`.
5. Report to the operator: what moved, what exists now that did not before, what remains,
   every decision with pros, cons and a recommendation, and **done / blocked / unverified**
   with the evidence for each claim.

## What is not here yet

- **No planning system.** `PLAN.md`, `NEXT.md`, `QUESTIONS.md`, milestones and gates are the
  language workspace's; nothing here carries a queue. Trigger to port one: a task from the
  operator that spans several steps of its own.
- **No CI, no gate script.** There is no `bin/agent/audit.sh`, no `.github/workflows`, no
  `entry.eyg` here; the checks in the table above are the whole gate. Trigger: the first
  time a session has to re-derive the same check three times.
- **The gated runner is not in this workspace.** The type-checking CLI on PATH has no
  `--policy`, so end-to-end gate behaviour is UNVERIFIED from here. Trigger: the first
  session that actually needs a gated run - then vendor or build a `--policy` runner and
  record what the presets then do.
- **Three copies of the world model tool.** This one, the language workspace's, and the
  publisher's; drift between them is invisible. Revisit trigger: two `CHANGELOG.md`s differ,
  or a fourth workspace wants the same tool - then publish it as an npm or git package.
