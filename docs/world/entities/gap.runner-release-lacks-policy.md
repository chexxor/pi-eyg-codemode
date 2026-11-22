---
id: gap.runner-release-lacks-policy
type: entity
owner: delegate
status: suspect
verified_at: 2026-11-22
verify: "! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy' && ! $HOME/.local/bin/eyg run --policy $PWD/policies/deny-all.eyg -c '!int_add(1, 1)' 2>&1 | grep -q '^2$' && grep -q 'did not understand `run --policy <module.eyg>`' guides/how-to-point-the-tool-at-your-runner.md && test ! -e bin/agent/build-checked-runner.sh"
confidence: high
sources: [README.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/traps.md, docs/world/entities/cli.runner-official-install-only.md]
supersedes: null
superseded_by: null
---

# Gap: the release published today has no build that knows the flag

The latest release the language repository serves is `gleam_cli-v0.1.0` (read from its release feed on 2026-11-19), and that build's help has no `--policy` (`! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'`, run 2026-11-19). Re-run on 2026-11-21 against the installed binary: `eyg run --policy policies/deny-all.eyg -c '!int_add(1, 1)'` answers `error: no such file: <cwd>/run` instead of `2`, which is the binary reading the mode word as a file name because it has no such flag. So **a person who follows the one-line installer cannot use this package at all** - every call names the install instead of running a program.

## What to do about it

The fix belongs to the language, not to this package: publish a release whose CLI accepts `--policy`, then move `cli.prebuilt-binary` and this record with the new output and re-run the effect probes.

What this package does is state the hole and refuse to work around it. It builds
nothing and points at nothing private: `bin/` carries one script, `agent/audit.sh`; the tool starts
`eyg` on `PATH` or a binary named by `EYG_CODEMODE_RUNNER`, and no other binary
(`docs/world/entities/cli.runner-official-install-only.md` records the one line such a call ends
with, and the command that produced it). The question to take upstream is which ref carries
`run --policy <module.eyg>`, and when the next release includes it. A
person who followed the one-line installer cannot use this package at all, and the README says so
rather than offering a route around it.

## Not this

It is not a claim that this package is broken: a build that knows `--policy`, wherever the
user puts it, works once `EYG_CODEMODE_RUNNER` names it. It is not the trap that a one-shot
`eyg run -c` is not checked (`docs/world/traps.md`), which is about the CLI's own default.
