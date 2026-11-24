---
id: overlay.policy-rules
type: entity
owner: delegate
status: current
verified_at: 2026-11-24
verify: "test -f test/fixtures/rule_mapping.gleam && grep -q 'pub const rule_mapping' test/fixtures/rule_mapping.gleam && grep -q 'policy.Unchecked' test/fixtures/rule_mapping.gleam && grep -q 'hide_secrets' policies/agent-roots.eyg && grep -q 'Pass(value)' policies/agent-roots.eyg && grep -q 'Mock(denied(' policies/agent-roots.eyg && grep -qF 'let absolute = (cwd, path)' host/guard.eyg && node --test test/host-coverage.test.mjs > /dev/null && node bin/agent/refusal-probe.mjs | grep -qF 'write_file denied by policy: /tmp/eyg-refusal-probe-'"
confidence: high
sources: [test/fixtures/rule_mapping.gleam, policies/agent-roots.eyg, policies/deny-all.eyg, host/guard.eyg, README.md, guides/eyg-surface.tsv]
supersedes: null
superseded_by: null
---

# The per-effect permission rules already exist

A running EYG program is stopped at every effect before the host performs it, and a
user-supplied function decides. This is the mechanism this package sits in front of; the
host that applies it is this package's own (`host/guard.eyg`,
`docs/world/entities/host.guard-boundary.md`), and what the language repository contributes is
the effect labels and the closed set of runtime-`Unchecked` ones, recorded in a snapshot.

- The rule table (`rule_mapping`) is recorded here at `test/fixtures/rule_mapping.gleam`,
  captured 2026-11-18 from the language repository's
  `packages/gleam_cli/src/eyg/cli/overlay.gleam`: which of the computer effects the runtime names
  and which of them it marks `Unchecked` - `DecodeJSON`, `EYGParse`, `Hash` and `Sign`. It decides
  labels and nothing else: the field names below are this package's, and
  `test/host-coverage.test.mjs` proves them against `host/guard.eyg` rather than against the
  snapshot (`docs/world/entities/codemode.effect-surface.md`).
- The checks are host-side, so a program cannot opt out of them by writing different code;
  the CLI hands a path **as written** - relative or not - and `host/guard.eyg` resolves it to an
  absolute, lexically normalized path before a rule sees it (`absolute` there, used at `host/guard.eyg:349`), so
  a policy compares resolved paths and the refusal names the resolved one.
- The policy modules are written out in full inside this package: `policies/agent-roots.eyg` and
  `policies/deny-all.eyg` each export one `rules(ctx)` function - deny-by-default plus
  `under(...)`-shaped rules over the roots, `hide_secrets` for `.env.eyg`, and the refusal text a
  program receives. See `notes/pi-codemode-policy-inlining.md` for what was inlined and what the
  language repository's own security suite no longer covers.
- What a rule may answer is the contract that makes a handler re-implementable
  (`policies/agent-roots.eyg` read 2026-11-18, re-read 2026-11-22): `Pass(value)` lets the guard
  perform the effect with the value handed back, so a rule may rewrite the argument the program
  asked for; `Mock(reason)` has the guard answer the program without the host performing anything.
  The guard shapes the answer to fit the effect's own reply type, which is why a refusal of `Env`
  is `None({})`, a refusal of `CWD` is `Error({})`, and a refused `Now` aborts the program
  (`docs/world/entities/host.guard-boundary.md`). A rule may take and return another rule, which is
  what `hide_secrets` does.
- The two refusal captures in `guides/tool-reference.md` ("A refusal, as it looked") were taken in
  this workspace through `node bin/agent/refusal-probe.mjs`, with the absolute paths masked
  (`@measured 2026-11-22`; the audit's path sweep is why they are masked). One shows a `ReadFile`
  inside the roots performing while a `WriteFile` outside them answered `write_file denied by
  policy`, with nothing at that path; the other shows a refused `ReadFile` of a `.env.eyg` while a
  `Search` named the same path. A capture's tag in that guide names where it was taken and never
  when, which is why the date sits here.
- **Two vocabularies, not one set of names.** The host layer (this package's) is the record a policy
  module returns: one field per effect the guard names, rules answering `Pass`/`Mock`. The language layer,
  documented on the website (<https://eyg.run/guides/effect-access-policies>, read 2026-11-18),
  is an `overlay.access` package applied *inside* a program - `access.apply(policy, program)`,
  fields answering `Allow({})` / `Mock(value)` / `Deny(reason)`, helpers like
  `access.read_file.allow_under` and `max_bytes`, six managed effects - and the website marks it
  "currently unpublished". Same idea, different reach; do not read one record as the other.
- A plan-then-act session is the same program run under two of these records
  (`policies/deny-all.eyg` first, `policies/agent-roots.eyg` to act) - no new field, no new
  tool. `README.md` names the section; `docs/world/decisions/ADR-006-guard-in-package.md` records
  why the seam sits in the policy module and not in a program or a new tool parameter, and
  supersedes `docs/world/decisions/ADR-002-handler-seam.md` on where that seam is.

## Not this

Not the effect definitions - those are in the CLI harness and on the language's effect page
(<https://eyg.run/guides/cli-effects-reference>); what this package ships offline is the rows in
`guides/eyg-surface.tsv`. Not the CLI's own `run`, `eval` or `script` commands started by a human:
outside this package's entry nothing decides an effect, so the program reaches the host unchecked -
see `docs/world/traps.md`, and `docs/world/entities/pi.codemode-tool.md` for what this package
builds on. Not a handler a program writes for itself: `handle EffectName` is the language's own route
to a handler, and what it can and cannot do to the host's decision is measured in
`docs/world/entities/host.guard-boundary.md` - a clause nested inside the guarded program can decline
an effect and can rewrite what a rule allowed, but it cannot perform what the outer stack refused.
