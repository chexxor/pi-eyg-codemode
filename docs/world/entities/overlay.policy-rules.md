---
id: overlay.policy-rules
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "test -f test/fixtures/rule_mapping.gleam && grep -q 'pub const rule_mapping' test/fixtures/rule_mapping.gleam && grep -q 'policy.Unchecked' test/fixtures/rule_mapping.gleam && grep -q 'hide_secrets' policies/agent-roots.eyg && grep -q 'Mock(Error' policies/deny-all.eyg && grep -q 'Pass(value)' policies/agent-roots.eyg"
confidence: high
sources: [test/fixtures/rule_mapping.gleam, policies/agent-roots.eyg, policies/deny-all.eyg, README.md, guides/eyg-surface.tsv]
supersedes: null
superseded_by: null
---

# The per-effect permission rules already exist

A running EYG program is stopped at every effect before the host performs it, and a
user-supplied function decides. This is the mechanism this package sits in front of; the
implementation is in the language repository, and this tree carries only the recorded
snapshot of its rule table.

- The rule table (`rule_mapping`) is recorded here at `test/fixtures/rule_mapping.gleam`,
  captured 2026-11-18 from the language repository's
  `packages/gleam_cli/src/eyg/cli/overlay.gleam`: which of the computer effects have a
  policy field and which field decides each. `DecodeJSON`, `EYGParse`, `Hash` and `Sign` are
  `Unchecked`.
- The checks are host-side, so a program cannot opt out of them by writing different code;
  the CLI resolves relative file paths to absolute *before* a check sees them, so a
  policy compares resolved paths.
- The EYG-side vocabulary that used to be imported from `eyg_packages/overlay/policy.eyg`
  is written out inside `policies/agent-roots.eyg` and `policies/deny-all.eyg`: deny-by-
  default plus `read_write(roots)`-shaped rules, `hide_secrets` for `.env.eyg`, and the
  `Mock(Error(...))` refusal shape that carries the reason back to the program.
  See `notes/pi-codemode-policy-inlining.md` for what was inlined and what the language
  workspace's security suite no longer covers.
- What a rule may answer is the contract that makes a handler re-implementable
  (`policies/agent-roots.eyg` read 2026-11-18): `Pass(value)` performs with the value handed
  back, so a handler may rewrite the argument the program asked for; `Mock(x)` answers the
  program without the host performing anything - that is the refusal shape `Mock(Error(...))`
  and also a re-implementation, since `env: (_) -> { Mock(None({})) }` makes `Env` answer
  "unset" rather than refuse. `Mock` must return a value of the effect's own type
  (`deny-all.eyg` refuses `cwd` with `Mock(Error({}))` because `CWD` returns a `Result`), and
  `Mock` cannot answer `Exit` at all. A rule may take and return another rule, which is what
  `hide_secrets` does.
- **Two vocabularies, not one set of names.** The host layer (this package's) is the record a `--policy`
  module builds: one field per effect the policy decides, rules answering `Pass`/`Mock`. The language layer,
  documented on the website (<https://eyg.run/guides/effect-access-policies>, read 2026-11-18),
  is an `overlay.access` package applied *inside* a program - `access.apply(policy, program)`,
  fields answering `Allow({})` / `Mock(value)` / `Deny(reason)`, helpers like
  `access.read_file.allow_under` and `max_bytes`, six managed effects - and the website marks it
  "currently unpublished". Same idea, different reach; do not read one record as the other.
- A plan-then-act session is the same program run under two of these records
  (`policies/deny-all.eyg` first, `policies/agent-roots.eyg` to act) - no new field, no new
  tool. `README.md` names the section; `docs/world/decisions/ADR-002-handler-seam.md` records
  why the seam sits in the policy module and not in a program or a new tool parameter.

## Not this

Not the effect definitions - those are in the CLI harness and in
`guides/cli_effects_reference.md`. Not the CLI's own `run`, `eval` or `script` commands:
without `--policy` they reach the host unchecked - see `docs/world/traps.md` - which is what
`pi.codemode-tool` builds on. Not a handler a program writes for itself: `handle EffectName`
(`guides/syntax.md:383`) is the language's own route to a handler, documented in two lines as
"advanced embedding scenarios", and whether it can shadow the host's rule is UNVERIFIED from
here - `docs/world/traps.md` carries that question and the command that shows it is still
unanswerable on this host.
