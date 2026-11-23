---
name: official-installed-runner-only
description: Why the runner probe reaches only `eyg` on PATH and `EYG_CODEMODE_RUNNER`, why the working-directory dev-build candidates and the build script were deleted, and what to do the day a release carries `--policy`
date: 2026-11-23
---

Three choices `runnerCandidates` in `lib/render-helpers.mjs` makes and the code does not argue.
It replaces `notes/eyg-checked-runner-on-this-host.md` and `notes/checked-runner-build-script.md`,
both deleted with the thing they argued for.

**A candidate list is a promise about who may supply the binary.** Until 2026-11-21 it tried
four names, two of them built from the working directory: `<cwd>/packages/gleam_cli/dist/eyg` and
`<cwd>/.local/eyg-checked`. Both existed for one honest reason - the only build on this machine that knew `--policy` was
a build output of the language repository, and naming its path in tracked files is forbidden here -
and the reason was real. The cost was invisible: a candidate the package itself probes makes a
private build a *supported* install route, so every number measured through it reads as current, the
upstream hole (`gap.runner-release-lacks-policy`) stops being a wall anyone has to face, and a fresh
clone silently differs from the development machine. The deleted note carried that argument; this one
carries the reversal.

**Two places, one of them the operator's own words.** `PATH` stays because that is where the official
installer writes. `EYG_CODEMODE_RUNNER` stays because naming a binary is an act the operator does,
not one this package guesses at - set it and nothing else is probed. Nothing else is tried: no
directory-derived candidate, no vendored binary, no build step in `bin/`. That is what makes the
honest sentence true rather than aspirational: a fresh clone of this package runs on whatever the
official installer put on `PATH`, because the checks are this package's guard rather than a flag of
the binary, and `docs/world/entities/cli.runner-official-install-only.md` carries that run.

**Deleting the route does not delete the numbers it produced.** Every effect-level row in
`docs/world/` keeps its 2026-11-20 date and now names the development build it came from; the record
that recorded that build (`cli.checked-runner-on-this-host`) is superseded rather than deleted, and
the verifies that once needed that build now ask the installed release through
`bin/agent/refusal-probe.mjs`, so they re-run on a fresh clone and are never stamped `suspect` on a
clean machine. The `.gitignore` line for `.local/` stays for one reason only: a build of the
language CLI is around 105 MB, and a binary an operator names must not be committed by accident.

Trigger to revisit: a language release whose `--help` mentions `--policy`. Then do **not** re-add a
candidate - the release lands on `PATH`, and a non-release build is named with the variable. What
that day does: re-capture `test/fixtures/rule_mapping.gleam` the way
`test/fixtures/rule_mapping.PROVENANCE.md` describes, run the live comparison with `EYG_RULE_SOURCE`,
and move `cli.prebuilt-binary`, `gap.runner-release-lacks-policy` and `gap.policy-runner-not-on-main`
in the same commit; what that day does to `host/guard.eyg` is
`docs/world/decisions/ADR-006-guard-in-package.md` to decide.
