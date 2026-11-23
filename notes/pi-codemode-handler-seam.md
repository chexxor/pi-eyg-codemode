---
name: pi-codemode-handler-seam
description: Which effect handler an operator may rewrite, what a program that installs its own handler is now that the guard is the host, and what was rejected
date: 2026-11-23
---

*(What this note left open is closed elsewhere, and it is named here rather than restated there: the
`handle` question is measured as boundary facts 1, 5 and 7 of
`docs/world/entities/host.guard-boundary.md`; the shape a refusal takes is the guard's job, recorded
in `notes/pi-codemode-host-guard-contract.md` and ratified in
`docs/world/decisions/ADR-006-guard-in-package.md`; the other policy vocabulary - the language's
`overlay.access`, whose page still reads "currently unpublished" when re-read 2026-11-23 - and this
package's decision about it are ADR-006's.)*

**The seams, and who owns each.** EYG separates an effect's description from its implementation (the
language's syntax page, <https://eyg.run/guides/eyg-syntax-guide>: "Scripts declare effects they
need; the runner decides what to do with them"), so there are four candidate seams and two of them
are open here. The **policy rule** is the operator's and is host-authored: the generated entry
imports the guard and the resolved policy and calls `guard.build(policy.rules(ctx), ctx, …)` before
the program runs, so a handler exists before the program can reach anything. The **registry module**
(`libraries/`, `.pi/eyg-functions/`) is the operator's composition of effects into a tool the model
calls - also available today. The **runtime implementation** of an effect is the language
repository's and an escalation there; the effect-label snapshot this package compares against is
`test/fixtures/rule_mapping.gleam`, which is not ours to edit. And `handle Label(clause, body)` - the
one route where a *program* supplies a handler - is closed to a model's program: the tool parses the
program and refuses one that names a clause.

**What closing that seam settled.** This note used to hold the question as UNVERIFIED from this
workspace: could a program's own clause shadow the host's rule? It can intercept - a `perform` under
a clause never reaches the host unless the clause sends it back - and it cannot widen reach, because
the clause's re-perform reaches the outer guard and is decided again. What it can do is answer the
program without asking the host, which is how a run comes to report a write the host never
performed. That is why the rule is a refusal of the argument before the run rather than something to
watch for in the result rows: the fabrication is invisible in the output, because the program's own
text is what reports it. Trust must never be expressed through a clause the model wrote.

**Do not mock in an act policy.** An act policy that mocks `write_file` reports a successful run with
nothing on disk - the trap file records the neighbouring failure mode (`let _ = perform
WriteFile(...)` looked like success). Simulation belongs in a **plan** policy, where "nothing lands"
is the point. The staged session is the cheapest thing this package buys an operator who wants a plan
approved before a change: the same program run under `policies/deny-all.eyg` prints its plan and gets
a refusal value for every effect it would have used, then the same program runs under
`policies/agent-roots.eyg` to act. It works because a refusal is a value, not a crash, and it costs
one extra runner start-up. The steps are in `guides/tool-reference.md` ("Plan first, then act, with
the same program"); what this note owns is the rule that survives any change to those steps - the
record that acts never mocks an effect it would otherwise perform.

**Rejected: a `tools` parameter in the extension** that maps names to modules and dispatches them.
That is a second answer to "what may this reach", and it would disagree with the guard's - the same
reason the registry listing's availability is advisory and re-probed rather than a check
(`notes/pi_codemode_registry_probe.md`). Permission belongs in the one record the host loads.
**Rejected: a new domain effect** (`QueryKB`, `Snapshot`) to get such a tool: an effect is an
escalation in the language repository's rules, the policy fields already decide the paths such a tool
needs, and a new effect would still need a rule in every policy and a clause in the guard.

**The store discipline, and the one number that matters.** Context that lives under a root and is
pulled by `ReadFile` `offset`/`limit` or `Search` `limit` stays out of the conversation history and
costs the runner, not the prompt; this tree's own store is `docs/world/`, re-verified by
`world_verify.mjs --all` at 0 prompt lines until a session asks, and a claim whose verify command
fails moves to `status: suspect`, so stale context is visible rather than silently trusted. A read is
still not free. Calls are not the constraint: 10-30 checked calls per session is 0.6-2 s against a
44-142 s live session (`@measured 2026-11-15` in the language repository), so what an operator should
budget is decisions to approve, not runner time.
