---
id: pi.spawner-policy
type: entity
owner: delegate
status: current
verified_at: 2026-11-23
verify: "eyg check policies/spawner-effects.eyg > /dev/null && grep -q 'EFFECT_ALLOWLIST_ENV = \"EYG_SUBAGENT_EFFECTS\"' lib/render-helpers.mjs && grep -qF 'SPAWNER_POLICY_NEVER = [\"CreateKey\", \"Fetch\", \"StandardIn\"]' lib/render-helpers.mjs && grep -qF 'NARROWING_POLICY = \"spawner-effects\"' extensions/eyg-codemode.ts && node bin/agent/refusal-probe.mjs --with-policy spawner-effects --fields read_file,standard_out | grep -qF 'write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out' && node bin/agent/refusal-probe.mjs --with-policy spawner-effects --program test/fixtures/refusal-abort.eyg | grep -qF 'EYG_SUBAGENT_EFFECTS=\"' && node bin/agent/refusal-probe.mjs --with-policy spawner-effects --fields write_file --program test/fixtures/refusal-abort.eyg | grep -qF 'write_file denied by policy: /tmp/' && node bin/agent/refusal-probe.mjs --with-policy spawner-effects --fields read_file,write_file,standard_out --program test/fixtures/secret-probe.eyg --inside-roots | grep -q 'read_file denied by policy: .*\\.env\\.eyg'"
confidence: high
sources: [policies/spawner-effects.eyg, extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, guides/how-to-spawn-a-subagent.md, notes/spawner-effect-allowlist.md, docs/world/entities/pi.subagent-spawn.md]
supersedes: null
superseded_by: null
---
# A spawner names the effects its child may perform, and a shipped policy enforces it

`policies/spawner-effects.eyg` is the third policy this package ships: `agent-roots.eyg` with an
allowlist check over each of its fields. `eyg_subagent` installs it for a child session when the spawner names
`effects`, so "read and print, nothing else" needs no file edited and nothing widened - every rule
in it is the agent-roots rule or a refusal, never a rule agent-roots does not have.

- **How the allowlist is read.** `EYG_SUBAGENT_EFFECTS` is a comma-separated list of *field* names (the
  lower-case names in the record at the bottom of the module), set by the spawner for the one spawn
  (`EFFECT_ALLOWLIST_ENV` in `lib/render-helpers.mjs`). Unset or empty names no field, so every field
  the policy decides is refused - the narrow reading of a missing list, because a policy nobody
  configured must not be the wide one.
- **A refusal names the whole boundary.** `Error("<field> denied by policy:
  EYG_SUBAGENT_EFFECTS=<the list the child was given>")`, so a child that asks for a field it does
  not have reads its own limits out of the answer rather than guessing them one effect at a time.
- **Two independent cuts.** A field that *is* named is still decided by `EYG_ALLOWED_ROOTS`, and a
  path under a root is still refused when its field is not named - neither list can loosen the
  other, and `read_file` keeps hiding `.env.eyg` through the narrowing.
- **What an allowlist cannot grant.** `fetch`, `standard_in` and `create_key` stay refused allowlist
  or not, because the base policy refuses them and an allowlist removes reach rather than adding it;
  `env` is answered `Mock(None({}))` in both, which is the only answer `Env`'s own type allows; the
  four unchecked effects (`DecodeJSON`, `EYGParse`, `Hash`, `Sign`) carry no field, so naming them
  changes nothing. The tool refuses the first group where it is asked and reports the other two as
  no-ops, instead of spending a child's calls on a refusal it could not act on
  (`SPAWNER_POLICY_NEVER`, `SPAWNER_POLICY_NOOP`).
- **It combines with `agent-roots` only.** The narrowing policy is a copy of that policy with an allowlist,
  so replacing a project policy that is narrower (`deny-all`) with it would widen the child; the
  tool refuses that combination and names both paths in the reason (`docs/world/entities/pi.subagent-spawn.md`).
- **`Search` has its own `search` field.** Naming `ReadFile` does not let a child search, and naming
  only `Search` does not let it read a file - the guard decides the walk through `search` and each
  directory it lists through `read_directory`
  (`docs/world/entities/codemode.effect-surface.md`). The recorded language snapshot maps `Search` to
  `read_file`, which is why the recorded table is not the source of this fact.

## What the policy answered, probe and live

Probes: `node bin/agent/refusal-probe.mjs --with-policy spawner-effects <flags>` - the same three
files and the same one argv the tool builds for every call, started from a scratch directory, with
`EYG_ALLOWED_ROOTS` left at this package (`@measured 2026-11-22 by that command, six rows, 1.11 s
total`). The scratch path is `/tmp/eyg-refusal-probe-<random>`; the write probe asks for a relative
path, which lands outside the roots, which is the point of the row.

| flags | effect asked for | answer |
| --- | --- | --- |
| `--fields read_file,standard_out` | write outside the roots | `write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out` - the refusal recites the child's whole allowlist |
| *(no `--fields`)* | the same write | **nothing printed, `exit=0`**: the write is refused and the probe's `StandardOut` is refused too, so a program cannot report its own refusal |
| *(no `--fields`)*, `--program test/fixtures/refusal-abort.eyg` | the same write, aborted with | `error: Aborted with reason: "write_file denied by policy: EYG_SUBAGENT_EFFECTS="` - the empty list is the evidence that an unset allowlist names no field |
| `--fields write_file --program test/fixtures/refusal-abort.eyg` | the same write | `... denied by policy: /tmp/eyg-refusal-probe-<random>/eyg-probe-refused.txt` - naming the field does not open the roots, and the refusal switches to naming the path |
| `--fields read_file,write_file,standard_out --program test/fixtures/secret-probe.eyg --inside-roots` | `.env.eyg` under a root | `read_file denied by policy: <tree>/.env.eyg` - the secret rule survives the narrowing |
| same program under `--with-policy agent-roots` | `.env.eyg` under a root | the same refusal - the narrowing adds nothing to the base policy's own rules |

`host.guard-boundary` carries the two probes that hold for this policy as well: an unnamed label
(`test/fixtures/unnamed-effect.eyg`) never reaches a rule, and a `Search` of `/tmp` answers
`search denied by policy: /tmp`.

Live, in a scratch project under this tree (`.ai-work/spawn-narrow`, gitignored): one fresh one-shot
parent session (`pi --print --mode json --model <model> --tools eyg,eyg_subagent,read --offline
--no-session --no-context-files`, 1:00 wall), one child it started with
`effects: ["ReadFile", "StandardOut"]`, `tools: ["eyg"]`, `roots` one directory below the parent's
(`<tree>/.ai-work/spawn-narrow/proj/data`), call budget 2 (not spent). The child made one `eyg` call
with one program asking for three effects, and its stdout was
(`@measured 2026-11-22 by that session; the run itself answered `ran in 0.18 s wall`):

| effect the child asked for | answer |
| --- | --- |
| `ReadFile` of a file inside its `roots` slice | performed - the value came back and the child printed it |
| `WriteFile` inside the same slice | `write_file denied by policy: EYG_SUBAGENT_EFFECTS=read_file,standard_out` |
| `ReadFile` of a file inside the **parent's** roots but outside the slice | `read_file denied by policy: <tree>/.ai-work/spawn-narrow/proj/outside.txt` |

So both cuts hold through the guard end to end: the field list refused a write under a root the child
was given, and the root list refused a read of a field the child *was* given. The parent's report
carried the child's final message, one row per child call, the field list and the refusal rows - which
is what a parent needs to re-scope a child without reading its transcript. The two refusal rows the
tool renders from these answers mis-print the reason (see
`docs/world/entities/pi.session-grants.md` and `docs/world/traps.md`); the answers the program
received, quoted above, are what the policy decided.

UNVERIFIED: whether the grant hint a refused child effect prints can be acted on as printed (it
suggests a "root" taken out of the refusal reason, which is a field list or a truncated path); and
whether a child session under a *grant* plus an allowlist composes the two (grants are
excluded from a child by construction, so the combination cannot be reached today); and the
TUI rendering of the refusal rows - the proofs ran `--print`, and only the row shapes in
`lib/render-helpers.mjs` are asserted.

## Not this

- the spawn itself, its tools and its call budget: `docs/world/entities/pi.subagent-spawn.md`;
- the effect surface and which effects carry no field: `docs/world/entities/codemode.effect-surface.md`;
- why a policy is written out whole rather than importing its base: `notes/spawner-effect-allowlist.md`,
  `notes/pi-codemode-policy-inlining.md`;
- how to use the parameter: `guides/how-to-spawn-a-subagent.md`.

@measured 2026-11-22 by `eyg check policies/spawner-effects.eyg` (exit 0) and the six probe rows
above (`node bin/agent/refusal-probe.mjs ...`, 1.11 s for all six), and by `node --test 'test/*.mjs'`
(pass 43, fail 0, 0.10 s: the field mapping, the never/no-op groups, the env names and the budget are
asserted).
