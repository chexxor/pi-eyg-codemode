---
id: gap.roots-have-no-config-file
type: entity
owner: delegate
status: superseded
verified_at: 2026-11-23
verify: "grep -q agent-roots .pi/settings.json && grep -q resolveRoots extensions/eyg-codemode.ts"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, .pi/settings.json, guides/how-to-write-a-policy.md, notes/pi-codemode-project-settings-key.md, docs/world/entities/pi.policy-config.md]
supersedes: null
superseded_by: pi.policy-config
---

# Gap closed: the roots and the policy have a per-project place to be named

This page recorded the hole: the roots in force were the session working directory or
`EYG_ALLOWED_ROOTS`, `.pi/settings.json` carried no key for them, and a person who wanted a
different root set per project had to export a variable per session, so nothing in the tree
said which project owned which roots.

It closed on 2026-11-20, on the operator's request. `.pi/settings.json` now carries an `eyg`
key - `policy` (a policy name or an absolute module path) and `roots` (absolute paths) - the
tool reads it on every call through `eygSettings`, `shippedPolicyPath`, `resolvePolicy` and
`resolveRoots` in `lib/render-helpers.mjs`, and the shape, both orders and the refusal
messages are in `guides/how-to-write-a-policy.md`. The command above checks the opposite
of what it used to: it passes because the key is there and the extension reads it.

Two things this does not settle. A session cannot widen its own boundary while it runs - the
in-session grant the operator agrees to for one call, N calls or the rest of the session is
still open, and `docs/world/decisions/ADR-002-handler-seam.md` explains why the widening has to
be operator-authored. And the key is read from pi's *effective* settings, so a key in the
global file applies to every project; the reasoning and the cost of that choice are in
`notes/pi-codemode-project-settings-key.md`.

## Not this

It is not about what the roots allow: a policy decides per effect under whatever roots are in
force, and that behaviour is `overlay.policy-rules`. The knob and its orders are
`pi.policy-config`.
