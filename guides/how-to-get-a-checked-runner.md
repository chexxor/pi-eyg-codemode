# Get a runner that checks effects

You have a fresh clone of this package and no binary that answers for an effect, so every
`eyg` call comes back refused before a program runs. This page ends with a checked call, and
one command that proves the call was checked.

Start with the check, not with an install:

```sh
<the eyg you have> --help 2>&1 | grep -c -- --policy   # 0 => every call will be refused
```

A prebuilt CLI prints `0` today: the release the language repository serves is
`gleam_cli-v0.1.0` and its help has no `--policy`
(`docs/world/entities/gap.runner-release-lacks-policy.md`, re-checked 2026-11-20), and the
language's default branch has no runner that checks an effect either
(`docs/world/entities/gap.policy-runner-not-on-main.md`). So an install page can finish
"successfully" and leave you with nothing this package can start
(`docs/world/entities/gap.install-guides-name-no-policy.md`).

## Where the artifact has to end up

The tool looks for a runner in four places and takes the first whose `--help` mentions
`--policy` (`runnerCandidates` in `lib/render-helpers.mjs`). Build once, then choose a row:

| place | when it is the right one |
| --- | --- |
| `EYG_CODEMODE_RUNNER` (absolute path) | you want to name one binary for one session and stop guessing |
| `eyg` on `PATH` | the checked build is the `eyg` you want everywhere |
| `<cwd>/packages/gleam_cli/dist/eyg` | you run sessions inside a checkout of the language repository |
| `<cwd>/.local/eyg-checked` | this machine has a checked build and `PATH` does not carry it - a symlink, and `.local/` is gitignored |

`guides/how-to-point-the-tool-at-your-runner.md` is the page for a binary you already have.

## Build one

The toolchain is Gleam ≥ 1.7 and Bun; `guides/install_from_source.md` carries the steps and
<https://eyg.run/guides/install-from-source> is their source.

Then run the script in this tree. **You run it; the package never does** - it has no effect
that starts a shell command, and a build of another repository is not this tree's work
(`AGENTS.md`).

```sh
bin/agent/build-checked-runner.sh --source <a checkout of the language repository>
bin/agent/build-checked-runner.sh --clone-url <the URL on that install page> --ref <a ref>
```

It compiles that checkout, counts `--policy` in the artifact's `--help`, then runs
`test/fixtures/refusal-probe.eyg` under `policies/deny-all.eyg` and looks for
`write_file denied by policy`. Both halves must pass, and then it prints the two ways to name
the binary. If the count is `0` the script stops and says so: the ref you built carries no
checked runner, which is the two gap records above still standing, not a build error to chase.
Ask the language repository which ref carries `run --policy` before building another one.

## Prove it from inside the tool

Make one call that performs an effect - `action: "effects"` answers without running anything -
and expand the row (`Ctrl+O`). Its last line reads `policy: <path> (<source>) runner: <path>
roots: <path>`: the runner named there is the proof. The counter-proof is the refusal you got
before, `no runner that accepts \`--policy\` was found among ...`.

At the shell, the fixture the script uses is the same proof in one command (0.1 s):

```sh
<the binary> run --policy <this package>/policies/deny-all.eyg test/fixtures/refusal-probe.eyg
```

It prints `write_file denied by policy` and leaves no file behind
(@measured 2026-11-20 by that command in this tree).

## When this page goes stale

The trigger is a language release whose `--help` mentions `--policy`. Then the prebuilt route
works, `<cwd>/.local/eyg-checked` should be deleted, and the records named above move with the
new output (`notes/eyg-checked-runner-on-this-host.md` carries the same trigger with the
fixture refresh steps).

## Not this

- naming a runner you already built or downloaded: `guides/how-to-point-the-tool-at-your-runner.md`;
- changing what a policy allows once a runner exists: `guides/how-to-write-another-preset.md`;
- the language's install pages themselves, which this tree mirrors but does not own
  (`docs/world/decisions/ADR-003-doc-delegation.md`).
