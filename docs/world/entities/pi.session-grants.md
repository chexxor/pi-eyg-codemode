---
id: pi.session-grants
type: entity
owner: delegate
status: current
verified_at: 2026-11-21
verify: "grep -q 'eyg-grant' extensions/eyg-codemode.ts && grep -q GRANT_ENTRY lib/render-helpers.mjs && grep -q argumentPolicyPath extensions/eyg-codemode.ts && node --test test/render-helpers.test.mjs"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, notes/pi-codemode-session-grants.md, guides/how-to-write-another-preset.md, guides/tool-reference.md]
---
# The in-session grant loop

A refused effect is an ask the model makes in chat and the operator answers with `/eyg-grant`,
registered by `extensions/eyg-codemode.ts`. The grant widens the policy for a duration the
operator chooses - one tool call, N calls, or the rest of the session - and can be revoked.

- **The refusal names the ask.** A call whose output contains `<field> denied by policy: <path>`
  returns rows naming the path, the policy that refused it and the exact grant that would have
  allowed it, including the first directory no root covers (`refusalHints`, `outsideRoot`,
  `suggestGrant` in `lib/render-helpers.mjs`). They render collapsed as well as expanded, and the
  row that no root would fix says so instead of guessing one. The last line of the row tells the
  model it cannot grant it itself.
- **The durations, and who chooses.** `/eyg-grant` bare asks through `ctx.ui.select`: the preset
  (or an absolute module path via `ctx.ui.input`), then "one tool call (recommended: retry exactly
  the refused program)", "a number of tool calls", or "the rest of the session (widest: every
  later call)", then roots, then `ctx.ui.confirm`. Typed with its arguments
  (`/eyg-grant agent-roots 3 roots=/tmp`) it asks only for the confirmation; `/eyg-grant revoke`
  picks among the grants in force. The tool's parameters carry no grant field, and
  `argumentPolicyPath` limits the call's `policy` argument to a preset this package ships, so a
  program cannot reach the widening (`notes/pi-codemode-session-grants.md`).
- **The store is the branch.** A grant is a custom session entry
  (`pi.appendEntry("eyg-grant", ...)`), which does not reach the model; a call that ran under one
  records its id in `details.grantId`, and every call's `details.grants` lists what is in force.
  `grantEvents` + `replayGrants` rebuild the state from
  `ctx.sessionManager.getBranch()` on each call, so a fork or a `/tree` jump replays the history
  and a truncated branch un-spends the calls it dropped. The unit test pins each duration, expiry
  by use, revoke, the newest-grant-wins stack, and that a call refused before the spawn spends
  nothing.

Measured 2026-11-20 in one RPC-driven session over a scratch project (`.ai-work` is
gitignored; the session's runner was a development build of the language CLI this tree no longer
has, `docs/world/entities/cli.runner-official-install-only.md`): the program that writes
`/tmp/eyg-grant-probe.txt` came back
`write_file denied by policy: /tmp/eyg-grant-probe.txt` with
`policySource: project settings`, roots = the project only, `refusals: [{write_file,
/tmp/eyg-grant-probe.txt}]` and the rows naming `/eyg-grant ... roots + /tmp`; `/eyg-grant` then
answered four dialogs (preset, duration, roots, confirm) and notified
`grant gmwos5ksd: <package>/policies/agent-roots.eyg for 1 tool call (roots + /tmp)`; the same
program next ran under `policySource: session grant` with roots `<project>,/tmp` and printed
`wrote /tmp/eyg-grant-probe.txt`, and the file existed; the same program again was refused,
`grantId: null`, the one-call grant spent. A second grant, typed as
`/eyg-grant agent-roots session roots=/tmp` with only a confirmation, let a third call through;
`/eyg-grant revoke` through the select ended it and the fourth call was refused again. The same
session file replayed through `grantEvents`/`replayGrants` reproduces each of those states, and a
branch cut before the first grant record replays with no grant in force at all.

UNVERIFIED: the N-calls duration is pinned by the unit test and was not run live; a `/tree` jump
in a real session was not driven, only the replay over the recorded session file. That live
proof, a time bound on a grant, and an operator's way to list the grants in force are owed
work, carried as `docs/world/entities/gap.grant-polish-undecided.md` with a row in
`docs/world/runbooks/runbook.next-milestone.md`.

## Not this

- the order a call's preset and roots come from: `docs/world/entities/pi.policy-config.md` and
  `guides/how-to-write-another-preset.md`;
- why a rule lives in the policy module at all: `docs/world/decisions/ADR-002-handler-seam.md`;
- the four trade-offs behind the loop: `notes/pi-codemode-session-grants.md`.

@measured 2026-11-20 by `node .ai-work/grant-loop/drive.mjs` (one `pi --mode rpc` session, five
prompts, seven dialogs answered by the driver; verdict in `.ai-work/grant-loop/report.json`), by
replaying that session file through `grantEvents`/`replayGrants`, and by
`node --test 'test/*.mjs'` (pass 1, fail 0, 0.04 s).
