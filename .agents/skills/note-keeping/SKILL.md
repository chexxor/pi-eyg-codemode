---
name: note-keeping
description: How to use notes/ instead of agent memories - when to write a note, what frontmatter it needs, and when to delete it. Use at the start and end of any non-trivial task.
verified: 2026-11-14
---

# Notes, not memories

Persistent agent memories are forbidden here. The record of decisions is
`notes/`, and the record of what is true about the repository is `docs/world/`.
Keep them apart:

- a **note** is a trade-off the code cannot show: why one option was chosen over
  another, a constraint found by experiment, something that surprised you and
  would surprise the next reader.
- a **world claim** is a fact with a command that proves it still holds. It lives
  in `docs/world/` and carries `verify:`. If you can write the check as a command,
  it is a claim or a test, not a note.

## Frontmatter, required
```markdown
---
name: short slug
description: one sentence
date: YYYY-MM-DD
---
```
`invariant.notes-frontmatter` carries the check, and `node pi-simple-world-model/bin/world_verify.mjs --all` runs it; its cost is in `AGENTS.md`'s command table.

## Write a note only when
- a design trade-off was made and the reasoning is not visible in the code;
- a non-obvious constraint was discovered by experiment;
- something would surprise the next reader.

## Never
- duplicate `guides/**`, `README.md` or `CONTRIBUTING.md`;
- record a fact the code or a test already states;
- leave a note you have not re-verified.

## Style reference
`notes/pi_codemode_host_gate.md`, `notes/pi_codemode_runner_probe.md`,
`notes/pi_codemode_registry_probe.md`, `notes/pi-codemode-policy-inlining.md`.

## At the end of a session
For each note you touched: still true - keep it and update `date:`; fixed by a
test or a code change - delete it; not read or edited in 90 days and no longer
load-bearing - delete it. A claim you touched goes through `world_verify.mjs --all`,
or `--changed-from <baseline commit>` for the claims a diff moved; a claim whose
command fails is `status: suspect` with the date it was caught, and only a human
promotes it back.
