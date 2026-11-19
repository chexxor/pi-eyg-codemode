---
id: overlay.policy-gate
type: entity
owner: delegate
status: current
verified_at: 2026-11-19
verify: "test -f test/fixtures/rule_mapping.gleam && grep -q 'pub const rule_mapping' test/fixtures/rule_mapping.gleam && grep -q 'policy.Unchecked' test/fixtures/rule_mapping.gleam && grep -q 'hide_secrets' policies/agent-roots.eyg && grep -q 'Mock(Error' policies/deny-all.eyg"
confidence: high
sources: [test/fixtures/rule_mapping.gleam, policies/agent-roots.eyg, policies/deny-all.eyg, README.md, guides/cli_effects_reference.md]
supersedes: null
superseded_by: null
---

# The per-effect permission gate already exists

A running EYG program is stopped at every effect before the host performs it, and a
user-supplied function decides. This is the mechanism this package sits in front of; the
implementation is in the language workspace, and this tree carries only the recorded
snapshot of its rule table.

- The rule table (`rule_mapping`) is recorded here at `test/fixtures/rule_mapping.gleam`,
  captured 2026-11-18 from the language workspace's
  `packages/gleam_cli/src/eyg/cli/overlay.gleam`: which of the computer effects are gated
  and the policy field that gates each. `DecodeJSON`, `EYGParse`, `Hash` and `Sign` are
  `Unchecked`.
- The gate is host-side, so a program cannot opt out of it by writing different code;
  the CLI resolves relative file paths to absolute *before* the gate sees them, so a
  preset compares resolved paths.
- The EYG-side vocabulary that used to be imported from `eyg_packages/overlay/policy.eyg`
  is written out inside `policies/agent-roots.eyg` and `policies/deny-all.eyg`: deny-by-
  default plus `read_write(roots)`-shaped rules, `hide_secrets` for `.env.eyg`, and the
  `Mock(Error(...))` refusal shape that carries the reason back to the program.
  See `notes/pi-codemode-preset-inlining.md` for what was inlined and what the language
  workspace's security suite no longer covers.

## Not this

Not the effect definitions - those are in the CLI harness and in
`guides/cli_effects_reference.md`. Not the CLI's own `run`, `eval` or `script` commands:
without `--policy` they reach the host ungated - see `docs/world/traps.md` - which is what
`pi.codemode-gate` builds on.
