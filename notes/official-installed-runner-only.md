---
name: official-installed-runner-only
description: Why the runner probe reaches only `eyg` on PATH and `EYG_CODEMODE_RUNNER`, why the working-directory dev-build candidates and the build script were deleted, and what to do the day a release carries `--policy`
date: 2026-11-21
---

Three choices `runnerCandidates` in `lib/render-helpers.mjs` makes and the code does not argue.
It replaces `notes/eyg-checked-runner-on-this-host.md` and `notes/checked-runner-build-script.md`,
both deleted with the thing they argued for.

**A probe candidate is a promise about who may build the runner.** Until 2026-11-21 the probe tried
four places, two of them built from the working directory: `<cwd>/packages/gleam_cli/dist/eyg` and
`<cwd>/.local/eyg-checked`. Both existed for one honest reason - a checked runner on this machine is
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
honest sentence true rather than aspirational: a fresh clone of this package refuses every call, and
`guides/how-to-get-a-checked-runner.md` says whose release closes it.

**Deleting the route does not delete the numbers it produced.** Every effect-level row in
`docs/world/` keeps its 2026-11-20 date and now names the development build it came from; the record
that recorded that build (`cli.checked-runner-on-this-host`) is superseded rather than deleted, and
the verifies that invoked the binary are guarded by `test -z "${EYG_CODEMODE_RUNNER:-}" || { ... }`,
so they pass offline, fail honestly when a named runner misbehaves, and are never stamped `suspect`
on a clean machine. The `.gitignore` line for `.local/` stays for one reason only: a build of the
language CLI is around 105 MB, and a binary an operator names must not be committed by accident.

Trigger to revisit: a language release whose `--help` mentions `--policy`. Then do **not** re-add a
candidate - the release lands on `PATH`, and a non-release build is named with the variable. What
that day does: re-capture `test/fixtures/rule_mapping.gleam` the way
`test/fixtures/rule_mapping.PROVENANCE.md` describes, un-guard the verifies, and move
`cli.prebuilt-binary`, `gap.runner-release-lacks-policy` and `gap.policy-runner-not-on-main` in the
same commit.
