---
name: eyg-run
description: Run, evaluate, script and type-check EYG with the CLI, and build the CLI itself. Use when you need to execute EYG, or when a command involving `eyg` fails.
verified: 2026-11-21
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

## What the CLI on this host can and cannot do
Whether the CLI on `PATH` carries `--policy` decides what a session can prove from here:
without it the CLI **type-checks** (`eyg check <file>.eyg`) but **cannot check a run**. The
record `docs/world/entities/cli.prebuilt-binary.md` carries the current answer and the command
that re-checks it. This package probes `eyg` on `PATH` and `EYG_CODEMODE_RUNNER`, builds nothing
itself, and points at no private build, so an effect-level result claimed from this tree is
UNVERIFIED, never PASS.

## Prove the CLI answers

Costs are in `AGENTS.md`'s command table, dated where measured.

```sh
node --test 'test/*.mjs'
for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done
node pi-simple-world-model/bin/world_verify.mjs --all
```
