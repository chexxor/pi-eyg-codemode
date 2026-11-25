# First session: perform one effect, and read one refusal

You installed this package and want proof it does what it claims, in the smallest
steps. Six of them, each with what you should see. If you only want the answer to
"why did my call never run", go to step 3 and the last section.

The steps are:

1. [Install the CLI](#install-the-cli)
2. [Start a project that loads this package](#start-a-project-that-loads-this-package)
3. [Check that the tool can start it](#check-that-the-tool-can-start-it)
3. [Ask what the policy allows](#ask-what-the-policy-allows)
4. [Read a file, and print what you got](#read-a-file-and-print-what-you-got)
5. [Write outside the roots, and read the refusal](#write-outside-the-roots-and-read-the-refusal)

## Install the CLI

This package does not carry a CLI. Get one from the EYG website:
<https://eyg.run/guides/install-a-prebuilt-binary> or
<https://eyg.run/guides/install-from-source>. The website's own verify step is

```sh
eyg eval -c '!int_add(1, 1)'
```

and it prints `2`. That proves the binary runs; it does not prove this package can use
it, which is step 3.

## Start a project that loads this package

Run the first session somewhere that is not the package's own tree, so what it writes cannot
land in the files you are reading. One script writes the one file a project needs:

```sh
node bin/agent/new-project.mjs /tmp/try-eyg
```

It writes `/tmp/try-eyg/.pi/settings.json`, which declares this package by absolute path and
drops pi's built-in coding tool, so the session has exactly one coding tool - this package's
`eyg`. The script prints what it wrote and the command that starts the session, and it refuses
a relative directory or a project that already has a `.pi/settings.json`, because that file
belongs to a project someone already configured. The check that the declaration resolves:

```sh
cd /tmp/try-eyg && pi list --approve
```

That names the package under `Project packages:`, twice - the declaration and the path it
resolved to. `--approve` is there because pi reads a project's `.pi` files only after project
trust: on a directory whose trust was never granted, plain `pi list` answers with no
`Project packages:` section at all, which looks like a project that declares nothing. A session
started in the new directory asks for trust instead, and answering it once is enough.

A directory with no such file declares no package, so the tool is not there to call - the
declaration above is the whole difference.

## Check that the tool can start it

The tool asks the binary for one thing: run the file it wrote. So the check is whether the
binary is where the tool looks - `command -v eyg`, or the absolute path in
`EYG_CODEMODE_RUNNER` - and whether one guarded program runs. The second half is one command,
in this package, and it costs a fifth of a second:

```sh
node bin/agent/refusal-probe.mjs
```

It prints the `eyg run <file>` it started, the policy and roots it handed the checks, and the
refusal: `write_file denied by policy: <a path under the temporary directory>`. A binary that
is missing, or that reads the mode word as a file name, answers with one line naming the
install instead - both are quoted in `guides/how-to-point-the-tool-at-your-runner.md`.

## Ask what the policy allows

Call the tool with `action: "effects"` and no program. You get one row per effect, as
`effect | policy field | decision`, plus a header naming the policy that answered, where
it came from, and the roots in force. The decisions are `allowed for the probe value`,
`refused by the policy in force`, `not implemented by this runner` and `unknown` with a
reason: `Env`, `Exit` and `StandardIn` are `unknown` because probing them would read your
environment, stop the probe, or swallow the runner's input, and `CWD`, `Sleep`,
`StandardOut` and `StandardError` because the guard answers a refusal of them with the same
value a pass is, so no probe could tell them apart.

Under the policy this package ships, `policies/agent-roots.eyg`, the answers you want are:
file effects `allowed` inside the session directory, `refused` outside it, `fetch` and
`create_key` refused everywhere, and `DecodeJSON`, `EYGParse`, `Hash`, `Sign` shown with
`none` as their field because no policy can forbid them.

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

## If a call never runs

A binary that does not take a file after the mode word reads the mode word as a file name,
so your program never runs and the row ends with one line:

```
the binary at <the path you named> has no `run` command, so it read `run` as a file name and ran nothing: `<the path you named> run /tmp/pi-eyg-codemode/2617833-mwsg7yjh-1/entry.eyg` is the command this package runs for every call. Install the EYG CLI (see <https://eyg.run/guides>), or name a binary that takes a file after the mode word with EYG_CODEMODE_RUNNER=<absolute path>.
```

That is what a fresh session answers with, and the run that produced it is recorded in
`guides/how-to-point-the-tool-at-your-runner.md`. A missing binary rather than an
unreadable one answers `no eyg binary found at <where the tool looked>`.

Work down that message: name a binary that takes a file with `EYG_CODEMODE_RUNNER`, and
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
