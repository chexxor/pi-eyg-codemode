---
name: project-world-model
description: "Opens when the EVENT happens: a claim in docs/world/ is about to be acted on and its verify command has not been run this session; the map and the tree disagree; a suspect claim needs reading before anyone trusts it; or a new claim has to be added to a page someone owns. Reads records with commands, never a prose summary. Not for task state or session narrative - those live in .notes/. Triggers: world model, docs/world, entity page, trap, invariant, stale claim, verify claim, roster, proposal."
---

# Project world model

The world model is a map with citations, not a copy of the facts. Every claim carries
a `verify` command that re-derives it from source. If a claim's command fails, the
claim is stale and must not be acted on.

Run the tools from the repository root. All of them are offline, dependency-free and
under a second except `verify`, whose cost is the commands the claims name.

```bash
node pi-simple-world-model/bin/world_lint.mjs        # schema check, exit 1 with file:line: rule
node pi-simple-world-model/bin/world_map.mjs --check # is the tier-0 index stale?
node pi-simple-world-model/bin/world_verify.mjs --all
```

In a repository that does not have a world model yet:

```bash
node pi-simple-world-model/bin/world_map.mjs --init
```

## Before acting on a claim

1. Run its `verify` command. Act only if it exits 0.
2. If it fails, read the `sources` path. Then write `docs/world/proposed/<id>.md`.
   Do not edit a page you do not own.
3. Never state a claim as fact in this session without having opened its source.
   Cite it as `<claim> [<source path>:<lines>]`.

If `docs/world` disagrees with the code, the code is right and the world model is a bug.

## Writing a claim

Every page under `entities/`, `decisions/`, `runbooks/` and each record in
`invariants.md` starts with front-matter:

```yaml
---
id: entity.sources.mobilizon
type: entity
owner: operator
status: current
verified_at: 2026-11-14
verify: "grep -qn 'export function read' sources/mobilizon/index.mjs"
confidence: high
sources: [sources/mobilizon/index.mjs]
supersedes: null
superseded_by: null
---
```

- `verify` is one non-interactive shell command, no network, under 20 seconds, that
  can fail. `true` and bare `echo` are lint failures.
- Entity pages need a `## Not this` section. Body under 120 lines, no code block
  longer than 5 lines, link code as `src/path.mjs:41-88` instead of pasting it.
- Versions, not names: "Node 24", not "the latest Node".
- To contradict a claim, add a new dated claim with `supersedes: <old-id>` and mark
  the old one `superseded_by` + `status: superseded`. Deleting is for facts that
  were never true.

## Traps

Append to `docs/world/traps.md` only after losing at least five tool calls to a
wrong assumption. One entry, three lines at most, including the wrong path taken and
the command that proves it:

```markdown
- 2026-11-14 — `config/defaults` looks authoritative; runtime values come from the
  loader that merges env over it. verify: `grep -n 'merge' config/load.mjs`
```

## Who may write what

`docs/world/roster.yaml` names the owners. Agents append to `traps.md` and file
`proposed/<id>.md`; only the page owner edits an entity page; only the human owner
edits `invariants.md` and the ADRs. A proposal is merged only when its verify command
passes, the lint passes, and - for `invariants.md` - the human approves.
