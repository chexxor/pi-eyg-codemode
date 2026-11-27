---
id: gap.surface-rows-name-no-argument
type: entity
owner: delegate
status: superseded
verified_at: 2026-11-27
verify: "grep -q '^superseded_by: guides.surface-arg-shapes' docs/world/entities/gap.surface-rows-name-no-argument.md && test -f docs/world/entities/guides.surface-arg-shapes.md && test \"$(awk -F'\\t' '$1==\"effect\" && $4==\"\"{n++} END{print n+0}' guides/eyg-surface.tsv)\" = 0"
confidence: high
sources: [guides/eyg-surface.tsv, bin/agent/gen-surface.mjs, test/fixtures/rule_mapping.gleam, test/fixtures/unchecked-ask-misshape.eyg, notes/pi-codemode-new-user-persona.md, guides/tool-reference.md]
supersedes: null
superseded_by: guides.surface-arg-shapes
---
# Gap: an effect row names the effect and its policy field, and nothing about its argument

**Closed 2026-11-27** by `docs/world/entities/guides.surface-arg-shapes.md`: the last column of
every effect row now names the argument that effect's ask carries. Read the rows below as the
hole as it stood until that change.

`guides/eyg-surface.tsv` carries 29 builtin rows and 23 effect rows. On a builtin row the fourth
column holds the signature the language's builtins page gave it; on every one of the 23 effect rows
that column is empty - the row is a name and a policy field, or `none` for the four the CLI marks
unchecked. Nothing in the generation carries more: the labels come from
`test/fixtures/rule_mapping.gleam`, the recorded runtime rule mapping, which is a mapping of effect
name to rule, and the field column is this package's own (`bin/agent/gen-surface.mjs` derives the
rows from that fixture and requires the labels to equal `POLICY_FIELDS` in
`lib/render-helpers.mjs`).

What that costs a session: every type-mismatch refusal tells the model to re-check the ask against
the effect's row in that file, and the row cannot answer it. The new-user run spent three calls on
one deletion - a record where the effect wants a bare path, then the reverse-shaped message - and
nine type mismatches in 32 calls (`notes/pi-codemode-new-user-persona.md`, tallied from the
transcript). `WriteFile` wants `{path, contents}` with `contents` a `Binary`, and `ReadFile` answers
an `Ok(Binary)`; none of that is readable offline, and the language's page on CLI effects, which
does describe each effect, is a URL the package copies no prose of (`guides/eyg-surface.tsv` header,
`ADR-003-doc-delegation`).

**How it was closed:** a column of argument shapes on the effect rows, generated from
`test/fixtures/effect-args.tsv` by `bin/agent/gen-surface.mjs` and drift-checked by `--check` like
every other row; the fixture's source is named in the file's header comment and in
`test/fixtures/effect-args.PROVENANCE.md`. The guard-alone arm was rejected in
`notes/pi-codemode-surface-arg-shapes.md` for naming fields but no types.

## Not this

- what each effect does in prose, which is the language's page and not this file's: the URL named in
  the surface file's header;
- the labels, the unchecked set and the policy fields, which the drift guard already compares against
  the fixture and against `POLICY_FIELDS`: `docs/world/entities/codemode.effect-surface.md`;
- the builtin rows, whose signatures this file already carries: `docs/world/entities/guides.surface-file.md`;
- what a refusal row costs a session, and where the ask's shape comes from:
  `docs/world/entities/gap.unchecked-effect-ask-costs-the-cap.md`.
