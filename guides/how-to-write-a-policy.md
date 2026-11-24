# Write a policy of your own

You want a session that works in a different directory, reads without writing, or reaches
one named host. `README.md` defines what a policy is; this page writes one handler, registers
it, and points the tool at the file.

The steps are:

1. [Learn what one record covers](#learn-what-one-record-covers)
2. [Copy the shipped policy closest to what you need](#copy-the-shipped-policy-closest-to-what-you-need)
3. [Change the handlers you need](#change-the-rules-you-need)
4. [Check the module and point the tool at it](#check-the-module-and-point-the-tool-at-it)
5. [Prove the policy answered](#prove-the-policy-answered)

## Which policy a call gets

| in order | where it comes from |
| --- | --- |
| 1 | the `policy` argument of this call, honoured only when it names the policy a lower row already chose or the narrowest policy this package ships (`deny-all`), so it can only narrow; any other name is refused and the refusal names the name it refused |
| 2 | a grant the operator made in this session with `/eyg-grant`, for one tool call, N calls or the rest of the session |
| 3 | the policy the spawner of a subagent session named (`EYG_SUBAGENT_POLICY`), read only when `EYG_CODEMODE_DEPTH` says this package started the process - so a spawner can narrow a child in a project that names its own policy |
| 4 | `eyg.policy` in `.pi/settings.json` - a policy shipped in this package (`agent-roots`, `deny-all`, `spawner-effects`) or an absolute path to a module of your own |
| 5 | `EYG_POLICY`, the environment variable of the pi process |
| 6 | `policies/agent-roots.eyg`, the policy in the package, which is what you get if you set nothing |
| if none exists | the tool refuses to run anything rather than run unchecked |

A grant is the operator answering a refusal, so the widening is a human act: the tool has no
parameter through which a program could choose a wider module, and the grant's own record is a
session entry (`pi.appendEntry`) that the branch replays. The ask a grant answers comes from a
session that has spent its routes inside the policy, and it names the addition, the reason for it
and the intended use (`guides/what-a-call-does.md`). `/eyg-grant` asks for the policy or
module path, the roots to add to the ones the policy reads, and the duration; typed with its
arguments (`/eyg-grant agent-roots 3 roots=/tmp`) it asks only for the confirmation, `/eyg-grant
status` answers what is in force without starting a grant, and `/eyg-grant revoke` ends one early.
`docs/world/entities/pi.session-grants.md` carries what one
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
silently matching nothing. A policy name that is not one of the package's, or a roots entry
of the wrong shape, is refused the same way, naming the key. pi reads the settings file when
it starts, so a changed file takes effect in the next session; the tool re-reads the two
keys on every call (`extensions/eyg-codemode.ts`, in `execute`), which `node --test
'test/*.mjs'` pins. `docs/world/entities/pi.policy-config.md` carries a session started in a
project that named `deny-all` and one root, with what it refused and what it cost.

## Learn what one record covers

The record names one field per effect the guard names: 19 fields for the 19 effects a policy
can forbid, and `Search` has its own `search` field, so naming `read_file` lets a session read
files without letting it walk a tree - `guides/eyg-surface.tsv` carries that table as data.
<https://eyg.run/guides/cli-effects-reference> lists each effect with its value. Four effects
have no field at all, because they are deterministic over the values they were given:
`DecodeJSON`, `EYGParse`, `Hash` and `Sign`. No policy refuses them, so a plan that depends on
forbidding one is a plan that cannot be built with a policy.

A rule is a function of the effect's value. Three shapes cover the whole record:

```eyg
let pass_through = (value) -> { Pass(value) }
let refuse = (reason) -> { (_) -> { Mock(reason) } }
{ now: pass_through, fetch: refuse("fetch denied by policy") }
```

`Pass(value)` performs the effect with that value, and `Pass` of a different value rewrites
a request the program never asked for. `Mock(reason)` performs nothing and answers the program
with `reason` - one string, the text the program reads. The guard puts it into the shape the
effect returns, which is why one word covers all of them: a file effect gets an `Error` whose
text names the field and the path, `env` gets `None({})`, an output effect gets the unit, and
`Now`, `Random`, `Flip` and `Exit` end the program with the reason. A rule may read the value
before it decides, which is what a path check and a host check are.

## Copy the shipped policy closest to what you need

| policy | what it allows |
| --- | --- |
| `policies/agent-roots.eyg` | file effects under the roots the call was given; `CWD`, `Now`, `Random`, `Sleep`, `Flip`, `StandardOut`, `StandardError`, `Exit` performed; `Fetch`, `StandardIn`, `CreateKey` refused; `Env` answered as unset; a path ending `.env.eyg` never readable, even under a root |
| `policies/deny-all.eyg` | values and output only; every file, network and environment effect refused |
| `policies/spawner-effects.eyg` | the agent-roots rules, but only for the fields named in `EYG_SUBAGENT_EFFECTS`; unset names nothing and refuses every gateable effect. `eyg_subagent` installs it for a child session whose spawner named `effects`, and an allowlist there cannot add reach (`docs/world/entities/pi.spawner-policy.md`) |

Copy one to a file of your own and change what you need. The comment above each shipped
rule names why it decides what it does, and none of them imports anything, so each is
readable in full where it is used; `notes/pi-codemode-policy-inlining.md` records why the
policies are written out rather than imported.

Copying is what the record forces rather than a style chosen here: a policy module cannot extend
the record the guard was built with, so changing one handler of a policy you did not write means
owning a copy of it. The one-line shape - `{ WebSearch: my_search } \ existing_policy`, register this
handler and keep the rest of that policy - is an ask against the language, not a feature of this
package: `notes/pi-eyg-codemode-policy-record-extension.md` carries what was rejected and why,
and `docs/world/entities/gap.policy-record-extension.md` carries the trigger that closes it.

## Change the handlers you need

Allow one host:

```eyg
let one_host = (request) -> {
  match !equal(request.host, "api.github.com") {
    True(_) -> { Pass(request) }
    False(_) -> { Mock("fetch denied by policy") }
  }
}
```

The `Fetch` value is a record with `method`, `scheme`, `host`, `port`, `path`, `query`,
`headers` and `body`, so a rule reads `request.host`.

A refusal is the reason as a plain String. What `Mock` answers an effect with is what that
effect's own reply type allows, and `Error("...")` is not a String: `eyg check` accepts it and
the run aborts instead of refusing.

To attach a token, `Pass` a rebuilt request: a record update overwrites only fields that already
exist (<https://eyg.run/guides/eyg-syntax-guide>), so a rewritten request lists every field -
`{headers: [...], ..request}` infers a record carrying only `headers`, and a rule you compose it
with that reads `request.host` answers `missing row 'host'`. Compose the token rule with a host
rule rather than with `pass`: an unwrapped one puts the header on every host the program asks
for. A token belongs in the policy module rather than in the program, because the module is
authored on the host: its own `perform Env("...")` runs at the top of the module, outside the
checks your program is under, while the program's `Env` answers whatever the `env` rule says.

Move the roots instead of the rules when the session is simply in the wrong place.
`eyg.roots` in `.pi/settings.json` is a list of absolute paths; `EYG_ALLOWED_ROOTS` is the same
list comma separated with no spaces, for a session started from a shell. When you name nothing
the tool passes the session working directory, so a policy whose roots are wrong reads as a wall
of refusals rather than as a broken module.

## Check the module and point the tool at it

Type-check it before a session runs it:

```sh
eyg check <absolute path to your module>
```

An exit code of 0 means the module parses and type-checks. The
check reads the module as an expression, so it does not ask for all 19 fields - a record of
one field passes - and it runs nothing. `docs/world/entities/cli.prebuilt-binary.md` carries
what the CLI installed here can and cannot do with a module, and the cost of checking the
shipped ones.

Then choose it for the session:

```sh
export EYG_POLICY=<absolute path to your module>
```

or pass `policy` on the call. The argument is honoured only when it names the policy the
session already runs under or the narrowest policy this package ships (`deny-all`), so it can
narrow a call and cannot widen one; the order of the other slots is the table at the top of
this page. The tool refuses rather than running a program unchecked: a relative
path answers `policy must be an absolute path, got <policy>` and a path with no file
answers `policy module not found: <policy>`.

## Prove the policy answered

Call `action: "effects"` and read the rows, `effect | policy field | decision`, whose header
names the policy that answered and where it came from. Or expand any row (`Ctrl+O`); its
last line reads `policy: <path> (<source>) runner: <path> roots: <path>`, and `<source>`
says which slot named it - `argument`, `session grant`, `spawner`, `project settings`,
`EYG_POLICY` or `package default`. A decision that is not the one you
wrote means the module the tool read is not the module you edited, and that line names
which one it read.

At the shell, one command runs a whole guarded program under the policy you name and prints
the argv it used, in a fifth of a second and with nothing written in this tree:

```sh
node bin/agent/refusal-probe.mjs --with-policy <name> --fields <field,field> --program test/fixtures/refusal-probe.eyg
```

`--inside-roots` moves the program's working directory inside the roots, which is what makes
`test/fixtures/secret-probe.eyg` a test of the `.env.eyg` rule rather than of the roots.

## Not this

- This page does not build a CLI. `guides/how-to-point-the-tool-at-your-runner.md` points the
  tool at a binary you built or downloaded, and <https://eyg.run/guides/install-from-source>
  builds one.
- The language keeps a wider policy library than the policies this package ships, and it is not
  installed with this package, so the policy you need is a module you write here.
- What a policy allows at run time is checkable, not something to take on faith: the probe
  above runs a program under the same guard a session runs under, and
  `docs/world/entities/overlay.policy-rules.md` carries what a rule can and cannot do.
