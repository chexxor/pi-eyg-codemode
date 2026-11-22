# Point the tool at a CLI you built or downloaded

The `eyg` tool starts one binary per call, and it asks that binary for one thing: run the
file it wrote. The checks are not inside the binary - they are in `host/guard.eyg`, which the
tool wraps around your program before the binary sees it - so any EYG CLI that runs a file
works, and this page is about which binary a call gets and how to prove it. Two steps and one
proof.

## Name the binary

```sh
export EYG_CODEMODE_RUNNER=<absolute path to the binary>
```

That is the whole contract. When the variable is set, that path is the binary. Without it,
the tool starts `eyg` on your `PATH`. There is no third place to park a binary: the package
reaches those two and nothing else (`docs/world/entities/cli.runner-official-install-only.md`).
A relative path is refused - the checks see absolute paths, and a relative name is resolved
before anything can decide it.

Nothing is asked of the binary before the run: no flag, no capability question, no probe of
its `--help`. The command line is `<binary> run <the file this package wrote>` (`eval` in
place of `run` for `action: "eval"`), and a binary that cannot answer that says so in its own
output, which the tool turns into one line. A binary that is not where it said it was:

```
spawn /nonexistent/eyg ENOENT
no eyg binary found at /nonexistent/eyg: install the EYG CLI so that `eyg` is on PATH, or name one with EYG_CODEMODE_RUNNER=<absolute path>.
```

A binary that takes the mode word as a file name rather than as a command (`EYG_CODEMODE_RUNNER`
pointed at a stub that prints `error: no such file: <cwd>/run`, so the sentence is not a
hypothetical):

```
the binary at <the path you named> has no `run` command, so it read `run` as a file name and ran nothing: `<the path you named> run /tmp/pi-eyg-codemode/2617833-mwsg7yjh-1/entry.eyg` is the command this package runs for every call. Install the EYG CLI (see <https://eyg.run/guides>), or name a binary that takes a file after the mode word with EYG_CODEMODE_RUNNER=<absolute path>.
```

## Prove this package found it

Make one call that asks a question rather than changing anything - `action: "effects"` answers
with one row per effect - and expand the row (`Ctrl+O`). Its last line reads
`policy: <path> (<source>) runner: <path> roots: <path>`: the runner named there is the proof,
and either line above is the counter-proof.

At the shell, this package's own probe is the same proof in one command, and it costs a fifth
of a second:

```sh
node bin/agent/refusal-probe.mjs
```

It writes the same entry and program module a tool call writes, under the system temporary
directory, runs `eyg run <that entry>` and prints the argv it used. Under
`policies/agent-roots.eyg` it prints `write_file denied by policy: <a path under the temporary
directory>` and leaves nothing behind. Add `--with-policy deny-all` for the narrowest policy, or
`--with-policy spawner-effects --fields read_file,standard_out` to see the child allowlist
refuse a write by name. `guides/how-to-write-a-policy.md` is where the decisions themselves are written.

## Not this

- getting a CLI in the first place: <https://eyg.run/guides/install-a-prebuilt-binary> and
  <https://eyg.run/guides/install-from-source>; this package carries no build of its own;
- changing what the policy allows once the binary runs: `guides/how-to-write-a-policy.md`;
- the language's install pages themselves, which this tree does not own
  (`docs/world/decisions/ADR-003-doc-delegation.md`).
