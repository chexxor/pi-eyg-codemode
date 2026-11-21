# rule_mapping.gleam - a recorded snapshot of the runtime's effect surface

`rule_mapping.gleam` is copied verbatim, not rewritten:

- source: the language repository's CLI module `overlay.gleam`, lines 695-719
  (`pub const rule_mapping = [ ... ]`) - wherever the operator has that checkout; this tree
  quotes no path to it
- `md5sum <absolute path to overlay.gleam>` = `9cb5e8ace42e1df79083bab255ee9bb1`
  (whole file, 719 lines), captured 2026-11-18
- the block itself is `d03a718c370a2ce3c14fa33eb7166691`, 25 lines, captured 2026-11-18

Why a snapshot: this workspace is the pi package alone, so the runtime that owns
`rule_mapping` is not here and cannot be read. `POLICY_FIELDS` in
`lib/render-helpers.mjs` is the package's copy of that list, and the test compares the
copy against this block. When a policy-capable runner IS available, re-capture the block
and re-run the live guard:

```bash
EYG_RULE_SOURCE=<absolute path to overlay.gleam> node --test test/
```

With that variable set the test also reads the real source and fails if it drifted from
this snapshot; without it only the snapshot check runs and the live check is skipped.
