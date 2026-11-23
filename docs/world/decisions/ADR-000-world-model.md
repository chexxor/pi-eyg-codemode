---
id: ADR-000-world-model
type: adr
owner: human
status: accepted
verified_at: 2026-11-23
verify: "test -f docs/world/00-map.md && test -f docs/world/roster.yaml"
confidence: high
sources: [docs/world/00-map.md, docs/world/roster.yaml]
supersedes: null
superseded_by: null
---

# ADR-000: a cited markdown world model in the repository

## Context

Agents rediscover the layout, act on stale assumptions, and re-litigate settled
decisions. The facts that survive a session - boundaries, entry points, invariants,
traps - need a home a clone can read.

## Decision

Markdown with front-matter in git. Every claim carries a shell `verify` command that
re-derives it from source. Agents propose, owners promote, staleness is a CI concern.

## Alternatives rejected

- Graph database: solves a concurrency problem git already solves; adds a second merge
  authority and a second staleness window.
- Vector store over notes: retrieval cannot express "and how do I check this"; loses
  provenance.
- A prompt that says "check the sources": decays, cannot be enforced.

## Consequences

+ Cheap, greppable, revertible with the code, no infrastructure, works offline.
- `verify` coverage is the discipline. Stale-claim rate above 15% for two weeks freezes
  new pages until verification is repaired.

## Revisit triggers for a graph store

Two of three must hold: more than two knowledge-file merge conflicts a week after the
one-writer rule; agents routinely need multi-hop traversal grep cannot answer; unmerged
branch knowledge must be visible live across agents.
