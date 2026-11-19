---
id: world-model.package
type: entity
owner: delegate
status: current
verified_at: 2026-11-19
verify: "test -f pi-simple-world-model/bin/world_lint.mjs && grep -q pi-simple-world-model .pi/settings.json && grep -q '\"..\"' .pi/settings.json"
confidence: high
sources: [pi-simple-world-model/package.json, pi-simple-world-model/README.md, .pi/settings.json, README.md]
supersedes: null
superseded_by: null
---

# The world model tool, vendored in this workspace

`pi-simple-world-model/` is a pi package carried in this workspace as a copy, declared
per project in `.pi/settings.json` (written `../pi-simple-world-model`, relative to the
settings file; `pi list` on 2026-11-18 resolves it to
`/home/chexxor/Git/pi-eyg-codemode/pi-simple-world-model`). Every session rooted here
loads the `world_model` tool, the `project-world-model` skill, the `/world` command and
the tier-0 injection of `docs/world/00-map.md`.

The three CLIs run from this workspace root: `node pi-simple-world-model/bin/world_lint.mjs`
(0.06 s), `world_map.mjs` (`--check`, `--init`; 0.04 s) and `world_verify.mjs` (`--all`,
`--changed-from <ref>`; 0.37 s wall over 24 claims on 2026-11-18). All are offline; `verify`
caps each claim's command at 20 s.

## Not this

It is not the model. `docs/world/` holds the claims; the package is only the tool over
them, and a session can read the records without the package installed. It is also not
shared with any other workspace: the copy-per-workspace rule is recorded in
`docs/world/decisions/ADR-001-world-model-import.md`.
