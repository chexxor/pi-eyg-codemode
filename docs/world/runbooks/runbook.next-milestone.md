---
id: runbook.next-milestone
type: runbook
owner: delegate
status: current
verified_at: 2026-11-19
verify: "test -f docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.runner-release-lacks-policy' docs/world/runbooks/runbook.next-milestone.md"
confidence: high
sources: [docs/world/entities/gap.runner-release-lacks-policy.md, docs/world/entities/gap.install-guides-name-no-policy.md, docs/world/entities/gap.roots-have-no-config-file.md, docs/world/entities/gap.windows-is-undocumented.md, docs/world/decisions/ADR-004-doc-shape-for-two-readers.md]
supersedes: null
superseded_by: null
---

# The next milestone's work list, as the documentation audit found it

Each row is a claim whose `verify` still passes, which means the hole is still open. Work one
row at a time; when a row's command starts failing, the feature landed - move the record with
the new evidence rather than leaving it suspect.

| gap claim | what is missing | the first step |
| --- | --- | --- |
| `gap.runner-release-lacks-policy` | a published CLI that accepts `--policy`, which is what makes this package usable at all | publish the release, then re-run the effect probes and move `cli.prebuilt-binary` |
| `gap.install-guides-name-no-policy` | a page that takes a working CLI to a runner this package finds | write `guides/how-to-point-the-tool-at-your-runner.md`, then file the same gap against the website |
| `gap.roots-have-no-config-file` | a per-project place for the roots, so a session does not inherit the cwd by surprise | decide the shape (a `roots` key in `.pi/settings.json`), then implement it in the extension and its test |
| `gap.windows-is-undocumented` | anything at all about Windows beyond the release asset's name | run one Windows session and record the rows; fix the environment hand-off if it fails |

The audit that produced this list is `ADR-004-doc-shape-for-two-readers`. Two further gaps are
documentation, not functionality, and were fixed in the same milestone as this record: the
missing tutorial and the missing how-to guides. Anything added to this list goes through the
same rule as every other claim: a command that answers while the hole is open.
