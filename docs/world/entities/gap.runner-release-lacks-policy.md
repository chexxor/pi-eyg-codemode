---
id: gap.runner-release-lacks-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'"
confidence: high
sources: [README.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/traps.md, guides/install_prebuilt.md]
supersedes: null
superseded_by: null
---

# Gap: the release published today cannot answer for an effect

The latest release the language repository serves is `gleam_cli-v0.1.0` (read from its release feed on 2026-11-19), and that build's help has no `--policy` (`! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'`, run 2026-11-19). The tool refuses every call when no candidate accepts the flag, so **a person who follows the one-line installer cannot use this package at all** - every effect comes back refused before the program runs.

## What to do about it

The fix belongs to the language, not to this package: publish a release whose CLI accepts `--policy`, then move `cli.prebuilt-binary` and this record with the new output and re-run the effect probes. Until then this package cannot shorten the gap - it can only make the README state it where a new reader will hit it, which ADR-004 does. A development build of the language CLI, named by `<cwd>/.local/eyg-checked`, is what lets this workspace see checked calls at all (`cli.checked-runner-on-this-host`); it changes nothing for a person who followed the installer.

## Not this

It is not a claim that this package is broken: a build that accepts `--policy`, wherever the
user puts it, works once `EYG_CODEMODE_RUNNER` names it. It is not the trap that a one-shot
`eyg run -c` is not checked (`docs/world/traps.md`), which is about the CLI's own default.
