# First session: perform one effect, and read one refusal

You installed this package and want proof it does what it claims, in the smallest
steps. Five of them, each with what you should see. If you only want the answer to
"why is every call refused", go to step 2 and the last section.

The steps are:

1. [Install the CLI](#install-the-cli)
2. [Check that the CLI answers for an effect](#check-that-the-cli-answers-for-an-effect)
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

## Check that the CLI answers for an effect

Run the check the tool runs for you, so you see it fail rather than hear it fail:

```sh
<the eyg you installed> --help 2>&1 | grep -c -- --policy
```

`0` means this package refuses every call, because a runner that does not accept `--policy`
has no checks to answer with. The tool's candidates are `eyg` on your `PATH` and
`<the session directory>/packages/gleam_cli/dist/eyg`, and the first one whose `--help`
mentions the flag wins.

On 2026-11-19 the release the language repository publishes answers `0`
(`gleam_cli-v0.1.0`, read from its release feed that day),
so a reader who installed today should expect the refusal below, not a run. Two ways out:

- build the current CLI from source (the second install link), then
  `export EYG_CODEMODE_RUNNER=<absolute path to that binary>`;
- or read this package as documentation, and treat a refusal for every call as the honest
  state of the release rather than a bug to chase.

## Ask what the policy allows

Call the tool with `action: "effects"` and no program. You get one row per effect, as
`effect | policy field | decision`, plus a header naming the policy that answered, where
it came from, and the roots in force. The decisions are `available`, `refused`,
`unavailable` (the runtime does not implement it) and `unknown` with a reason: `Env`,
`Exit` and `StandardIn` are reported `unknown` because probing them would read your
environment, stop the probe, or swallow the runner's input.

Under the preset this package ships, `policies/agent-roots.eyg`, the answers you want are:
file effects `available` inside the session directory, `refused` outside it, `fetch`
refused everywhere, and `DecodeJSON`, `EYGParse`, `Hash`, `Sign` shown with `none` as their
field because no preset can forbid them.

## Read a file, and print what you got

`ReadFile` hands back `Binary`, and printing needs a `String`, so both fallibilities show
up. This program is the shape, and it type-checks (`eyg check` on it answered `{}` on
2026-11-19):

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

The call that finds no runner answers before your program runs:

```
no runner that accepts `--policy` was found among eyg, <session directory>/packages/gleam_cli/dist/eyg. Gating happens in the runner, so an older CLI cannot be used: build the current one (guides/install_from_source.md) or set EYG_CODEMODE_RUNNER to its absolute path.
```

Work down that message: set `EYG_CODEMODE_RUNNER` to a binary whose `--help` mentions the
flag, and re-run step 2. If the policy is the wrong one rather than missing, set
`EYG_POLICY` to an absolute module path or pass the `policy` argument; a relative path is
refused. To see which policy, runner and roots answered, expand the row (`Ctrl+O`), whose
last line reads `policy: <path> (<source>) runner: <path> roots: <path>`.

## What to read next

- `guides/cli_effects_reference.md` - every effect, its policy field and its argument type.
- `guides/how-to-write-another-preset.md` - a session that works somewhere else, or that may
  reach the network.
- `guides/how-to-point-the-tool-at-your-runner.md` - a CLI you built yourself.
- `docs/world/decisions/ADR-004-doc-shape-for-two-readers.md` - why the docs are cut the way
  they are.
