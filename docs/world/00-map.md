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
| bin/ | The shell scripts a human runs outside this package. One: `agent/audit.sh`, which runs the |
| docs/ | The world model records for this workspace: docs/world/00-map.md (tier-0 index), the entity, decision and runbook pages, invariants.md, traps.md and roster.yaml. The lint, map and verify CLIs that check them live in pi-simple-world-model/. |
| extensions/ | The one pi extension: it registers the `eyg` tool, resolves the policy, the roots and the runner from inside the package, and spawns the runner that checks every effect through argv. |
| guides/ | Prose guides read before writing EYG, in two sets: the language reference copied from the |
| lib/ | The pure JavaScript shapes the tool and its tests share: render rows, the effect scan, availability-probe arguments, the registry walk, the argument mapping. |
| libraries/ | EYG modules this package ships: bound by the tool's `libraries` parameter and listed in its function registry. |
| notes/ | Design notes with name/description/date front-matter; the record of trade-offs that are not clear in the code. |
| pi-simple-world-model/ | The pi package that implements the world model: bin CLIs, lib parser, one extension, one skill, one prompt, templates. |
| policies/ | The policy modules this package ships: one record, one rule per refusable effect, written out in full and importing nothing outside this tree. |
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
| cli.checked-runner-on-this-host | **Superseded 2026-11-21 by `docs/world/entities/cli.runner-official-install-only.md`.** The untracked symlink this ... | delegate | 2026-11-22 |
| cli.prebuilt-binary | `command -v eyg` answers `$HOME/.local/bin/eyg` and `eyg --version` answers `eyg v0.1.0` (measured 2026-11-18). | delegate | 2026-11-22 |
| cli.runner-official-install-only | `runnerCandidates` in `lib/render-helpers.mjs` returns two things and nothing else: the value of `EYG_CODEMODE_RUNNER` ... | delegate | 2026-11-22 |
| codemode.effect-surface | A running program reaches the host only through effects, and the set it may perform is an intersection of three files. | delegate | 2026-11-22 |
| gap.grant-polish-undecided | The mechanism is recorded and partly measured in `docs/world/entities/pi.session-grants.md`: a refusal names the ask, ... | delegate | 2026-11-22 |
| gap.install-guides-name-no-policy | Neither install route - the website's pages and this tree's mirrors, `guides/install_prebuilt.md` and ... | delegate | 2026-11-22 |
| gap.language-skill-home-undecided | `.pi/settings.json` declares the EYG language-skill pi package by path, one directory above this one (`@measured ... | delegate | 2026-11-22 |
| gap.policy-runner-not-on-main | The one-shot checked runner this package starts — `eyg run --policy <module.eyg>` — is not in the language repository's ... | delegate | 2026-11-22 |
| gap.roots-have-no-config-file | This page recorded the hole: the roots in force were the session working directory or `EYG_ALLOWED_ROOTS`, ... | delegate | 2026-11-22 |
| gap.runner-release-lacks-policy | The latest release the language repository serves is `gleam_cli-v0.1.0` (read from its release feed on 2026-11-19), and ... | delegate | 2026-11-22 |
| gap.windows-is-undocumented | `guides/install_prebuilt.md` offers `eyg-windows-x64.exe` as a release asset, and `README.md` mentions Windows nowhere. | delegate | 2026-11-22 |
| guides.index | `guides/` holds the prose an agent reads before writing EYG, in two sets. | delegate | 2026-11-22 |
| notes.format | `notes/` is where trade-offs go when they are not clear from the code: one file per subject, `name:`, `description:` ... | delegate | 2026-11-22 |
| overlay.agent-harness | Overlay is the EYG repository's own agent. | delegate | 2026-11-22 |
| overlay.policy-rules | A running EYG program is stopped at every effect before the host performs it, and a user-supplied function decides. | delegate | 2026-11-22 |
| pi.codemode-tool | This workspace **is** the package: `pi list` (2026-11-18) resolves the declaration `..` in `.pi/settings.json` to this ... | delegate | 2026-11-22 |
| pi.first-draft | `README.md` opens with a status line calling the package a first draft that has not been proved in extended use, and ... | delegate | 2026-11-22 |
| pi.policy-config | Two questions the operator asked, answered in the tree: which policy the package uses if you set nothing, and where to ... | delegate | 2026-11-22 |
| pi.reference-action | `action: "reference"` (`code: ""`) prints the language surface the session is writing against: `eyg reference: 29 ... | delegate | 2026-11-22 |
| pi.session-grants | A refused effect is an ask the model makes in chat and the operator answers with `/eyg-grant`, registered by ... | delegate | 2026-11-22 |
| pi.spawner-preset | `policies/spawner-effects.eyg` is the third preset this package ships: `agent-roots.eyg` with an allowlist check over ... | delegate | 2026-11-22 |
| pi.subagent-spawn | `eyg_subagent`, registered by `extensions/eyg-codemode.ts`, starts a second pi session in the same working directory ... | delegate | 2026-11-22 |
| usability.without-language-skill | One task, run in fresh one-shot sessions over two scratch projects whose `.pi/settings.json` differ only in whether the ... | delegate | 2026-11-22 |
| world-model.package | `pi-simple-world-model/` is a pi package carried in this workspace as a copy, declared per project in ... | delegate | 2026-11-22 |
| invariant.eyg-over-bash | EYG is the language this package runs its agent in, and it does not have an effect to run shell commands. | human | 2026-11-22 |
| invariant.notes-frontmatter | Every note carries `name:` front-matter. | human | 2026-11-22 |
| invariant.purpose-every-dir | Every top-level directory has a `PURPOSE` file, so the generated tier-0 map can name what each one is for. | human | 2026-11-22 |
| invariant.policy-self-contained | A policy module in this package imports nothing outside the package. | human | 2026-11-22 |
| ADR-000-world-model | ## Context Agents rediscover the layout, act on stale assumptions, and re-litigate settled decisions. | human | 2026-11-22 |
| ADR-001-world-model-import | ## Context The world model tool (`pi-simple-world-model`) is authored in `another of the operator's projects`. | delegate | 2026-11-22 |
| ADR-002-handler-seam | ## Context An operator wants tools an agent can trust, and EYG separates an effect's *description* from its ... | human | 2026-11-22 |
| ADR-003-doc-delegation | ## Context A new user of this package needs two different things: how to get an EYG CLI onto their machine, and what ... | human | 2026-11-22 |
| ADR-004-doc-shape-for-two-readers | ## Context Three readers, and each needs a different thing from this tree: 1. | human | 2026-11-22 |
| ADR-005-grants-spawn-and-child-surface | ## Context Three mechanisms went in during 2026-11-20, each answering a different question the code could not answer ... | delegate | 2026-11-22 |
| runbook.check-a-change | Costs are in `AGENTS.md`'s command table, dated where each was measured; they are not repeated here. | delegate | 2026-11-22 |
| runbook.next-milestone | Each row is a claim whose `verify` still passes, which means the hole is still open. | delegate | 2026-11-22 |

## Where to look for a claim

- entities: 24 · invariants: 4 · decisions: 6 · runbooks: 2 · traps: 45
- suspect right now: ADR-002-handler-seam, overlay.agent-harness
- re-check everything: `npm run world` · checks: `npm run world:lint` · regenerate this index: `npm run world:map`
<!-- END GENERATED -->
