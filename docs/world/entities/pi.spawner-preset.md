---
id: pi.spawner-preset
type: entity
owner: delegate
status: current
verified_at: 2026-11-21
verify: "eyg check policies/spawner-effects.eyg > /dev/null && test -z \"${EYG_CODEMODE_RUNNER:-}\" || { EYG_ALLOWED_ROOTS=$PWD EYG_SUBAGENT_EFFECTS=read_file,standard_out \"$EYG_CODEMODE_RUNNER\" run --policy $PWD/policies/spawner-effects.eyg test/fixtures/refusal-probe.eyg 2>&1 | grep -q 'write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out' && env -u EYG_SUBAGENT_EFFECTS EYG_ALLOWED_ROOTS=$PWD \"$EYG_CODEMODE_RUNNER\" run --policy $PWD/policies/spawner-effects.eyg test/fixtures/refusal-probe.eyg 2>&1 | grep -q 'standard_out denied by policy: EYG_SUBAGENT_EFFECTS=$'; }"
confidence: high
sources: [policies/spawner-effects.eyg, extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, guides/how-to-spawn-a-subagent.md, notes/spawner-effect-allowlist.md, docs/world/entities/pi.subagent-spawn.md]
supersedes: null
superseded_by: null
---
# A spawner names the effects its child may perform, and a shipped preset enforces it

`policies/spawner-effects.eyg` is the third preset this package ships: `agent-roots.eyg` with an
allowlist check over each of its fields. `eyg_subagent` installs it for a child session when the spawner names
`effects`, so "read and print, nothing else" needs no file edited and nothing widened - every rule
in it is the agent-roots rule or a refusal, never a rule agent-roots does not have.

- **How the allowlist is read.** `EYG_SUBAGENT_EFFECTS` is a comma-separated list of *field* names (the
  lower-case names in the record at the bottom of the module), set by the spawner for the one spawn
  (`EFFECT_ALLOWLIST_ENV` in `lib/render-helpers.mjs`). Unset or empty names no field, so every
  gateable field is refused - the narrow reading of a missing list, because a preset nobody
  configured must not be the wide one.
- **A refusal names the whole boundary.** `Error("<field> denied by policy:
  EYG_SUBAGENT_EFFECTS=<the list the child was given>")`, so a child that asks for a field it does
  not have reads its own limits out of the answer rather than guessing them one effect at a time.
- **Two independent cuts.** A field that *is* named is still decided by `EYG_ALLOWED_ROOTS`, and a
  path under a root is still refused when its field is not named - neither list can loosen the
  other, and `read_file` keeps hiding `.env.eyg` through the narrowing.
- **What an allowlist cannot grant.** `fetch`, `standard_in` and `create_key` stay refused allowlist
  or not, because the base preset refuses them and an allowlist removes reach rather than adding it;
  `env` is answered `Mock(None({}))` in both, which is the only answer `Env`'s own type allows; the
  four unchecked effects (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) carry no field, so naming them
  changes nothing. The tool refuses the first group where it is asked and reports the other two as
  no-ops, instead of spending a child's calls on a refusal it could not act on
  (`SPAWNER_PRESET_NEVER`, `SPAWNER_PRESET_NOOP`).
- **It combines with `agent-roots` only.** The narrowing preset is a copy of that preset with an allowlist,
  so replacing a project policy that is narrower (`deny-all`) with it would widen the child; the
  tool refuses that combination and names both paths in the reason (`docs/world/entities/pi.subagent-spawn.md`).
- **`Search` is the `read_file` field**, so naming `ReadFile` also lets a child search and naming
  only `Search` also lets it read a file - one field, stated in the parameter description rather
  than pretended away.

## What the preset answered, probe and live

Probes: `"$EYG_CODEMODE_RUNNER" run --policy $PWD/policies/spawner-effects.eyg <program>` in a scratch
directory, with `EYG_ALLOWED_ROOTS` set to it, `@measured 2026-11-20` - through a development build
of the language CLI this tree no longer has, so the table is a dated record and the command runs
only when the operator names a runner. The preset itself still type-checks on the CLI on `PATH`.

| `EYG_SUBAGENT_EFFECTS` | effect asked for | answer |
| --- | --- | --- |
| `read_file,write_file,standard_out` | write inside the root | performed |
| same | write **outside** the root | `write_file denied by policy: <abs path>` - the roots cut still works on a named field |
| same | `DeleteFile`, `MakeDirectory` | `delete_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,write_file,standard_out` (same shape per field) |
| same | `Fetch`, `CWD` | `fetch denied by policy`; `cwd` refused with the `Error({})` its type allows |
| `read_file,write_file,standard_out` | `.env.eyg` inside the root | `read_file denied by policy: <abs>/.env.eyg` |
| unset | `StandardOut` | `standard_out denied by policy: EYG_SUBAGENT_EFFECTS=`, exit 1, nothing gateable performed |
| all nine gateable fields | `MakeDirectory`, `CWD`, `Fetch`, write outside the root | performed, performed, `fetch denied by policy`, refused by path |
| *(same program under `agent-roots.eyg`, no allowlist set)* | `DeleteFile`, `MakeDirectory`, `CWD` | performed - the strict narrowing, side by side |

Live, the same scratch project as `docs/world/entities/pi.subagent-spawn.md`, one parent
`pi --print` session, child under this preset with `effects: ["ReadFile", "StandardOut"]` and roots
one directory below the parent's: the child's read inside its slice printed the file's line, its
`WriteFile` inside the same slice came back `write_file denied by policy:
EYG_SUBAGENT_EFFECTS=read_file,standard_out`, and its read of a file **inside the parent's root but
outside the child's** came back `read_file denied by policy: <abs path>` - both refusals listed in
the parent's report, which is what a parent needs to re-scope a child without reading its
transcript.

UNVERIFIED: whether a child session under a *grant* plus an allowlist composes the two (grants are
excluded from a child by construction, so the combination cannot be reached today); and the
TUI rendering of the refusal rows - the proofs ran `--print`, and only the row shapes in
`lib/render-helpers.mjs` are asserted.

## Not this

- the spawn itself, its tools and its call budget: `docs/world/entities/pi.subagent-spawn.md`;
- the effect surface and which effects carry no field: `docs/world/entities/codemode.effect-surface.md`;
- why a preset is written out whole rather than importing its base: `notes/spawner-effect-allowlist.md`,
  `notes/pi-codemode-preset-inlining.md`;
- how to use the parameter: `guides/how-to-spawn-a-subagent.md`.

@measured 2026-11-20 by `.local/eyg-checked check policies/spawner-effects.eyg` (exit 0, the record
printed with all 18 fields; `eyg check policies/spawner-effects.eyg` on the CLI on `PATH` answers the
same today, exit 0, re-measured 2026-11-21) and the probe runs in the table above (`0.15-0.33 s`
each, development build), by one live
parent session (`pi --print --mode json --offline --approve --no-session --no-context-files
--tools eyg,eyg_subagent,read`, 154 s wall, exit 0, transcript under `.ai-work/spawn-surface/`,
gitignored), and by `node --test 'test/*.mjs'` (pass 1, fail 0, 0.12 s: the field mapping, the
never/no-op groups, the env names and the budget are asserted).
