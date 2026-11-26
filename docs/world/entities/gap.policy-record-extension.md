---
id: gap.policy-record-extension
type: entity
owner: delegate
status: current
verified_at: 2026-11-26
verify: "test $(grep -v '^//' policies/agent-roots.eyg | sed '/^ *$/d' | grep -Fxc -f policies/spawner-effects.eyg) -ge 40 && grep -q 'record extension' notes/pi-eyg-codemode-policy-record-extension.md && grep -q 'gap.policy-record-extension' guides/how-to-write-a-policy.md && grep -q 'gap.policy-record-extension' docs/world/runbooks/runbook.next-milestone.md"
confidence: high
sources: [policies/agent-roots.eyg, policies/spawner-effects.eyg, notes/pi-eyg-codemode-policy-record-extension.md, notes/spawner-effect-allowlist.md, guides/how-to-write-a-policy.md, docs/world/runbooks/runbook.next-milestone.md]
supersedes: null
superseded_by: null
---

# Gap: customizing a policy means copying it, because a loaded policy record cannot be extended

`guides/how-to-write-a-policy.md` tells an operator to copy the shipped policy nearest what
they need and change the handlers, and `policies/spawner-effects.eyg` does exactly that inside
the package: it is `agent-roots.eyg` with an allowlist over its fields, written out whole. The
hole is the copying itself. 68 of the 84 non-comment lines of `policies/agent-roots.eyg` appear
verbatim in `policies/spawner-effects.eyg` - `verify` counts them - so every rule change is two
edits, and the drift between the copies is a cost already named in
`notes/spawner-effect-allowlist.md`.

The alternative shape was measured and does not lower that number: a policy written as named
lists plus derivations (`test/fixtures/policy-data-shape.eyg`, 114 non-comment lines of 145)
shares 84 lines with `policies/agent-roots.eyg` and decides the same 16 probe rows
(`node bin/agent/secret-rule-probe.mjs --policy "$PWD/test/fixtures/policy-data-shape.eyg"`), and
one generic `decide(effect, value)` field does not type-check at all
(`test/fixtures/policy-generic-decide.eyg`). `notes/pi-codemode-policy-shape.md` carries that
decision and its costs.

What is missing is a way to extend or override **the record the host loaded**: in the operator's
spelling, `{ WebSearch: my_search } \ existing_policy`, register a handler for a field the
loaded policy does not carry, or replace one it does, without owning its file. EYG has record
update for a record the program holds as a value, and it only overwrites fields already present.
What changed on 2026-11-22 is the second half of that sentence: a policy module *is* imported now -
the generated entry imports `host/guard.eyg`, the policy module and the program module - and a
module's top-level effects are not performed on the way in, so importing one no longer asks them of
the running program (`docs/world/entities/host.guard-boundary.md`). Importing still gives no way to
name the record another module returned, which is the hole. The measurement, what was rejected and
why are in `notes/pi-eyg-codemode-policy-record-extension.md`; the trigger that closes this record
is a language release in which one policy module can extend or override the record another module
returned.

This package cannot close it. The compiler and the CLI are the language repository's, and this tree
builds neither (`AGENTS.md`); nothing here adds a language feature, and no shipped
policy is loosened to imitate one.

## Not this

- Not about whether the shipped policies decide correctly at run time: that is
  `docs/world/entities/codemode.effect-surface.md` and `docs/world/entities/overlay.policy-rules.md`.
- Not the allowlist design - why the child's policy is a copied file reading one environment
  variable, and why an unset list refuses everything, is `notes/spawner-effect-allowlist.md`
  and `docs/world/entities/pi.spawner-policy.md`.
- Not the reason the policies import nothing (`invariant.policy-self-contained`,
  `notes/pi-codemode-policy-inlining.md`): self-containment is chosen, the copying is the
  consequence this record counts.
- Not a request for a new effect or a wider policy: the surface and the policies' reach are
  unchanged by this gap.
