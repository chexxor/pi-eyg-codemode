# Project world model - tier 0

Read this first. It tells you where to look; the pages it points at carry the claims and
the command that re-checks each one. Task state and session narrative do not belong here.

This workspace is one pi package: `pi-eyg-codemode`, the EYG coding tool for a pi agent
whose every effect is decided by a host policy module before the host performs it. The
language itself, its Gleam toolchain and its hub live in `/home/chexxor/Git/eyg-lang`;
nothing here reads that repository at run time, and this tree never writes to it.

<!-- BEGIN GENERATED: do not edit -->
## Layout - what is in this repository

| directory | purpose |
| --- | --- |
| docs/ | The world model records for this workspace: docs/world/00-map.md (tier-0 index), the entity, decision and runbook pages, invariants.md, traps.md and roster.yaml. The lint, map and verify CLIs that check them live in pi-simple-world-model/. |
| extensions/ | The one pi extension: it registers the `eyg` tool, resolves the policy, the roots and the runner from inside the package, and spawns the runner that checks every effect through argv. |
| guides/ | Prose guides read before writing EYG: surface syntax, builtins, the CLI effect reference, and running a policy-checked codemode session. |
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
| cli.prebuilt-binary | `command -v eyg` answers `/home/chexxor/.local/bin/eyg` and `eyg --version` answers `eyg v0.1.0` (measured 2026-11-18). | delegate | 2026-11-19 |
| codemode.effect-surface | A running program reaches the host only through effects, and the set it may perform is an intersection of three files. | delegate | 2026-11-19 |
| gap.install-guides-name-no-policy | Neither install route - the website's pages and this tree's mirrors, `guides/install_prebuilt.md` and ... | delegate | 2026-11-19 |
| gap.roots-have-no-config-file | The roots in force are the session working directory, or `EYG_ALLOWED_ROOTS` read from the environment by the shipped ... | delegate | 2026-11-19 |
| gap.runner-release-lacks-policy | The latest release the language repository serves is `gleam_cli-v0.1.0` ... | delegate | 2026-11-19 |
| gap.windows-is-undocumented | `guides/install_prebuilt.md` offers `eyg-windows-x64.exe` as a release asset, and `README.md` mentions Windows nowhere. | delegate | 2026-11-19 |
| guides.index | `guides/` holds the prose an agent reads before writing EYG: `syntax.md` is the surface syntax, `builtins_reference.md` ... | delegate | 2026-11-19 |
| notes.format | `notes/` is where trade-offs go when they are not clear from the code: one file per subject, `name:`, `description:` ... | delegate | 2026-11-19 |
| overlay.policy-rules | A running EYG program is stopped at every effect before the host performs it, and a user-supplied function decides. | delegate | 2026-11-19 |
| pi.codemode-tool | This workspace **is** the package: `pi list` (2026-11-18) resolves the declaration `..` in `.pi/settings.json` to ... | delegate | 2026-11-19 |
| world-model.package | `pi-simple-world-model/` is a pi package carried in this workspace as a copy, declared per project in ... | delegate | 2026-11-19 |
| invariant.eyg-over-bash | EYG is the language this package runs its agent in, and it does not have an effect to run shell commands. | human | 2026-11-19 |
| invariant.notes-frontmatter | Every note carries `name:` front-matter. | human | 2026-11-19 |
| invariant.purpose-every-dir | Every top-level directory has a `PURPOSE` file, so the generated tier-0 map can name what each one is for. | human | 2026-11-19 |
| invariant.policy-self-contained | A policy module in this package imports nothing outside the package. | human | 2026-11-19 |
| ADR-000-world-model | ## Context Agents rediscover the layout, act on stale assumptions, and re-litigate settled decisions. | human | 2026-11-19 |
| ADR-001-world-model-import | ## Context The world model tool (`pi-simple-world-model`) is authored in `~/Git/social-event-publisher`. | delegate | 2026-11-19 |
| ADR-002-handler-seam | ## Context An operator wants tools an agent can trust, and EYG separates an effect's *description* from its ... | human | 2026-11-19 |
| ADR-003-doc-delegation | ## Context A new user of this package needs two different things: how to get an EYG CLI onto their machine, and what ... | human | 2026-11-19 |
| ADR-004-doc-shape-for-two-readers | ## Context Three readers, and each needs a different thing from this tree: 1. | human | 2026-11-19 |
| runbook.check-a-change | 1. | delegate | 2026-11-19 |
| runbook.next-milestone | Each row is a claim whose `verify` still passes, which means the hole is still open. | delegate | 2026-11-19 |

## Where to look for a claim

- entities: 11 · invariants: 4 · decisions: 5 · runbooks: 2 · traps: 24
- suspect right now: none
- re-check everything: `npm run world` · checks: `npm run world:lint` · regenerate this index: `npm run world:map`
<!-- END GENERATED -->
