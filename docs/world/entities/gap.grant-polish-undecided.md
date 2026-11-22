---
id: gap.grant-polish-undecided
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "grep -q 'UNVERIFIED: the N-calls duration' docs/world/entities/pi.session-grants.md && grep -q 'grant.used < grant.calls' lib/render-helpers.mjs && ! grep -qE 'tokens\\[0\\] === .(status|list|show)' extensions/eyg-codemode.ts && grep -q 'gap.grant-polish-undecided' docs/world/runbooks/runbook.next-milestone.md"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, docs/world/entities/pi.session-grants.md, docs/world/runbooks/runbook.next-milestone.md, notes/pi-codemode-session-grants.md, guides/how-to-write-a-policy.md]
supersedes: null
superseded_by: null
---

# Gap: the grant loop shipped, and three pieces of its polish were left out on purpose

The mechanism is recorded and partly measured in `docs/world/entities/pi.session-grants.md`:
a refusal names the ask, the operator answers with `/eyg-grant`, the grant is a session entry
the branch replays. The milestone that gave a spawner control over its child parked the
remaining polish as a row here rather than doing it - a live proof, a time bound, and the
operator's view of what is widened. Each piece below says what exists today, what does not,
and the step that closes it. `verify` goes red when a piece lands, which is how this record
retires.

**1. The N-call duration has never been run live.** The 2026-11-20 session drove a one-call
grant and a session grant; "a number of tool calls" is pinned only by the unit test
(`test/render-helpers.test.mjs:249-263`, `an N-call grant counts the calls it covered`), and
that page says so itself: `UNVERIFIED: the N-calls duration is pinned by the unit test and was
not run live`. First step, the same shape as the run already on record and about two minutes
of wall: one `pi --mode rpc` session over a gitignored scratch project, a typed
`/eyg-grant agent-roots 2 roots=/tmp`, then three calls at the same refused path - call 1 and
2 expected granted, call 3 expected refused with `grantId: null` - and record the verdict in
`pi.session-grants.md` in place of that sentence.

**2. Nothing bounds a grant in time.** A grant ends by spend or by revoke:
`grants.filter((grant) => grant.calls === null || grant.used < grant.calls)`
(`lib/render-helpers.mjs:389`, read 2026-11-21), and `Date.now()` appears in the grant path
only to name the id (`g${Date.now().toString(36)}`, `extensions/eyg-codemode.ts:1420`). A
session grant therefore keeps widening an hour later, and across any idle gap, until someone
revokes it or cuts the branch. No field carries a deadline, and the shape is a decision rather
than a patch: a wall-clock deadline per grant or an idle timeout; what the entry stores; and
what a replayed branch does with a deadline that passed after the entries were written - a
recorded `expiresAt` is re-evaluated against the wall clock, so replaying an old session could
un-run a grant that was in force when it ran, which is the opposite of what the branch-as-store
is for. Trigger to decide: the first grant left in force across a break by accident, or the
first unattended run (`pi --print`) that takes a grant nobody is there to revoke.

**3. The operator cannot see the grants in force without starting one.** What exists:
`/eyg-grant revoke [id]` (`extensions/eyg-codemode.ts:1329-1340`, one line in
`guides/how-to-write-a-policy.md:32`), one-line descriptions with the spend in
`describeGrant` (`lib/render-helpers.mjs:395`), and a `grants in force: ...` row in every eyg
call's output (`lib/render-helpers.mjs:600`), so the session sees the state even though a
grant entry itself never reaches the model. What does not: a listing subcommand. `state()`,
the line that builds "grants in force now" (`extensions/eyg-codemode.ts:1324-1327`), is
reachable only on the command's two error paths (1365, 1383) and inside the confirmation
summary (1416), so `revoke` is the only subcommand and asking "what is widened right now" means
beginning a grant. First step: `/eyg-grant` with no arguments answering the list instead of
opening the dialogs, or a `status` subcommand, plus the argument grammar
(`<preset | absolute module path> <one | N | session> [roots=/abs,/abs]`) as a row in
`guides/tool-reference.md`, where today it is only a mention.

## Not this

- the mechanism itself, and which parts of it were driven live: `docs/world/entities/pi.session-grants.md`;
- the four trade-offs behind the loop, including why the store is the session branch: `notes/pi-codemode-session-grants.md`;
- who may widen a policy: the operator, host-side, through a command a program cannot reach. This page proposes no program-reachable grant, and `argumentPolicyPath` keeps a call's `policy` argument inside the shipped presets;
- a child session's surface (`eyg_subagent`'s `tools`, `effects`, `max_calls`): `docs/world/entities/pi.subagent-spawn.md`. A grant made in the parent does not reach a child;
- any change to a shipped preset. All three pieces sit in the command and its replay, not in `policies/`.
