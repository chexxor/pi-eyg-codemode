---
id: ADR-006-guard-in-package
type: adr
owner: human
status: accepted
verified_at: 2026-11-26
verify: "grep -q 'guard.build(policy.rules(ctx), ctx, (_)' lib/render-helpers.mjs && grep -q 'let build = (policy, ctx, body)' host/guard.eyg && grep -qF '[mode, entryPath]' extensions/eyg-codemode.ts && grep -q 'return \\[\"eyg\"\\]' lib/render-helpers.mjs && node --test test/host-coverage.test.mjs > /dev/null"
confidence: high
sources: [host/guard.eyg, lib/render-helpers.mjs, extensions/eyg-codemode.ts, test/host-coverage.test.mjs, docs/world/entities/host.guard-boundary.md, docs/world/decisions/ADR-002-handler-seam.md, notes/pi-codemode-host-guard-contract.md, notes/pi-codemode-handler-seam.md, guides/how-to-point-the-tool-at-your-runner.md]
supersedes: null
superseded_by: null
---
# ADR-006: the per-effect checks live in a guard this package ships, not in a runner build

## Context

Until 2026-11-22 the tool asked the CLI to do the deciding: it named a policy module and the program
inline in the same argv, and treated a refusal as the runner's answer.
That put the boundary in a binary this package does not own, and the request was understood in exactly
one place - a development build of the language CLI on this operator's machine, parked in an untracked
symlink. The installed release (`eyg v0.1.0`) understands no such request, and neither the language
repository's `main` nor its published release carries it
(`docs/world/entities/gap.policy-runner-not-on-main.md`,
`docs/world/entities/gap.runner-release-lacks-policy.md`). So the package shipped a check it could
not run: every claim about what a policy decided at runtime was either UNVERIFIED or depended on a
build a reader could not obtain, and the tool spent a call probing whether the binary it found
understood the flag (`docs/world/traps.md`, the runner-probe traps).

The alternative host was already in the language: `handle Name(handler, fallback)`
(`guides/advanced-effects` on the website), documented in the syntax page in two lines as "used to
install custom effect handlers in advanced embedding scenarios", with examples only for effects a
program designs for itself. Whether such a clause could intercept one of the CLI's *computer*
effects was unverified, and this package's own record said so
(`docs/world/decisions/ADR-002-handler-seam.md`).

## Decision

Move the checks into this package. A call is now three files this package writes and one argv the
installed CLI answers:

- `host/guard.eyg` names one `handle` clause per effect row of `guides/eyg-surface.tsv` and applies
  the resolved policy inside each; a label it does not name has no host.
- `program.eyg` holds the model's source inside one `run` function - the only file containing model
  text, which is what makes injection a parse error rather than an escape.
- `entry.eyg` imports the guard, the policy and the program, and calls `guard.build(policy.rules(ctx), ctx, …)`
  with `ctx` written as a literal (`entryProgram` in `lib/render-helpers.mjs`).
- the spawn is `<binary> <mode> <entryPath>`, and the binary is chosen by name:
  `EYG_CODEMODE_RUNNER`, else `eyg` on `PATH` - two places and no capability probe.

The boundary facts this rests on are claimed and probed in
`docs/world/entities/host.guard-boundary.md`.

## Options considered

| option | what a policy author writes | what it costs |
| --- | --- | --- |
| **Wait for the language to ship a host** (keep the flag) | unchanged | nothing today, and the package stays unrunnable on an installed release; a reader cannot reproduce a single runtime proof. Rejected: a check nobody can run is not a check. |
| **Guard in EYG, policy as a record of rules** (shipped) | `rules(ctx)` returning one field per effect, each a function answering `Pass(value)` / `Mock(reason)` | ~600 lines of guard, one clause per effect, mechanical and table-tested; the guard chooses each refusal's shape because the effect's reply type decides it. Adding an effect means editing the guard, which `test/host-coverage.test.mjs` turns into a red test. |
| **Handler stacks with no policy record** (each effect's decision written inline in the guard) | nothing; they edit the guard | the policy stops being data: a session cannot pick a shipped policy, narrow one, or dry-run with the narrowest one, and `action: "effects"` loses the field it reports. Rejected: it would move the boundary out of reach of configuration. |
| **The language's own policy-helper shape** (`overlay.access`, applied *inside* a program) | helper calls such as `access.read_file.allow_under(["data"])` | a package the website marks as currently unpublished, covering six of the effects, and an apply-inside-program seam that the model's own code could sit outside. Rejected for reach and availability. |

The contract question was the operator's to answer, and on 2026-11-23 they answered it: **the shipped
contract is ratified**. A rule answers `Pass(value) | Mock(reason: String)` and the guard turns
`reason` into the shape the effect's own reply allows. The alternatives inside that contract were a
rule returning the finished value (`Mock(Error(...))`, as the old runner contract did - more precise,
but every policy author would repeat a shape table the guard already knows) or a rule returning
`Deny(reason)` separately from `Mock(value)` (three cases, and today's refusals never need to
fabricate a value). The guard-as-wiring row of the table above gained one measured reason to stay
rejected: a rule that writes its own handler can answer `resume(Ok(...))` without re-performing, and
the program then believes a write happened that the host never performed.

The operator attached one condition: the contract may be revisited when a use-case turns up. What
would change then is not the rule vocabulary but where it lives - `policies/agent-roots.eyg` already
composes its rules from `under(...)`, `hide_secrets(...)` and `refuse(...)`, the names the language's
own policy library uses, and carries those helpers inline in each policy file. The trigger to revisit:
the first policy that would write those helpers a third time, or a language release that publishes
that library. Doing it also means amending `invariant.policy-self-contained`, whose check is that the
shipped policies contain no `import` at all, so it is the operator's edit as much as this package's.

## Consequences

- The installed release runs every call, so a runtime refusal is re-runnable by anyone:
  `node bin/agent/refusal-probe.mjs` costs a fifth of a second and needs nothing but `eyg` on `PATH`.
- The closed effect row is this package's job now: default-deny comes from naming every label, and a
  language effect added without a guard handler fails a test instead of running ungarded.
- The guard must resolve paths itself, because the CLI hands over the path as written.
- A refusal is no longer printed by the host: for the effects whose reply is a `Result` it is the
  reply's `Error` branch, which is invisible to a probe that only performs the effect. That misreport
  was caught live and fixed (`docs/world/traps.md`).
- What is lost: one fewer moving part the language owns, and one more file this package must keep in
  step with the runtime's label list. If the language later ships its own host, this guard becomes
  redundant rather than wrong - it can be deleted with the table test that pins it.

## Not this

- whether a `handle` clause actually intercepts a host effect: `docs/world/entities/host.guard-boundary.md`;
- the handler-composition idea this replaces, and what was rejected then: `ADR-002-handler-seam.md`;
- the trade-offs in prose: `notes/pi-codemode-host-guard-contract.md`, `notes/pi-codemode-handler-seam.md`.
