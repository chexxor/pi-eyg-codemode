# Project world model - tier 0

Read this first. It tells you where to look; the pages it points at carry the claims and
the command that re-checks each one. Task state and session narrative do not belong here.

This workspace is one pi package: `pi-eyg-codemode`, the EYG coding tool for a pi agent
whose every effect is decided by a host policy module before the host performs it. The
language itself, its Gleam toolchain and its hub live in the language repository;
nothing here reads it at run time, and this tree never writes outside itself.

<!-- BEGIN GENERATED: do not edit -->
## Layout - what is in this repository

| directory | purpose |
| --- | --- |
| bin/ | The shell scripts a human runs outside this package: `agent/audit.sh`, which runs the checks in |
| docs/ | The world model records for this workspace: docs/world/00-map.md (tier-0 index), the entity, decision and runbook pages, invariants.md, traps.md and roster.yaml. The lint, map and verify CLIs that check them live in pi-simple-world-model/. |
| extensions/ | The one pi extension: it registers the `eyg` tool, resolves the policy, the roots and the runner from inside the package, and spawns the runner that checks every effect through argv. |
| guides/ | Prose this package writes for its own users - the tour (`first-session.md`), the how-tos |
| host/ | The EYG host this package ships: the guard module that wraps a model's program in |
| lib/ | The pure JavaScript shapes the tool and its tests share: render rows, the effect scan, availability-probe arguments, the registry walk, the argument mapping. |
| libraries/ | EYG modules this package ships: bound by the tool's `libraries` parameter and listed in its function registry. |
| notes/ | Design notes with name/description/date front-matter; the record of trade-offs that are not clear in the code. |
| pi-simple-world-model/ | The pi package that implements the world model: bin CLIs, lib parser, one extension, one skill, one prompt, templates. |
| policies/ | The policy modules this package ships, each written out in full and importing nothing outside this tree. |
| skills/ | The pi skill loaded when a model writes EYG: the forms, what a refusal means, and how to ask the registry before writing a helper. |
| test/ | The unit test over the shapes in `lib/`, and the recorded `rule_mapping` snapshot the drift guard compares against. |

## Commands you can run

| command | what it does |
| --- | --- |
| `npm run test` | `node --test 'test/*.mjs'` |
| `npm run world` | `node pi-simple-world-model/bin/world_verify.mjs --all` |
| `npm run world:lint` | `node pi-simple-world-model/bin/world_lint.mjs` |
| `npm run world:map` | `node pi-simple-world-model/bin/world_map.mjs` |

## Claim index

| id | one line | owner | verified_at |
| --- | --- | --- | --- |
| cli.checked-runner-on-this-host | **Superseded 2026-11-21 by `docs/world/entities/cli.runner-official-install-only.md`.** The untracked symlink this ... | delegate | 2026-11-25 |
| cli.prebuilt-binary | `command -v eyg` answers `$HOME/.local/bin/eyg` and `eyg --version` answers `eyg v0.1.0` (measured 2026-11-18, again ... | delegate | 2026-11-25 |
| cli.runner-official-install-only | `runnerCandidates` in `lib/render-helpers.mjs` returns two things and nothing else: the value of `EYG_CODEMODE_RUNNER` ... | delegate | 2026-11-25 |
| codemode.effect-surface | A running program reaches the host only through effects, and the set it may perform is an intersection of three files. | delegate | 2026-11-25 |
| doc-checks.citations | Every markdown file in the tree is scanned (except the session's own goal and note state under `.pi/goals/` and ... | delegate | 2026-11-25 |
| doc-checks.dated-prose | Within the prose set minus `AGENTS.md`, no line may match an ISO date, `@measured`, "measured <a digit>", "development ... | delegate | 2026-11-25 |
| doc-checks.headings | Within the prose set (`README.md`, `AGENTS.md`, `guides/`, `skills/`, `.agents/skills/`; the set ... | delegate | 2026-11-25 |
| doc-checks.mirrors | Two halves, one per failure mode of an offline documentation copy. | delegate | 2026-11-25 |
| doc-checks.one-term | `bin/agent/doc-checks.mjs` holds this package's five prose checks, one name each: `one-term`, `citations`, `headings`, ... | delegate | 2026-11-25 |
| gap.grant-polish-undecided | The mechanism is recorded and partly measured in `docs/world/entities/pi.session-grants.md`: a refusal carries the ask ... | delegate | 2026-11-25 |
| gap.install-guides-name-no-policy | This page recorded the hole: neither install page at <https://eyg.run/guides> - `install-a-prebuilt-binary` and ... | delegate | 2026-11-25 |
| gap.language-skill-home-undecided | `.pi/settings.json` declares the EYG language-skill pi package by path, one directory above this one (`@measured ... | delegate | 2026-11-25 |
| gap.one-host-check-not-transitive | Boundary fact 7 of `docs/world/entities/host.guard-boundary.md` refuses a program whose parse names a `handle` clause. | delegate | 2026-11-25 |
| gap.policy-record-extension | `guides/how-to-write-a-policy.md` tells an operator to copy the shipped policy nearest what they need and change the ... | delegate | 2026-11-25 |
| gap.policy-runner-not-on-main | The one-shot run with a policy module that this package used to start is not in the language repository's `main` as ... | delegate | 2026-11-25 |
| gap.roots-have-no-config-file | This page recorded the hole: the roots in force were the session working directory or `EYG_ALLOWED_ROOTS`, ... | delegate | 2026-11-25 |
| gap.runner-release-lacks-policy | This page recorded the hole: the latest release the language repository serves is `gleam_cli-v0.1.0` (read from its ... | delegate | 2026-11-25 |
| gap.symlinks-escape-the-roots | `absolute` (`host/guard.eyg:165`) normalizes a path **lexically**: split it into segments, collapse `.` and `..`, ... | delegate | 2026-11-25 |
| gap.windows-is-undocumented | The language's prebuilt-install page (<https://eyg.run/guides/install-a-prebuilt-binary>, read as a copy here on ... | delegate | 2026-11-25 |
| guides.index | `guides/` holds what an agent reads before writing EYG, and it is one set now: prose this package wrote, plus ... | delegate | 2026-11-25 |
| guides.surface-file | `guides/eyg-surface.tsv` is the whole offline answer to "what may I call, and what may I ask for": 29 `builtin` rows ... | delegate | 2026-11-25 |
| host.closed-effect-set | The question this answers: the tool runs EYG, EYG lets a program name an effect and install a handler for it, so what ... | delegate | 2026-11-25 |
| host.guard-boundary | `host/guard.eyg` is an EYG program, run by the ordinary installed CLI with no flag, that decides every effect of a call. | delegate | 2026-11-25 |
| notes.format | `notes/` is where trade-offs go when they are not clear from the code: one file per subject, `name:`, `description:` ... | delegate | 2026-11-25 |
| overlay.agent-harness | Overlay is the EYG repository's own agent. | delegate | 2026-11-25 |
| overlay.policy-rules | A running EYG program is stopped at every effect before the host performs it, and a user-supplied function decides. | delegate | 2026-11-25 |
| pi.codemode-tool | This workspace **is** the package: `pi list` (2026-11-18) resolves the declaration `..` in `.pi/settings.json` to this ... | delegate | 2026-11-25 |
| pi.fetch-and-injection-exfiltration | `fetch` is a checked effect whose policy field is `fetch`, and both shipped policies refuse it by name: `fetch: ... | delegate | 2026-11-25 |
| pi.first-draft | `README.md` opens with a status line calling the package a first draft that has not been proved in extended use, and ... | delegate | 2026-11-25 |
| pi.policy-config | Two questions the operator asked, answered in the tree: which policy the package uses if you set nothing, and where to ... | delegate | 2026-11-25 |
| pi.reference-action | `action: "reference"` (`code: ""`) prints the language surface the session is writing against: `eyg reference: 29 ... | delegate | 2026-11-25 |
| pi.registry-scope-persistence | A session's roots contain the two directories a call can leave code in for a later call: the function-registry scope ... | delegate | 2026-11-25 |
| pi.secret-directory-rule | `policies/agent-roots.eyg` decides a path in two steps. | delegate | 2026-11-25 |
| pi.session-grants | A refused effect is a value the program gets back, not a report the model owes the operator: the tool description, the ... | delegate | 2026-11-25 |
| pi.spawner-policy | `policies/spawner-effects.eyg` is the third policy this package ships: `agent-roots.eyg` with an allowlist check over ... | delegate | 2026-11-25 |
| pi.subagent-spawn | `eyg_subagent`, registered by `extensions/eyg-codemode.ts`, starts a second pi session in the same working directory ... | delegate | 2026-11-25 |
| pi.variable-scopes | An `eyg` call keeps the top-level `let` bindings it defines by naming a scope with `extern`: `session`, `workspace` ... | delegate | 2026-11-25 |
| usability.without-language-skill | One task, run in fresh one-shot sessions over two scratch projects whose `.pi/settings.json` differ only in whether the ... | delegate | 2026-11-25 |
| variables.generated-shapes | `bin/agent/check-variable-shapes.mjs` builds the text an `extern` call builds and runs it through the CLI on `PATH`: ... | delegate | 2026-11-25 |
| world-model.package | `pi-simple-world-model/` is a pi package carried in this workspace as a copy, declared per project in ... | delegate | 2026-11-25 |
| invariant.eyg-over-bash | EYG is the language this package runs its agent in, and it does not have an effect to run shell commands. | human | 2026-11-25 |
| invariant.notes-frontmatter | Every note carries `name:` front-matter. | human | 2026-11-25 |
| invariant.purpose-every-dir | Every top-level directory has a `PURPOSE` file, so the generated tier-0 map can name what each one is for. | human | 2026-11-25 |
| invariant.policy-self-contained | A policy module in this package imports nothing outside the package. | human | 2026-11-25 |
| ADR-000-world-model | ## Context Agents rediscover the layout, act on stale assumptions, and re-litigate settled decisions. | human | 2026-11-25 |
| ADR-001-world-model-import | ## Context The world model tool (`pi-simple-world-model`) is authored in `another of the operator's projects`. | delegate | 2026-11-25 |
| ADR-002-handler-seam | **Superseded 2026-11-22 by `docs/world/decisions/ADR-006-guard-in-package.md`.** The choice this record made - that the ... | human | 2026-11-25 |
| ADR-003-doc-delegation | ## Context A new user of this package needs two different things: how to get an EYG CLI onto their machine, and what ... | human | 2026-11-25 |
| ADR-004-doc-shape-for-two-readers | ## Context Three readers, and each needs a different thing from this tree: 1. | human | 2026-11-25 |
| ADR-006-guard-in-package | ## Context Until 2026-11-22 the tool asked the CLI to do the deciding: it named a policy module and the program inline ... | human | 2026-11-25 |
| ADR-005-grants-spawn-and-child-surface | ## Context Three mechanisms went in during 2026-11-20, each answering a different question the code could not answer ... | delegate | 2026-11-25 |
| runbook.check-a-change | Costs are in `AGENTS.md`'s command table, dated where each was measured; they are not repeated here. | delegate | 2026-11-25 |
| runbook.next-milestone | Each row is a claim whose `verify` still passes, which means the hole is still open. | delegate | 2026-11-25 |

## Where to look for a claim

- entities: 40 · invariants: 4 · decisions: 7 · runbooks: 2 · traps: 88
- suspect right now: doc-checks.citations
- re-check everything: `npm run world` · checks: `npm run world:lint` · regenerate this index: `npm run world:map`
<!-- END GENERATED -->
