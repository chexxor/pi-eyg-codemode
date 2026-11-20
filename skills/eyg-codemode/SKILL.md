---
name: eyg-codemode
description: "Use when a session's side effects must go through EYG instead of bash or the built-in JavaScript codemode: the `eyg` tool is registered and a host policy module decides every effect. Trigger on the `eyg` tool, a policy module, EYG_ALLOWED_ROOTS, EYG_POLICY, `--policy`, or any attempt to reach a file, the network or a process. Not for editing this package's own source."
---

# EYG codemode: effects are the only channel to the outside world

An EYG program reaches the outside world only through effects; a host policy decides each.
Capability question first: `guides/cli_effects_reference.md` opens with `Every effect at a glance`,
one row per effect with the policy field it sits under and what that field allows - that answers "can I
perform this here" without deriving it. Then the one-line smoke test `perform StandardOut("ok")`
shows the policy answering. The presets this package ships are written out in full in
`policies/agent-roots.eyg` and `policies/deny-all.eyg`, so authoring another one means editing
one of those records, not reading a library somewhere else; the renderer, the timeout shape and
the registry scopes are in `README.md`, presets and security in `guides/pi_codemode_agent.md`,
surface syntax in `guides/syntax.md`.

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

- `action` selects what the call does: `run` (default, effects allowed by the policy), `eval` (pure,
  prints the value), `list_functions` (the registry of re-usable functions - pass `code: ""`) or
  `describe_function` (one of them by `function: "<name>"`).
- `timeout` is in SECONDS as the bash tool spells it: `timeout: 90` is ninety seconds, default 30, at
  most 120. A run that hits it reports elapsed wall time rather than hanging.
- `code` is EYG source and the last expression is the value. In `run` mode nothing is printed unless the
  program performs `StandardOut`, so a refusal left as the trailing value is invisible. A performed effect
  that is not the last expression must be bound (`let _ = perform ...`) or the program does not parse.
- with no `policy` argument the tool uses the preset it ships over the session working directory, and a
  call is never unchecked. Paths must be absolute - the runner resolves a relative path before the policy
  sees it - and a path outside the roots is refused, not truncated.
- under the agent preset `Env` is refused and answers `None({})`: a token belongs in the policy module,
  which may read the environment, never in the program.
- every result says how long the run took (`ran in 1.24 s wall`, `timed out after 2 s in 2.01 s wall`);
  quote that wall time rather than estimating a cost.

## Reading the result

A line such as `write_file denied by policy: /abs/path` is a fact about the permission, not a crash: this
session has no other channel and a program cannot change the policy from inside, so report the refusal or
change what the program asks for. A refused effect left nothing on disk, so after a program continues past
one check the evidence with a later `ReadFile` or `ReadDirectory`.

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

## Finding files

`perform Search({path: "/abs/root", pattern: "**/*.eyg", limit: 20})` is one host action that answers absolute
paths, or `Error("read_file denied by policy: /abs/root")` when the roots do not cover it - the policy decides
the whole walk under its `read_file` rule; matching and `limit` semantics are in the `Search` section of
`guides/cli_effects_reference.md`.

A search reports **names**, including the name of a path a read of would be refused for, so a listed path is
not permission to read it and contents never come through. Without the `Search` effect, pass `libraries:
["search"]` and call `search_lib.search({root, pattern, limit})`: the same policy, one decision per directory.

## Delegating a chunk of work

`eyg_subagent` starts one pi session in the same directory with only the `eyg` tool: it performs its
effects through a policy module like you do, and returns its final message, one row per call and every
refusal it got. It can be given a preset this package ships and roots **inside** the roots you have, and
nothing wider: no root you lack, no module you wrote, no grant this session holds, and a session that is
itself a subagent gets no children. Use it for work you can state completely in `task`; do not use it to get
past a refusal. `guides/how-to-spawn-a-subagent.md` is the how-to.
