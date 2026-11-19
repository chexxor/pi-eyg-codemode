# pi-simple-world-model

A project world model an agent can trust: a tier-0 map, entity pages, invariants,
traps, decisions and runbooks in `docs/world/`, where **every claim carries a shell
command that re-derives it from source**. Nothing is "keep it updated" - the lint,
the map and the verify step are executable rules.

It is a map with citations, not a copy of the facts. The model tells you where to
look and how to check; the source holds the detail.

## Install

Locally, from a checkout of this repository:

```bash
pi install ./pi-simple-world-model          # personal
pi install ./pi-simple-world-model -l       # this project only (.pi/settings.json)
pi list                                     # confirm it is configured
```

From npm or git once published:

```bash
pi install npm:pi-simple-world-model
pi install git:github.com/<owner>/<repo>@v1
```

Try it for one run without installing:

```bash
pi -e ./pi-simple-world-model/extensions/world-model.ts
```

Project-local packages load after project trust is granted. The extension executes
`verify` commands written in the world model, so review a model you did not write
before trusting it.

## What you get

| resource | what it does |
| --- | --- |
| tool `world_model` | `map`, `claims`, `lint`, `verify`, `init` - returns records `claim \| status \| verified_at \| verify \| sources`, never prose |
| command `/world` | `/world map`, `/world claims <id>`, `/world lint`, `/world verify` |
| skill `project-world-model` | the authoring and read-before-acting rules |
| prompt template `world-model` | the same rules for a fresh session |
| tier-0 injection | `docs/world/00-map.md` is placed in the system prompt once per session, so an agent does not rediscover the layout |

## The three CLIs

```bash
node pi-simple-world-model/bin/world_map.mjs --init        # create docs/world/ in a repo
node pi-simple-world-model/bin/world_lint.mjs              # schema gate, exit 1, file:line: rule
node pi-simple-world-model/bin/world_map.mjs --check       # is the generated index stale?
node pi-simple-world-model/bin/world_verify.mjs --all      # run every claim's verify command
node pi-simple-world-model/bin/world_verify.mjs --changed-from origin/main
```

`verify` writes `verified_at` on a pass and sets `status: suspect` on a failure. It
never promotes a suspect claim back to `current`; only a human or the page owner
does that, after reading the source.

## Record schema

```yaml
---
id: entity.auth.session          # equals the filename stem
type: entity                     # entity | invariant | runbook | trap | adr
owner: agent-07                  # must appear in roster.yaml, or "human"
status: current                  # draft | current | suspect | superseded
verified_at: 2026-11-14          # written by the verify tool, never by hand
verify: "grep -qn 'validateSession' src/middleware/session.ts"
confidence: high                 # high | medium | low
sources: [src/middleware/session.ts, commit:9f2ac1e]
supersedes: null
superseded_by: null
---
```

Body: prose, ≤120 lines (ADRs ≤200), no code block longer than 5 lines, every entity
page has a `## Not this` section. Task state, session narrative and secrets are lint
failures.

## Cost, measured 2026-11-14

| loop | command | cost |
| --- | --- | --- |
| lint the model | `node pi-simple-world-model/bin/world_lint.mjs` | 0.10-0.14 s wall, no network |
| regenerate the map | `node pi-simple-world-model/bin/world_map.mjs` | 0.10-0.13 s wall |
| verify every claim | `node pi-simple-world-model/bin/world_verify.mjs --all` | 2.2-2.6 s wall - the commands the claims name dominate; parsing is under 0.05 s |

## Dependencies

Node standard library only. `verify` shells out with a 20-second timeout per claim;
no network, no package install, no database.

## License

Apache-2.0, as the repository that carries it.
