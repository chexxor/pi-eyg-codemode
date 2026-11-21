# Write a policy preset of your own

You want a session that works in a different directory, reads without writing, or reaches
one named host. A preset is one record, one rule per effect the CLI answers for, and the tool
reads it before your program runs.

The steps are:

1. [Learn what one record covers](#learn-what-one-record-covers)
2. [Copy the shipped preset closest to what you need](#copy-the-shipped-preset-closest-to-what-you-need)
3. [Change the rules you need](#change-the-rules-you-need)
4. [Check the module and point the tool at it](#check-the-module-and-point-the-tool-at-it)
5. [Prove the preset answered](#prove-the-preset-answered)

## Which preset a call gets

| in order | where it comes from |
| --- | --- |
| 1 | the `policy` argument of this call, which may only name a preset this package ships - it narrows a call and cannot widen one |
| 2 | a grant the operator made in this session with `/eyg-grant`, for one tool call, N calls or the rest of the session |
| 3 | the policy the spawner of a subagent session named (`EYG_SUBAGENT_POLICY`), read only when `EYG_CODEMODE_DEPTH` says this package started the process - so a spawner can narrow a child in a project that names its own preset |
| 4 | `eyg.policy` in `.pi/settings.json` - a preset shipped in this package (`agent-roots`, `deny-all`, `spawner-effects`) or an absolute path to a module of your own |
| 5 | `EYG_POLICY`, the environment variable of the pi process |
| 6 | `policies/agent-roots.eyg`, the preset in the package, which is what you get if you set nothing |
| if none exists | the tool refuses to run anything rather than run unchecked |

A grant is the operator answering a refusal, so the widening is a human act: the tool has no
parameter through which a program could choose a wider module, and the grant's own record is a
session entry (`pi.appendEntry`) that the branch replays. `/eyg-grant` asks for the preset or
module path, the roots to add to the ones the preset reads, and the duration; typed with its
arguments (`/eyg-grant agent-roots 3 roots=/tmp`) it asks only for the confirmation, and
`/eyg-grant revoke` ends one early. `docs/world/entities/pi.session-grants.md` carries what one
sequence did, and `notes/pi-codemode-session-grants.md` why it sits on the operator's side.

The project file is the per-project knob, and it is the one to use: a session started in
this directory gets this directory's policy. The same key names the roots:

```json
"eyg": { "policy": "agent-roots", "roots": ["<absolute path>", "<another absolute path>"] }
```

Roots are absolute paths and are tried in their own order - the roots a spawner narrowed the
session to, then the project key, then `EYG_ALLOWED_ROOTS`, then the directory pi was started
in, plus any root a grant in force
adds - and a relative entry stops the
call with `every eyg.roots entry must be an absolute path, got <entry>` rather than
silently matching nothing. A preset name that is not one of the package's, or a roots entry
of the wrong shape, is refused the same way, naming the key. pi reads the settings file when
it starts, so a changed file takes effect in the next session; the tool re-reads the two
keys on every call (`extensions/eyg-codemode.ts`, in `execute`). Measured 2026-11-20: a
project file naming `deny-all` and one root produced `deny-all.eyg (project settings)` in
the probe header, a write inside that root refused, and 16 probes in 0.94 s - through a
development build of the language CLI this tree no longer has; reading those two keys is pinned
by `node --test` regardless.

## Learn what one record covers

The record names 18 fields, and 19 effects share them: a `Search` is decided under the
`read_file` field, so one rule covers a whole walk. `guides/cli_effects_reference.md` lists
each effect with its field and the type a rule must return. Four effects have no field at
all, because they are deterministic over the values they were given: `DecodeJSON`,
`EYGParse`, `Hash` and `Sign`. No preset refuses them, so a plan that depends on forbidding
one is a plan that cannot be built with a preset.

A rule is a function of the effect's value. Three shapes cover the whole record:

```eyg
let pass_through = (value) -> { Pass(value) }
let refuse = (reason) -> { (_) -> { Mock(Error(reason)) } }
{ now: pass_through, fetch: refuse("fetch denied by policy") }
```

`Pass(value)` performs the effect with that value, and `Pass` of a different value rewrites
a request the program never asked for. `Mock(x)` answers `x` without touching the host, so
`x` is in the shape the effect returns; that is why the shipped `deny-all.eyg` writes
`Mock(Error({}))` for `cwd` and `Mock(None({}))` for `env` while it refuses the other
effects with a message. A rule may read the value before it decides, which is what a path
check and a host check are.

## Copy the shipped preset closest to what you need

| preset | what it allows |
| --- | --- |
| `policies/agent-roots.eyg` | file effects under the roots named in `EYG_ALLOWED_ROOTS`; `CWD`, `Now`, `Random`, `Sleep`, `Flip`, `StandardOut`, `StandardError`, `Exit` performed; `Fetch`, `StandardIn`, `CreateKey` refused; `Env` answered as unset; a path ending `.env.eyg` never readable, even under a root |
| `policies/deny-all.eyg` | values and output only; every file, network and environment effect refused |
| `policies/spawner-effects.eyg` | the agent-roots rules, but only for the fields named in `EYG_SUBAGENT_EFFECTS`; unset names nothing and refuses every gateable effect. `eyg_subagent` installs it for a child session whose spawner named `effects`, and an allowlist there cannot add reach (`docs/world/entities/pi.spawner-preset.md`) |

Copy one to a file of your own and change what you need. The comment above each shipped
rule names why it decides what it does, and none of them imports anything, so each is
readable in full where it is used; `notes/pi-codemode-preset-inlining.md` records why the
presets are written out rather than imported.

## Change the rules you need

Allow one host:

```eyg
let one_host = (request) -> {
  match !equal(request.host, "api.github.com") {
    True(_) -> { Pass(request) }
    False(_) -> { Mock(Error("fetch denied by policy")) }
  }
}
```

The `Fetch` value is a record with `method`, `scheme`, `host`, `port`, `path`, `query`,
`headers` and `body`, so a rule reads `request.host`. To attach a token, `Pass` a rebuilt
request: a record update overwrites only fields that already exist (`guides/syntax.md`), so
a rewritten request lists every field. A token belongs in the policy module rather than in
the program, because the module is authored on the host: its own `perform Env("...")` runs
at the top of the module, outside the checks your program is under, while the program's
`Env` answers whatever the `env` rule says.

Move the roots instead of the rules when the session is simply in the wrong place.
`EYG_ALLOWED_ROOTS` is a comma separated list of absolute paths with no spaces; unset or
empty names no roots, which refuses every file effect. When you name nothing the tool
passes the session working directory, so a preset whose roots are wrong reads as a wall of
refusals rather than as a broken module.

## Check the module and point the tool at it

Type-check it before a session runs it:

```sh
eyg check <absolute path to your module>
```

An exit code of 0 means the module parses and type-checks; the two shipped presets answer 0
and the snippets on this page answer 0 (`eyg check` exit codes measured 2026-11-19). The
check reads the module as an expression, so it does not ask for all 18 fields - a record of
one field passes - and it runs nothing.

Then choose it for the session:

```sh
export EYG_POLICY=<absolute path to your module>
```

or pass `policy` on the call. The tool takes the argument, then `EYG_POLICY`, then this
package's own preset, and it refuses rather than running a program unchecked: a relative
path answers `policy must be an absolute path, got <policy>` and a path with no file
answers `policy module not found: <policy>`.

## Prove the preset answered

Call `action: "effects"` and read the rows, `effect | policy field | decision`, whose header
names the policy that answered and where it came from. Or expand any row (`Ctrl+O`); its
last line reads `policy: <path> (<source>) runner: <path> roots: <path>`, and `<source>`
says `argument`, `EYG_POLICY` or `package default`. A decision that is not the one you
wrote means the module the tool read is not the module you edited, and that line names
which one it read.

## Not this

- This page does not build a CLI. `guides/how-to-point-the-tool-at-your-runner.md` points the
  tool at a binary you built or downloaded, and <https://eyg.run/guides/install-from-source>
  builds one.
- The language keeps a wider preset library than the two this package ships, and it is not
  installed with this package, so the preset you need is a module you write here.
- What a preset allows at run time is checkable, not something to take on faith: run one call
  through a `--policy` runner and read what comes back. No officially installed build is such a
  runner yet (`docs/world/entities/gap.runner-release-lacks-policy.md`), so on a machine that
  installed only the release no call runs at all. The numbers this tree recorded on 2026-11-20
  came from a development build of the language CLI it no longer has
  (`docs/world/entities/cli.checked-runner-on-this-host.md`, superseded). `AGENTS.md` names the
  probe and its result.
