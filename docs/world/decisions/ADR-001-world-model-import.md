---
id: ADR-001-world-model-import
type: adr
owner: delegate
status: accepted
verified_at: 2026-11-21
verify: "test -f pi-simple-world-model/package.json && grep -q pi-simple-world-model .pi/settings.json"
confidence: high
sources: [pi-simple-world-model/package.json, .pi/settings.json, pi-simple-world-model/CHANGELOG.md]
supersedes: null
superseded_by: null
---

# ADR-001: import the world model package into this workspace

## Context

The world model tool (`pi-simple-world-model`) is authored in
`another of the operator's projects`. This workspace needs the same tool over its own
`docs/world/`. A local pi package is loaded from the path in the settings file, so
there are two ways to make it available: declare the foreign absolute path, or
carry a copy here.

## Decision

Copy the package into this workspace at `pi-simple-world-model/` and declare it
per project: `pi install ./pi-simple-world-model -l`, which writes a relative
declaration into `.pi/settings.json`.

## Alternatives rejected

- Declare `another of the operator's projects/pi-simple-world-model` from here: one
  source of truth, but a session here changes behaviour whenever the publisher
  session edits the tool, and the tool's own `README`/skill paths (`pi-simple-world-model/bin/...`)
  stop matching this tree.
- Install machine-wide (no `-l`): every workspace on this host loads the tool,
  including ones with no `docs/world/`, and the declaration is invisible to this
  repository.

## Consequences

+ This repository carries the tool, so a clone of it brings the checks with it; the
  documented commands (`node pi-simple-world-model/bin/world_lint.mjs`) are
  literally true from the repository root.
- Two copies. A fix to the tool has to be applied in both, and drift between them
  is invisible until someone diffs them.

## Revisit triggers

The publisher copy gains a version this one does not have (`pi-simple-world-model/CHANGELOG.md`
differs), or a third workspace wants the same tool. Then publish it as an npm or
git package and declare that source instead of copying.
