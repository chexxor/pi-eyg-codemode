---
id: cli.prebuilt-binary
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "test -f guides/install_prebuilt.md && test -f guides/install_from_source.md && ! ~/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'"
confidence: high
sources: [guides/install_prebuilt.md, guides/install_from_source.md, notes/pi_codemode_runner_probe.md, guides/pi_codemode_agent.md]
supersedes: null
superseded_by: null
---

# The CLI this workspace can reach is prebuilt, and prebuilt means it checks nothing

`command -v eyg` answers `~/.local/bin/eyg` and `eyg --version` answers
`eyg v0.1.0` (measured 2026-11-18). That build ships as one self-contained executable per
platform installed by `install.sh` into `$HOME/.local/bin/` - it is the release asset, not
a tree build - and its help has no `--policy` flag: `grep -c -- '--policy' <<<
"$(~/.local/bin/eyg --help 2>&1)"` printed `0`.

Consequences for this workspace, stated as facts:

- the CLI can **type-check** this package's modules (`eyg check policies/agent-roots.eyg`
  and friends, 0.43 s for both presets plus the library);
- the CLI **cannot check a run** from here, so the extension's runner probe refuses and the
  tool answers that no runner accepting `--policy` was found;
- every claim about what a preset allows *at run time* is therefore UNVERIFIED here. The
  runner that checks effects is built in the language repository (`packages/gleam_cli/dist/eyg` after
  `./bin/compile`) and is not vendored here.

## Not this

Not the install instructions for a user who wants the language: those are on the EYG
website (<https://eyg.run/guides/install-a-prebuilt-binary>,
<https://eyg.run/guides/install-from-source>) and the README points there rather than
repeating them; `guides/install_prebuilt.md` and `guides/install_from_source.md` are offline
copies of those pages, belonging to the language repository's build. Vendoring a runner here is
a decision with a trigger, recorded in `AGENTS.md` ("the runner that checks effects is not in this workspace").
