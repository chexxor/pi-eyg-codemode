---
id: runbook.next-milestone
type: runbook
owner: delegate
status: current
verified_at: 2026-11-20
verify: "test -f docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.runner-release-lacks-policy' docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.policy-runner-not-on-main' docs/world/runbooks/runbook.next-milestone.md"
confidence: high
sources: [docs/world/entities/gap.runner-release-lacks-policy.md, docs/world/entities/gap.install-guides-name-no-policy.md, docs/world/entities/gap.roots-have-no-config-file.md, docs/world/entities/gap.windows-is-undocumented.md, docs/world/entities/gap.policy-runner-not-on-main.md, docs/world/decisions/ADR-004-doc-shape-for-two-readers.md]
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
| `gap.policy-runner-not-on-main` | the checked one-shot runner in the language's default branch, not only in a branch of it | land it there and publish it (the row above), then re-capture `test/fixtures/rule_mapping.gleam` and re-run the live guard against that source |

The audit that produced this list is `ADR-004-doc-shape-for-two-readers`. Two further gaps are
documentation, not functionality, and were fixed in the same milestone as this record: the
missing tutorial and the missing how-to guides. Anything added to this list goes through the
same rule as every other claim: a command that answers while the hole is open.

One parked decision sits here rather than in the table, because no command answers it and the
operator wants it reviewed later: **should the EYG language-skill package stay a separate
package declared from outside this tree, or live inside this one?** It is the only line of
this tree that reaches outside it (`pi list`, 2026-11-20). It moved on 2026-11-20 with a
measurement and a recommendation: measured over eight one-shot sessions, the declaration loads
no skill at all (that package's `SKILL.md` front matter is invalid YAML, so pi never advertises
it), and even a loadable copy of the skill was opened by one session in six - while the same
sessions reading this package's own `guides/` mirrors first finished in 11 calls and 89 s with no
invented builtin. Recommendation: keep it outside, do not vendor it, ask for the one-line
front-matter fix in the other workspace, and point the agent at the mirrors from this package's
own skill. Both options, the costs and the new trigger (the fix lands and a re-run beats the
mirrors, or a release lets the declaration be written by name) are in
`notes/pi-codemode-language-skill-packaging.md`; the measurement is
`docs/world/entities/usability.without-language-skill.md`.
