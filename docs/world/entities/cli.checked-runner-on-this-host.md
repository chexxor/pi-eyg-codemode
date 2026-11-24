---
id: cli.checked-runner-on-this-host
type: entity
owner: delegate
status: superseded
verified_at: 2026-11-24
verify: "grep -q '^superseded_by: cli.runner-official-install-only' docs/world/entities/cli.checked-runner-on-this-host.md && test -f docs/world/entities/cli.runner-official-install-only.md && ! grep -rq 'eyg-checked' lib/render-helpers.mjs extensions/eyg-codemode.ts test/ && test ! -e bin/agent/build-checked-runner.sh"
confidence: high
sources: [test/fixtures/refusal-probe.eyg, lib/render-helpers.mjs, extensions/eyg-codemode.ts, notes/official-installed-runner-only.md, docs/world/entities/gap.policy-runner-not-on-main.md, docs/world/entities/cli.runner-official-install-only.md]
supersedes: null
superseded_by: cli.runner-official-install-only
---
# A runner that checks effects was reachable from this tree on 2026-11-20, and a checked call was observed

**Superseded 2026-11-21 by `docs/world/entities/cli.runner-official-install-only.md`.** The
untracked symlink this record describes is deleted, the build script that made it is deleted, and
the candidate slot that reached it is gone from `runnerCandidates`. The rows below stay because
other records date their live numbers to this day, and they say where those numbers came from: a
**development build of the language CLI**, built 2026-11-16, whose `--version` answers `eyg dev`
rather than a release version.

Measured 2026-11-20.

- its `--help` named a policy module on each of the three run modes: `grep -c` over that help for
  the flag printed **3** (`run`, `eval`, `script`).
- The binary was a build of the language repository itself, at that repository's own build
  output path. Its `--version` says `dev`, not a release version, which is why
  `gap.runner-release-lacks-policy` still stood then and stands now.
- Provenance read without running `git` there: that checkout's `.git/HEAD` answers
  `ref: refs/heads/main` and its `.git/logs/HEAD` last line is
  `checkout: moving from chexxor to main` at 2026-11-19 20:42 CST - **after** the binary was
  built, so the binary carried the checks and `main` did not
  (`gap.policy-runner-not-on-main`).
- At the time the tool reached it through a fourth probe candidate, an untracked symlink in this
  tree. That candidate no longer exists: see the successor record for the two places the tool
  tries, pinned by the unit test's assertions over `runnerCandidates`.

## What a checked call did

In a fresh one-shot pi session (`--print --mode json --tools eyg`, `EYG_ALLOWED_ROOTS` set to a
scratch directory), with no `EYG_CODEMODE_RUNNER` in its environment:

| call | result | on disk |
| --- | --- | --- |
| `action: effects` | 16 probes in 1.13 s under `policies/agent-roots.eyg` (`policySource: package default`) | - |
| `WriteFile` inside the root | `performed`, 0.09 s | file written |
| `WriteFile` in `/tmp` | `refused: write_file denied by policy: /tmp/task2-outside-pi.txt`, 0.08 s | nothing written |

The probe rows are what the default policy in fact does: `AppendFile`, `CWD`, `DeleteFile`,
`MakeDirectory`, `ReadDirectory`, `ReadFile`, `Search`, `WriteFile`, `Flip`, `Now`, `Random`,
`Sleep`, `StandardError`, `StandardOut` allowed for the probe value; `CreateKey` and `Fetch`
refused; `Env`, `Exit`, `StandardIn` unknown because probing them would read the environment,
stop the probe or need input; `DecodeJSON`, `EYGParse`, `Hash`, `Sign` unchecked. The same probe
under `policies/deny-all.eyg` refuses the write fixture: the call printed
`write_file denied by policy` and created no file (0.1 s). That row runs today as
`node bin/agent/refusal-probe.mjs --with-policy deny-all`, recorded in
`docs/world/entities/codemode.effect-surface.md`.

Running the binary did not touch the language checkout: `find <that checkout> -newermt @<start>`
printed nothing after both the direct calls and the pi session.

## Not this

- which places the tool probes today, and what an installed CLI answers:
  `docs/world/entities/cli.runner-official-install-only.md`;
- whether a *release* carries a host of its own: `gap.runner-release-lacks-policy`; and whether `main`
  has one: `gap.policy-runner-not-on-main`;
- how much of the package is still unproven in use: `pi.first-draft`;
- what the policies decide, effect by effect: `overlay.policy-rules` and the effect rows of
  `guides/eyg-surface.tsv`;
- how to point the tool at a runner of your own: `guides/how-to-point-the-tool-at-your-runner.md`.

@measured 2026-11-20 by `.local/eyg-checked --help` (three run-mode lines took a policy module,
and `--version` answered `eyg dev`) and `.local/eyg-checked run` with that module over the write
fixture and the print fixture (the three rows above),
and `node --test 'test/*.mjs'` (pass 1, fail 0, 0.07 s) - that symlink is deleted, so these rows
are a dated record, not a command that runs here today.
