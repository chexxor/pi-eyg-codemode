# Changelog

Every entry below 1.5.0 records what ran while this package lived inside
the language repository; the paths in them (`packages/...`, `eyg_packages/...`,
`bin/agent/gate.sh`, `pi --world-model-check` counts) are that repository's and are kept as
history, not as instructions for this tree. On 2026-11-19 the word "gate" was replaced with
"the checks", "checked" and "unchecked" throughout these entries; what ran is unchanged.

## 1.5.0 - 2026-11-18

- The package has its own workspace. `package.json` is now the manifest at
  this workspace's root, so `pi install . -l` (from the workspace root) declares
  the package as `..`, and no part of the package reaches into the language repository at run
  time.
- The presets are self-contained: `policies/agent-roots.eyg` and `policies/deny-all.eyg`
  carry their record inline instead of importing `eyg_packages/overlay/policy.eyg`. `eyg check`
  answers both with 18 rules, and the printed shapes are the shapes the imported presets produced
  (compared side by side on 2026-11-18). `notes/pi-codemode-preset-inlining.md` states the
  decision per effect and what is no longer covered: the language repository's
  `codemode_policy` security suite does not run here.
- The drift guard moved with the isolation: `test/render-helpers.test.mjs` compares
  `POLICY_FIELDS` against the `rule_mapping` recorded verbatim in
  `test/fixtures/rule_mapping.gleam`, and against the live runtime source when `EYG_RULE_SOURCE`
  names one. Provenance for the snapshot, with its checksums, is in
  `test/fixtures/rule_mapping.PROVENANCE.md`. `node --test test/render-helpers.test.mjs` passes
  here: pass 1, fail 0, 45 ms in process on 2026-11-18.
- The always-loaded context came with the package: `AGENTS.md` rewritten for this tree, the
  guides (`pi_codemode_agent`, `cli_effects_reference`, `syntax`, `builtins_reference`,
  `install_from_source`, `install_prebuilt`), the codemode notes, and a `docs/world/` tree
  checked by a `pi-simple-world-model` copy vendored into this workspace - the tool is copied
  per workspace, never declared across workspaces.
- Not done here, and named rather than claimed: end-to-end run behaviour. The CLI on `PATH`
  (`$HOME/.local/bin/eyg`, `eyg v0.1.0`) advertises no `--policy`, so no runner on this
  host can check effects, and UNVERIFIED is what the README says until one is built.

## 1.4.0 - 2026-11-16

- `action: "effects"` answers the capability question in one call instead of one probe
  program per effect: it spawns one probe per name in `POLICY_FIELDS` and prints
  `effect | policy field | decision`, where the decision comes from the runner that will run
  the real program, never from a copy of the preset in this package. `Env`, `Exit` and
  `StandardIn` say `unknown` with the reason they are not probed, and the header prints the
  policy, where it came from, the roots and the wall time.
- `POLICY_FIELDS` is now checked against the source of truth: a new test reads
  `rule_mapping` out of `packages/gleam_cli/src/eyg/cli/overlay.gleam` and compares it,
  in order, to the record the tool advertises, so an effect added to the runtime or a field
  renamed fails the test rather than leaving a stale list. `ruleMappingEffects` and
  `effectLine` are the pure helpers behind it in `lib/render-helpers.mjs`.
- The effect list moved out of prose and into the repository's effect reference: the table
  at the top of `guides/cli_effects_reference.md` names all 23 effects with their field and
  what the field allows, and gains a `Search` section (the skill pointed at one that did not exist).
  `docs/world/entities/codemode.effect-surface.md` claims the same thing with a verify
  command that greps the table and counts the `PolicyField` lines.

## 1.3.0 - 2026-11-16

- The tool renders like the built-in `bash` tool: `renderCall` and `renderResult` are
  registered on it, so the collapsed row names the effects the program performs plus the
  first 4 source lines, and `Ctrl+O` expands to the whole program and the whole output plus
  a policy/runner/roots provenance line. Wall time is in both the render and the model-facing
  status line (`ran in 0.81 s wall`, `timed out after 2 s in 2.01 s wall`), and a run that is
  still going answers `eyg running, 4.20 s so far`.
- The time knob is `timeout` in SECONDS (default 30, cap 120) as bash spells it. `timeout_ms`
  and `mode`, sent by sessions resumed from 1.2.0 and earlier, are mapped in `prepareArguments`
  rather than added to the schema the model sees; `EYG_CODEMODE_TIMEOUT` keeps its milliseconds,
  and the mismatch is stated in the README tables rather than silently renamed.
- A registry of re-usable EYG functions, read-only: one `.eyg` module per function-set with a
  `let metadata = {name, description, signature, effects}` record, scopes read in order
  workspace `<cwd>/.pi/eyg-functions` then home `$HOME/.pi/eyg-functions` then the package's
  own `libraries/`, first match wins and a shadow is reported. `action` selects `run` (default),
  `eval`, `list_functions` or `describe_function`; the same `libraries` parameter now resolves a
  registry name through that scope order, so `libraries: ["search"]` is unchanged. Declared
  effects are cross-checked against the `perform` names in the module, both directions are a
  registry error, and effect availability is re-probed at every query, is advisory, and does not
  block a run.
- `lib/render-helpers.mjs` holds the pure shapes (`callLines`, `resultLines`, `formatDuration`,
  `effectsUsed`, `findMetadata`, `checkDeclaredEffects`, `probeArguments`,
  `buildRegistry`, `prepareCallArguments`) and `test/render-helpers.test.mjs` asserts them -
  `node --test test/render-helpers.test.mjs`, 41 ms in process, pass 1 fail 0 on 2026-11-16.
  Plain JS, not TS: jiti does not transform a `.mjs`, so an annotation in it is a parse error
  at load.
- Tried and rejected: availability probes at `/dev/null` (the agent preset refuses every path
  probe, so a root-relative probe is what makes `ReadDirectory` read as `available` in a session
  that can read); `MAX_TIMEOUT_MS` left in the new constants, which the tool's own output caught
  as `MAX_TIMEOUT_MS is not defined`; testing `code === 0` before `killed` for a timed-out run,
  which pi reports with both.
- This package is still SKIP in `bin/agent/gate.sh`: it walks `packages/*/` and
  `eyg_packages/` and this package sits at the repository root as a pi package. The loops that
  did run are the `node --test` above, `pi --world-model-check` (lint clean, 36 claims, 0 failing)
  and fresh headless `pi -p --no-session --no-builtin-tools --tools eyg` runs, quoted verbatim in
  `README.md`.

## 1.2.0 - 2026-11-16

- The `Search` effect exists in the CLI runtime, so the tool and the skill ask for it
  before the library: `perform Search({path, pattern, limit})` answers absolute paths in
  one host action, and the policy decides the whole walk under its `read_file` rule
  (`packages/gleam_cli/src/eyg/cli/overlay.gleam`). The walk itself is a change outside
  this package - `packages/loam/src/loam/platform/computer.gleam` (`search_the_tree`,
  `search_max_depth = 32`) over the interface published in `touch_grass` 0.4.4 - made the
  same day, with tests in `packages/loam/test/computer_test.gleam`; `README.md` names the
  route, the checks run for it, and the boundary a search keeps: names under an allowed root
  come through, contents never do.
- `libraries/search.eyg` remains the route for a runtime that lacks the effect: one import,
  and the same roots rule decides every directory it opens.

## 1.1.0 - 2026-11-16

- Defaults, so a first session configures nothing: the policy is resolved inside the
  installed package (`packageDir`, `defaultPolicy` in `extensions/eyg-codemode.ts`) rather
  than requiring `EYG_POLICY`, and the roots default to the session working directory,
  passed to the preset as `EYG_ALLOWED_ROOTS` for one call and restored after it.
- The runner is probed, not assumed (`resolveRunner`): a runner is usable only if its help
  text advertises `--policy`, because the check lives in the runner and the prebuilt CLI
  release predates that flag. The old default, `eyg` on `PATH`, used to hand `run` to that
  release as a program path (`error: no such file: <cwd>/run`) and run the program unchecked.
- `libraries/search.eyg` and a `libraries` tool parameter: search is a library over
  `ReadDirectory`, bound as `search_lib`, and the effects it performs go through the policy
  like the program's own.
- `README.md` carries a worked transcript copied from runs on 2026-11-16, the defaults
  table (each row names the file its default comes from), and why permissioning at the
  effect level is the point.

## 1.0.0 - 2026-11-15

- First release: one tool, `eyg`, that runs EYG source through the CLI runner that checks effects
  (`packages/gleam_cli/src/eyg/cli/policy_runner.gleam`, `eyg run|eval|script --policy <module.eyg>`).
  Every effect of the program is decided by the host policy module before the host
  performs it, so this package has no shell, no file editor and no JavaScript sandbox.
- `policies/agent-roots.eyg` is a policy preset built from
  `eyg_packages/overlay/policy.eyg`: `agent(roots)` allows reading and writing inside
  `EYG_ALLOWED_ROOTS` and refuses everything else, including every `.env.eyg`.
- `skills/eyg-codemode/SKILL.md` carries the EYG forms the model needs (`perform` with
  one argument, `let _ =` binding, no infix operators) and what a refusal means.
- The tool refuses to run anything when no policy module is configured: a session
  cannot fall back to an unchecked run.
- `pi.exec` is used with argv, not a shell, so no quoting can smuggle a second command
  past the policy.
