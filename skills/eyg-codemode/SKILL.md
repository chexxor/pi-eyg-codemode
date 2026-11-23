---
name: eyg-codemode
description: "Use when a session's side effects must go through EYG instead of bash or the built-in JavaScript codemode: the `eyg` tool is registered and a host policy module decides every effect. Trigger on the `eyg` tool, a policy module, EYG_ALLOWED_ROOTS, EYG_POLICY, the guard, or any attempt to reach a file, the network or a process. Not for editing this package's own source."
---

# EYG codemode: effects are the only channel to the outside world

An EYG program reaches the outside world only through effects, and the guard this package ships
(`host/guard.eyg`) puts a policy's rule in front of every one. For the effects whose reply carries
text a refusal is that reply's `Error` branch, so the program reads it and carries on.
Capability question first: `guides/eyg-surface.tsv` answers "can I perform this here" without
deriving it - one row per effect with the policy field that decides it, and `action: "effects"`
answers what the policy in force decides for each. Then the one-line smoke test `perform StandardOut("ok")`
shows the policy answering. The policies this package ships are written out in full in
`policies/agent-roots.eyg`, `policies/deny-all.eyg` and `policies/spawner-effects.eyg`, so authoring
another one means editing
one of those records, not reading a library somewhere else; the renderer, the timeout shape and
the registry scopes are in `README.md`, and the language's prose - syntax, effects, installation -
is at <https://eyg.run/guides>.

## Before writing EYG

`action: "reference"` prints the builtin names and the effect surface in one call without
performing an effect, and it reads `guides/eyg-surface.tsv`, which this package generates. Do not
try to read that file through an effect: the roots cover your working directory, not this package,
so `perform ReadFile` on a `guides/` path answers `read_file denied by policy`, and a grant is the
operator's to give, not yours to assume. The harness `read` tool is not decided by a policy, and the
language's prose is at <https://eyg.run/guides>. Guessing builtin names instead of asking costs
the session (`docs/world/entities/usability.without-language-skill.md`).

## Calling the tool

An effect is performed with `perform` and takes one argument record; copy this shape.

```eyg
let text = perform ReadFile({path: "/abs/file", offset: 0, limit: 2000})
let written = perform WriteFile({path: "/abs/file", contents: !string_to_binary("text")})
perform MakeDirectory("/abs/dir")
let names = perform ReadDirectory("/abs/dir")
perform StandardOut("text")
let result = perform WriteFile({path: "/abs/file", contents: !string_to_binary("text")})
match result { Error(why) -> { perform StandardOut(why) } Ok(_) -> { perform StandardOut("written") } }
```

A refused effect resumes the program with an `Error`, and `let _ = perform WriteFile(...)` throws that
answer away, so the call looks like success while nothing was written: bind a name you use and branch
on its value, as the last two lines above do.

- A program never handles an effect itself. The tool parses the code before it runs it and refuses a
  program that names a `handle` clause, with the labels it handled in the message: one call has one
  host for its effects, the guard, and a clause in the program answers the program instead of asking
  that host. Perform the effect and match its answer; changing what is decided is a grant, which is
  the operator's to give.

- `match` arms: the first arm takes no leading `|`, an arm after it takes none either, and the only arm
  that carries a `|` is the **catch-all**, written `| (name) -> { ... }`. `_ -> { ... }` is not a
  pattern, and a constructor arm written `| Error(_) -> { ... }` fails with `unexpected ->` at the
  arrow, which reads like a broken arm rather than a stray pipe. A program must end with an
  expression: a trailing `let` is a parse error in the file this tool writes, and the error names
  that file rather than your program.

- `action` selects what the call does: `run` (default, effects allowed by the policy), `eval` (pure,
  prints the value), `effects` (what the policy in force decides, one probe per effect - pass
  `code: ""`), `reference` (every builtin with its signature, plus the effect surface and the field
  that decides each effect - pass `code: ""`, performs nothing), `list_functions` (the registry of
  re-usable functions - pass `code: ""`) or `describe_function` (one of them by `function: "<name>"`).
- never guess a builtin name: `action: "reference"` prints all of them with their signatures in one
  call that performs nothing, and a run that named one answers `builtin undefined: !name` with rows
  naming `guides/eyg-surface.tsv`. pi's own `read` tool is not decided by a policy, so a session that has
  it can open that file directly; `ReadFile` reaches only the roots, and asking for a grant over this
  package's own files is rarely the right ask.
- `timeout` is in SECONDS as the bash tool spells it: `timeout: 90` is ninety seconds, default 30, at
  most 120. A run that hits it reports elapsed wall time rather than hanging.
- `code` is EYG source and the last expression is the value. In `run` mode nothing is printed unless the
  program performs `StandardOut`, so a refusal left as the trailing value is invisible. A performed effect
  that is not the last expression must be bound (`let _ = perform ...`) or the program does not parse.
- with no `policy` argument the tool uses the policy it ships over the session working directory, and a
  call is never unchecked. Prefer absolute paths: the guard resolves a relative one against the call's
  working directory before the rule sees it, and a path outside the roots is refused, not truncated.
- under the agent policy `Env` is refused and answers `None({})`: a token belongs in the policy module,
  which may read the environment, never in the program.
- every result says how long the run took (`ran in 1.24 s wall`, `timed out after 2 s in 2.01 s wall`);
  quote that wall time rather than estimating a cost.

## Reading the result

A line such as `write_file denied by policy: /abs/path` is a fact about one path, not a crash and not a
report to the operator: this session has no other channel and a program cannot change the policy from
inside, so keep solving inside what the policy allows - another path, another effect, a shipped library, a
narrower question - and do not stop to announce a refusal that does not block the task. Ask the operator
for a grant only when the refusal blocks the task and the other routes are spent; the ask names the exact
addition (the policy field, the path or root, the duration: one tool call, N calls, or the rest of the
session, through `/eyg-grant`), why the task cannot proceed without it, and what it would be used for - the
refusal rows print that template. A refused effect left nothing on disk, so after a program continues past
one check the evidence with a later `ReadFile` or `ReadDirectory`. Four effects answer a refusal another
way, because their replies have nowhere to put one - `perform Now()`, `Random()`, `Flip()` and
`Exit(code)` end the run with `Aborted with reason: <the policy's reason>` instead of resuming it. And a
program whose `standard_out` rule refuses cannot report anything: under `policies/spawner-effects.eyg`
with an allowlist that omits `standard_out`, a refusal of a write prints no reason at all.

## Re-usable functions

Before writing a helper, call `action: "list_functions"` - the function you need may already exist, with a
signature, a description and its required effects. A function-set is one `.eyg` module carrying
`let metadata = {name, description, signature, effects}`, read from `<cwd>/.pi/eyg-functions` (this workspace, the
default), then `$HOME/.pi/eyg-functions` (every workspace on this machine), then the package's `libraries/`;
first match wins and a shadowed module is reported. The tool never writes those scopes - author a module
with ordinary effects. Bind it with `libraries: ["<name>"]` and call `<name>_lib.<function>`.

The required effects are **advisory**: re-probed at every listing against the policy then in force, and a run
whose effect is refused is not blocked - the refusal surfaces as the ordinary `Error("<field> denied by
policy: ...")` value inside the program, so `available` is never permission to read a path.

## Keeping a binding between calls

A name this call defines is not in scope on the next one. `extern: "session"`, `"workspace"` or
`"user"` keeps this call's top-level `let` bindings, and the next call sees each name with no
`libraries` argument. What is kept is the binding's **source text**, so the call that uses the name
evaluates it again rather than reading a stored value. A binding name is lower snake_case
(`my_web_search`, not `myWebSearch`), and a file scope is kept by a program this tool runs, which
performs `MakeDirectory` and `WriteFile` under the policy in force - so that write is refused like
any other, and the refusal comes with the grant rows. Kept bindings live in `.pi/eyg-variables/`,
never in a registry scope; `guides/how-to-keep-bindings.md` is the how-to, including the shapes this
package refuses to keep rather than writing a module that would not work.

## Finding files

`perform Search({path: "/abs/root", pattern: "**/*.eyg", limit: 20})` is one host action that answers absolute
paths, or `Error("search denied by policy: /abs/root")` when the policy's `search` rule refuses the walk -
it has a field of its own, which `guides/eyg-surface.tsv` records, so a session that may read files need
not be allowed to search them. Matching and `limit` semantics are in the `Search` section of
<https://eyg.run/guides/cli-effects-reference>.

A search reports **names**, including the name of a path a read of would be refused for, so a listed path is
not permission to read it and contents never come through. Without the `Search` effect, pass `libraries:
["search"]` and call `search_lib.search({root, pattern, limit})`: the same policy, one decision per directory.

## Delegating a chunk of work

`eyg_subagent` starts one pi session in the same directory. It performs its effects through a policy
module like you do, and returns its final message, one row per call and every refusal it got. Three
knobs, each checked against what this session already has: `tools` (`eyg`, or `eyg` plus pi's `read`
tool - never a tool you do not have yourself), `effects` (an allowlist of effects, enforced by the
shipped narrowing policy `policies/spawner-effects.eyg`; it removes reach and cannot add it, so `Fetch`
is not in it), and `max_calls` (how many `eyg` calls the child may make before it is told to report what
it has). It can be given a policy this package ships and roots **inside** the roots you have, and
nothing wider: no root you lack, no module you wrote, no grant this session holds, and a session that is
itself a subagent gets no children. Use it for work you can state completely in `task`; do not use it to get
past a refusal. Hand the child programs to paste rather than a description of them - a child left to
invent EYG spends its budget on syntax errors and reports its own mistakes instead of your boundary
(`docs/world/entities/pi.subagent-spawn.md`). `guides/how-to-spawn-a-subagent.md` is the how-to.
