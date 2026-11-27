---
id: pi.codemode-tool
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "test -f extensions/eyg-codemode.ts && grep -qF '[mode, entryPath]' extensions/eyg-codemode.ts && grep -q 'entryCheckArguments' extensions/eyg-codemode.ts && grep -q 'join(dir, \"policies\", \"agent-roots.eyg\")' extensions/eyg-codemode.ts && grep -q 'renderCall:' extensions/eyg-codemode.ts && grep -q 'prepareArguments' extensions/eyg-codemode.ts && grep -q 'DEFAULT_TIMEOUT_S' extensions/eyg-codemode.ts && grep -q 'list_functions' extensions/eyg-codemode.ts && grep -q '\"reference\", \"list_functions\"' extensions/eyg-codemode.ts && grep -q 'buildRegistry' extensions/eyg-codemode.ts && grep -qF 'rmSync(scratch' extensions/eyg-codemode.ts && test -f lib/render-helpers.mjs && grep -q 'export function callLines' lib/render-helpers.mjs && grep -q 'defaultTools' .pi/settings.json && grep -q '\"-builtin:codemode\"' .pi/settings.json && test -f libraries/search.eyg && test -f notes/pi_codemode_registry_probe.md && ! grep -q 'import \"' policies/agent-roots.eyg"
confidence: high
sources: [extensions/eyg-codemode.ts, policies/agent-roots.eyg, policies/deny-all.eyg, package.json, lib/render-helpers.mjs, README.md, .pi/settings.json, notes/pi_codemode_host_gate.md, notes/pi_codemode_registry_probe.md, notes/pi-codemode-policy-inlining.md, notes/pi-codemode-host-guard-contract.md, guides/tool-reference.md, host/guard.eyg]
supersedes: null
superseded_by: null
---

# The pi agent's coding tool is EYG, checked effect by effect

This workspace **is** the package: `pi list` (2026-11-18) resolves the declaration `..`
in `.pi/settings.json` to this workspace's root, whose one extension
registers one tool, `eyg`. With `"-builtin:codemode"` in `extensions` the built-in
JavaScript codemode is disabled, and `defaultTools` names only `read`, `edit`, `write`,
`bash`, `codemode`, `grep`, so the model's channel to the outside world is an EYG
program whose every effect is decided by the policy in force before the host performs it.

- `extensions/eyg-codemode.ts` writes two files into a scratch directory of its own - the
  program module and the entry that imports guard, policy and program and writes the refusal record
  as its last line - and
  spawns argv `[mode, entryPath]` with `pi.exec`, which has no shell, so no quoting can smuggle a
  second command past the checks; the directory is removed when the run ends, and with no policy
  configured the tool refuses to run anything.
- Before that run, the model's own call type-checks the entry it wrote: `entryCheckArguments` names
  the argv `[check, entryPath]`, run with 5 s of its own, and only the lines that start
  `error: type mismatch` are reported back - every well-shaped entry answers one other line, `missing
  row 'Abort'`, and a parse failure answers `missing reference`, both of which the run names cheaply
  itself. A mis-shaped ask otherwise prints nothing for the whole spawn cap: the CLI's error report
  inspects the interpreter state, and the guarded body's source text is in it
  (`notes/pi-codemode-misshaped-ask.md`). The probe programs and the keep-writing program skip it.
- The defaults come from inside the installed package, so a first session configures
  nothing: `packageDir()` resolves the package directory from `import.meta.url` (the
  module file the extension was loaded from), `defaultPolicy()` is
  `join(dir, "policies", "agent-roots.eyg")`, and the roots default to the session
  working directory, written into the `ctx` the entry hands the policy. The order the policy comes from is the table in `guides/how-to-write-a-policy.md`, and
  the tool says which slot it used; the call's `policy` argument sits outside that chain and is
  honoured only when it can narrow it (`pi.policy-config`).
- The binary is chosen by name, not by asking it what it can do: `EYG_CODEMODE_RUNNER`, else `eyg`
  on `PATH` - two places, and the rule is pinned by four assertions in the unit test
  (`cli.runner-official-install-only`). Nothing is asked of it but the mode word and a file this
  package wrote, so the prebuilt release on `PATH` runs every call: the checks are in
  `host/guard.eyg`, which the entry imports around the program
  (`host.guard-boundary`). A binary that is not there, or that reads the mode word as a file name
  because it has no such command, ends the call with one line naming the install and quoting the
  command that was run (`runnerFailureLine` in `lib/render-helpers.mjs`); both lines were captured
  live on 2026-11-22 with a stub and a missing path.
- The tool renders like the built-in `bash` tool: `renderCall` and `renderResult` are
  registered on it, and the shapes they paint live in `lib/render-helpers.mjs` as
  `{tone, text}` rows (`callLines`, `resultLines`) that the extension only colours.
  Collapsed: the `perform` names the program uses plus the first 4 source lines;
  expanded (`Ctrl+O`): the whole program, the whole output and a policy/runner/roots
  provenance line. Wall time is in the model-facing status line (`ran in 0.81 s wall`,
  `timed out after 2 s in 2.01 s wall`) and in the render, always labelled wall.
- The time knob is `timeout` in SECONDS (`DEFAULT_TIMEOUT_S` 30, `MAX_TIMEOUT_S` 120,
  `MIN_TIMEOUT_MS` 100 as the floor); `EYG_CODEMODE_TIMEOUT` stays milliseconds.
  `prepareArguments` is `prepareCallArguments` in the same module, which maps `timeout_ms`
  and `mode` from sessions resumed before this version, so the public schema carries no
  deprecated field. pi's `exec` answers a killed run with `code === 0` *and* `killed`,
  so the tool tests `killed` first.
- The tool keeps a read-only registry of re-usable EYG functions: one `.eyg` module per
  function-set with a `let metadata = {name, description, signature, effects}` record,
  read from three scopes in order - workspace `<cwd>/.pi/eyg-functions`, home
  `$HOME/.pi/eyg-functions`, package `<pkg>/libraries` - first match wins and a shadow is
  reported. `action` selects `run` (default), `eval`, `effects`, `reference`,
  `list_functions` or `describe_function`; the same `libraries` parameter resolves a name through that scope
  order, so `libraries: ["search"]` is unchanged. Declared effects are cross-checked
  against the `perform` names in the module in both directions. Effect availability is
  re-probed at every query with no-op-safe arguments and is advisory only - running a
  refused effect is not pre-blocked, so the listing and the runner give one answer to
  that question, not two (`notes/pi_codemode_registry_probe.md`).
- Search has two routes. `libraries/search.eyg` is search as a library, bound by the
  tool's `libraries` parameter as `<name>_lib`: it walks with `ReadDirectory`, so the
  policy decides every directory it opens and it cannot see outside the roots. The CLI
  runtime also has a `Search` effect (landed 2026-11-16 in the language repository), which the
  guard hosts under a policy field of its own (`search`), so one host action is decided once and a
  session allowed to read files is not thereby allowed to walk them. Both routes report
  names under an allowed root - including the name of a file a read of that path would
  be refused for - and never its contents.
- `policies/agent-roots.eyg` is the policy module: it imports nothing and returns one rule per
  policy field over the roots in the `ctx` the tool hands it, denying `.env.eyg`. `policies/deny-all.eyg` and
  `policies/spawner-effects.eyg` are the other shipped policies, the second one enforcing a child
  session's effect allowlist (`docs/world/entities/pi.spawner-policy.md`).
  The policies were inlined from the language repository's `overlay/policy.eyg` on
  2026-11-18 (`notes/pi-codemode-policy-inlining.md`).
- A refusal is reported, not swallowed: the reason the policy wrote reaches the model in the
  output, and the tool result carries `gated: true` with `refusals` - the field and the path - and
  the `/eyg-grant` that would have allowed it when the reason names a path
  (`docs/world/entities/pi.session-grants.md`).

## Not this

Not the permission mechanism - `overlay.policy-rules` and `host.guard-boundary` own that. Not the
EYG language reference - the language's prose is at <https://eyg.run/guides>, the surface this
package ships is `guides/eyg-surface.tsv`, and the language *skill* is a separate pi package,
declared in `.pi/settings.json` (`docs/world/entities/gap.language-skill-home-undecided.md`).
