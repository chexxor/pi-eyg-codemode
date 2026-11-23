---
name: pi-codemode-runner-probe-and-roots
description: Why pi-eyg-codemode once probed its runner for --policy (that half is superseded), why the policy refuses when roots are unset, and why the context-budget package is project-local here
date: 2026-11-23
---
*(Carried from the language repository, 2026-11-16: the runner probe and its costs were measured there. The CLI on `PATH` here still has no `--policy`; the probe now finds no candidate at all - it reaches `PATH` and `EYG_CODEMODE_RUNNER` and nothing else (`docs/world/entities/cli.runner-official-install-only.md`, `notes/official-installed-runner-only.md`). It did succeed once, on 2026-11-20, through a development build since deleted: `docs/world/entities/cli.checked-runner-on-this-host.md`, superseded. The probe itself was removed on 2026-11-21: the tool starts the named binary and reads what it says back (`notes/runner-not-probed.md`). The last section is the language's and stands as written; the two sections above it describe this package, and what moved there is corrected in place below - the host is now `host/guard.eyg` (`docs/world/decisions/ADR-006-guard-in-package.md`), a policy module takes its values as `rules(ctx)` rather than reading the environment (`notes/pi-codemode-host-guard-contract.md`), and the only binary this package requires is an installed `eyg`.)*

Three trade-offs that the code states but does not argue.

**The runner is probed, not configured.** The check lives in the runner:
`packages/gleam_cli/src/eyg_cli.gleam` sends `run`/`script`/`eval` through
`policy_runner` only when `--policy` is present. The CLI installed on `PATH`
(`$HOME/.local/bin/eyg`) is the prebuilt release and has no such flag, so a tool that
assumed it would be a tool with no check, and the argv would be mis-parsed by that
release: it reads `run` as a program path (`error: no such file: <cwd>/run`).
Assuming either the path or the version is a guess about the host; probing `--help`
once per session costs 0.1-0.6 s wall and fails with a message that names the
remedy. `EYG_CODEMODE_RUNNER` overrides the probe for a host that wants to say no.

**The policy has no roots of its own.** A policy module is not allowed to decide where it
applies. The alternative - the policy picking the process's current directory - was rejected:
a policy module is host authored and may be reused outside a pi session, where its
own idea of "here" is not the session's, and a policy that silently widens itself is
a policy whose permission set cannot be quoted. The extension, which does know the
session's working directory, supplies it: `policies/agent-roots.eyg` exports `rules(ctx)` and
reads `ctx.roots`, and the tool fills it from the spawner, the project settings,
`EYG_ALLOWED_ROOTS` or the working directory, plus any session grant (`resolveRoots`). Empty means no
roots, so every path is refused.

**The context-budget package is declared project-local.** `pi install
npm:@woksin/pi-context-budget -l` writes the declaration into
`.pi/settings.json` and the npm tree into `.pi/npm/`, which is gitignored: it is an
install artefact of this machine, not source. Pi resolves packages and settings at
`session_start`, so installing the package does not change a session that is running -
on 2026-11-16 the session that started before the install committed 3 native
compactions and 0 by hook, and its handoff text is unrecoverable. Check the plane a
fresh process resolves with the `diagnose-context-budget.mjs` script of another of the
operator's pi packages
(1.2 s wall, offline).

**Two runtimes, two resolutions of `touch_grass`, and one search effect.** The `Search`
effect is not an invention: its interface is already published in `touch_grass` 0.4.4 on
Hex (`packages/loam/build/packages/touch_grass/src/touch_grass/file_system/search.gleam`
carries `label = "Search"`, `Input(path, pattern, limit)`, `lift`/`lower`, `matches`), while
the tracked local copy predates it. What was missing was the runtime walk, landed on
2026-11-16 in `packages/loam/src/loam/platform/computer.gleam` (`search_the_tree`,
`search_max_depth = 32`, `limit` spent while walking, an unreadable directory contributing
nothing) with tests in `packages/loam/test/computer_test.gleam`, and the local `touch_grass/`
copy synced byte identical to the published module. The asymmetry decides where such a
change is visible, and it is the trap that wasted an hour: `packages/loam/manifest.toml:56`
resolves `touch_grass` with `source = "hex"`, so a standalone `gleam build` in `loam` compiles
the published artifact and cannot see a new local module; `packages/gleam_cli/manifest.toml:107`
resolves it as `{ path = "../touch_grass" }`, so the build that produces `dist/eyg` - a binary
an operator may name with `EYG_CODEMODE_RUNNER` - does see the local tree. `gleam 1.19.2` has `compile-package` and
no `local-packages` subcommand, so the offline route is the CLI build; publishing a new
version or restating a dependency as a path is still the operator's decision, and is what
would make a standalone `loam` build agree. Gating reuses the existing `read_file` policy
field (`packages/gleam_cli/src/eyg/cli/overlay.gleam`), so all four policy shapes already
rule the effect and no policy field was added. The boundary both search routes share: names
under an allowed root are reported even for a file a read of that path would be refused for
(`.env.eyg` listed, its contents refused), so a listed path is not permission to read it;
hiding names needs its own `search` field wrapped like `hide_secrets` wraps `read_file`.
The tests for the walk live in `packages/loam/test/computer_test.gleam` (four of them, `search_walks_the_tree_and_globs_the_relative_path_test`, `search_spends_its_limit_while_walking_test`, `search_skips_what_it_cannot_read_and_never_writes_test`, `search_is_an_effect_the_interpreter_can_perform_test`) and not in `packages/touch_grass/test/`: the `touch_grass` interface module is upstream-owned and byte identical to the published 0.4.4, so a test added to the local copy would be invisible to every consumer of the published package and would drift silently.
Re-check in about 0.1 s wall, all offline: `grep -n 'source = "hex"' packages/loam/manifest.toml`,
`grep -n 'touch_grass' packages/gleam_cli/manifest.toml`, `grep -c Search
packages/loam/src/loam/platform/computer.gleam`, `diff -q packages/touch_grass/src/touch_grass/file_system/search.gleam
packages/loam/build/packages/touch_grass/src/touch_grass/file_system/search.gleam`,
`gleam --version`.
