---
name: pi-codemode-handler-seam
description: Where an effect handler may be re-implemented for an operator's own tools (the policy rule, not the program), the Mock type obligation, plan-then-act staging, and what was rejected
date: 2026-11-18
---

The question an operator asks is "which effect handler is mine to rewrite" - EYG separates an
effect's description from its implementation (`guides/syntax.md:349`: "Scripts declare effects
they need; the runner decides what to do with them"), so there are four candidate seams and
only two of them are this package's.

**The seams, and who owns each.** The **policy rule** is this package's and is host-authored:
`extensions/eyg-codemode.ts:372-377` spawns the runner with `--policy <module.eyg>` before the
program runs, so the handler exists before the program can reach anything. The **registry
module** (`libraries/`, `.pi/eyg-functions/`) is the operator's composition of effects into a
tool the model calls - also available today. The **runtime implementation** of an effect is the
language workspace's and an escalation there; the effect-to-field map is recorded here at
`test/fixtures/rule_mapping.gleam` and is not ours to edit. `handle EffectName`
(`guides/syntax.md:383`) is the one route where a *program* supplies a handler, and whether it
can shadow the host's rule is **UNVERIFIED from this workspace** (`docs/world/traps.md` carries
the question and the command that shows it is still unanswerable: the runner on PATH has no
`--policy`). Nothing in this tree relies on it, and trust must never be expressed through it.

**`Mock` is a re-implementation, not only a veto.** A rule answers `Pass(value)` or
`Mock(x)`; `Mock` answers the program without the host performing anything, which is both the
refusal shape (`Mock(Error("<effect> denied by policy: <path>"))`) and a substitution:
`env: (_) -> { Mock(None({})) }` makes `Env` answer "unset" rather than refuse, because
`Env` returns an `Option` and refusing it would tell the program about the caller's
environment (`deny-all.eyg:60`). `deny-all.eyg:58` refuses `cwd` with `Mock(Error({}))` because
`CWD` returns a `Result`. The obligation the code cannot show is the **type**: the mocked value
must be the effect's own value type, and `Mock` cannot answer `Exit` at all. Whether the runner
checks that before performing is UNVERIFIED here (no runner that checks to run it on), so a
mis-typed mock should be read as a runtime error rather than a refusal until proven.

**Do not mock in an act preset.** An act preset that mocks `write_file` reports a successful
run with nothing on disk - the trap file already records the neighbouring failure mode
(`let _ = perform WriteFile(...)` looked like success). Simulation belongs in a **plan** preset,
where "nothing lands" is the point. The staged session is the cheapest thing this package
buys an operator who wants a plan approved before a change: the same program run under
`policies/deny-all.eyg` (which performs only `Now`, `Random`, `Sleep`, `Flip`,
`StandardOut`, `StandardError`, `Exit`) prints its plan and gets a refusal value for every
effect it would have used, then the same program runs under `policies/agent-roots.eyg` to act.
It works because a refusal is a value, not a crash. Two presets, no new field, no new tool,
one extra runner start-up (0.06-0.07 s measured in the language workspace).

**Rejected: a `tools` parameter in the extension** that maps names to modules and dispatches
them. That is a second answer to "what may this reach", and it would disagree with the runner's
- the same reason the registry listing's availability is advisory and re-probed rather than a
check (`notes/pi_codemode_registry_probe.md`). Permission belongs in the one record the host
loads. **Rejected: a new domain effect** (`QueryKB`, `Snapshot`) to get such a tool: an effect
is an escalation in the language workspace's rules, the 19 fields already decide the paths it
needs, and a new effect would still need a rule in every preset.

**The store discipline, and the one number that matters.** Context that lives under a root and
is pulled by `ReadFile` `offset`/`limit` or `Search` `limit` stays out of the conversation
history and costs the runner, not the prompt; this tree's own store is 39 claims re-verified in
0.7 s wall with 0 prompt lines until a session asks (`world_verify.mjs --all`, 2026-11-19), and a
claim whose verify command fails moves to `status: suspect`, so stale context is visible rather
than silently trusted. A read is still
not free. Calls are not the constraint:
10-30 checked calls per session is 0.6-2 s against a 44-142 s live session (`@measured 2026-11-15`
in the language workspace), so what an operator should budget is decisions to approve, not
runner time.

Trigger to revisit: the first session that installs a `--policy` runner here - then the
`Mock` type behaviour and the `handle EffectName` question become answerable, and the claims
labelled UNVERIFIED here should move with the output.

## The two vocabularies, read off the EYG website on 2026-11-18

<https://eyg.run/guides/effect-access-policies> documents a policy vocabulary that is **not**
this package's: an `overlay.access` package applied inside a program - `access.apply(policy,
(_) -> { perform ... })` - whose fields answer `Allow({})` (perform the original host effect),
`Mock(value)` (resume with `Ok(value)`) or `Deny(reason)` (resume with `Error(reason)`), built
from helpers (`access.read_file.allow_under`, `allow_exact`, `max_bytes`, `access.fetch.allow_get_hosts`,
`access.write_file.mock_success` for dry runs) and composed with spreads (`..access.deny_all`).
It manages six effects (`Fetch`, `ReadFile`, `ReadDirectory`, `WriteFile`, `AppendFile`,
`DeleteFile`) and the page marks the package as **currently unpublished**.

What that changes about this note, and what it does not:

- It backs the staging decision. The docs name dry-run mocking as an intended pattern
  (`write_file: access.write_file.mock_success`), the same shape as this package's plan preset -
  a separate, named policy that answers instead of performing. The rule stays: never in the
  record that acts.
- It gives names this package's presets do not have: `max_bytes`, `allow_exact`, host allow-lists
  for `Fetch`. Ours are `under(effect, roots, path_of)` and `hide_secrets`, inline, host-side.
  Trigger to reconcile: once `overlay.access` is published and a `--policy` runner exists here,
  decide once whether the presets should be written in that vocabulary, and record what the host
  layer can express that it cannot (the 19 fields, `Env`, `Search` under `read_file`, `cwd`) -
  rather than letting two vocabularies drift.
- It narrows but does not close the `handle` question: <https://eyg.run/guides/advanced-effects>
  shows `handle EffectName(handler_fn, fallback)` building stateful computations out of effects
  the program itself designed (`Increment`, `Update`, `State`, `Get`, `Increase`); no page shows
  a program re-handling one of the CLI's computer effects. "A program cannot replace the host
  policy" is therefore still UNVERIFIED here and must not be written as proven.
