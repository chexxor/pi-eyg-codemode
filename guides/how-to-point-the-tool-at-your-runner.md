# Point the tool at a CLI you built or downloaded

You have a binary that accepts `--policy` and you want this package to use it instead of
refusing. Three steps, and one check that proves it worked.

The steps are:

1. [Confirm the binary answers for an effect](#confirm-the-binary-answers-for-an-effect)
2. [Name it](#name-it)
3. [Prove the tool found it](#prove-the-tool-found-it)

## Confirm the binary answers for an effect

```sh
<your binary> --help 2>&1 | grep -c -- --policy
```

A candidate counts only when that number is not `0`; the tool spawns `<candidate> --help`
and looks for the flag. A candidate that cannot be spawned is not a runner at all.

## Name it

Set the variable for the session:

```sh
export EYG_CODEMODE_RUNNER=<absolute path to the binary>
```

That is the whole contract: when the variable is set, nothing else is probed. Without it,
the tool tries three candidates in order and takes the first whose `--help` mentions
`--policy`: `eyg` on your `PATH`, then `<the session directory>/packages/gleam_cli/dist/eyg`
(the language repository's own build layout), then `<the session directory>/.local/eyg-checked`.
The last one is where to put a runner this machine has and `PATH` does not carry - a symlink is
enough, and `.local/` is gitignored so the tree stays free of machine paths. The probe is one
process per set of candidates, so a session pays it once.

On this machine the third candidate is what works: a dev build of the language CLI, symlinked at
`.local/eyg-checked`, with how it was found and what it refused in
`docs/world/entities/cli.checked-runner-on-this-host.md` and `notes/eyg-checked-runner-on-this-host.md`.

A relative path is refused: the policy sees absolute paths, and a relative one resolves
before the checks can read it.

## Prove the tool found it

Make one call that performs an effect - `action: "effects"` answers without running
anything - and expand the row (`Ctrl+O`). Its last line reads
`policy: <path> (<source>) runner: <path> roots: <path>`. The runner you named is the
proof, and the refusal message below is the counter-proof:

```
no runner that accepts `--policy` was found among ...
```

If you see that message, the binary is not where the name says it is, or its `--help` does
not carry the flag. Re-run step 1 against the exact path you set.

At the shell, one command proves both halves - the runner answers for an effect, and the
preset answered: `test/fixtures/refusal-probe.eyg` asks for a `WriteFile` and prints what came
back, so `<runner> run --policy <this package>/policies/deny-all.eyg test/fixtures/refusal-probe.eyg`
prints `write_file denied by policy` and leaves no file behind (0.1 s wall, @measured 2026-11-20).

## Not this

This page does not build a CLI - <https://eyg.run/guides/install-from-source> does, and
this package carries none of that build. It also does not change what a policy allows;
`guides/how-to-write-another-preset.md` does that.
