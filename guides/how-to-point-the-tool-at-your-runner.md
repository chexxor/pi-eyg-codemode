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

That is the whole contract: when the variable is set, nothing else is probed. Without it, the
tool tries one candidate: `eyg` on your `PATH`. There is no third place to park a binary - the
package reaches those two and nothing else
(`docs/world/entities/cli.runner-official-install-only.md`) - and the probe is one process per
set of candidates, so a session pays it once.

No officially installed build is a candidate yet: the published release's `--help` has no
`--policy` (`docs/world/entities/gap.runner-release-lacks-policy.md`), and neither does a build
of the published default branch (`docs/world/entities/gap.policy-runner-not-on-main.md`). So
today this page is for a binary you built from a ref the language repository names, or for a
machine where a release does carry the flag.

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
prints `write_file denied by policy` and leaves no file behind (0.1 s wall when a runner is
named; measured 2026-11-20 through a development build of the language CLI this tree no longer
has).

## Not this

This page does not build a CLI - <https://eyg.run/guides/install-from-source> does, and
this package carries none of that build; if you have no binary yet, start at
`guides/how-to-get-a-checked-runner.md`, which says what to ask upstream. It also does not change
what a policy allows; `guides/how-to-write-another-preset.md` does that.
