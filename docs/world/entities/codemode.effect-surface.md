---
id: codemode.effect-surface
type: entity
owner: delegate
status: current
verified_at: 2026-11-24
verify: "test $(grep -c 'PolicyField(' test/fixtures/rule_mapping.gleam) -eq 19 && test $(grep -c '^effect' guides/eyg-surface.tsv) -eq 23 && node bin/agent/gen-surface.mjs --check && node --test test/host-coverage.test.mjs > /dev/null && node bin/agent/refusal-probe.mjs --program test/fixtures/search-walk.eyg 2>&1 | grep -q 'search listed: 5' && node bin/agent/refusal-probe.mjs --with-policy spawner-effects --fields search,standard_out --program test/fixtures/search-walk.eyg 2>&1 | grep -q 'search listed: 0'"
confidence: high
sources: [guides/eyg-surface.tsv, bin/agent/gen-surface.mjs, test/fixtures/rule_mapping.gleam, policies/agent-roots.eyg, policies/deny-all.eyg, README.md, host/guard.eyg, test/host-coverage.test.mjs, test/fixtures/search-walk.eyg, guides/tool-reference.md]
supersedes: null
superseded_by: null
---

# What an EYG program may perform, and where that answer lives

A running program reaches the host only through effects, and the set it may perform is an
intersection of three files. Read them in this order, and the answer costs one lookup:

1. `guides/eyg-surface.tsv`, the `effect` rows - the closed row of labels the guard names, one row
   per effect with the policy field that decides it (`none` for the four no policy can forbid).
   `action: "effects"` answers what the policy in force decides for each. The argument type a rule
   must return is on <https://eyg.run/guides/cli-effects-reference>.
2. The policy in force - `policies/agent-roots.eyg` answers one rule per policy field for the roots
   in its `ctx`; the vocabulary is written out inline, one rule per field, and `host/guard.eyg`
   installs a clause per effect row that calls the rule before the host sees the effect.
3. The roots themselves, for a path question. The tool reports the policy it used and its
   roots in the call, so a refusal names the path it was denied.

`test/fixtures/rule_mapping.gleam` is the recorded snapshot of the language repository's
`rule_mapping` (captured 2026-11-18, md5 `9cb5e8ace42e1df79083bab255ee9bb1` of the source
file): 23 effects, 19 of them named by a `PolicyField`, 4 (`DecodeJSON`, `EYGParse`,
`Hash`, `Sign`) marked unchecked and deterministic, so available under every policy
including `deny_all`. The snapshot decides the **labels** and the unchecked set; the field
names are this package's own, and the one that differs is `Search`, which the language maps to
`read_file` and this package gives a field of its own (`search`), because the guard - not the
CLI - is the host of that walk (`docs/world/entities/host.guard-boundary.md`). A missing field in
a policy is a configuration error, not a silent allow: `lib/render-helpers.mjs` carries
`POLICY_FIELDS` and the tests compare it against the fixture and against the guard's handler
list, so a surface that moved fails the suite rather than silently allowing.

Three shapes matter when a rule decides by path: `read_directory`, `delete_file` and `make_directory`
carry a bare path string, `read_file`, `write_file` and `append_file` carry a record with a
`path` field, and `env` refuses with `None({})` instead of an error.

`search` is one field and one clause, and it is not the whole walk. The guard re-performs the
search and then answers the `read_directory` of every directory the walk reaches, so two fields
together decide a search and a refusal in the middle of it is a listing that comes back empty,
not an error. Re-runnable (`@measured 2026-11-22`, 0.2 s each): `node bin/agent/refusal-probe.mjs
--program test/fixtures/search-walk.eyg` prints `search listed: 5` under `policies/agent-roots.eyg`;
the same program under `policies/spawner-effects.eyg` with `--fields search,standard_out` prints
`search listed: 0`, because the search is named and the listings are not, and adding
`read_directory` to that list makes it list five again.

## Not this

The table is not the policy: it says what a CLI can name and how a policy decides, not what
was allowed on any given day. Which policy ran, and its roots, is reported by the tool per
call (`README.md`). Effects are not added to answer a feature request: that is an escalation,
and the file that answers "can this effect exist at all" lives in the language repository.
