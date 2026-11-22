---
name: the language reference is reachable with the harness read tool, not through EYG
description: measured cost of a session that guesses EYG syntax instead of opening the reference, why the tool's own hint does not get it there, and what this package should do about it.
date: 2026-11-20
---

**The fact.** A session whose every effect is policy-gated also has no way to *read* this
package's prose through an effect: the roots cover its working directory, not the package, so
`perform ReadFile` on `guides/eyg-surface.tsv` answers `read_file denied by policy` (measured
2026-11-20, five of six measured sessions tried; `docs/world/entities/usability.without-language-skill.md`).
The tool's own error hint - `check the builtin name against the builtins reference` - names no
path, so a model that has not been told reads the hint as an instruction to ask the operator for
a grant over documentation that is already installed. One such session spent 86 calls and 7 m 27 s
and wrote nothing.

**What it costs to guess.** In six fresh one-shot sessions over the same three-file task, the ones
that opened no reference used 25-93 tool calls and produced 5-57 `builtin undefined` errors each:
invented builtins, infix `+`, `match` without braces, invented effect syntax (`handle`, `attempt`,
`.value`). The arithmetic and the refusal reports were still right, so the damage is cost and
latency, not correctness. Told to open the two reference copies this tree then shipped
(`guides/syntax.md`, `guides/builtins_reference.md`, both deleted on 2026-11-22) first, a session
used 11 calls, 0 `builtin undefined`, 89 s (n=1 each).

**What was done here.** Two fixes, in order of cheapness at the time. `skills/eyg-codemode/SKILL.md`
says, before writing EYG, to reach the reference with the harness `read` tool and not through an
effect. Then `action: "reference"` shipped: the tool prints the builtin names with signatures and
the effect surface in one call that performs nothing and asks the policy nothing
(`docs/world/entities/pi.reference-action.md`), and the invented-builtin error rows name
`guides/eyg-surface.tsv` and that action (`lib/render-helpers.mjs` builds them) - the second
deferred item above, done.

**What the fix rests on now.** The surface is one generated file rather than two prose copies, so
the answer the tool prints is the same rows the drift check guards
(`docs/world/entities/guides.surface-file.md`), and the prose neither the file nor the action
carries - what an effect does, how to install a CLI - is upstream at
<https://eyg.run/guides>. Trigger to re-measure: the next session that invents a builtin after
reading the skill, which would say the action is not being found.

**What this is not evidence for.** Whether the language-skill package should be vendored or
published: that decision, its two options and its triggers are
`notes/pi-codemode-language-skill-packaging.md`, and the hole is tracked as
`docs/world/entities/gap.language-skill-home-undecided.md`. This page measures only what a
session can reach from inside the tree.
