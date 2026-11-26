---
id: gap.policy-runner-not-on-main
type: entity
owner: delegate
status: current
verified_at: 2026-11-26
verify: "grep -q '#(\"Search\"' test/fixtures/rule_mapping.gleam && grep -q 'EYG_RULE_SOURCE' test/fixtures/rule_mapping.PROVENANCE.md && test -x $HOME/.local/bin/eyg && ! $HOME/.local/bin/eyg --help 2>&1 | grep -qi policy && grep -qF '[mode, entryPath]' extensions/eyg-codemode.ts"
confidence: high
sources: [test/fixtures/rule_mapping.gleam, test/fixtures/rule_mapping.PROVENANCE.md, lib/render-helpers.mjs, docs/world/entities/gap.runner-release-lacks-policy.md, docs/world/entities/overlay.agent-harness.md, docs/world/entities/cli.checked-runner-on-this-host.md, docs/world/traps.md]
supersedes: null
superseded_by: null
---

# Gap: the language's default branch has no host that checks an effect, though a branch build on this machine did

The one-shot run with a policy module that this package used to start is not in
the language repository's `main` as that checkout sits on this machine, and it is not in the CLI
installed on `PATH`. Measured 2026-11-19 by reading that checkout read-only (`AGENTS.md` forbids
running `git` there, so its branch is read from its `.git/HEAD`, which answers
`ref: refs/heads/main`):

- its `packages/gleam_cli/src/eyg/cli/` has `overlay.gleam` (711 lines) and **no**
  `policy_runner.gleam`;
- `grep -n policy` in its `cli/args.gleam` prints nothing, so that CLI takes no policy module;
- the `rule_mapping` in its `overlay.gleam` is 22 entries, 18 of them a `PolicyField`, and it
  has **no `Search` row**;
- `diff` of that table against `test/fixtures/rule_mapping.gleam` is one line,
  `#("Search", policy.PolicyField("read_file"))`.

So the fixture here records the effect table of the branch that carries the checks, not of
`main`, and the live half of the drift guard follows the same rule: pointed at that checkout,
`node --test test/render-helpers.test.mjs` fails on the missing `Search` row (measured 2026-11-19:
pass 0, fail 1); without `EYG_RULE_SOURCE` the suite passes on the snapshot alone (pass 1, fail 0,
0.06 s). Meanwhile the CLI on `PATH` answers `v0.1.0` with the word "policy" nowhere in its help
(`gap.runner-release-lacks-policy`).

What changed on 2026-11-20 is the machine, not the branch: that checkout holds a build made on
2026-11-16, before it moved from its `chexxor` branch to `main`, and that binary accepted a policy
module and performed the checks (`cli.checked-runner-on-this-host`). The gap stands as
recorded - **a build from `main`, or from the published release, cannot check an effect** - and
the fixture is still the snapshot of a branch, not of `main`.

What changed on 2026-11-22 is what this package needs from that branch: the checks moved into
`host/guard.eyg`, so the tool starts the installed CLI and asks it for `run <entry>` and nothing
else (`docs/world/decisions/ADR-006-guard-in-package.md`). The gap is no longer this package's
blocker; it stays current because it is a fact about the language's default branch, and because the
fixture's provenance still points at a branch rather than at `main`.

## What to do about it

The fix belongs to the language: land a checked host on its default branch, then
publish a release that carries it - `gap.runner-release-lacks-policy` is the publishing
half of the same hole, and this package stopped waiting on it (ADR-006). When a build of the default
branch here takes a policy module: re-capture the
fixture as `test/fixtures/rule_mapping.PROVENANCE.md` describes, re-run the live guard against
that source, and re-run the availability probes
(`action: effects`). A branch build already let the probes run once
(`cli.checked-runner-on-this-host`, superseded); what is still owed is a run whose host anyone
else can install, which today means this package's own guard.

## Not this

It is not a claim that the fixture is wrong: it records the effect table this package targets,
and the guard passing against the snapshot is the package being honest about a snapshot. It is
not the publishing gap, which `gap.runner-release-lacks-policy` owns, and not the trap that an
`eyg run` started by hand reaches the host unchecked (`docs/world/traps.md`).
