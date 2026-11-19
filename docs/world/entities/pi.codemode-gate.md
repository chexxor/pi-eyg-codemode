---
id: pi.codemode-gate
type: entity
owner: delegate
status: current
verified_at: 2026-11-19
verify: "test -f extensions/eyg-codemode.ts && grep -q -- '\"--policy\"' extensions/eyg-codemode.ts && grep -q 'join(dir, \"policies\", \"agent-roots.eyg\")' extensions/eyg-codemode.ts && grep -q 'renderCall:' extensions/eyg-codemode.ts && grep -q 'prepareArguments' extensions/eyg-codemode.ts && grep -q 'DEFAULT_TIMEOUT_S' extensions/eyg-codemode.ts && grep -q 'list_functions' extensions/eyg-codemode.ts && grep -q 'buildRegistry' extensions/eyg-codemode.ts && test -f lib/render-helpers.mjs && grep -q 'export function callLines' lib/render-helpers.mjs && grep -q 'defaultTools' .pi/settings.json && grep -q '\"-builtin:codemode\"' .pi/settings.json && test -f libraries/search.eyg && test -f notes/pi_codemode_registry_probe.md && ! grep -q 'import \"' policies/agent-roots.eyg"
confidence: high
sources: [extensions/eyg-codemode.ts, policies/agent-roots.eyg, policies/deny-all.eyg, package.json, lib/render-helpers.mjs, README.md, .pi/settings.json, guides/pi_codemode_agent.md, notes/pi_codemode_host_gate.md, notes/pi_codemode_registry_probe.md, notes/pi-codemode-preset-inlining.md]
supersedes: null
superseded_by: null
---

# The pi agent's coding tool is EYG behind the CLI gate

This workspace **is** the package: `pi list` (2026-11-18) resolves the declaration `..`
in `.pi/settings.json` to `/home/chexxor/Git/pi-eyg-codemode`, whose one extension
registers one tool, `eyg`. With `"-builtin:codemode"` in `extensions` the built-in
JavaScript codemode is disabled, and `defaultTools` names only `read`, `edit`, `write`,
`bash`, `codemode`, `grep`, so the model's channel to the outside world is an EYG
program whose every effect is decided by the gate before the host performs it.

- `extensions/eyg-codemode.ts` builds argv `[mode, "--policy", policy, "-c", code]`
  and spawns it with `pi.exec`, which has no shell, so no quoting can smuggle a second
  command past the gate; with no policy configured the tool refuses to run anything.
- The defaults come from inside the installed package, so a first session configures
  nothing: `packageDir()` resolves the package directory from `import.meta.url` (the
  module file the extension was loaded from), `defaultPolicy()` is
  `join(dir, "policies", "agent-roots.eyg")`, and the roots default to the session
  working directory, exported as `EYG_ALLOWED_ROOTS` for the one call and restored
  after it. Resolution order is `policy` argument, `EYG_POLICY`, package default, and
  the tool says which one it used.
- The runner is probed, not assumed: a candidate is usable only if its `--help`
  advertises `--policy`, because the gate lives in the runner and the prebuilt release
  on `PATH` predates that flag. **On this host the probe fails**: `~/.local/bin/eyg`
  (v0.1.0) has no `--policy` in its help, so the tool refuses, and every statement about
  what a preset allows at run time is UNVERIFIED from this workspace. `EYG_CODEMODE_RUNNER`
  overrides the probe. Using a runner without the flag is both ungated and a mis-parsed
  argv - it reads `run` as a program path.
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
  reported. `action` selects `run` (default), `eval`, `list_functions` or
  `describe_function`; the same `libraries` parameter resolves a name through that scope
  order, so `libraries: ["search"]` is unchanged. Declared effects are cross-checked
  against the `perform` names in the module in both directions. Effect availability is
  re-probed at every query with no-op-safe arguments and is advisory only - running a
  refused effect is not pre-blocked, so the listing and the runner give one answer to
  that question, not two (`notes/pi_codemode_registry_probe.md`).
- Search has two routes. `libraries/search.eyg` is search as a library, bound by the
  tool's `libraries` parameter as `<name>_lib`: it walks with `ReadDirectory`, so the
  policy gates every directory it opens and it cannot see outside the roots. The CLI
  runtime also has a `Search` effect (landed 2026-11-16 in the language workspace),
  mapped to the existing `read_file` policy field, so one host action is decided once
  by the same roots that gate reads and no new policy field exists. Both routes report
  names under an allowed root - including the name of a file a read of that path would
  be refused for - and never its contents.
- `policies/agent-roots.eyg` is the policy module: it imports nothing and answers the
  roots named in `EYG_ALLOWED_ROOTS` with the preset written out inline, one rule per
  gated effect, denying `.env.eyg`. `policies/deny-all.eyg` is the other shipped preset.
  The presets were inlined from the language workspace's `overlay/policy.eyg` on
  2026-11-18 (`notes/pi-codemode-preset-inlining.md`).
- A refusal is reported, not swallowed: the runner exits 1 with the reason on stderr,
  and the tool result carries `gated: true, ran: true, exit: 1` plus the reason.

## Not this

Not the gate mechanism - `overlay.policy-gate` owns that, and the runner side is in the
language workspace. Not the EYG language reference - `guides/pi_codemode_agent.md` is
how to run such a session, `guides/syntax.md` is the language, and the language *skill*
is the separate `pi-eyg-expressions` package.
