---
id: ADR-004-doc-shape-for-two-readers
type: adr
owner: human
status: accepted
verified_at: 2026-11-22
verify: "grep -q 'diataxis.fr' docs/world/decisions/ADR-004-doc-shape-for-two-readers.md && grep -q 'fuchsia.dev/fuchsia-src/contribute/docs/documentation-style-guide' docs/world/decisions/ADR-004-doc-shape-for-two-readers.md && grep -q '## Alternatives rejected' docs/world/decisions/ADR-004-doc-shape-for-two-readers.md && test -f skills/eyg-codemode/SKILL.md"
confidence: high
sources: [README.md, AGENTS.md, guides/pi_codemode_agent.md, guides/cli_effects_reference.md, skills/eyg-codemode/SKILL.md, .agents/skills/eyg-run/SKILL.md, docs/world/decisions/ADR-003-doc-delegation.md, docs/world/runbooks/runbook.check-a-change.md]
supersedes: null
superseded_by: null
---

# ADR-004: the documentation is shaped for three readers, and the README is an overview that links forward

## Context

Three readers, and each needs a different thing from this tree:

1. **A person installing this package on their own machine.** They want one effect to
   perform, and they want to know what to do when every call is refused.
2. **The model that writes EYG into the `eyg` tool.** It reads `skills/eyg-codemode/SKILL.md`
   and the tool's own rows before it acts; it needs the forms, the shape of a refusal and
   where to ask for help.
3. **The agent working in this repository.** It reads `AGENTS.md` and `docs/world/`, and wants
   commands, budgets and triggers.

`wc -l README.md` answers 398 on 2026-11-19, in 12 sections, and `grep -c '^## ' README.md`
answers 12. Reader 1 walks that wall of reference and explanation before their first command.
The two documentation principles this audit applies:

- **Diátaxis** (<https://diataxis.fr/start-here/, read 2026-11-19): four kinds - tutorial,
  how-to, reference, explanation. Tutorials and how-to guides inform *action*; reference and
  explanation inform *cognition*. Tutorials and explanation serve *study*; how-to guides and
  reference serve *work*. "Where possible, the architecture of reference documentation should
  reflect the structure of the thing it describes", and a tutorial gives the learner the
  *minimal* explanation, linking to the deep article for later.
- **The Fuchsia documentation style guide**
  (<https://fuchsia.dev/fuchsia-src/contribute/docs/documentation-style-guide>, read 2026-11-19,
  last updated 2026-10-16 UTC), which builds on the Google Developers Style Guide
  (<https://developers.google.com/style>): second person ("you"), present tense and active
  voice, sentence case headings, no code formatting in headings, a navigation list near the
  top of a long document (numbered only when the sections run in sequence), empty lines
  around lists and code blocks, no decorative horizontal rules.

The language's how-to stays delegated (ADR-003). What the delegation does **not** cover is
this package's own requirement. The website's install pages verify only
`eyg eval -c '!int_add(1, 1)'` and never mention `--policy`; the repository's
`releases/latest` serves `gleam_cli-v0.1.0` (fetched 2026-11-19), which is the build whose
`--help` has no `--policy` on this host (`docs/world/traps.md` trap-17, and
`guides/install_prebuilt.md` copies the same one-line installer). So the recommended install
route hands a new reader a CLI this package's probe rejects, and the README says so in a
paragraph framed as "this host".

## The four kinds, and where this tree sits

| kind | this tree has it in | this tree lacks |
| --- | --- | --- |
| tutorial | nothing | `guides/first-session.md` |
| how-to | nothing; the goals sit in README sections written as reference | `guides/how-to-point-the-tool-at-your-runner.md`, `guides/how-to-write-a-policy.md`, `guides/how-to-read-in-slices.md`, `guides/how-to-share-functions.md` |
| reference | `guides/cli_effects_reference.md`, `guides/syntax.md`, `guides/builtins_reference.md`, the README tables, `AGENTS.md`'s command table | - |
| explanation | the README's prose, `notes/`, `docs/world/decisions/` | - |

The two missing kinds are filled in this milestone. The functionality holes are claims whose
commands answer while the hole is open, listed in `docs/world/runbooks/runbook.next-milestone.md`.

## Findings, per reader

Reader 1 (a person installing the package):

- **No tutorial.** Nothing walks "I have the package" to "one effect performed". The README's
  first-session block stops at `pi list`. Diátaxis: this tree has reference (`guides/cli_effects_reference.md`,
  `guides/syntax.md`, the README tables) and explanation, and no tutorial and no how-to.
- **Reference before action.** The knobs table, the env table, the policy vocabulary and the
  registry are all in the file the new reader opens first. Reference serves a reader at work;
  a new reader is at study.
- **Words used before they are defined.** *runner*, *policy*, *roots*, *the checks*,
  *refused*, *unchecked*, *registry scope*, *one-shot* are used in the README and never defined
  on the page that uses them. The 2026-11-19 rewording replaced "gate" with "the checks" and
  left the new phrase undefined - the same trap the last audit found, one word later.
- **The blocking fact is host-shaped.** "The prebuilt route is not enough on this host" reads
  as one machine, while the fetched release page shows the latest published release is the
  build without `--policy`. For reader 1 that is not a footnote, it is the first thing they
  would hit.
- **No troubleshooting entry.** "Every call is refused" is named as the honest outcome in the
  README, and nothing tells the reader what to check or where to report it.

Reader 2 (the model that writes EYG):

- `skills/eyg-codemode/SKILL.md` is the right shape - the forms, the refusal value, ask-the-registry
  first, one pointer per question - and it is 81 lines, which is what keeps it cheap to load.
- **A moving measurement in four places.** The same costs appear in the skill, in two `.agents/skills/`
  files, in `guides/pi_codemode_agent.md` and in `AGENTS.md`; `world_verify.mjs --all` took
  0.37 s over 24 claims when they were written and 0.65 s over 40 on 2026-11-19. A cost belongs
  in the one dated table in `AGENTS.md`; elsewhere, point at it.

## Decision

- **The README becomes an overview.** What the package is, who reads it, the one thing that has
  to be true on your machine, then a list that links forward to the tutorial, the how-to guides,
  the reference and the world model. Reference tables that are this package's contract (the tool's
  knobs, the environment variables) move to the page they belong to or stay behind the link list.
- **New pages, named by what the reader does with them** (`guides/first-session.md` as the tutorial;
  `guides/how-to-*.md` for point-the-tool-at-your-runner, write-a-policy,
  read-in-slices, share-functions). A page title states the goal, not the file it touches.
- **A words block in the README** defines *runner*, *policy*, *roots*, *the checks*, *refused*,
  *unchecked* and *registry scope* once, in the order a new reader meets them. It is the
  glossary the Fuchsia guide calls a "glossary term" and Diátaxis calls minimal explanation.
- **The published-release fact moves from a footnote to the overview**, grounded by the fetched
  release page and dated, and paired with the one action that resolves it: build from source, or
  set `EYG_CODEMODE_RUNNER`.
- **Costs live in `AGENTS.md` only.** Skills, guides and runbooks point at the table.
- **Every functionality hole this audit finds becomes a claim** in `docs/world/` whose `verify`
  passes while the hole is still there, indexed by `docs/world/runbooks/runbook.next-milestone.md`.
  The gap log is the next milestone's work list, not this milestone's fix list.

## Alternatives rejected

- **A full Diátaxis re-layout** (rename and move every page into the four kinds): the lint requires
  a claim id to equal its filename stem, so moving `guides/pi_codemode_agent.md` moves ids, pointers
  and verify commands; the two `guides/install_*.md` files would stop being mirrors of the website
  and stop being checkable against it. Trigger to revisit: a reader who cannot find the reference
  they need.
- **Keeping the README as one 398-line document:** the new reader pays the reference tables before
  they can act, and the same facts are then read twice, once at study and once at work.
- **Splitting `skills/eyg-codemode/SKILL.md` into several skills:** pi loads one skill per trigger
  event; more files means more reads in every session for the model, which is the reader that
  pays that cost.
- **Fixing the functionality gaps in this milestone:** the release is the operator's to publish,
  the language repository is read-only from here, and the objective says log them for next time.
- **Citing the website inside the README's claims:** an offline session cannot load it, so the
  website is linked and dated while the checkable artefact stays local (ADR-003's rule).

## Consequences

+ Reader 1 reaches a first effect call in one page and knows, at the top of the README, that the
  release published today has no build that knows `--policy`.
+ Filled on 2026-11-19: `guides/first-session.md` is the tutorial, the four `guides/how-to-*.md`
  pages are the how-tos, and `guides/tool-reference.md` carries the reference this package's README
  used to hold; `guides/PURPOSE` names the two sets in `guides/`, and two claim verifies moved from
  `README.md` to that page (`ADR-002-handler-seam`, `traps.md` trap-04).
+ The model's skill stays short and pointer-shaped, so it costs the same reads it costs today.
+ The audit's findings are records: an ADR a later session can re-read, gap claims with commands
  that prove the hole is still open, and a runbook that names what to do next.
- A new page is a new place for a fact to drift; the world model's `sources` and the lint tie each
  page to the claims that read it.
- The README no longer carries every fact, so a session that reads only the README now reads one
  more file; the link list is the price.
