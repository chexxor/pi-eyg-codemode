# Changelog

Every entry below 1.5.0 records what ran while this package lived inside
the language repository; the paths in them (`packages/...`, `eyg_packages/...`,
`bin/agent/gate.sh`, `pi --world-model-check` counts) are that repository's and are kept as
history, not as instructions for this tree. On 2026-11-19 the word "gate" was replaced with
"the checks", "checked" and "unchecked" throughout these entries; what ran is unchanged.

## Unreleased

- **The grant ask is read off what the run printed.** `refusalHints` scans the run's output for
  `<field> denied by policy: <path>`, so a program that catches the refusal value and prints words of
  its own reports no refusal: measured in a fresh one-shot session (`pi --print --mode json --tools
  eyg`), a `WriteFile` at a path outside the roots came back `refusals: []` and `grantId: null` even
  though the guard refused it - no clause needed. That session also ran the imported-module route
  through the registered tool and not only through `bin/agent/refusal-probe.mjs`: the importing call
  answered a fabricated success, `exit=0`, no refusal, nothing on disk. `pi.session-grants` carries
  the limit, `gap.one-host-check-not-transitive` the through-the-tool row, and `docs/world/traps.md`
  the front-matter escape that failed a claim.

- **A limit of the one-host rule, named and measured.** The parse that refuses a program handling
  its own effects covers the text the tool assembles - the prelude of `import` lines and the program -
  and not the body of a module that text imports. A clause inside an imported module installs inside
  the guarded body unnamed: `test/fixtures/imported-handler.eyg` and its module answer the program
  with a successful write the host never performed, print no refusal, and leave nothing on disk, while
  the same path with no clause is refused as every other call is. Reach is unchanged (boundary fact 5)
  - what breaks is the honesty of the answer and of the ask, and plain code can already do it. Closing
  it needs a parse that resolves imports; the effect row cannot answer the question. Recorded as
  `docs/world/entities/gap.one-host-check-not-transitive.md`, with a row in `runbook.next-milestone`.

- **The notes caught up with the guard.** The notes still described the host this package replaced
  on 2026-11-22 - a spawn that named `--policy`, a capability probe, "a fresh clone of this package
  refuses every call", "nothing runs on a machine holding only the release" - and every gate stayed
  green, because the only automated check over `notes/` is the front-matter invariant. Each was
  rewritten against what a call does now, the `handle` question the oldest of them left UNVERIFIED was
  closed by boundary facts 1, 5 and 7 of `host.guard-boundary`, and `docs/world/traps.md` carries the
  grep that finds such a sentence next time.

- **A call cannot change the files that decide it.** A session run inside this package has
  `host/guard.eyg` and `policies/*.eyg` inside its own roots, and the per-call entry imports both by
  absolute path, so a program could rewrite the rules of its next call; building the tool's three
  files by hand performed a new policy module, a rewrite of `policies/deny-all.eyg` and a rewrite of
  the guard. The guard now refuses `write_file`, `append_file`, `delete_file` and `make_directory` for
  any path under `ctx.protected` before the policy rule is consulted (`shield` in `host/guard.eyg`),
  and the tool writes that list as the package's `host/` and `policies/` plus the resolved policy
  module wherever it lives (`hostProtectedPaths` in `lib/render-helpers.mjs`, `contextLiteral` now
  emitting `protected`). The refusal says `denied by the host`, so a program knows a grant will not
  open the path; reads stay open. `test/fixtures/self-write-probe.eyg` re-runs the attempt, boundary
  fact 6 of `docs/world/entities/host.guard-boundary.md` carries the command, and
  `notes/guard-self-protection.md` why the check sits in the guard.

- **One host per call.** A program that installs its own `handle` clause is refused before anything
  runs: the tool asks the binary to parse the program (`parseArguments` in `lib/render-helpers.mjs`),
  walks the tree for handler nodes (`handledEffectLabels`) and answers with the labels it found and
  the change to make (`handledEffectRefusal`); a parse that fails or answers non-JSON stops the call
  too, so a program whose effects were never listed is not run. A clause could never widen what the
  policy allows - the guard sits outside it - but it answers the program instead of asking the host,
  and that is what the rule protects. `bin/agent/handler-scan.mjs <file.eyg>` runs the same two steps
  from a shell, `bin/agent/audit.sh` keeps a row that proves the refused fixture is still named,
  boundary fact 7 carries the commands, `notes/one-host-per-call.md` the trade-offs, and the tool's
  own description states the expectation.

- **One more kind of page.** `guides/what-a-call-does.md` is the explanation of one call: the argument
  check, the four resolutions, the prelude, the parse, the three files in the scratch directory, the
  guard's decision, the printed rows, and the shell command that shows each step - including the one
  that shows why the entry matters, a program run on its own performing a write with nothing deciding
  it. `guides/PURPOSE`, the README link list and `guides.index` name it.

- **The per-effect checks moved into this package.** The tool no longer asks the CLI to load a
  policy module: `host/guard.eyg` is an EYG program that installs one `handle` clause per effect row
  of `guides/eyg-surface.tsv`, applies the resolved policy around the model's code, and is imported
  by the entry the tool writes for every call, so the argv is `<binary> <mode> <entry.eyg>` and
  nothing is asked of the binary but the mode word and a file. Consequences: `runnerCandidates` is
  two names with no capability probe, a missing or unsuitable binary is one refusal line naming the
  command that was run, `Search` gained a policy field of its own (`search`) because the guard is the
  host of that walk, and a policy rule answers `Pass(value)` or `Mock(reason)` with the guard shaping
  the answer to the effect's own reply type. `test/fixtures/rule_mapping.gleam` now decides the
  effect labels and the unchecked set only; the field names are this package's and
  `test/host-coverage.test.mjs` proves them against the guard. The records that described the flag
  moved with it: two gap records closed as superseded, `ADR-002-handler-seam` superseded by
  `ADR-006-guard-in-package`, and `host.guard-boundary` carries the five boundary facts the guard
  rests on, each re-runnable through `node bin/agent/refusal-probe.mjs`.

- **The doc rules became checks.** `bin/agent/doc-checks.mjs` answers five questions over this
  package's own prose and code - one word per concept, a `path:NNN` citation whose file is in this
  tree and whose line holds the names it anchors, a section heading whose subject is named in its
  first line, no upstream page copied into `guides/`, no dated stamp in the prose a session acts on
  - and each answer is one row of `bin/agent/audit.sh`, one claim whose `verify` is that command,
  and one planted violation in `test/doc-checks.test.mjs`. The dated stamps the scrub removed from
  the guides moved into the records that carry the dates. `notes/wording-the-checks-not-the-gate.md`
  says why the file is named for the check and not for anything else.
- **Review fixes.** `test/render-helpers.test.mjs` became 22 named tests, so one failure names the
  group it came from instead of stopping the file at its first assert. The policy resolution order
  is stated once, in the table "Which policy a call gets" in `guides/how-to-write-a-policy.md`, and
  the entity pages and `AGENTS.md` point at that table instead of listing the slots again.
  `.pi/settings.json` stopped naming `codemode` in `defaultTools` while disabling the built-in of
  the same name. The audit gained a `shipped EYG modules check` row: `eyg check` over every module
  in `policies/` and `libraries/`, which the CLI on `PATH` answers offline. Claim verifies that could
  pass because a binary was absent, or because `&&` outranks `||`, were rewritten to lead with
  `test -x` and keep their conditional last (`docs/world/traps.md`).

- **One generated surface, not six page copies.** The offline copies of the language's pages
  (`syntax.md`, `builtins_reference.md`, `cli_effects_reference.md`, `install_prebuilt.md`,
  `install_from_source.md`, `pi_codemode_agent.md`) are deleted, and every pointer to them moved in
  the same commit. What a session with no network needs is the surface rather than the prose, so it
  is one generated file: `guides/eyg-surface.tsv`, a builtin row per name with its section and
  signature, an effect row per name with the policy field that decides it (`none` for the four no
  policy can forbid). Its header carries where its builtin rows were captured and when; its effect
  rows come from the recorded `rule_mapping`. `node bin/agent/gen-surface.mjs --check` (0.04 s)
  re-derives the file and compares it with the fixture, with `POLICY_FIELDS`, with every `!builtin`
  this tree's own `.eyg` sources call, and byte for byte with its own rebuild - and the unit suite
  plants a renamed effect row, a deleted effect row and a renamed builtin this tree calls, and
  asserts the check answers each. `action: "reference"` and the invented-builtin hint rows read the
  file (`docs/world/entities/guides.surface-file.md`, `test/fixtures/surface.PROVENANCE.md`, and the
  amendment at the end of ADR-003's Decision).
- **No probe, one line.** The tool stopped asking the binary what it can do before running it. The
  binary is chosen by name (`EYG_CODEMODE_RUNNER`, else `eyg` on `PATH`), every command line carries
  `--policy <module.eyg>`, and a binary too old for the flag — which reads the mode word as a file
  name rather than rejecting the option — is answered with one line naming the install
  (`runnerFailureLine` in `lib/render-helpers.mjs`), as is a binary that is not there at all.
  `guides/how-to-get-a-checked-runner.md` is deleted, `guides/how-to-point-the-tool-at-your-runner.md`
  is the one page, and `guides/first-session.md` quotes the line. `runnerFailureLine` and the two
  candidate rules are pinned by unit assertions (`docs/world/entities/cli.runner-official-install-only.md`,
  `notes/runner-not-probed.md`).
- **The `policy` argument can no longer widen a call.** It is honoured only when it names the policy
  the other slots already chose, or the narrowest policy this package ships (`deny-all.eyg`);
  anything else comes back `refusedArgument` and the refusal names the name it refused. A spawner
  naming a child's policy is held to the same rule
  (`docs/world/entities/pi.policy-config.md`).
- **One word for one thing.** The older name for a policy is gone from the extension, `lib/`, the
  shipped policy comments, the guides, the notes, the
  claims and this file (`shippedPolicyPath`, `argumentPolicyPath`, `SPAWNER_POLICY_NEVER`, claim
  `pi.spawner-policy`, `guides/how-to-write-a-policy.md`); the README words table defines the term
  once and `guides/how-to-write-a-policy.md` is the one page with the
  customize recipe; the ask that recipe cannot cover - extending the policy record the host loaded -
  is `docs/world/entities/gap.policy-record-extension.md` and
  `notes/pi-eyg-codemode-policy-record-extension.md`.

- **The runner probe reaches only what you can install.** `runnerCandidates` answers
  `EYG_CODEMODE_RUNNER` when it is set and otherwise the single candidate `eyg`: the two
  working-directory candidates (`<cwd>/packages/gleam_cli/dist/eyg` and `<cwd>/.local/eyg-checked`)
  are gone, and so is `bin/agent/build-checked-runner.sh`. This package supports the officially
  installed CLI and a runner the operator names, and builds nothing
  (`docs/world/entities/cli.runner-official-install-only.md`,
  `notes/official-installed-runner-only.md`). The consequence is carried where the numbers live:
  every effect-level row in `docs/world/` keeps its 2026-11-20 date and names the development build
  it came from, and the verifies that invoked that binary run only when `EYG_CODEMODE_RUNNER` names
  a runner. `cli.checked-runner-on-this-host` is superseded by the new record.

- **The reference is inside the tool.** `action: "reference"` (`code: ""`) answers the builtin set with
  its signatures and the effect surface with the policy field that decides each effect, performing
  nothing and asking the policy nothing, so it answers where no runner was found as well as where one
  was. A run that named a builtin the runtime does not have now carries rows naming
  the reference guides then shipped and `action: "reference"`, and says pi's own `read`
  tool is not policy-gated while `ReadFile` reaches only the roots. Measured 2026-11-20 in one fresh
  one-shot session: 20 tool calls and 0 `builtin undefined`, against the 41-93 calls and 16-57 such
  errors of the rounds that guessed (`docs/world/entities/pi.reference-action.md`,
  `docs/world/entities/usability.without-language-skill.md`).
- **A grant is an ask, with a duration.** `/eyg-grant` lets the operator widen the session they are in -
  one tool call, N calls, or the rest of the session - and the tool reads that record back off the
  session branch (`docs/world/entities/pi.session-grants.md`). A program cannot reach it and a call
  cannot widen itself.
- **A spawner names the child's surface.** `eyg_subagent` takes `tools` (`eyg`, or `eyg` plus pi's `read`
  tool, never a tool the parent session lacks), `effects` (an allowlist enforced by the third shipped
  policy, `policies/spawner-effects.eyg`: `agent-roots.eyg` written out whole with an allowlist check
  per field, reading `EYG_SUBAGENT_EFFECTS`, unset refusing every gateable effect, never able to grant
  `fetch`, `standard_in` or `create_key`) and `max_calls` (carried as `EYG_SUBAGENT_MAX_CALLS` and
  enforced in the child's own `eyg` tool, counted off the session records). Roots still have to sit
  inside the spawner's, a child gets no children, and a grant is not inherited. Proven live 2026-11-20
  in two parent sessions: one with the roots narrowed to a slice, where the allowlist refusal and the
  roots refusal both came back in the parent's report and the child's `read` tool read the file outside
  the slice; one where a budget of 2 stopped the third call (`docs/world/entities/pi.subagent-spawn.md`,
  `docs/world/entities/pi.spawner-policy.md`, `notes/spawner-effect-allowlist.md`).
- **(Removed later in the same release.)** *One page from a fresh clone to a build that runs checks,
  and the build it pointed at.* `guides/how-to-get-a-checked-runner.md` named the candidates the tool
  probed, and `bin/agent/build-checked-runner.sh` was a script a person ran. Both are gone: the probe
  went with them, and the install pages point at the website
  (`docs/world/entities/gap.runner-release-lacks-policy.md`).
- **The checks ran in one command.** `bin/agent/audit.sh` was added to run the unit test and drift
  guard, the world lint, the claim verifies, the map check, `pi --world-model-check` and the
  tracked-path-and-name sweep, printing what each cost and whether a record moved: 5.70 s wall, 6/6,
  2026-11-20. The rows it runs now are the list `AGENTS.md` prices.
- Vocabulary: the tree says **the checks**, **checked** and **unchecked**; a new claim, four trap
  entries and the `AGENTS.md` "no check script" line moved with the script's arrival.

## 1.5.0 - 2026-11-18

- The package has its own workspace. `package.json` is now the manifest at
  this workspace's root, so `pi install . -l` (from the workspace root) declares
  the package as `..`, and no part of the package reaches into the language repository at run
  time.
- The policies are self-contained: `policies/agent-roots.eyg` and `policies/deny-all.eyg`
  carry their record inline instead of importing `eyg_packages/overlay/policy.eyg`. `eyg check`
  answers both with 18 rules, and the printed shapes are the shapes the imported policies produced
  (compared side by side on 2026-11-18). `notes/pi-codemode-policy-inlining.md` states the
  decision per effect and what is no longer covered: the language repository's
  `codemode_policy` security suite does not run here.
- The drift guard moved with the isolation: `test/render-helpers.test.mjs` compares
  `POLICY_FIELDS` against the `rule_mapping` recorded verbatim in
  `test/fixtures/rule_mapping.gleam`, and against the live runtime source when `EYG_RULE_SOURCE`
  names one. Provenance for the snapshot, with its checksums, is in
  `test/fixtures/rule_mapping.PROVENANCE.md`. `node --test test/render-helpers.test.mjs` passes
  here: pass 1, fail 0, 45 ms in process on 2026-11-18.
- The always-loaded context came with the package: `AGENTS.md` rewritten for this tree, the
  guides (six copies of the language's pages, since deleted; the surface they carried is now
  `guides/eyg-surface.tsv`), the codemode notes, and a `docs/world/` tree
  checked by a `pi-simple-world-model` copy vendored into this workspace - the tool is copied
  per workspace, never declared across workspaces.
- Not done here, and named rather than claimed: end-to-end run behaviour. The CLI on `PATH`
  (`$HOME/.local/bin/eyg`, `eyg v0.1.0`) advertises no `--policy`, so no runner on this
  host can check effects, and UNVERIFIED is what the README says until one is built.

## 1.4.0 - 2026-11-16

- `action: "effects"` answers the capability question in one call instead of one probe
  program per effect: it spawns one probe per name in `POLICY_FIELDS` and prints
  `effect | policy field | decision`, where the decision comes from the runner that will run
  the real program, never from a copy of the policy in this package. `Env`, `Exit` and
  `StandardIn` say `unknown` with the reason they are not probed, and the header prints the
  policy, where it came from, the roots and the wall time.
- `POLICY_FIELDS` is now checked against the source of truth: a new test reads
  `rule_mapping` out of `packages/gleam_cli/src/eyg/cli/overlay.gleam` and compares it,
  in order, to the record the tool advertises, so an effect added to the runtime or a field
  renamed fails the test rather than leaving a stale list. `ruleMappingEffects` and
  `effectLine` are the pure helpers behind it in `lib/render-helpers.mjs`.
- The effect list moved out of prose and into a reference table: the table then at the top of
  `guides/cli_effects_reference.md` (since deleted) named all 23 effects with their field and
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
- Tried and rejected: availability probes at `/dev/null` (the agent policy refuses every path
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
  passed to the policy as `EYG_ALLOWED_ROOTS` for one call and restored after it.
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
- `policies/agent-roots.eyg` is a policy policy built from
  `eyg_packages/overlay/policy.eyg`: `agent(roots)` allows reading and writing inside
  `EYG_ALLOWED_ROOTS` and refuses everything else, including every `.env.eyg`.
- `skills/eyg-codemode/SKILL.md` carries the EYG forms the model needs (`perform` with
  one argument, `let _ =` binding, no infix operators) and what a refusal means.
- The tool refuses to run anything when no policy module is configured: a session
  cannot fall back to an unchecked run.
- `pi.exec` is used with argv, not a shell, so no quoting can smuggle a second command
  past the policy.
