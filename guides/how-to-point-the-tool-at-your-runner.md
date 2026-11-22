# Point the tool at a CLI you built or downloaded

The `eyg` tool starts one binary to run every program, and it must accept
`run --policy <module.eyg>`: `--policy` is what carries the policy into the run, so a binary
without that flag cannot run a program with checks in it. Two steps and one proof.

## Name the binary

```sh
export EYG_CODEMODE_RUNNER=<absolute path to the binary>
```

That is the whole contract. When the variable is set, that path is the binary. Without it,
the tool starts `eyg` on your `PATH`. There is no third place to park a binary: the package
reaches those two and nothing else (`docs/world/entities/cli.runner-official-install-only.md`).
A relative path is refused - the policy sees absolute paths, and a relative one resolves
before the checks can read it.

Nothing is asked of the binary before the run: the flag is in every command line the tool
builds, and a binary that does not know it says so in its own output. That output ends the
call with one line:

```
the eyg binary this tool started did not understand `run --policy <module.eyg>` and read `run` as a file name, so no policy ran and nothing was performed: the install predates the flag this package needs, so install a newer release of the EYG CLI or name a binary that accepts the flag with EYG_CODEMODE_RUNNER=<absolute path>.
```

A binary that is not there at all answers `no eyg binary found at <where the tool looked>`.

Neither officially installed build carries the flag: not the published release
(`docs/world/entities/gap.runner-release-lacks-policy.md`), not a build of the published
default branch (`docs/world/entities/gap.policy-runner-not-on-main.md`). So this page is for
a binary built from a ref the language repository names, or for a machine where a release
does carry the flag.

## Prove this package found it

Make one call that asks a question rather than changing anything - `action: "effects"`
answers without running a program - and expand the row (`Ctrl+O`). Its last line reads
`policy: <path> (<source>) runner: <path> roots: <path>`: the runner named there is the
proof, and the line quoted above is the counter-proof.

At the shell, this package's own fixture is the same proof in one command:

```sh
$EYG_CODEMODE_RUNNER run --policy <this package>/policies/deny-all.eyg test/fixtures/refusal-probe.eyg
```

It prints `write_file denied by policy` and leaves no file behind; the fixture is
`test/fixtures/refusal-probe.eyg`.

## Not this

- getting a CLI in the first place: <https://eyg.run/guides/install-a-prebuilt-binary> and
  <https://eyg.run/guides/install-from-source>; this package carries no build of its own;
- changing what the policy allows once the binary runs: `guides/how-to-write-a-policy.md`;
- the language's install pages themselves, which this tree does not own
  (`docs/world/decisions/ADR-003-doc-delegation.md`).
