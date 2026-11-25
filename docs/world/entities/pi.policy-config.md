---
id: pi.policy-config
type: entity
owner: delegate
status: current
verified_at: 2026-11-25
verify: "grep -c 'the default policy' README.md && grep -c 'Which policy a call gets' guides/how-to-write-a-policy.md && grep -c 'eyg.policy' guides/how-to-write-a-policy.md && grep -q agent-roots .pi/settings.json && grep -q resolvePolicy extensions/eyg-codemode.ts && grep -q NARROWEST_POLICY_FILE lib/render-helpers.mjs && grep -q refusedArgument extensions/eyg-codemode.ts && node pi-simple-world-model/bin/world_lint.mjs"
confidence: high
sources: [README.md, guides/how-to-write-a-policy.md, guides/tool-reference.md, extensions/eyg-codemode.ts, lib/render-helpers.mjs, .pi/settings.json, notes/pi-codemode-project-settings-key.md, docs/world/entities/pi.session-grants.md]
---
# The default policy, and the page that teaches customization

Two questions the operator asked, answered in the tree: which policy the package uses if
you set nothing, and where to go to change it.

- The package ships three policies: `policies/agent-roots.eyg` (the default, 18 handlers),
  `policies/deny-all.eyg` (the narrowest) and `policies/spawner-effects.eyg`, which is agent-roots
  behind a per-field allowlist and is installed for a child session rather than chosen by an operator
  (`docs/world/entities/pi.spawner-policy.md`). README.md names all three in its policy table.
- The order a call's policy comes from is stated once, in
  `guides/how-to-write-a-policy.md`'s table "Which policy a call gets": the `policy` argument of
  the call first and held to narrowing, the operator's grant, the spawner's choice, the project
  key, `EYG_POLICY`, the policy in the package, and nothing at all if no slot names a module - the
  tool refuses to run anything rather than run unchecked. The order is one
  function, `resolvePolicy` in `lib/render-helpers.mjs`, and the unit test pins every step of
  it. The same page states the roots order, which is `resolveRoots`.
  `guides/tool-reference.md` carries the knobs and links there for the orders.
- The project key is the per-project knob: `"eyg": { "policy": ..., "roots": [...] }`, where
  the policy is a shipped policy name (`agent-roots`, `deny-all`, `spawner-effects`) or an absolute module path, and the
  roots are absolute paths. This workspace sets it: `.pi/settings.json` names `agent-roots`
  with no roots, which means the working directory. A relative root or a name that resolves to
  no file stops the call with a message that names the key.
- The customization home is `guides/how-to-write-a-policy.md`: what one record
  covers, the shipped policies to copy, how to write handlers, how to check the module and
  point the tool at it, and how to prove the policy answered. The roots recipe is there too.

Measured 2026-11-20 in a scratch project (a fresh `pi --print` with `--tools eyg`, through a
development build of the language CLI this tree no longer has -
`docs/world/entities/cli.runner-official-install-only.md`): a
`.pi/settings.json` naming `deny-all` and one root gave the probe header
`deny-all.eyg (project settings)`, a write inside that root came back
`write_file denied by policy` with nothing written, 16 probes took 0.94 s, and replacing the
root with `relative/too` answered `every eyg.roots entry must be an absolute path, got
relative/too` without running anything.

What is **not** configurable per call:

- a call cannot widen itself: its `policy` argument is honoured only when it names the policy
  the other slots already chose, or the narrowest policy the package ships (`deny-all.eyg`,
  `NARROWEST_POLICY_FILE` in `lib/render-helpers.mjs`); any other name is refused and the tool
  says which name it refused. A wider module comes from the operator's grant
  (`docs/world/entities/pi.session-grants.md`), the project key, or the environment. A spawner
  naming a child's policy is held to the same rule: the spawn is refused when `resolvePolicy`
  reports `refusedArgument`.

## Not this

- what an effect-handler may return and why a refusal is a value: `docs/world/decisions/ADR-002-handler-seam.md`;
- the tool's parameters, actions and probe rows: `guides/tool-reference.md`;
- how to write the handlers themselves: the guide named above.

@measured 2026-11-20 by `grep -c 'Which policy a call gets' guides/how-to-write-a-policy.md` (1),
`grep -c 'eyg.policy' guides/how-to-write-a-policy.md` (2), `grep -q agent-roots .pi/settings.json`
and `grep -q resolvePolicy extensions/eyg-codemode.ts` (both found), the scratch-project session
above, and `node --test 'test/*.mjs'` (pass 1, fail 0, 0.05 s: the six-step precedence, both
roots orders, the policy-name rules and the settings shaping are asserted).

Re-measured 2026-11-21 with the argument held to narrowing: `node --test 'test/*.mjs'` (pass 1,
fail 0, 0.06 s) asserts the equal case, the `deny-all.eyg` case, and three refusals (a wider
shipped policy, a module of the model's own, `spawner-effects.eyg` over a package default), and
`grep -q NARROWEST_POLICY_FILE lib/render-helpers.mjs` with
`grep -q refusedArgument extensions/eyg-codemode.ts` both answer found.
