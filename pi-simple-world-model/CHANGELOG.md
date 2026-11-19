# Changelog

## 1.0.0 - 2026-11-14

- First release: the `world_model` tool, the `/world` command, the
  `project-world-model` skill, and the `world_lint` / `world_map` / `world_verify`
  CLIs.
- Tier-0 `docs/world/00-map.md` is injected into the system prompt once per session,
  so layout is loaded rather than rediscovered.
- `verify` writes `verified_at` on a pass and sets `status: suspect` on a failure.
  It never promotes a suspect claim back to `current`.
- `world_map.mjs --init` scaffolds `docs/world/` (map, roster, invariants, traps,
  an ADR-000, and the empty entity/decision/runbook/proposed directories) for a
  repository that has no world model yet.
