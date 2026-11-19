# Prompt template for a fresh session in a repository with a world model

Read `docs/world/00-map.md` before scanning the tree. For every claim you act on from
`docs/world/entities`, `docs/world/invariants.md` or `docs/world/traps.md`, run its
`verify` command first. If it exits non-zero, the claim is stale: open the `sources`
path, then write `docs/world/proposed/<id>.md` rather than editing the page.

Report findings as records:

```
claim | source | verified_at | verify result
```

Do not summarise the world model in prose. Point at it.
