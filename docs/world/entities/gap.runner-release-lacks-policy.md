---
id: gap.runner-release-lacks-policy
type: entity
owner: delegate
status: superseded
verified_at: 2026-11-27
verify: "grep -qF '[mode, entryPath]' extensions/eyg-codemode.ts && grep -q 'return \\[\"eyg\"\\]' lib/render-helpers.mjs && test -x $HOME/.local/bin/eyg && $HOME/.local/bin/eyg --version | grep -q 'v0.1.0' && ! $HOME/.local/bin/eyg --help 2>&1 | grep -qi policy && test ! -e bin/agent/build-checked-runner.sh"
confidence: high
sources: [README.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/traps.md, docs/world/entities/cli.runner-official-install-only.md, docs/world/decisions/ADR-006-guard-in-package.md]
supersedes: null
superseded_by: cli.runner-official-install-only
---

# Gap closed: the release published today is enough for this package

This page recorded the hole: the latest release the language repository serves is
`gleam_cli-v0.1.0` (read from its release feed on 2026-11-19), that build's help named no policy
module (`! $HOME/.local/bin/eyg --help 2>&1 | grep -qi policy`, re-run 2026-11-22), and a call this
package used to start - a one-shot run asked to load a policy module - ended
`error: no such file: <cwd>/run`, the binary reading the mode word as a file name. So a person who
followed the one-line installer could not use this package at all: every call named the install
instead of running a program.

It closed on 2026-11-22, and not because the release changed: the per-effect checks moved into
`host/guard.eyg`, which this package ships, so the tool asks the installed CLI for `run <entry>` and
nothing else (`docs/world/decisions/ADR-006-guard-in-package.md`,
`docs/world/entities/cli.runner-official-install-only.md`). The command above checks the opposite of
what it used to: it passes because the argv this package builds carries no such request, because the
binary on `PATH` is the one the tool starts, and because that binary still knows nothing about policy
modules - which is now information about the language, not an obstacle here.

What the language still owes, and this package no longer waits on, is in
`docs/world/entities/gap.policy-runner-not-on-main.md`. What this tree never did about the old hole
is worth keeping: it built nothing and pointed at nothing private - `bin/` carried one script,
`agent/audit.sh`, and the deleted build script is still absent (`test ! -e
bin/agent/build-checked-runner.sh`).

## Not this

It is not a claim that the release is broken: it produces a CLI that runs programs, and this package
now uses it as-is. It is not the trap that a one-shot `eyg run` started by a person is not checked
(`docs/world/traps.md`), which is about the CLI's own default. The installed-binary facts today - which
places the tool tries, and what a call ends with when the binary is missing - are
`docs/world/entities/cli.runner-official-install-only.md`.
