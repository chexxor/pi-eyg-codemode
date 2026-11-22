---
id: cli.runner-official-install-only
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "node -e 'import(\"./lib/render-helpers.mjs\").then(m => { const a = m.runnerCandidates(\"/srv/app\", {}), b = m.runnerCandidates(\"/srv/app\", {EYG_CODEMODE_RUNNER: \"/opt/eyg\"}); process.exit(a.length === 1 && a[0] === \"eyg\" && b.length === 1 && b[0] === \"/opt/eyg\" ? 0 : 1); })' && grep -q 'runnerFailureLine' lib/render-helpers.mjs && grep -c 'runnerFailureLine(' extensions/eyg-codemode.ts | grep -q '^[3-9]' && ! grep -q 'resolveRunner' extensions/eyg-codemode.ts && grep -q '[mode, \"--policy\", policy, \"-c\", source]' extensions/eyg-codemode.ts && ! grep -rq 'eyg-checked' lib/render-helpers.mjs extensions/eyg-codemode.ts test/ && test ! -e bin/agent/build-checked-runner.sh && test -x $HOME/.local/bin/eyg && ! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'"
confidence: high
sources: [lib/render-helpers.mjs, extensions/eyg-codemode.ts, test/render-helpers.test.mjs, bin/PURPOSE, notes/official-installed-runner-only.md, guides/how-to-point-the-tool-at-your-runner.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/entities/gap.runner-release-lacks-policy.md]
supersedes: null
superseded_by: null
---
# The tool reaches an installed `eyg` and one variable, and no installed build knows the flag

`runnerCandidates` in `lib/render-helpers.mjs` returns two things and nothing else: the value of
`EYG_CODEMODE_RUNNER` when it is set, otherwise the single name `eyg`. There is no candidate built
from the working directory, no vendored binary, and no build step in this tree - `bin/` carries one
script, `agent/audit.sh`. The tool starts the first of those and puts `--policy <module.eyg>` in
every command line it builds (`extensions/eyg-codemode.ts:579`), so nothing is asked of the binary
in advance: there is no `--help` probe and no cached verdict. `runnerFailureLine` in
`lib/render-helpers.mjs` reads the failed run's own output and answers with one line. Measured
2026-11-21, pinned by four assertions over `runnerCandidates` and `runnerFailureLine` in
`test/render-helpers.test.mjs`.

## What an official install answers

| check | answer |
| --- | --- |
| `$HOME/.local/bin/eyg --version` | `eyg v0.1.0` |
| `grep -c -- '--policy' <<< "$($HOME/.local/bin/eyg --help 2>&1)"` | `0` |
| `eyg eval --policy policies/deny-all.eyg -c '!int_add(1, 1)'` | `error: no such file: <cwd>/eval` - the binary has no `--policy`, so it reads the mode word as a file name |
| the same checks on a build of the published default branch | also no build that knows the flag: `gap.policy-runner-not-on-main` |

So a person who installed the CLI the official way gets this from their first call: the runner's own
two lines, then one line from this package (@measured 2026-11-21 by a fresh one-shot
`pi --print --mode json --offline --tools eyg --model strata/qwen3.8-flash-next-iq3_s --thinking low`
session in this tree, transcript `.ai-work/goal-mwr4a29j-66ress/refusal-line.jsonl`, whose tool row
records `argv: ["run","--policy","<package>/policies/agent-roots.eyg","-c","perform StandardOut(\"hello\")"]`):

```
the eyg binary this tool started did not understand `run --policy <module.eyg>` and read `run` as a file name, so no policy ran and nothing was performed: the install predates the flag this package needs, so install a newer release of the EYG CLI or name a binary that accepts the flag with EYG_CODEMODE_RUNNER=<absolute path>.
```

A binary that is not there at all - `ENOENT` in the spawn's stderr, which `pi.exec` reports as a
failed run rather than an exception - answers `no eyg binary found at <name>: install the EYG CLI so
that \`eyg\` is on PATH, or name one with EYG_CODEMODE_RUNNER=<absolute path>.` The two lines are the
whole surface: no call is ever run without `--policy`, and no other binary is reached.

## Nothing here works around that

Until 2026-11-20 this tree reached a development build of the language CLI through a fourth
candidate and an untracked symlink, and `bin/agent/build-checked-runner.sh` existed to build one
(both recorded in `docs/world/entities/cli.checked-runner-on-this-host.md`, now superseded). The
symlink is deleted, the script is deleted (`git log --diff-filter=D --name-only -1` names it), the
candidate is gone from the code, and the `.gitignore` line for `.local/` stays only so that a
~105 MB binary an operator names with `EYG_CODEMODE_RUNNER` cannot be committed by accident. The
capability probe that the candidate list used also went on 2026-11-21, and `notes/runner-not-probed.md`
records what that trade-off costs.

The consequence is stated where it matters: every live effect number in this tree is dated
2026-11-20 and labelled as coming from that build, and no effect-level behaviour can be re-proved
on this machine until the language ships a build whose `--help` carries the flag
(`gap.runner-release-lacks-policy` names the trigger). What is still checked offline is the code
shape: the unit test, the drift guard over `test/fixtures/rule_mapping.gleam`, and this record's
own command.

## Not this

- whether the release or the default branch carries the flag: `gap.runner-release-lacks-policy`,
  `gap.policy-runner-not-on-main`;
- what the shipped policies decide, effect by effect: `overlay.policy-rules` and
  `docs/world/entities/codemode.effect-surface.md`;
- the fact that a long-lived session's tool can be older than the working tree:
  `docs/world/traps.md`;
- naming a binary you built yourself: `guides/how-to-point-the-tool-at-your-runner.md`.

@measured 2026-11-21 by `node --test 'test/*.mjs'` (pass 1, fail 0, 0.07 s), by the commands in the
table above, and by the one-shot session quoted; the deletion by
`git log --diff-filter=D --name-only -1` in this tree.
