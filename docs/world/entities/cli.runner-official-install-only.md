---
id: cli.runner-official-install-only
type: entity
owner: delegate
status: current
verified_at: 2026-11-21
verify: "node -e 'import(\"./lib/render-helpers.mjs\").then(m => { const a = m.runnerCandidates(\"/srv/app\", {}), b = m.runnerCandidates(\"/srv/app\", {EYG_CODEMODE_RUNNER: \"/opt/eyg\"}); process.exit(a.length === 1 && a[0] === \"eyg\" && b.length === 1 && b[0] === \"/opt/eyg\" ? 0 : 1); })' && ! grep -rq 'eyg-checked' lib/render-helpers.mjs extensions/eyg-codemode.ts test/ && test ! -e bin/agent/build-checked-runner.sh && ! $HOME/.local/bin/eyg --help 2>&1 | grep -q -- '--policy'"
confidence: high
sources: [lib/render-helpers.mjs, extensions/eyg-codemode.ts, test/render-helpers.test.mjs, bin/PURPOSE, guides/how-to-get-a-checked-runner.md, guides/how-to-point-the-tool-at-your-runner.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/entities/gap.runner-release-lacks-policy.md]
supersedes: null
superseded_by: null
---
# The tool reaches an installed `eyg` and one variable, and no installed build answers for an effect

`runnerCandidates` in `lib/render-helpers.mjs` returns two things and nothing else: the value of
`EYG_CODEMODE_RUNNER` when it is set, otherwise the single candidate `eyg`. There is no candidate
built from the working directory, no vendored binary, and no build step in this tree - `bin/`
carries one script, `agent/audit.sh`. `resolveRunner` in `extensions/eyg-codemode.ts` then keeps a
candidate only if its `--help` mentions `--policy`, and when none does, the call is refused before
a program is spawned. Measured 2026-11-21, pinned by three assertions over `runnerCandidates` in
`test/render-helpers.test.mjs`.

## What an official install answers

| check | answer |
| --- | --- |
| `$HOME/.local/bin/eyg --version` | `eyg v0.1.0` |
| `grep -c -- '--policy' <<< "$($HOME/.local/bin/eyg --help 2>&1)"` | `0` |
| the same check on a build of the published default branch | also no runner: `gap.policy-runner-not-on-main` |

So a person who installed the CLI the official way gets this from their first call
(@measured 2026-11-21 by a fresh one-shot `pi --print --mode json --tools eyg` session in this
tree, 54 s wall, exit 0):

```
eyg refused: no runner that accepts `--policy` was found among eyg. Checking happens in the runner, so a CLI without that flag cannot be used, and this package reaches no other binary: install the official CLI, and if what you installed has no --policy, the release predates the checks (docs/world/entities/gap.runner-release-lacks-policy.md). Besides PATH the only thing tried is a runner the operator names: EYG_CODEMODE_RUNNER=<absolute path>.
```

## Nothing here works around that

Until 2026-11-20 this tree reached a development build of the language CLI through a fourth probe
candidate and an untracked symlink, and `bin/agent/build-checked-runner.sh` existed to build one
(both recorded in `docs/world/entities/cli.checked-runner-on-this-host.md`, now superseded). The
symlink is deleted, the script is deleted (`git log --diff-filter=D --name-only -1` names it), the
candidate is gone from the code, and the `.gitignore` line for `.local/` stays only so that a
~105 MB binary an operator names with `EYG_CODEMODE_RUNNER` cannot be committed by accident.

The consequence is stated where it matters: every live effect number in this tree is dated
2026-11-20 and labelled as coming from that build, and no effect-level behaviour can be re-proved
on this machine until the language ships a build whose `--help` carries the flag
(`gap.runner-release-lacks-policy` names the trigger). What is still checked offline is the code
shape: the unit test, the drift guard over `test/fixtures/rule_mapping.gleam`, and this record's
own command.

## Not this

- whether the release or the default branch carries the flag: `gap.runner-release-lacks-policy`,
  `gap.policy-runner-not-on-main`;
- what the presets decide, effect by effect: `overlay.policy-rules` and
  `guides/cli_effects_reference.md`;
- the fact that a long-lived session's tool can be older than the working tree:
  `docs/world/traps.md`;
- naming a runner you built yourself: `guides/how-to-point-the-tool-at-your-runner.md`.

@measured 2026-11-21 by `node --test 'test/*.mjs'` (pass 1, fail 0, 0.08 s), by the two commands
in the table above, and by the one-shot session quoted; the deletion by
`git log --diff-filter=D --name-only -1` in this tree.
