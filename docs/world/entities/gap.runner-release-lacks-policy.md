---
id: gap.runner-release-lacks-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy' && test -x bin/agent/build-checked-runner.sh && grep -q -- '--policy' guides/how-to-get-a-checked-runner.md"
confidence: high
sources: [README.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/traps.md, guides/install_prebuilt.md, guides/how-to-get-a-checked-runner.md, bin/agent/build-checked-runner.sh, notes/checked-runner-build-script.md]
supersedes: null
superseded_by: null
---

# Gap: the release published today cannot answer for an effect

The latest release the language repository serves is `gleam_cli-v0.1.0` (read from its release feed on 2026-11-19), and that build's help has no `--policy` (`! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'`, run 2026-11-19). The tool refuses every call when no candidate accepts the flag, so **a person who follows the one-line installer cannot use this package at all** - every effect comes back refused before the program runs.

## What to do about it

The fix belongs to the language, not to this package: publish a release whose CLI accepts `--policy`, then move `cli.prebuilt-binary` and this record with the new output and re-run the effect probes.

What this package can do is shorten the wait, and since 2026-11-20 it does: `guides/how-to-get-a-checked-runner.md` is the one page from a fresh clone to a checked call, and `bin/agent/build-checked-runner.sh` is the build it points at - a script a person runs, which compiles a ref the operator names and refuses to call the artifact a runner until its `--help` mentions `--policy` and the shipped `deny-all` preset has refused its write fixture (`notes/checked-runner-build-script.md`). A person who followed the one-line installer still cannot use this package, and that is the honest outcome the README states; what is no longer true is that they have no route.

## Not this

It is not a claim that this package is broken: a build that accepts `--policy`, wherever the
user puts it, works once `EYG_CODEMODE_RUNNER` names it. It is not the trap that a one-shot
`eyg run -c` is not checked (`docs/world/traps.md`), which is about the CLI's own default.
