---
id: gap.policy-runner-not-on-main
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "grep -q '#(\"Search\"' test/fixtures/rule_mapping.gleam && grep -q 'EYG_RULE_SOURCE' test/fixtures/rule_mapping.PROVENANCE.md && ! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'"
confidence: high
sources: [test/fixtures/rule_mapping.gleam, test/fixtures/rule_mapping.PROVENANCE.md, lib/render-helpers.mjs, docs/world/entities/gap.runner-release-lacks-policy.md, docs/world/entities/overlay.agent-harness.md, docs/world/traps.md]
supersedes: null
superseded_by: null
---

# Gap: no checkout or CLI on this machine has the runner that checks an effect

The one-shot checked runner this package starts — `eyg run --policy <module.eyg>` — is not in
the language repository's `main` as that checkout sits on this machine, and it is not in the CLI
installed on `PATH`. Measured 2026-11-19 by reading that checkout read-only (`AGENTS.md` forbids
running `git` there, so its branch is read from its `.git/HEAD`, which answers
`ref: refs/heads/main`):

- its `packages/gleam_cli/src/eyg/cli/` has `overlay.gleam` (711 lines) and **no**
  `policy_runner.gleam`;
- `grep -n policy` in its `cli/args.gleam` prints nothing, so that CLI has no `--policy` flag;
- the `rule_mapping` in its `overlay.gleam` is 22 entries, 18 of them a `PolicyField`, and it
  has **no `Search` row**;
- `diff` of that table against `test/fixtures/rule_mapping.gleam` is one line,
  `#("Search", policy.PolicyField("read_file"))`.

So the fixture here records the effect table of the branch that carries the checks, not of
`main`, and the live half of the drift guard follows the same rule: pointed at that checkout,
`node --test test/render-helpers.test.mjs` fails on the missing `Search` row (measured 2026-11-19:
pass 0, fail 1); without `EYG_RULE_SOURCE` the suite passes on the snapshot alone (pass 1, fail 0,
0.06 s). Meanwhile the CLI on `PATH` answers `v0.1.0` with no `--policy` in its help
(`gap.runner-release-lacks-policy`), so **nothing on this host performs the checks the shipped
presets describe**.

## What to do about it

The fix belongs to the language: land the checked one-shot runner on its default branch, then
publish a release that carries the flag — `gap.runner-release-lacks-policy` is the publishing
half of the same hole. When a runner here accepts `--policy`: re-capture the fixture as
`test/fixtures/rule_mapping.PROVENANCE.md` describes, re-run the live guard against that source,
and run the availability probes (`action: effects`) once. Until then every statement about what a
preset allows at run time stays UNVERIFIED here (`pi.first-draft`).

## Not this

It is not a claim that the fixture is wrong: it records the effect table this package targets,
and the guard passing against the snapshot is the package being honest about a snapshot. It is
not the publishing gap, which `gap.runner-release-lacks-policy` owns, and not the trap that an
`eyg run -c` without `--policy` reaches the host unchecked (`docs/world/traps.md`).
