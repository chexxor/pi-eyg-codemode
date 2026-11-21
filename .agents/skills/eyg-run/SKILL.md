---
name: eyg-run
description: Run, evaluate, script and type-check EYG with the CLI, and build the CLI itself. Use when you need to execute EYG, or when a command involving `eyg` fails.
verified: 2026-11-21
---

# Running EYG

The CLI's own reference lives in the language repository, which this tree does not
read; the effect surface this package documents is here, in
`guides/cli_effects_reference.md`. Read that rather than guessing at effects.

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
Measured 2026-11-18 and again 2026-11-21: `command -v eyg` answers `$HOME/.local/bin/eyg`, and
`eyg --version` answers `eyg v0.1.0`. That build's help has no `--policy`
(`grep -c -- '--policy' <<< "$(eyg --help 2>&1)"` prints `0`), so from
this workspace the CLI **type-checks** (`eyg check <file>.eyg`) but **cannot check a run**. A run
with checks in force needs a CLI that accepts `--policy`; this package probes `eyg` on `PATH` and
`EYG_CODEMODE_RUNNER`, builds nothing itself, and points at no private build, so an effect-level
result claimed from this tree is UNVERIFIED, never PASS.

## Prove it

Costs are in `AGENTS.md`'s command table, dated where measured.

```sh
node --test 'test/*.mjs'
for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done
node pi-simple-world-model/bin/world_verify.mjs --all
```
