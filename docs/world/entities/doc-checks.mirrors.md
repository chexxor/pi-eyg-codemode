---
id: doc-checks.mirrors
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "node bin/agent/doc-checks.mjs mirrors | grep -qx 'mirrors: ok'"
confidence: high
sources: [bin/agent/doc-checks.mjs, test/doc-checks.test.mjs, guides/tool-reference.md, docs/world/decisions/ADR-003-doc-delegation.md]
supersedes: null
superseded_by: null
---

# No upstream page copied into `guides/`, and no pointer to a file that is gone

Two halves, one per failure mode of an offline documentation copy.

**A copied page.** No file under `guides/` may have the basename of an upstream EYG page. The
list in `UPSTREAM_SLUGS` carries both shapes the copies had (`syntax`,
`builtins_reference`, `cli_effects_reference`, `install_prebuilt`, `install_from_source`,
`pi_codemode_agent`) and the slugs live upstream uses today (`eyg-syntax-guide`,
`builtins-reference`, `cli-effects-reference`, `install-a-prebuilt-binary`, `install-from-source`,
`effect-access-policies`, `advanced-effects`, `file-resolution`, `writing-tests-with-aok`), so
re-adding a mirror under either name fails the check the day it is added. This package deleted
those six mirrors in favour of one generated file plus links
(`docs/world/entities/guides.index.md`, `docs/world/entities/guides.surface-file.md`).

**A dangling pointer.** In the prose set, every mentioned path that starts with a top-level entry
of this tree and ends in a known extension (`.md .ts .mjs .eyg .gleam .json .sh .tsv`) must
exist. A mention containing `<` or `*` is a template, not a pointer, and a line containing
`deleted` is evidence rather than a pointer.

The generated surface file is the reason the second half exists: `guides/eyg-surface.tsv` is
named in fifteen places, and an earlier version of the checker read its `.tsv` as a `.ts` path
because the extension alternation was ordered wrongly - a checker bug that reported fifteen
missing files and no real drift. The alternation now puts `tsv` before `ts`.

The limit is the list: a mirror named something else is not caught until its slug joins
`UPSTREAM_SLUGS`, and the check does not read the file's content to compare it with upstream.
What keeps the *rows* true is a different check - `gen-surface.mjs --check`
(`docs/world/entities/guides.surface-file.md`).

## Not this

- not a check that the links in `guides/` resolve to live URLs: `<https://eyg.run/...>` is
  upstream's to keep (`docs/world/entities/guides.index.md`);
- not the drift check on `guides/eyg-surface.tsv`, which compares rows against the recorded
  runtime and the tool's own record;
- not a ban on quoting upstream: a quotation in `guides/tool-reference.md` marked as a capture
  is a quotation, not a page in the tree.
