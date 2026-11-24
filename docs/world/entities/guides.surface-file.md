---
id: guides.surface-file
type: entity
owner: delegate
status: current
verified_at: 2026-11-24
verify: "node bin/agent/gen-surface.mjs --check && node --test test/render-helpers.test.mjs 2>&1 | grep -q 'fail 0'"
confidence: high
sources: [guides/eyg-surface.tsv, bin/agent/gen-surface.mjs, test/fixtures/rule_mapping.gleam, test/fixtures/surface.PROVENANCE.md, lib/render-helpers.mjs, test/render-helpers.test.mjs]
supersedes: null
superseded_by: null
---

# One generated surface file, and the check that keeps it true

`guides/eyg-surface.tsv` is the whole offline answer to "what may I call, and what may I ask
for": 29 `builtin` rows (name, the section the language's page files it under, its signature)
and 23 `effect` rows (name, the policy field that decides it, or `none` for the four no policy
can forbid). `#` lines above the rows are its header, which names the page that records when
the builtin rows were captured and the command that re-derives the file. `kind`, `name`,
`detail1`, `detail2`
is the column line, and a parser that ignores the four kinds it does not know treats that line
as a row, which is what `surfaceRows` in both readers guards against.

The builtin rows are a capture of the language's builtins page taken 2026-11-18 from page text
whose `md5` is `e859f37e70d9e058b11bf4c372693f44` (@measured 2026-11-18; `node bin/agent/gen-surface.mjs
--builtins <the page as markdown> --write` re-captures and prints the line to record here). The
file itself carries no date: `--check` decides whether its rows are current, and
`test/render-helpers.test.mjs` asserts that no date appears in it.

Four offline comparisons decide whether the file is current, all run by
`node bin/agent/gen-surface.mjs --check` (0.07 s here):

1. its `effect` rows against `test/fixtures/rule_mapping.gleam`, the runtime's `rule_mapping`
   recorded verbatim;
2. the same rows against `POLICY_FIELDS` in `lib/render-helpers.mjs`, the record the tool
   renders from, so the file and the code cannot disagree;
3. every `!builtin` this tree's own `.eyg` sources call against its `builtin` rows - the names
   this package depends on at run time pin the list;
4. the file byte for byte against what the generator rebuilds from its inputs, which is what
   makes a hand-edited row drift.

The unit suite plants three mutations in the rows in memory and asserts the check answers each -
a renamed effect row, a deleted effect row, a renamed builtin this tree calls - so the drift
check is proved to bite, not merely advertised (`test/render-helpers.test.mjs`, and
`surfaceDriftProblems` is exported for exactly that).

Two readers: `action: "reference"` prints both halves of the file, and a run that named a
builtin the runtime does not have gets rows naming the file
(`docs/world/entities/pi.reference-action.md`). The prose neither of them carries - what an
effect does, the argument type a rule must return, how to install a CLI - is upstream at
<https://eyg.run/guides> and this package copies none of it
(`docs/world/entities/guides.index.md`).

The limit is honest: the builtin rows are a dated capture, not a live read, because the drift
check runs offline and the installed CLI prints no builtin list
(`docs/world/entities/cli.prebuilt-binary.md`). Comparison 3 catches a rename of a builtin this
package calls; a builtin it never calls stays unverified until someone with network access runs
`--builtins <the page as markdown> --write` (`test/fixtures/surface.PROVENANCE.md`).

## Not this

- not the effect reference in prose: that page is the language's, and the file carries rows,
  not explanations;
- not the policy's verdict on one effect: `action: "effects"` asks the policy in force, and
  `docs/world/entities/overlay.policy-rules.md` is how a rule decides;
- not the compiler: under every row of the file is the language repository's build, which this
  workspace does not build (`docs/world/entities/gap.policy-runner-not-on-main.md`).
