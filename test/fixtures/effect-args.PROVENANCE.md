# effect-args.tsv - where the argument shapes of the effect rows came from

`effect-args.tsv` is the input that gives each effect row its argument shape and return type;
`guides/eyg-surface.tsv` carries it in a row's last column, written there by
`bin/agent/gen-surface.mjs`. Twenty-three rows, tab-separated, `#` lines are comments:

```
md5sum test/fixtures/effect-args.tsv   # ffb4b2b322eadfdf87d48f2e157cd4a1, captured 2026-11-27
```

Two sources, and the row that tells them apart:

- **twenty-two rows** are the language's CLI effects page,
  <https://eyg.run/guides/cli-effects-reference>, read 2026-11-27. The page gives each effect
  an example ask, a field table where the ask is a record (`ReadFile`, `Hash`) and a line
  naming the argument and the return type where it is not (`CWD`, `Env`, `Sleep`, `Exit`).
- **`Search`** is this package's own, because the page does not name it: the guard, not the
  CLI, is the host for that walk (`guides/eyg-surface.tsv` header; `test/host-coverage.test.mjs`).
  Its row is read off `host/guard.eyg`: the clause reads `request.path`, `request.pattern`
  and `request.limit`, and resumes `Ok(walk(...))`, whose value is a list of the absolute
  paths that matched (`walk` collects `child`, a `String`), or `Error(reason)`.

What the fixture keeps and what it drops: the page also documents four authenticated-service
effects (`GitHub`, `Netlify`, `DNSimple`, `Vimeo`) that the runtime's `rule_mapping` snapshot
does not carry, and `Abort`, which the guard performs but no effect row names. The surface
file's effect rows are the snapshot's twenty-three labels, so those four rows are not here,
and a runtime that starts recording them fails the label comparison in
`bin/agent/gen-surface.mjs` rather than quietly gaining a shape.

Where the fixture's types stop being exact: the page writes the `Fetch` request with
`headers: []` and names the return's `headers` as `List(...)`; this row keeps both ellipses
rather than inventing an element type. `Sign`'s `key` field is the page's own wording -
"key material in the shape returned by `CreateKey`" - so the row points at `CreateKey`'s
return row instead of restating it.

Re-capture, when you can load the page: read it, rewrite the rows, then
`node bin/agent/gen-surface.mjs --write` and commit both files. The drift check decides:
`--check` requires one row here per label in `POLICY_FIELDS` (`lib/render-helpers.mjs`) and
compares the surface file byte for byte, so an effect that gained a field reads as a failed
check, not as a stale sentence.
