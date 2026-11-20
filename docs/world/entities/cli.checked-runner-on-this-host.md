---
id: cli.checked-runner-on-this-host
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "test -x .local/eyg-checked && [ \"$(.local/eyg-checked --help 2>&1 | grep -c -- --policy)\" -ge 1 ] && .local/eyg-checked run --policy $PWD/policies/deny-all.eyg test/fixtures/refusal-probe.eyg | grep -q 'write_file denied by policy'"
confidence: high
sources: [test/fixtures/refusal-probe.eyg, lib/render-helpers.mjs, extensions/eyg-codemode.ts, notes/eyg-checked-runner-on-this-host.md, docs/world/entities/gap.policy-runner-not-on-main.md]
supersedes: null
superseded_by: null
---
# A runner that checks effects is reachable from this tree, and a checked call was observed

The hole every other record in this tree pointed at - "no runner here accepts `--policy`, so no
checked call has ever been seen" - is closed on this machine. Measured 2026-11-20.

- `<runner> --help 2>&1 | grep -c -- --policy` prints **3** (`run --policy <m> <src>`,
  `eval --policy <m>`, `script --policy <m> <file>`); `--version` answers `eyg dev`.
- The runner is the language workspace's own build output: that repository's layout puts it at
  `packages/gleam_cli/dist/eyg`, built 2026-11-16. Its `--version` says `dev`, not a release
  version, which is why `gap.runner-release-lacks-policy` still stands.
- Provenance read without running `git` there: that checkout's `.git/HEAD` answers
  `ref: refs/heads/main` and its `.git/logs/HEAD` last line is
  `checkout: moving from chexxor to main` at 2026-11-19 20:42 CST - **after** the binary was
  built, so the binary carries the checks and `main` does not
  (`gap.policy-runner-not-on-main`).
- The tool reaches it through `<cwd>/.local/eyg-checked`, an untracked symlink; the candidate
  order is `EYG_CODEMODE_RUNNER`, then `eyg` on PATH, then that symlink
  (`runnerCandidates` in `lib/render-helpers.mjs`, pinned by three assertions in the unit test;
  the user-facing page is `guides/how-to-point-the-tool-at-your-runner.md`).

## What a checked call did

In a fresh one-shot pi session (`--print --mode json --tools eyg`, `EYG_ALLOWED_ROOTS` set to a
scratch directory), with no `EYG_CODEMODE_RUNNER` in its environment:

| call | result | on disk |
| --- | --- | --- |
| `action: effects` | 16 probes in 1.13 s under `policies/agent-roots.eyg` (`policySource: package default`), runner recorded as `.local/eyg-checked` | - |
| `WriteFile` inside the root | `performed`, 0.09 s | file written |
| `WriteFile` in `/tmp` | `refused: write_file denied by policy: /tmp/task2-outside-pi.txt`, 0.08 s | nothing written |

The probe rows are what the default preset in fact does: `AppendFile`, `CWD`, `DeleteFile`,
`MakeDirectory`, `ReadDirectory`, `ReadFile`, `Search`, `WriteFile`, `Flip`, `Now`, `Random`,
`Sleep`, `StandardError`, `StandardOut` allowed for the probe value; `CreateKey` and `Fetch`
refused; `Env`, `Exit`, `StandardIn` unknown because probing them would read the environment,
stop the probe or need input; `DecodeJSON`, `EYGParse`, `Hash`, `Sign` unchecked. The same probe
under `policies/deny-all.eyg` refuses the write fixture:
`.local/eyg-checked run --policy $PWD/policies/deny-all.eyg test/fixtures/refusal-probe.eyg`
prints `write_file denied by policy` and creates no file (0.1 s).

Running the binary did not touch the language checkout: `find <that checkout> -newermt @<start>`
printed nothing after both the direct calls and the pi session.

## Not this

- whether a *release* carries the flag: `gap.runner-release-lacks-policy`; and whether `main`
  has the runner: `gap.policy-runner-not-on-main`;
- how much of the package is still unproven in use: `pi.first-draft`;
- what the presets decide, effect by effect: `overlay.policy-rules` and
  `guides/cli_effects_reference.md`;
- how to point the tool at a different runner: `guides/how-to-point-the-tool-at-your-runner.md`.

@measured 2026-11-20 by `.local/eyg-checked --help 2>&1 | grep -c -- --policy` (3),
`.local/eyg-checked run --policy policies/agent-roots.eyg -c <program>` (the three rows above),
and `node --test 'test/*.mjs'` (pass 1, fail 0, 0.07 s).
