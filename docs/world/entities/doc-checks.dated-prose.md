---
id: doc-checks.dated-prose
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "node bin/agent/doc-checks.mjs dated-prose | grep -qx 'dated-prose: ok'"
confidence: high
sources: [bin/agent/doc-checks.mjs, test/doc-checks.test.mjs, notes/prose-carries-no-dates.md, .agents/skills/eyg-run/SKILL.md, docs/world/entities/cli.prebuilt-binary.md]
supersedes: null
superseded_by: null
---

# The guides, the README and the skills carry no dated stamp

Within the prose set minus `AGENTS.md`, no line may match an ISO date, `@measured`, "measured <a
digit>", "development build"/"dev build", or "this machine had parked". The date pattern is
`(?:19|20)\d{2}-\d{2}-\d{2}`, not one year's literal, so the check does not expire.

Why the rule exists is in `notes/prose-carries-no-dates.md`: a dated stamp in instructions reads
as fact after the date passes, nothing re-checks it, and a reader cannot tell a stale capture
from a live one. The record pages and `notes/` keep dates because they are the claims those
stamps belong to, and each carries a command to re-run.

Two exemptions, both in the checker and both stated where they apply:

- `AGENTS.md` is out of this check's scope. Its command table prices each command with the date
  the cost was measured, which is what makes the price honest rather than a rumor
  (`docs/world/entities/runbook.check-a-change.md`).
- a line in a skill file's front matter starting `verified:` is a pi metadata field, not prose.

What the rule moved rather than deleted: `.agents/skills/eyg-run/SKILL.md` used to open "What the
CLI on this host can and cannot do" with "Measured 2026-11-18 and again 2026-11-21: `command -v
eyg` answers `$HOME/.local/bin/eyg` ...". It now says what a session does with the fact - whether
the CLI on `PATH` is the one that runs every call, because the checks are a program this package
ships and a runtime decision is re-runnable with one command - and points at
`docs/world/entities/cli.prebuilt-binary.md`, which carries the capture and the command that
re-runs it. `guides/eyg-surface.tsv` lost its capture line for the same reason; its header names
`test/fixtures/surface.PROVENANCE.md`, and that page carries the date and the checksum
(`docs/world/entities/guides.surface-file.md`).

`test/doc-checks.test.mjs` plants one line of each shape and asserts one problem, and asserts the
dated `AGENTS.md` table and the skill front matter stay quiet.

## Not this

- not a rule for records: `docs/world/` and `notes/` are dated on purpose, and a claim without a
  capture date is the thing that would be a bug here;
- not a ban on saying when something was true: the pointer the check asks for names the page that
  says it, with its command;
- not the sweep over other workspaces' paths, which is `bin/agent/audit.sh`'s own row
  (`docs/world/entities/overlay.agent-harness.md`).
