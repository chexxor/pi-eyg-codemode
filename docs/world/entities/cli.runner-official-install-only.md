---
id: cli.runner-official-install-only
type: entity
owner: delegate
status: current
verified_at: 2026-11-23
verify: "node -e 'import(\"./lib/render-helpers.mjs\").then(m => { const a = m.runnerCandidates(\"/srv/app\", {}), b = m.runnerCandidates(\"/srv/app\", {EYG_CODEMODE_RUNNER: \"/opt/eyg\"}); process.exit(a.length === 1 && a[0] === \"eyg\" && b.length === 1 && b[0] === \"/opt/eyg\" ? 0 : 1); })' && grep -qF '[mode, entryPath]' extensions/eyg-codemode.ts && grep -qF 'no eyg binary found at' lib/render-helpers.mjs && grep -qF 'is the command this package runs for every call' lib/render-helpers.mjs && ! grep -q 'resolveRunner' extensions/eyg-codemode.ts && ! grep -rq 'eyg-checked' lib/render-helpers.mjs extensions/eyg-codemode.ts test/ && test ! -e bin/agent/build-checked-runner.sh && node bin/agent/refusal-probe.mjs 2>&1 | grep -q 'write_file denied by policy: /tmp/'"
confidence: high
sources: [lib/render-helpers.mjs, extensions/eyg-codemode.ts, test/render-helpers.test.mjs, bin/PURPOSE, notes/official-installed-runner-only.md, guides/how-to-point-the-tool-at-your-runner.md, docs/world/entities/cli.prebuilt-binary.md, docs/world/entities/host.guard-boundary.md]
supersedes: null
superseded_by: null
---
# The tool reaches an installed `eyg` and one variable, and asks it for a mode word and a file

`runnerCandidates` in `lib/render-helpers.mjs` returns two things and nothing else: the value of
`EYG_CODEMODE_RUNNER` when it is set, otherwise the single name `eyg`. There is no candidate built
from the working directory, no vendored binary, and no build step in this tree - `bin/` carries the
agent scripts and nothing that compiles the language. The tool starts the first of those with
`[mode, entryPath]` (`extensions/eyg-codemode.ts:480`), so nothing is asked of the binary in
advance: there is no `--help` probe and no cached verdict. `runnerFailureLine` in
`lib/render-helpers.mjs` reads the failed run's own output and answers with one line. Pinned by four
assertions over `runnerCandidates` and `runnerFailureLine` in `test/render-helpers.test.mjs`.

## What an official install answers

| check | answer |
| --- | --- |
| `$HOME/.local/bin/eyg --version` | `eyg v0.1.0` |
| `node bin/agent/refusal-probe.mjs` (the entry, the policy import and the program this package writes) | `write_file denied by policy: /tmp/eyg-refusal-probe-<random>/eyg-probe-refused.txt`, 0.19 s |
| `node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg` | `error: unhandled effect Foo({})` |
| a binary whose `run` command is missing (a stub printing `error: no such file: <cwd>/run`) | one line naming the install and quoting `<stub> run <entry>` |

So the checks are this package's, and the release install runs them: the refusal and the closed
effect row come from `host/guard.eyg`, which the generated entry imports around the program
(`docs/world/entities/host.guard-boundary.md`). What a broken install gets is one line from this
package, not a stack. A binary that is not there at all - `ENOENT` in the spawn's stderr, which
`pi.exec` reports as a failed run rather than an exception - answers `no eyg binary found at <name>:
install the EYG CLI so that \`eyg\` is on PATH, or name one with EYG_CODEMODE_RUNNER=<absolute
path>.` Both lines were captured live on 2026-11-22 in fresh one-shot sessions (transcripts under
the session's gitignored scratch, `@measured 2026-11-22 by pi --print --mode json --tools eyg`), and
`guides/how-to-point-the-tool-at-your-runner.md` quotes them.

## Nothing here works around that

Until 2026-11-20 this tree reached a development build of the language CLI through a fourth
candidate and an untracked symlink, and `bin/agent/build-checked-runner.sh` existed to build one
(both recorded in `docs/world/entities/cli.checked-runner-on-this-host.md`, now superseded). The
symlink is deleted, the script is deleted (`git log --diff-filter=D --name-only -1` names it), the
candidate is gone from the code, and the `.gitignore` line for `.local/` stays only so that a
~105 MB binary an operator names with `EYG_CODEMODE_RUNNER` cannot be committed by accident. The
capability probe that the candidate list used also went on 2026-11-21, and `notes/runner-not-probed.md`
records what that trade-off costs.

What that leaves is stated where it matters: the installed release runs every call, so an
effect-level answer is re-runnable by anyone who has `eyg` on `PATH`, at the cost of one fifth of a
second (`bin/agent/refusal-probe.mjs`). What is checked offline, without any binary, is the code
shape: the unit test, the guard-coverage test, the drift guard over
`test/fixtures/rule_mapping.gleam`, and this record's own command.

## Not this

- whether the release or the default branch carries a host of the language's own:
  `gap.runner-release-lacks-policy`, `gap.policy-runner-not-on-main`;
- what the shipped policies decide, effect by effect: `overlay.policy-rules` and
  `docs/world/entities/codemode.effect-surface.md`;
- the fact that a long-lived session's tool can be older than the working tree:
  `docs/world/traps.md`;
- naming a binary you built yourself: `guides/how-to-point-the-tool-at-your-runner.md`.

@measured 2026-11-22 by `node --test 'test/*.mjs'` (43 pass, 0 fail, 0.10 s), by the commands in the
table above, and by the one-shot sessions quoted; the deletion by
`git log --diff-filter=D --name-only -1` in this tree.
