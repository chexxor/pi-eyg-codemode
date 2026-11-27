---
id: guides.surface-arg-shapes
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "test \"$(awk -F'\\t' '$1==\"effect\"{n++} END{print n}' guides/eyg-surface.tsv)\" = 23 && test \"$(awk -F'\\t' '$1==\"effect\" && $4==\"\"{n++} END{print n+0}' guides/eyg-surface.tsv)\" = 0 && node bin/agent/gen-surface.mjs --check && test -f test/fixtures/effect-args.tsv && node bin/agent/misshape-probe.mjs --program test/fixtures/misshaped-ask.eyg 2>&1 | grep -q 'guides/eyg-surface.tsv'"
confidence: high
sources: [guides/eyg-surface.tsv, bin/agent/gen-surface.mjs, test/fixtures/effect-args.tsv, test/fixtures/effect-args.PROVENANCE.md, test/fixtures/rule_mapping.gleam, lib/render-helpers.mjs, notes/pi-codemode-surface-arg-shapes.md, docs/world/entities/gap.surface-rows-name-no-argument.md]
supersedes: gap.surface-rows-name-no-argument
superseded_by: null
---
# An effect row names its argument shape, and the row a type mismatch points at can answer

Every one of the 23 effect rows of `guides/eyg-surface.tsv` now ends with the argument that
effect's ask carries and what the effect answers back - `ReadFile` a row of
`{path: String, offset: Int, limit: Int} -> Result(Binary, String)`, `Env` a row of
`(String) -> Option(String)`. The column is generated: `bin/agent/gen-surface.mjs` reads
`test/fixtures/effect-args.tsv`, one row per label, and `--check` requires a row there for
every label in `POLICY_FIELDS` and none for an effect the package does not name, so a shape
that drifted reads as a failed check rather than as a sentence nobody re-ran.

| step | answer |
| --- | --- |
| `node bin/agent/gen-surface.mjs --check` | `surface current: 29 builtins, 23 effects, all inputs agree` |
| `awk -F'\t' '$1=="effect" && $4==""{n++} END{print n+0}' guides/eyg-surface.tsv` | `0` - no effect row ships an empty shape |
| `node bin/agent/misshape-probe.mjs --program test/fixtures/misshaped-ask.eyg` | names the mis-shape in 0.25 s and quotes the row that now answers it: the refusal for a mis-shaped ask points at `guides/eyg-surface.tsv` (`misshapedAskRows`, `lib/render-helpers.mjs`) |

The source of the column is two sources, and the row that tells them apart is written in
`test/fixtures/effect-args.PROVENANCE.md`: twenty-two shapes are the language's CLI-effects
page read 2026-11-27, and `Search` is this package's own, because the guard rather than the CLI
hosts that walk - its shape is read off `host/guard.eyg`, which reads `path`, `pattern` and
`limit` out of the request and answers a list of the paths that matched.

**What this is not.** It is not the prose page: the file ships no description of what an effect
does, only shapes, and the page stays the URL the header names. It is not a claim that the shapes
are complete - two of them keep the page's own ellipses (`Fetch` names `headers: List(...)`,
`Sign` points at `CreateKey`'s return row) rather than inventing an element type, and
`test/fixtures/effect-args.PROVENANCE.md` says which rows those are. It is not a new check the
package runs: the same `--check` row of the audit covers it.

**Trigger to revisit:** a runtime release whose `rule_mapping` names an effect this package's
`POLICY_FIELDS` does not (the four authenticated-service effects the page documents - `GitHub`,
`Netlify`, `DNSimple`, `Vimeo` - are not in the snapshot, so they have no shape row here); then
the fixture gains rows and `codemode.effect-surface` moves with it.

## Not this

- the labels, the unchecked set and the policy fields: `docs/world/entities/codemode.effect-surface.md`;
- the builtin rows and their signatures: `docs/world/entities/guides.surface-file.md`;
- the hole this closed, and what nine type mismatches in 32 calls cost before it:
  `docs/world/entities/gap.surface-rows-name-no-argument.md`;
- why a recorded fixture rather than a CLI probe or the guard alone: `notes/pi-codemode-surface-arg-shapes.md`;
- what a mis-shaped ask costs, and where its shape is now read:
  `docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md`.
