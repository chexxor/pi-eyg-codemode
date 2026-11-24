---
id: runbook.next-milestone
type: runbook
owner: delegate
status: current
verified_at: 2026-11-24
verify: "test -f docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.windows-is-undocumented' docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.policy-runner-not-on-main' docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.grant-polish-undecided' docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.policy-record-extension' docs/world/runbooks/runbook.next-milestone.md && grep -q 'gap.one-host-check-not-transitive' docs/world/runbooks/runbook.next-milestone.md"
confidence: high
sources: [docs/world/entities/gap.windows-is-undocumented.md, docs/world/entities/gap.policy-runner-not-on-main.md, docs/world/entities/gap.language-skill-home-undecided.md, docs/world/entities/gap.grant-polish-undecided.md, docs/world/entities/gap.policy-record-extension.md, docs/world/entities/gap.one-host-check-not-transitive.md, docs/world/decisions/ADR-004-doc-shape-for-two-readers.md, docs/world/decisions/ADR-006-guard-in-package.md]
supersedes: null
superseded_by: null
---

# The next milestone's work list, as the documentation audit found it

Each row is a claim whose `verify` still passes, which means the hole is still open. Work one
row at a time; when a row's command starts failing, the feature landed - move the record with
the new evidence rather than leaving it suspect.

| gap claim | what is missing | the first step |
| --- | --- | --- |
| `gap.windows-is-undocumented` | anything at all about Windows beyond the release asset's name | run one Windows session and record the rows; fix the environment hand-off if it fails |
| `gap.policy-runner-not-on-main` | a host of the language's own in its default branch, not only in a branch of it | land it there and publish it, then re-capture `test/fixtures/rule_mapping.gleam` and re-run the live guard against that source; this package is unblocked meanwhile (`docs/world/decisions/ADR-006-guard-in-package.md`) |
| `gap.language-skill-home-undecided` | a decision about where the EYG language-skill package lives: the sibling checkout declared by path, a copy inside this package, or a published package declared by name | read `notes/pi-codemode-language-skill-packaging.md`; if the upstream `SKILL.md` front-matter fix has landed, re-run the A/B recorded in `usability.without-language-skill`; then write the choice as a decision record in `docs/world/decisions/` named for the topic, which retires the row |
| `gap.grant-polish-undecided` | the grant polish the child-surface milestone parked: a live proof of the N-call duration, any time bound on a grant, a way for the operator to list the grants in force without starting one, and the wording of the ask a refusal prints - seen live 2026-11-22 suggesting a "root" cut out of a refusal reason (`EYG_SUBAGENT_EFFECTS=read_file,standard_out...`, `/home`) | drive one RPC session that spends a 2-call grant and record it in `pi.session-grants.md`; fix the ask's text where the reason names no path, which is a change to the row builder and its test, not to a policy |
| `gap.policy-record-extension` | a way to extend or override the policy record the host loaded, so changing one handler stops meaning copying a file | ask the language for the shape named in `notes/pi-eyg-codemode-policy-record-extension.md`; when a release carries it, shrink `policies/spawner-effects.eyg` to the handlers it changes and move the record with the new count |
| `gap.one-host-check-not-transitive` | a parse that names the handler labels of a program **and of the modules it imports**, so a clause written in an imported module is refused before the run | ask the language for that transitive parse; the effect row cannot answer it (`handle L` deletes `L`, and a handled row and a never-needed row print identically, with no ascription to demand an empty row). Meanwhile the limit is measured by `test/fixtures/imported-handler.eyg` and costs the honesty of a run's answer, not its reach |

The audit that produced this list is `ADR-004-doc-shape-for-two-readers`. Two further gaps are
documentation, not functionality, and were fixed in the same milestone as this record: the
missing tutorial and the missing how-to guides. Anything added to this list goes through the
same rule as every other claim: a command that answers while the hole is open.

One parked decision now sits in the table rather than only in prose: where the EYG language-skill
package lives (`gap.language-skill-home-undecided`). It is the only line of this tree that
reaches outside it (`pi list`, 2026-11-20). The measurement and the recommendation - keep it
outside, do not vendor it, ask for the one-line `SKILL.md` front-matter fix in that package - are
recorded once in `notes/pi-codemode-language-skill-packaging.md` and
`docs/world/entities/usability.without-language-skill.md`; the decision itself is the operator's,
and the two events that reopen it are on the gap record.
