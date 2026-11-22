---
name: eyg-run
description: Run, evaluate, script and type-check EYG with the CLI, and build the CLI itself. Use when you need to execute EYG, or when a command involving `eyg` fails.
verified: 2026-11-22
---

# Running EYG

The CLI's own reference is upstream at <https://eyg.run/guides>. The surface this package
ships is one generated file, `guides/eyg-surface.tsv`: a builtin row per name, an effect
row per name with the policy field that decides it. Read that rather than guessing, and
`node bin/agent/gen-surface.mjs --check` says whether it is still true.

## Which execute command
| Need | Do |
|---|---|
| Production script with args and an exit code | `eyg script <file>.eyg` |
| One-liner with side effects | `eyg run -c '<code>'` |
| Pure expression, want the value printed | `eyg eval -c '<code>'` |
| Type check without running | `eyg check <file>.eyg` |
| See the IR | `eyg parse <file>.eyg` (JSON to stdout) |
| Type check this package's modules | `for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done` |

`eval` is pure: it does not run effects. `script` returns the `Int` from the
`script` field as the exit code, so a script file must expose
`{script: (List(String)) -> Int, ..}`.

## Other subcommands
`compile` (to JavaScript), `share`, `fetch <cid>`, `publish <pkg> <file>`,
`signatory initial|list|show`, `tui`, `overlay <file>`, `version`.

## Environment
- Hub commands (`share`, `publish`, `signatory`) belong to the language repository;
  nothing in this package reaches a hub.

## Two traps this repo has already burned people on
- `eyg shell` is not a shell. It is the REPL, configured by a module - the
  `shell:` field of a record. EYG still has no effect that runs shell commands.
- `.env.eyg` files hold credentials. Do not read, print, commit or paste them.
  `policies/agent-roots.eyg` and `policies/deny-all.eyg` deny reading them by design;
  keep that invariant intact.

## What a run here proves

The checks are a program this package ships (`host/guard.eyg`), so the installed CLI runs every
call and a runtime decision is re-runnable here with no build of the language and no special flag.
One command, a fifth of a second, writes the same entry, policy import and program module a tool
call writes and prints what the policy answered:

```sh
node bin/agent/refusal-probe.mjs
node bin/agent/refusal-probe.mjs --with-policy deny-all
node bin/agent/refusal-probe.mjs --with-policy spawner-effects --fields read_file,standard_out
node bin/agent/refusal-probe.mjs --program test/fixtures/unnamed-effect.eyg
```

`eyg check <file>.eyg` still type-checks a module without running one, which is all the audit's
`shipped EYG modules check` row needs. What the installed binary *is* - path, version - is a claim
with its own command in `docs/world/entities/cli.prebuilt-binary.md`; this package builds nothing
and points at no private build.

## Prove the CLI answers

Costs are in `AGENTS.md`'s command table, dated where measured.

```sh
node --test 'test/*.mjs'
for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done
node pi-simple-world-model/bin/world_verify.mjs --all
```
