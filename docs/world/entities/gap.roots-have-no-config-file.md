---
id: gap.roots-have-no-config-file
type: entity
owner: delegate
status: current
verified_at: 2026-11-20
verify: "grep -q 'EYG_ALLOWED_ROOTS' extensions/eyg-codemode.ts && ! grep -q 'roots' .pi/settings.json"
confidence: high
sources: [extensions/eyg-codemode.ts, .pi/settings.json, README.md, policies/agent-roots.eyg]
supersedes: null
superseded_by: null
---

# Gap: the roots a session may reach have no place to configure them per project

The roots in force are the session working directory, or `EYG_ALLOWED_ROOTS` read from the environment by the shipped preset (`extensions/eyg-codemode.ts` sets it for the call and restores it after). `.pi/settings.json` carries package declarations, extensions and tools - it has no roots key. So a person who wants a different root set per project has to export the variable per session, and nothing in the tree says which project owns which roots.

## What to do about it

A configuration surface is a feature decision, not a wording fix: name it and its precedence before building it. The options are a `roots` key in `.pi/settings.json` (pi already reads that file per project), or a per-package default file this package resolves from `import.meta.url`. Recommendation: the settings-file key, since the file is already the per-project place and pi owns its shape.

Trigger: a user who runs sessions in more than one directory and gets refused because the roots followed the cwd rather than their intent.

## Not this

It is not about what the roots allow: a preset decides per effect under whatever roots are in
force, and that behaviour is `overlay.policy-rules`. The gap is where those roots come from.
