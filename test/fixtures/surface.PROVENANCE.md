# eyg-surface.tsv - where the builtin rows came from

`guides/eyg-surface.tsv` carries two kinds of row, and each kind has its own source:

- **effect rows** are generated from `test/fixtures/rule_mapping.gleam`, the runtime's
  `rule_mapping` recorded verbatim (see `rule_mapping.PROVENANCE.md` beside it). Nothing here
  is hand-written, and `--check` re-derives every effect row from that fixture.
- **builtin rows** are a dated capture of the language's builtins page,
  `<https://eyg.run/guides/builtins-reference>`, taken 2026-11-18 from the markdown of the page
  as this tree then held it. The header of the surface file records the capture date and the
  `md5` of that copy (`e859f37e70d9e058b11bf4c372693f44`), which this tree no longer carries:
  the offline copies of the language's pages were deleted, and what survives of them is the
  rows, not the prose.

Why a dated capture instead of asking a CLI: the drift check has to run offline in well under a
second, and the installed CLI prints no builtin list - its `--help` names no command that does
(`docs/world/entities/cli.prebuilt-binary.md`). The compiler is the source under the list; a
capture is a dated statement about it.

What pins the capture, offline: every `!builtin` this tree's own `.eyg` sources call must be a
row in the file (`builtinsUsed` in `bin/agent/gen-surface.mjs`, comparison 3 of `--check`). A
builtin this package depends on that upstream renamed therefore fails the check. A builtin this
package never calls is invisible until someone re-captures, and that is the honest limit of an
offline check.

Re-capture, when you can load the page:

```bash
node bin/agent/gen-surface.mjs --builtins <the page saved as markdown> --captured <YYYY-MM-DD> --write
node bin/agent/gen-surface.mjs --check
```

`--builtins` replaces the builtin rows, rewrites the header's capture line with the new date and
the new md5, and leaves the effect rows generated from the fixture. Commit both the file and this
page's sentence about the date.

Hand-editing a row fails the check: comparison 4 compares the file byte for byte with what the
generator rebuilds from its inputs, so an edit to a name, a signature or the header is drift.
