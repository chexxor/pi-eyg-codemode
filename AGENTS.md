# AGENTS.md - pi-eyg-codemode

This workspace **is** the pi package: one package.json at the root, one pi extension,
its policies, its libraries, its tests. Read `README.md` for what the package does and
why its shape is the shape it is; this file carries the commands, the paths and the
rules, not the argument.

The package is one directory deep. Everything it loads at run time is inside it:
the extension resolves its own `policies/` and `libraries/` from `import.meta.url`
(`extensions/eyg-codemode.ts:233-251`, `packageDir()` then
`join(dir, "policies", "agent-roots.eyg")`), and the policy modules import nothing
outside the package (`invariant.policy-self-contained`). **Nothing in this tree reads
another workspace at run time.**

## Two things this tree does not contain

- **The language itself** - the EYG compiler, its Gleam sources, its test suite, its
  hub - lives in **the language repository**, somewhere else on the operator's machine.
  This package was extracted from inside it on 2026-11-18 and never goes back. Its files
  are cited as "the language repository's", never as a path this tree can open. That
  repository also carries its own agent harness, Overlay: what each harness owns is
  `docs/world/entities/overlay.agent-harness.md`, and what that repository does not carry is a
  host that decides effects for someone else's program - which is why the guard this package
  starts is in this tree (`host/guard.eyg`, `gap.policy-runner-not-on-main`).
- **The EYG language skill is not in this tree**: it is a separate pi package declared by
  path in `.pi/settings.json` - the one line of this tree that reaches outside it, and the
  only reason a session here can see the language reference. `pi list` prints where each
  declared package resolves. A session that needs the language reference loads that
  package; a session that needs the effect surface reads `guides/eyg-surface.tsv` here. Whether that
  skill belongs inside this package or out as its own release is an open question, with its
  evidence and its two triggers in
  `docs/world/entities/gap.language-skill-home-undecided.md`.

## The layout, and what each directory is for

`extensions/` the one pi extension (registers the `eyg` tool, resolves policy/roots/runner,
writes the entry a call runs and spawns the installed binary on it through argv) ·
`host/` the guard every call runs inside: one `handle` clause per effect row of
`guides/eyg-surface.tsv`, the policy applied inside each · `lib/` the plain-JavaScript shapes shared by the
tool and its tests · `libraries/` the EYG modules bound by the tool's `libraries`
parameter · `policies/` the policies this package ships, each written out in full and importing
nothing · `skills/` the pi skill a model reads before writing EYG · `test/` the unit test and the
recorded `rule_mapping` snapshot the drift guard compares against, and `guides/eyg-surface.tsv` the generated surface · `guides/` the prose
reference · `notes/` the trade-offs the code cannot show · `docs/world/` the claims with
their verify commands · `pi-simple-world-model/` the vendored tool over those claims ·
`bin/agent/` the scripts a human runs: `audit.sh` the rows below, `gen-surface.mjs` the surface
file's generator and drift check, `doc-checks.mjs` the five prose checks, `check-variable-shapes.mjs`
the generated text of a kept binding, run through the CLI ·
`.agents/skills/` the skills the coding agent loads. Every one carries a `PURPOSE` file.

## What the checks are, in facts

A program reaches the host only through effects, and this package has no effect that runs
shell commands; the guard this package ships puts a policy rule in front of each effect before the
host performs it.

- A call is two files the tool writes, one file the entry writes last, and one argv for the run: the tool writes `program.eyg` (the model's source
  inside one `run` function) and `entry.eyg` (which imports the guard, the policy and the
  program, and writes the refusal record as its last line) into a scratch directory of its own and spawns
  `<binary> <mode> <entry.eyg>` - no shell in between, so quoting cannot be a route around
  the checks (`runGuarded` in `extensions/eyg-codemode.ts:507`, its run spawn at
  `:558`).
- The per-effect checks are a program this package ships: `host/guard.eyg` installs one
  `handle` clause per effect row of `guides/eyg-surface.tsv` and applies the policy around
  the model's code, which is imported inside the guarded body. A label the guard does not
  name has no host, so naming every effect is what makes the default a refusal (`build` in
  `host/guard.eyg:704`, `test/host-coverage.test.mjs`,
  `notes/pi-codemode-host-guard-contract.md`).
- The model's own call type-checks that entry before the run starts: `<binary> check <entry.eyg>` on the same file, and only an `error: type mismatch` row stops the run (`entryCheckArguments` in `lib/render-helpers.mjs:497`, `ENTRY_CHECK_TIMEOUT_MS` in `extensions/eyg-codemode.ts:197`); a mis-shaped ask inside the guarded body otherwise spends the whole timeout printing nothing (`notes/pi-codemode-misshaped-ask.md`).
- Policy resolution: the order is stated once, in the table "Which policy a call gets" in
  `guides/how-to-write-a-policy.md`, and it is one function - `resolvePolicy` in
  `lib/render-helpers.mjs:672`, used at `extensions/eyg-codemode.ts:772`. A slot that names no
  module is skipped, and when none names one the tool refuses rather than running unchecked. The
  call's `policy` argument sits outside that chain: it is
  honoured only when it names the policy the chain already chose or `NARROWEST_POLICY_FILE`
  (`narrows` in `lib/render-helpers.mjs:636`, used at `:684`), and anything else comes back
  `refusedArgument` (`extensions/eyg-codemode.ts:789`, and `:1502` for a child's policy).
- The binary is chosen by name, not by asking it what it can do: `EYG_CODEMODE_RUNNER` (an
  absolute path), else `eyg` on PATH - two places, no third (`runnerCandidates` in
  `lib/render-helpers.mjs:592`, used at `extensions/eyg-codemode.ts:840` and `:1546`). Nothing
  is asked of it but the mode word and a file this package wrote; a missing binary, or one with
  no such mode command, ends the call with one line naming the install and quoting the command
  that was run (`runnerFailureLine` in `lib/render-helpers.mjs:893`).
- **Nothing here waits on a build of the language.** The installed CLI runs every call:
  `eyg --version` answers `eyg v0.1.0` and `eyg run <the entry this package writes>` runs the
  guard (`@measured 2026-11-22`), so what a shipped policy decides at runtime is re-runnable
  here - run the claim's command and report what it prints. What the language repository still
  does not carry is a host of its own (`gap.policy-runner-not-on-main`).
- Env: `EYG_CODEMODE_RUNNER` (absolute path to the binary a call runs in), `EYG_POLICY` (absolute
  policy module path), `EYG_ALLOWED_ROOTS` (comma-separated absolute roots, the default source for
  the `ctx.roots` the tool writes into the entry),
  `EYG_CODEMODE_TIMEOUT` (ms, default 30000, cap 120000); the tool's `timeout` parameter is
  in **seconds** (default 30, max 120).
- The effect surface: 23 effects, 19 named by a policy field, 4 unchecked
  (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) available under every shipped policy including deny-all;
  `Search` has a field of its own (`search`) because the guard, not the CLI, is the host for that
  walk. The drift guard compares the labels and the unchecked set of `POLICY_FIELDS` in
  `lib/render-helpers.mjs` against `test/fixtures/rule_mapping.gleam` (a recorded snapshot of the
  language repository's `overlay.gleam`, md5
  `9cb5e8ace42e1df79083bab255ee9bb1` at capture); the field column is this package's own, and
  `test/host-coverage.test.mjs` proves it against the guard.
- A **policy rule is a function** the guard calls with the value the program asked for, and it
  answers `Pass(value)` (the guard performs with what you hand back, so the argument may be
  rewritten) or `Mock(reason)` (the guard answers the program itself, in the shape that effect's
  own reply type allows: `Error(reason)` for the effects whose reply carries text, `None({})` for
  `Env`, `Error({})` for `CWD`, the unit value for `Sleep`, `StandardOut` and `StandardError`, and
  an abort naming the reason for `Now`, `Random`, `Flip` and `Exit`, whose replies carry no
  refusal). Rules wrap each other (`hide_secrets(under(...))`), which is why one record is one
  composed decision (`policies/agent-roots.eyg`, read 2026-11-18; `ADR-006-guard-in-package`).
- The tool's registry reads three scopes and never writes: `<cwd>/.pi/eyg-functions`
  (workspace), `$HOME/.pi/eyg-functions` (home), `<package>/libraries` (package). The listing
  says whose module each entry is (`scopeOwner` and `registryScopeLegend` in
  `lib/render-helpers.mjs`, printed per entry in `extensions/eyg-codemode.ts`), because a name
  in the home scope reaches every project on the machine.

## The commands a session runs here, and what each costs

| Do this | cost | measured |
| --- | --- | --- |
| `bin/agent/audit.sh` (a human or a cron runs it; twenty-four rows, each cost printed) | 40 s wall, 24 rows, 0 failed | 2026-11-26 |
| `node bin/agent/doc-checks.mjs --all` (the five prose checks: one term, citations, headings, mirrors, dated prose) | 0.07 s wall | 2026-11-22 |
| `node bin/agent/gen-surface.mjs --check` (the surface file against its four inputs) | 0.04 s wall | 2026-11-22 |
| `node --test 'test/*.mjs'` (or the single file; one named test per group) | 0.16 s wall, 46 tests, 0 fail | 2026-11-23 |
| `node bin/agent/refusal-probe.mjs` (one guarded call from a shell: the entry, the policy import and the program module the tool writes, run as `eyg run <entry>`; `--with-policy`, `--fields`, `--program`, `--inside-roots`) | 0.19 s wall | 2026-11-22 |
| `node bin/agent/misshape-probe.mjs` (the entry check alone: `eyg check <the entry this package writes>`, never the run; `--program` names a fixture) | 0.25 s wall on the shipped mis-shape, 0.407 s on a well-shaped fixture | 2026-11-25 |
| `node --test test/host-coverage.test.mjs` (the guard names every effect row of the surface file) | 0.09 s wall | 2026-11-22 |
| `node bin/agent/check-variable-shapes.mjs` (generates a kept binding's text and runs it through the CLI on PATH, with no policy module loaded) | 0.40 s wall, eleven rows | 2026-11-22 |
| `node bin/agent/new-project.mjs /abs/dir` (writes the one `.pi/settings.json` a scratch project needs; refuses a relative directory and a project that already has one) | 0.04 s wall | 2026-11-25 |
| `pi --print --mode json --tools eyg <prompt>` (one fresh session) | 440 s wall for three `eyg` calls - the wall is the model's generation, not the calls, so budget for the task's calls and run it in the background; needs `--model`, and it must be the model the server serves (`$PI_MODEL`) - `pi --list-models` also lists names the server answers 404 for, and the default model hangs | 2026-11-23 |
| `for f in policies/*.eyg libraries/*.eyg host/*.eyg; do eyg check "$f"; done` (the audit's `shipped EYG modules check` row) | 0.65 s wall | 2026-11-22 |
| `node pi-simple-world-model/bin/world_lint.mjs` | 0.06 s wall | 2026-11-18 |
| `node pi-simple-world-model/bin/world_map.mjs --check` | 0.04 s wall | 2026-11-18 |
| `node pi-simple-world-model/bin/world_verify.mjs --all` | 11.3 s wall, every claim in `docs/world/` (the count is the map's), 0 failed - the chains run CLI probes, so this is no longer the cheap row it was | 2026-11-23 |
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

- **Nothing tracked may contain credentials.** `.env.eyg` files are denied by the default policy
  and by the narrowest one, and must stay out of the tree; do not copy a token into a note, a
  claim, a commit message or a guide.
- **Say each fact once.** A sentence carries one new fact; when a neighbour only restates
  it - in other words, as emphasis, or as a gloss under a link whose URL already says it -
  delete the restatement and keep the link. `install from <url>`, not `install from the
  docs, not from this README, the website is the source`. Check it by hand: name the
  paragraph's key noun, grep the paragraph, a hit in two sentences is one too many.
- **EYG reaches the outside world only through effects**, and the checks are host-side: a
  program cannot opt out of it by writing different code. Do not loosen a policy to get
  past a boundary - name the boundary, and if a policy must change, say why in a note and
  change the whole policy rather than one handler inside it.
- **Bash is not the work.** EYG does not have an effect to run shell commands; bash here is
  for reading this tree and for work EYG cannot express, not for doing the work the operator
  asked for.
- **Never write outside this tree.** The language repository and every other checkout are
  read-only from here: no edits, no moves, no `git` command run in anything but this
  workspace.
- **Do not push, publish or release.** A remote **is** configured: `git remote -v` answers
  `chexxor  git@github.com:chexxor/pi-eyg-codemode.git` and there is no `origin`
  (`@measured 2026-11-20 and again 2026-11-21`), and `git reflog show --date=iso-strict
  refs/remotes/chexxor/main` records five `update by push` entries, the latest at
  2026-11-20T18:00:15-06:00; the record does not say who ran them. The
  rule is unchanged by the fact: pushing is not a session's act, publishing this package is the
  operator's, and `npm publish` is out of scope. Local commits are fine, and a session's work is
  done when it is committed - check `git branch -r --contains <your commit>` answers nothing
  before saying nothing was pushed.
- **Ground every claim** in a file read, a command run, or a fetched page, with a date and
  the command (`@measured 2026-11-18 by ...`). An unverified item is labelled UNVERIFIED.
- **A deferral names its trigger**, or it is not parked - it is lost.
- **Read the file before you edit it.**

## Clock out (before you stop)

1. Write a note in `notes/` for any trade-off the code does not show, with `name:`,
   `description:`, `date:` front-matter - and delete a note the code or a guide now covers.
2. Verify the claims you touched: `node pi-simple-world-model/bin/world_verify.mjs --all`, or
   `--changed-from <baseline commit>` for the claims the diff moved - after
   committing, since it diffs a ref to `HEAD` and selects no claims from uncommitted edits.
   A claim whose command fails is `status: suspect` with the date it was caught.
3. Append to `docs/world/traps.md` every obstacle this session hit: the wrong path taken,
   the command that fixes it, the time it costs - three lines at most, and an entry without
   a command is not a fix.
4. Regenerate the tier-0 index if any claim moved: `node pi-simple-world-model/bin/world_map.mjs`.
5. Report to the operator: what moved, what exists now that did not before, what remains,
   every decision with pros, cons and a recommendation, and **done / blocked / unverified**
   with the evidence for each claim.

## What is not here yet

- **No planning system.** `PLAN.md`, `NEXT.md`, `QUESTIONS.md`, milestones and stage checks are the
  language repository's; nothing here carries a queue. Trigger to port one: a task from the
  operator that spans several steps of its own.
- **No CI.** There is no `.github/workflows` and no `entry.eyg` here. `bin/agent/audit.sh` is the
  one command that runs the rows in the table above and prints what each cost; nothing in this
  tree runs it, so a failing check is still something a person notices. Trigger for CI: the first
  commit that lands with a failing check nobody saw.
- **No release of the language carries a host, and this package does not wait for one.** The
  guard is this package's file (`host/guard.eyg`), so a fresh clone gets the checks with the
  package; what is copied from the language is its effect surface, recorded in
  `test/fixtures/rule_mapping.gleam`. Trigger to re-capture: `node bin/agent/gen-surface.mjs
  --check` fails against an installed CLI whose labels differ - then re-capture the fixture the
  way `test/fixtures/rule_mapping.PROVENANCE.md` says and move
  `gap.runner-release-lacks-policy` and `gap.policy-runner-not-on-main` with the new output.
- **No decision on where the language-skill package lives.** `.pi/settings.json` declares it from
  outside this tree - the one line here that reaches outside - and the three shapes (leave it, vendor
  it as `pi-simple-world-model/` is vendored, publish it and declare it by name) are unwritten down as
  a decision (`gap.language-skill-home-undecided`; options and costs in
  `notes/pi-codemode-language-skill-packaging.md`). It is the next milestone's first row. Trigger: the
  upstream `SKILL.md` front-matter fix lands and a re-run beats the surface this package ships, or the first
  release of either package lets the declaration be written by name.
- **Three copies of the world model tool.** This one, the language repository's, and the
  publisher's; drift between them is invisible. Revisit trigger: two `CHANGELOG.md`s differ,
  or a fourth workspace wants the same tool - then publish it as an npm or git package.
