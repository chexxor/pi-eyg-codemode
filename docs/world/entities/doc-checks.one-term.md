---
id: doc-checks.one-term
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "node bin/agent/doc-checks.mjs one-term | grep -qx 'one-term: ok'"
confidence: high
sources: [bin/agent/doc-checks.mjs, bin/agent/audit.sh, test/doc-checks.test.mjs, README.md, notes/wording-the-checks-not-the-gate.md]
supersedes: null
superseded_by: null
---

# One word per concept, checked against one table

`bin/agent/doc-checks.mjs` holds this package's six prose checks, one name each: `one-term`,
`citations`, `headings`, `mirrors`, `dated-prose`, `line-count`. Each is a function taking
`{root, files}` and returning problem strings, so a test can point it at a fixture tree, and
`node bin/agent/doc-checks.mjs <name>` prints the problems and exits 1 when there are any.
`bin/agent/audit.sh` runs all six, one row each, with the wall cost of every row printed; that
file is the only thing that runs them (`bin/PURPOSE`).

The checks cover two sets. PROSE is `README.md`, `AGENTS.md`, `guides/`, `skills/`,
`.agents/skills/`. CODE is `extensions`, `lib`, `policies`, `libraries`, `bin`, `test`, `host`. Three
exemptions are deliberate and stated in the file's header comment: `docs/world/` and `notes/`
belong to `world_lint.mjs`, a note is allowed to name a word in order to ban it
(`notes/wording-the-checks-not-the-gate.md` is such a note), and `CHANGELOG.md` is the history of
names this package dropped. Any line carrying `doc-check:ignore` is skipped, which is how an
exemption stays visible in the file that needs it rather than hidden in the checker; the checker
skips its own source for the same reason.

`one-term` asks three questions of those sets:

- exactly one file carries a canonical-term heading, and it is
  `## The words this package uses` in `README.md` - a second table anywhere is a rival authority;
- that table has a row for each of `runner`, `policy`, `roots`, `the checks`,
  `checked, unchecked`, `registry scope`, so deleting a row from the definition of the
  vocabulary fails the check rather than quietly shrinking it;
- no file in scope uses a rival word for a concept the table names: `prese[t]` - bracketed here
  because `docs/world/traps.md` carries a sweep for that word over every tracked file, and a page
  that explains a ban has to name the banned word without tripping it - and the `gate`
  family (`gate`, `gates`, `gated`, `gating`).

The `gate` family is the residue the vocabulary rewrite left behind: the tool's own user-facing strings
said "the effects the policy gates" and "pi's own `read` tool is not policy-gated" while its
prose said "the checks" and "the policy decides". Those strings, the comments in
`policies/agent-roots.eyg` and `policies/deny-all.eyg`, and the test assertions that pin them now
read "the effects the policy decides" and "is not decided by a policy". The one exempt token is
`gated:`, a field name in the tool's `details` record: renaming it would change the tool's output
contract, so the exemption is a list item in the checker rather than a rewrite.

The table's `policy` row is the only place the package says what a policy is - a record of
effect-handlers, one per effect the CLI decides, with `Pass` the handler an effect keeps at its
default - and the check counts that phrase so a second copy anywhere fails.

The fixtures prove the rules bite: `test/doc-checks.test.mjs` writes temp trees that plant a
second table, a rival word, a deleted row, and a repeated definition, and asserts the problems;
the same file asserts all six checks report nothing against this package
(`docs/world/entities/doc-checks.citations.md` and its five siblings carry the other rules).

## Not this

- not the world model's own lint: `world_lint.mjs` checks claim front matter, ids and sources,
  and this check deliberately does not read `docs/world/`;
- not a style linter: it knows three rival words, because those three are the ones this
  package's vocabulary table has already ruled on;
- not the tool's runtime behaviour: the strings it rewrote are descriptions, and
  `docs/world/entities/pi.codemode-tool.md` is what the tool does.
