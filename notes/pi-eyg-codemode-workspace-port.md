---
name: pi-codemode-workspace-port
description: What moved out of ~/Git/eyg-lang into this workspace, every cross-workspace reference found in the package, and where each one was pointed
date: 2026-11-18
---

This workspace exists so the pi package `pi-eyg-codemode` has its own home instead of
sitting inside the EYG language repository. The inventory below is the record of what that
port carries, taken from the source tree before anything was copied.

Commands run on 2026-11-18 against `/home/chexxor/Git/eyg-lang` (read only; that
repository is never written to by this port — the operator reverts its branch
separately).

## The package: 11 files, all promoted to this workspace root

`git ls-files pi-eyg-codemode | wc -l` in the source workspace printed `11`, and
`find pi-eyg-codemode -type f` printed the same 11 names, so nothing was untracked:

| source (under `~/Git/eyg-lang/`) | destination (this workspace root) |
| --- | --- |
| `pi-eyg-codemode/package.json` | `package.json` |
| `pi-eyg-codemode/PURPOSE` | `PURPOSE` |
| `pi-eyg-codemode/README.md` | `README.md` |
| `pi-eyg-codemode/CHANGELOG.md` | `CHANGELOG.md` |
| `pi-eyg-codemode/extensions/eyg-codemode.ts` | `extensions/eyg-codemode.ts` |
| `pi-eyg-codemode/lib/render-helpers.mjs` | `lib/render-helpers.mjs` |
| `pi-eyg-codemode/libraries/search.eyg` | `libraries/search.eyg` |
| `pi-eyg-codemode/policies/agent-roots.eyg` | `policies/agent-roots.eyg` |
| `pi-eyg-codemode/policies/deny-all.eyg` | `policies/deny-all.eyg` |
| `pi-eyg-codemode/skills/eyg-codemode/SKILL.md` | `skills/eyg-codemode/SKILL.md` |
| `pi-eyg-codemode/test/render-helpers.test.mjs` | `test/render-helpers.test.mjs` |

The relative imports `../lib/render-helpers.mjs` in `extensions/eyg-codemode.ts:67` and
`test/render-helpers.test.mjs:14` are package-internal, so they keep working once the
package is the root; they are one level deep in both cases.

## The context ported from the language workspace

| what | source | destination | why |
| --- | --- | --- | --- |
| `AGENTS.md` | `AGENTS.md` | `AGENTS.md` | rewritten for this tree: the Gleam, `eyg_packages`, fork-sync and CI rows do not apply here |
| `.agents/skills/` | 7 skills (`effect-change`, `eyg-run`, `eyg-test`, `fork-sync`, `gleam-gate`, `note-keeping`, `snapshot-review`) | only the applicable ones | no Gleam build, no birdie suites, no `eyg_packages`, no remote push flow |
| `notes/pi_codemode_*.md` | `pi_codemode_host_gate.md`, `pi_codemode_runner_probe.md`, `pi_codemode_registry_probe.md` | `notes/` | the codemode design record |
| `guides/` | `pi_codemode_agent.md`, `cli_effects_reference.md`, `syntax.md` | `guides/` | cited by the README and the package skill |
| `docs/world/` | `00-map.md`, `roster.yaml`, `invariants.md`, `traps.md`, `decisions/`, `entities/` | `docs/world/` | the codemode entities `pi.codemode-tool`, `codemode.effect-surface`, `overlay.policy-rules` carry the claims this package makes |
| `pi-simple-world-model/` | 15 files, pi package v1.0.0 | `pi-simple-world-model/` | copied per workspace, never declared across workspaces: see `~/Git/eyg-lang/docs/world/decisions/ADR-001-world-model-import.md` |
| `.pi/settings.json` | `.pi/settings.json` | `.pi/settings.json` | mirror of the installed context: `./pi-simple-world-model`, `npm:@woksin/pi-context-budget`, the EYG skill at `~/Git/pi-eyg-expressions`, `"-builtin:codemode"`, compaction off, same `defaultTools` |
| `.gitignore` | `.gitignore` | `.gitignore` | same rule: keep `.pi/settings.json`, ignore `.pi/goals/`, the goal-pool snapshot and `.pi/npm/` |

The EYG *language* skill is not ported. It is published from its own workspace,
`/home/chexxor/Git/pi-eyg-expressions/skills/eyg-expressions/`, as a harness-independent
pi package; this workspace declares it by path, it does not copy it.

## Every cross-workspace reference inside the package

`grep -rn 'Git/eyg-lang\|eyg_packages\|\.\./' pi-eyg-codemode` printed 45 lines across 8
files. Each one is classified here:

**Must be rewritten (runtime):**

- `policies/agent-roots.eyg:15` and `policies/deny-all.eyg:5`:
  `let policy = import "../../eyg_packages/overlay/policy.eyg"` — the only real
  out-of-workspace dependency. Both modules are made self-contained: the preset records
  (`deny_all`, `read_write`) are inlined from `eyg_packages/overlay/policy.eyg`, so the
  package carries no `eyg_packages/` source and no `import` outside itself.

**Must be rewritten (instructions):**

- `README.md:14` the `pi list` line, and every `--policy` / `EYG_ALLOWED_ROOTS` command
  line in the how-to-run sections — these are instructions, so they point at
  `/home/chexxor/Git/pi-eyg-codemode`.
- `README.md:183,188,210,211,312,578,579,580`, `skills/eyg-codemode/SKILL.md:12`,
  `CHANGELOG.md:55,98`, `libraries/search.eyg:25` — prose pointers to
  `eyg_packages/overlay/policy.eyg` and `eyg_packages/codemode_policy/*`. With no vendored
  presets they now point at the inline presets in `policies/` and at the note that records
  the same vocabulary.

**Kept verbatim (historical evidence, labelled as such):**

*Line ranges below are the README as the port wrote it on 2026-11-18, before the same day's
rewrite of that file (see "README rewritten" further down); the captures they name are
unchanged in the surviving README.*

- `README.md:32-34,58,63,73,78,80,87,104-114,273-276,281,286,304,305,526,531,536,541,543`
  — transcript blocks captured in the old workspace on 2026-11-16. Rewriting a path inside
  a transcript would make the claim un-verbatim, so the blocks stay byte-identical and each
  gets a provenance line naming the old workspace and the capture date.
- `README.md:368,370,384` and `CHANGELOG.md` release entries — records of runs taken in the
  old workspace (the `bin/agent/gate.sh` script, the Gleam `manifest.toml` path).

## What could not be re-probed here

`which eyg` prints `/home/chexxor/.local/bin/eyg` and `eyg --version` prints `eyg v0.1.0`;
`eyg --help` advertises no `--policy`, and `eyg run --help` fails with
`error: no such file: .../--help`, so the PATH runner is the prebuilt release that predates
the `--policy` flag. The package's own runner probe (`/\-\-policy/` against `<runner> --help`)
therefore finds no runner on this host, and the policy decision cannot be re-observed here
without building `packages/gleam_cli` from source inside the language repository — out of
this port's scope. Run behaviour in this workspace is **UNVERIFIED** until a policy-capable
runner is installed; the inlined presets are held to the preset source read on 2026-11-18.

## The checks run from this workspace root, `@measured 2026-11-18`

Everything below was run with this directory as the working directory. Costs are wall
time; the date of every run is 2026-11-18 (the shell clock: `date` printed
`Wed Nov 18 09:07:51 PM CST 2026`; the world model tools stamp their `verified_at` in UTC,
so they write 2026-11-19 here - see `docs/world/traps.md`).

| what | command | result |
| --- | --- | --- |
| unit test + drift guard | `node --test test/render-helpers.test.mjs` (contract form) / `node --test 'test/*.mjs'` | exit 0, pass 1 fail 0, 49-55 ms |
| modules parse and type-check | `for f in policies/*.eyg libraries/*.eyg; do eyg check "$f"; done` | exit 0 for all three, 0.43 s |
| world model records | `node pi-simple-world-model/bin/world_lint.mjs` | `world lint: clean`, 0.06 s |
| claims re-run | `node pi-simple-world-model/bin/world_verify.mjs --all` | `33 claim(s) checked, 0 failed`, 0.37 s |
| tier-0 index | `node pi-simple-world-model/bin/world_map.mjs --check` | `world map: current`, 0.04 s |
| the same checks as a pi session sees them | `pi --world-model-check` | exit 0, 1.14 s |
| packages registered | `pi list` | `.. -> /home/chexxor/Git/pi-eyg-codemode`, `../pi-simple-world-model -> .../pi-simple-world-model`, `npm:@woksin/pi-context-budget -> .pi/npm/...`, `../../pi-eyg-expressions -> /home/chexxor/Git/pi-eyg-expressions` |

### The isolation sweeps

`grep -rn "Git/eyg-lang" .` and `grep -rn "eyg_packages" .` over the tree, with
`--exclude-dir=.git --exclude-dir=.pi`: 18 files, 108 lines, and every one of them is a
labelled historical record or a sentence that names the language workspace - the only line
the label scan cannot see is the front-matter `description:` of this very note, whose
subject *is* that import. The `.pi/goals/` state files also carry the goal text; they are
gitignored session state (`git check-ignore .pi/goals` is ignored), not repository content.

Per file (`Git/eyg-lang` / `eyg_packages`): `README.md` 50/7 - inside blocks tagged
`*[2026-11-16 · ~/Git/eyg-lang]*`; `AGENTS.md` 2/0 - the read-only-neighbour rule;
`CHANGELOG.md` 1/4 - the header naming pre-1.5.0 entries as old-workspace history;
`guides/*` 2/12 - each guide carries a copied-from-the-language-workspace header;
`docs/world/*` 3/3 - the entity pages and traps name the workspace in the sentence;
`notes/*` 7/14 - the three ported notes carry a provenance line, the two written here
state it (`notes/pi-codemode-handler-seam.md`, written after the sweeps were next re-run, adds
to these counts: measured 13/19 for `notes/*` and for the tree overall on 2026-11-18, in the
section below); `.agents/skills/eyg-run/SKILL.md` 1/0 - the measured host facts;
`test/fixtures/rule_mapping.PROVENANCE.md` 1/0 - the snapshot's own provenance;
`policies/*.eyg`, `lib/*`, `extensions/*`, `package.json` - zero hits.

`grep -rn '\.\./' .` in the shipped code returns exactly `../lib/render-helpers.mjs`
(`extensions/eyg-codemode.ts`), `../../lib/world_model.mjs` inside the vendored
`pi-simple-world-model/`, and prose paths; no `import` outside the package, in code or in
`policies/*.eyg`.

### README rewritten the same day, `2026-11-18`

A reader who does not know EYG could not use the README as it stood: EYG was never defined,
the prerequisite that a runner must accept `--policy` first appears 160 lines below "That is
all", the boundary that the checks are not in this package was at line 638, and every example was
a capture from the other workspace. The file was rewritten around those four facts and
shortened from 662 lines to 288 (`wc -l README.md`, 2026-11-18):

- **Kept as instructions:** install (`pi install . -l`), the knob/env tables, preset authoring
  (the 18 fields and the three path shapes), the effect listing, both search routes and the
  name-not-contents boundary, the registry, the renderer and the time knob, the install table.
- **Kept verbatim, still tagged `*[2026-11-16 · ~/Git/eyg-lang]*`:** the read-inside/write-refused
  program output, and the `.env.eyg` refused-read/named-by-`Search` pair - the two captures a
  reader needs to understand what a refusal is.
- **Dropped, not shortened:** the language workspace's `bin/agent/gate.sh` transcripts, the whole
  `Search`-effect landing (files, manifest resolution, `gleam 1.19.2` notes), the 30-line
  registry listing, the four `eyg run --policy` argv captures. They still live in the language
  workspace's README, and their decisions are recorded here in `CHANGELOG.md`,
  `docs/world/traps.md`, `docs/world/entities/overlay.policy-rules.md` and the `notes/` set. Each
  dropped fact keeps a pointer in the rewritten README to the document that carries it.
- **Re-measured here for the rewrite:** `node --test` 0.09 s wall either form (was quoted as
  45 ms in process, 49 ms wall in `AGENTS.md`), `eyg check` over the three modules 0.43 s, and
  the pasted test output is a fresh capture from this workspace (node's own 45.82 ms figure,
  `duration_ms 58.49`) rather than the old one.
- The two claims that grep README prose still hold after the rewrite
  (`grep -q 'the language workspace' README.md && grep -q 'the language repository' README.md`,
  `world_verify.mjs --all`: 33 claims, 0 failed), and `world_lint.mjs` stays clean.

The package's own skill (`skills/eyg-codemode/SKILL.md`) is written for the model, not for a
newcomer, and its trigger `description:` is what a session loads; the human-facing gap that the
rewrite closes is deliberately not closed in the skill, since a model already knows which tool
it has.

- **Re-measured after the rewrite:** the sweeps return 28 and 42 lines over the same 18 files
  (`README.md` 50/7 -> 6/1 - the dropped captures were the bulk of it); the test is 0.09 s wall
  in either form, so the "49-55 ms" in the checks table above and the "69 and 47 lines" in the
  audit below both describe the README before this rewrite.
- **Absolute machine paths taken out of the README the same day:** a first-time reader cannot
  use a path that only exists on this operator's machine. Removed from instructions and prose:
  the language workspace's checkout path, this package's own checkout path (the install
  commands now say `pi install . -l` from inside the package, or `/your/path/...`, and point at
  `pi list` for the resolution), the sibling `pi-eyg-expressions` path, and the `eyg` binary's
  path (the section now gives the three commands to run on **any** machine and quotes only the
  version and the `--policy` count measured here). The two capture tags were retagged
  `*[2026-11-16 · the language workspace]*` so a reader is not shown a path they cannot open;
  the text inside those blocks is unchanged, still verbatim, and the two `Git/eyg-lang` paths
  left in the README are inside such a block. `AGENTS.md` and `docs/world/` keep the absolute
  path on their own terms - they are this workspace's facts, not a new user's instructions.

### What the probes proved, and did not prove

The EYG CLI on PATH is available, so the probes were run rather than assumed:

```
$ command -v eyg
/home/chexxor/.local/bin/eyg
$ eyg --version
eyg v0.1.0
$ grep -c -- '--policy' <<< "$(eyg --help 2>&1)"
0
$ eyg run --policy "$(pwd)/policies/deny-all.eyg" -c 'perform WriteFile(...)'
error: no such file: /home/chexxor/Git/pi-eyg-codemode/run
hint: check the path and that the file exists, relative to the current working directory
exit=1
$ eyg run --policy "$(pwd)/policies/agent-roots.eyg" -c 'perform StandardOut("hi")'
error: no such file: /home/chexxor/Git/pi-eyg-codemode/run
hint: check the path and that the file exists, relative to the current working directory
exit=1
$ find /tmp/eyg-proof -newermt '2026-11-18' -print
(no output - nothing was written to the proof path today)
```

Read as: v0.1.0 reads `run` as a program path, so the checked call never started; the policy
decision was therefore **not observed** from this workspace. The claims about what each
preset does at run time stay **UNVERIFIED** here, and say so wherever they appear
(`docs/world/entities/cli.prebuilt-binary.md`, `docs/world/entities/pi.codemode-tool.md`,
`AGENTS.md`, `guides/pi_codemode_agent.md`, this note). What *is* proven here is that both
presets parse, carry all 18 policy fields, and type-check; that the package's extension
resolves its own policy, library and render helpers from inside itself; and that the
language workspace keeps its own copy of everything.

## Completion audit, re-read against the contract, `@measured 2026-11-18`

Run from this workspace root after the first commit (`git log` shows it; this is the
commit that carries the audit).

| the contract asks | the command | the answer |
| --- | --- | --- |
| workspace root is the package | `ls` | `package.json` (name `pi-eyg-codemode`, `pi` manifest `extensions`/`skills`/`changelogPath`, host `peerDependencies` at `"*"`, plus this workspace's `scripts`) beside `extensions/ lib/ libraries/ policies/ skills/ test/ README.md CHANGELOG.md PURPOSE` |
| relative imports resolve inside the tree | `grep -rn '\.\./' extensions lib libraries policies package.json test` | exactly `../lib/render-helpers.mjs` in `extensions/eyg-codemode.ts:67` and in `test/render-helpers.test.mjs:14`; `policies/*.eyg` and `libraries/*.eyg` carry no import at all |
| no out-of-workspace import in the presets | `grep -n 'let .* = import' policies/*.eyg` | no output |
| the sweeps | `grep -rn "Git/eyg-lang" . --exclude-dir=.git --exclude-dir=.pi` / same for `eyg_packages` | 69 and 47 lines, 18 files, every one a labelled historical record or a sentence naming the language workspace (the classification, file by file, is above in this note) |
| the test | `node --test test/render-helpers.test.mjs` | exit 0, `pass 1 fail 0` |
| registration | `pi list` | `..` → `/home/chexxor/Git/pi-eyg-codemode`, `../pi-simple-world-model` → the vendored copy, `npm:@woksin/pi-context-budget` → `.pi/npm/...`, `../../pi-eyg-expressions` → `/home/chexxor/Git/pi-eyg-expressions` |
| the vendored world model checks, as a session sees them | `pi --world-model-check` | exit 0, ends `tool registered: yes (22 tools active in this session)` |
| local commit only | `git status --porcelain` / `git remote -v` | 0 lines / 0 lines; `git log` shows the local commits, no remote exists |
| the language workspace is untouched | `cd ~/Git/eyg-lang && git diff \| wc -l` | `0` tracked diffs; `git status --porcelain` prints only the pre-existing `?? .ai-work/` |

Still **UNVERIFIED**, and named as such wherever it appears: that a preset actually refuses
or allows an effect at run time. The CLI on PATH (`/home/chexxor/.local/bin/eyg`, `eyg v0.1.0`)
has no `--policy` (`grep -c -- '--policy' <<< "$(eyg --help 2>&1)"` → `0`), so both checked probes
print `error: no such file: <this workspace>/run` and exit 1 without starting a program. What the
presets' semantics rest on here is the recorded preset source, `eyg check` on both modules, the
18-field comparison against `test/fixtures/rule_mapping.gleam`, and the unit test - not an
observed refusal.
