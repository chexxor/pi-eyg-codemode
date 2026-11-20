---
id: pi.policy-config
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "grep -c 'the default preset' README.md && grep -c 'Which preset a call gets' guides/how-to-write-another-preset.md && grep -c 'eyg.policy' guides/how-to-write-another-preset.md && grep -q agent-roots .pi/settings.json && grep -q resolvePolicy extensions/eyg-codemode.ts && node pi-simple-world-model/bin/world_lint.mjs"
confidence: high
sources: [README.md, guides/how-to-write-another-preset.md, guides/tool-reference.md, extensions/eyg-codemode.ts, lib/render-helpers.mjs, .pi/settings.json, notes/pi-codemode-project-settings-key.md]
---
# The default preset, and the page that teaches customization

Two questions the operator asked, answered in the tree: which policy the package uses if
you set nothing, and where to go to change it.

- The package ships two presets: `policies/agent-roots.eyg` (the default, 18 rules) and
  `policies/deny-all.eyg` (the narrowest). README.md names both in its preset table.
- The order a call's preset comes from is stated once, in
  `guides/how-to-write-another-preset.md`: the `policy` argument of the call, then
  `eyg.policy` in `.pi/settings.json`, then `EYG_POLICY`, then the preset in the package, and
  if none exists the tool refuses to run anything rather than run unchecked. The order is one
  function, `resolvePolicy` in `lib/render-helpers.mjs`, and the unit test pins every step of
  it; a slot for a grant the operator made in this session sits between the first two. The
  same page states the roots order - `eyg.roots`, then `EYG_ALLOWED_ROOTS`, then the working
  directory - which is `resolveRoots`. `guides/tool-reference.md` carries the knobs and links
  there for the orders.
- The project key is the per-project knob: `"eyg": { "policy": ..., "roots": [...] }`, where
  the policy is a preset name (`agent-roots`, `deny-all`) or an absolute module path, and the
  roots are absolute paths. This workspace sets it: `.pi/settings.json` names `agent-roots`
  with no roots, which means the working directory. A relative root or a name that resolves to
  no file stops the call with a message that names the key.
- The customization home is `guides/how-to-write-another-preset.md`: what one record
  covers, the shipped presets to copy, how to change rules, how to check the module and
  point the tool at it, and how to prove the preset answered. The roots recipe is there too.

Measured 2026-11-20 in a scratch project (a fresh `pi --print` with `--tools eyg`): a
`.pi/settings.json` naming `deny-all` and one root gave the probe header
`deny-all.eyg (project settings)`, a write inside that root came back
`write_file denied by policy` with nothing written, 16 probes took 0.94 s, and replacing the
root with `relative/too` answered `every eyg.roots entry must be an absolute path, got
relative/too` without running anything.

What is **not** configurable today:

- there is no in-session widening: a refusal is a value the model reads, and the way to move
  the boundary is to change the project key or the environment between calls
  (`docs/world/decisions/ADR-002-handler-seam.md`).

## Not this

- what a rule may return and why a refusal is a value: `docs/world/decisions/ADR-002-handler-seam.md`;
- the tool's parameters, actions and probe rows: `guides/tool-reference.md`;
- how to write the rules themselves: the guide named above.

@measured 2026-11-20 by `grep -c 'Which preset a call gets' guides/how-to-write-another-preset.md` (1),
`grep -c 'eyg.policy' guides/how-to-write-another-preset.md` (2), `grep -q agent-roots .pi/settings.json`
and `grep -q resolvePolicy extensions/eyg-codemode.ts` (both found), the scratch-project session
above, and `node --test 'test/*.mjs'` (pass 1, fail 0, 0.05 s: the five-step precedence, both
roots orders, the preset-name rules and the settings shaping are asserted).
