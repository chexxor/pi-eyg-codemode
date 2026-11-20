---
id: pi.policy-config
type: entity
owner: delegate
status: suspect
verified_at: 2026-11-20
verify: "grep -c 'the default preset' README.md && grep -c 'Which preset a call gets' guides/how-to-write-another-preset.md && grep -c 'policies/agent-roots.eyg' guides/how-to-write-another-preset.md && grep -c 'guides/how-to-write-another-preset.md' guides/tool-reference.md && grep -c 'policy: Type.Optional' extensions/eyg-codemode.ts && node pi-simple-world-model/bin/world_lint.mjs"
confidence: high
sources:
  - README.md
  - guides/how-to-write-another-preset.md
  - guides/tool-reference.md
  - extensions/eyg-codemode.ts
---
# The default preset, and the page that teaches customization

Two questions the operator asked, answered in the tree: which policy the package uses if
you set nothing, and where to go to change it.

- The package ships two presets: `policies/agent-roots.eyg` (the default, 18 rules) and
  `policies/deny-all.eyg` (the narrowest). README.md names both in its preset table.
- The order a call's preset comes from is stated once, in
  `guides/how-to-write-another-preset.md`: the `policy` argument of the call, then
  `EYG_POLICY`, then the preset in the package, and if none exists the tool refuses to run
  anything rather than run unchecked. `guides/tool-reference.md` carries the knobs
  themselves and links here for the order.
- The customization home is `guides/how-to-write-another-preset.md`: what one record
  covers, the shipped presets to copy, how to change rules, how to check the module and
  point the tool at it, and how to prove the preset answered. The roots recipe -
  `EYG_ALLOWED_ROOTS`, comma-separated absolute paths - is in that page too.

What is **not** configurable today, each with its own page:

- there is no config file for the roots or the preset, and no way to point one project at
  one policy and another project at a different one
  (`docs/world/entities/gap.roots-have-no-config-file.md`);
- there is no in-session widening: a refusal is a value the model reads, and the only way
  to change the boundary is to edit the environment or the module and restart pi
  (`docs/world/decisions/ADR-002-handler-seam.md`).

## Not this

- what a rule may return and why a refusal is a value: `docs/world/decisions/ADR-002-handler-seam.md`;
- the tool's parameters, actions and probe rows: `guides/tool-reference.md`;
- how to write the rules themselves: the guide named above.

@measured 2026-11-20 by `grep -c 'the default preset' README.md` (1),
`grep -c 'Which preset a call gets' guides/how-to-write-another-preset.md` (1),
`grep -c 'policies/agent-roots.eyg' guides/how-to-write-another-preset.md` (2),
`grep -c 'guides/how-to-write-another-preset.md' guides/tool-reference.md` (1), and
`node pi-simple-world-model/bin/world_lint.mjs` (clean).
