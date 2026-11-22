# First session: perform one effect, and read one refusal

You installed this package and want proof it does what it claims, in the smallest
steps. Five of them, each with what you should see. If you only want the answer to
"why is every call refused", go to step 2 and the last section.

The steps are:

1. [Install the CLI](#install-the-cli)
2. [Check that the CLI knows the command](#check-that-the-cli-knows-the-command)
3. [Ask what the policy allows](#ask-what-the-policy-allows)
4. [Read a file, and print what you got](#read-a-file-and-print-what-you-got)
5. [Write outside the roots, and read the refusal](#write-outside-the-roots-and-read-the-refusal)

## Install the CLI

This package does not carry a CLI; the check that decides every effect lives in one. Get
one from the EYG website: <https://eyg.run/guides/install-a-prebuilt-binary> or
<https://eyg.run/guides/install-from-source>. The website's own verify step is

```sh
eyg eval -c '!int_add(1, 1)'
```

and it prints `2`. That proves the binary runs; it does not prove this package can use
it, which is step 2.

## Check that the CLI knows the command

This package always asks the binary for a policy, so the check is whether the binary knows
that command:

```sh
<the eyg you installed> --help 2>&1 | grep -c -- --policy
```

`0` means every call will be refused: the binary has no flag to carry a policy, so the run
would have no checks in it, and this package will not start one. The binary it starts is
`eyg` on your `PATH` or, if you set it, `EYG_CODEMODE_RUNNER` holding an absolute path -
two places and no third (`guides/how-to-point-the-tool-at-your-runner.md`).

Neither official install route carries the flag today: not the published release
(`docs/world/entities/gap.runner-release-lacks-policy.md` has the command that re-checks it)
nor a build of the published default branch
(`docs/world/entities/gap.policy-runner-not-on-main.md`), so expect the refusal in the last
section rather than a run. Two ways forward:

- ask the language repository which ref carries `run --policy`, build that ref from source (the
  second install link), then `export EYG_CODEMODE_RUNNER=<absolute path to that binary>`;
- or read this package as documentation, and treat a refusal for every call as the honest
  state of the release rather than a bug to chase.

## Ask what the policy allows

Call the tool with `action: "effects"` and no program. You get one row per effect, as
`effect | policy field | decision`, plus a header naming the policy that answered, where
it came from, and the roots in force. The decisions are `available`, `refused`,
`unavailable` (the runtime does not implement it) and `unknown` with a reason: `Env`,
`Exit` and `StandardIn` are reported `unknown` because probing them would read your
environment, stop the probe, or swallow the runner's input.

Under the policy this package ships, `policies/agent-roots.eyg`, the answers you want are:
file effects `available` inside the session directory, `refused` outside it, `fetch`
refused everywhere, and `DecodeJSON`, `EYGParse`, `Hash`, `Sign` shown with `none` as their
field because no policy can forbid them.

## Read a file, and print what you got

`ReadFile` hands back `Binary`, and printing needs a `String`, so both fallibilities show
up. This program is the shape, and it type-checks (`eyg check` on it answers `{}`):

```eyg
match perform ReadFile({path: "/abs/path/to/a/file", offset: 0, limit: 500}) {
  Ok(bytes) -> {
    match !string_from_binary(bytes) {
      Ok(text) -> { perform StandardOut(text) }
      Error(_) -> { perform StandardOut("not valid utf-8") }
    }
  }
  Error(why) -> { perform StandardOut(why) }
}
```

The collapsed row shows `performs: ReadFile, StandardOut` and the first four lines of your
program. The result row starts with the first line your program printed, then
`(N output lines)` and the wall time. Read a slice, not a whole file: `offset` and `limit`
are bytes, and a read costs the runner process, not the model's window.

## Write outside the roots, and read the refusal

```eyg
let written = perform WriteFile({path: "/tmp/outside-the-roots/proof.txt", contents: !string_to_binary("nope")})
match written {
  Ok(_) -> { perform StandardOut("written: the roots were wider than expected") }
  Error(why) -> { perform StandardOut(why) }
}
```

You should see one line that names the effect and the path - `write_file denied by policy:
/tmp/outside-the-roots/proof.txt` - and a status line that is that printed line, not a
crash. Nothing exists at that path. Bind `written` and use it: a refusal is a value, and
`let _ = perform WriteFile(...)` throws the refusal away, which makes a failed write look
like a success.

## If every call is refused

A binary with no `--policy` flag reads the mode word as a file name, so your program never
runs and the row ends with one line:

```
the eyg binary this tool started did not understand `run --policy <module.eyg>` and read `run` as a file name, so no policy ran and nothing was performed: the install predates the flag this package needs, so install a newer release of the EYG CLI or name a binary that accepts the flag with EYG_CODEMODE_RUNNER=<absolute path>.
```

That is what a fresh session answers with, and
`docs/world/entities/cli.runner-official-install-only.md` keeps the run that showed it. A
missing binary rather than an old one answers `no eyg binary found at <where the tool looked>`.

Work down that message: set `EYG_CODEMODE_RUNNER` to a binary that carries the flag, and
re-run step 2. If the policy is the wrong one rather than missing, set
`EYG_POLICY` to an absolute module path or pass the `policy` argument; a relative path is
refused. To see which policy, runner and roots answered, expand the row (`Ctrl+O`), whose
last line reads `policy: <path> (<source>) runner: <path> roots: <path>`.

## What to read next

- `guides/eyg-surface.tsv` - one row per effect with the policy field that decides it; <https://eyg.run/guides/cli-effects-reference> adds the argument type.
- `guides/how-to-write-a-policy.md` - a session that works somewhere else, or that may
  reach the network.
- `guides/how-to-point-the-tool-at-your-runner.md` - a CLI you built yourself.
- `docs/world/decisions/ADR-004-doc-shape-for-two-readers.md` - why the docs are cut the way
  they are.
