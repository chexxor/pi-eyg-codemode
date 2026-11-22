---
id: gap.runner-release-lacks-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy' && test ! -e bin/agent/build-checked-runner.sh && grep -q 'No official install can answer for an effect today' guides/how-to-get-a-checked-runner.md"
confidence: high
sources: [README.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/traps.md, guides/install_prebuilt.md, guides/how-to-get-a-checked-runner.md, docs/world/entities/cli.runner-official-install-only.md]
supersedes: null
superseded_by: null
---

# Gap: the release published today cannot answer for an effect

The latest release the language repository serves is `gleam_cli-v0.1.0` (read from its release feed on 2026-11-19), and that build's help has no `--policy` (`! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'`, run 2026-11-19). The tool refuses every call when no candidate accepts the flag, so **a person who follows the one-line installer cannot use this package at all** - every effect comes back refused before the program runs.

## What to do about it

The fix belongs to the language, not to this package: publish a release whose CLI accepts `--policy`, then move `cli.prebuilt-binary` and this record with the new output and re-run the effect probes.

What this package does is state the hole and refuse to work around it. Since 2026-11-21 it builds
nothing and points at nothing private: `bin/` carries one script, `agent/audit.sh`; the probe
reaches `eyg` on `PATH` or a runner named by `EYG_CODEMODE_RUNNER`, and no other binary
(`docs/world/entities/cli.runner-official-install-only.md`). `guides/how-to-get-a-checked-runner.md`
ends at "no official install can answer for an effect today" and names the question to take
upstream: which ref carries `run --policy <module.eyg>`, and when the next release includes it. A
person who followed the one-line installer cannot use this package at all, and the README says so
rather than offering a route around it.

## Not this

It is not a claim that this package is broken: a build that accepts `--policy`, wherever the
user puts it, works once `EYG_CODEMODE_RUNNER` names it. It is not the trap that a one-shot
`eyg run -c` is not checked (`docs/world/traps.md`), which is about the CLI's own default.
