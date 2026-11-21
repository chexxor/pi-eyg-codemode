# Get a runner that checks effects

You have a fresh clone of this package and no binary that answers for an effect, so every
`eyg` call comes back refused before a program runs. This page states where such a binary has
to end up, and why no install route hands you one today.

Start with the check, not with an install:

```sh
<the eyg you have> --help 2>&1 | grep -c -- --policy   # 0 => every call will be refused
```

**No official install can answer for an effect today.** Both official routes print `0`:

| route | what it installs | the record that says so |
| --- | --- | --- |
| the prebuilt release (`guides/install_prebuilt.md`) | `gleam_cli-v0.1.0`, whose `--help` has no `--policy` | `docs/world/entities/gap.runner-release-lacks-policy.md` |
| the source build (`guides/install_from_source.md`) | the published default branch, which has no runner that answers for an effect either | `docs/world/entities/gap.policy-runner-not-on-main.md` |

So an install page can finish "successfully" and leave you with nothing this package can start
(`docs/world/entities/gap.install-guides-name-no-policy.md`). Nothing in this package works
around that: the tool reaches `eyg` on `PATH` or a runner you name, and no other binary
(`docs/world/entities/cli.runner-official-install-only.md`). A refusal at every call is the
honest state of a fresh install, not a bug to chase.

## Where a binary has to end up

Two places, tried in order, and a candidate counts only when its `--help` mentions `--policy`
(`runnerCandidates` in `lib/render-helpers.mjs`):

| place | when it is the right one |
| --- | --- |
| `EYG_CODEMODE_RUNNER` (absolute path) | you want to name one binary for one session and stop guessing; set it and nothing else is probed |
| `eyg` on `PATH` | the binary you installed is the one you want everywhere |

`guides/how-to-point-the-tool-at-your-runner.md` is the page for a binary you already have.

## Prove one from inside the tool

Make one call that performs an effect - `action: "effects"` answers without running anything -
and expand the row (`Ctrl+O`). Its last line reads `policy: <path> (<source>) runner: <path>
roots: <path>`: the runner named there is the proof. The counter-proof is the refusal you get
with no such binary, `no runner that accepts \`--policy\` was found among eyg`
(@measured 2026-11-21 by a one-shot `pi --print --mode json --tools eyg` session in this tree;
the live call itself has not been seen here since - see the record above for why).

At the shell, with a runner you named, this package's own fixture is the same proof in one
command (0.1 s when it runs):

```sh
$EYG_CODEMODE_RUNNER run --policy <this package>/policies/deny-all.eyg test/fixtures/refusal-probe.eyg
```

It prints `write_file denied by policy` and leaves no file behind. That number was measured on
2026-11-20 through a development build of the language CLI this machine had parked in a
gitignored directory; no build this tree points at produced it, and no such build is here now.

## Ask upstream, not this package

There is no supported build step in this tree. The question to take to the language repository
is which ref carries `run --policy <module.eyg>`, and when the next release will include it.

The trigger that moves these records is a language release whose `--help` mentions `--policy`:
then the prebuilt route works, and `cli.prebuilt-binary`,
`gap.runner-release-lacks-policy` and `gap.policy-runner-not-on-main` move with the new output,
along with the recorded effect-surface snapshot
(`test/fixtures/rule_mapping.PROVENANCE.md` carries the refresh steps).

## Not this

- naming a runner you already built or downloaded: `guides/how-to-point-the-tool-at-your-runner.md`;
- changing what a policy allows once a runner exists: `guides/how-to-write-another-preset.md`;
- the language's install pages themselves, which this tree mirrors but does not own
  (`docs/world/decisions/ADR-003-doc-delegation.md`).
