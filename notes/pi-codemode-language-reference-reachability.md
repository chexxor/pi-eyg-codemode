---
name: the language reference is reachable with the harness read tool, not through EYG
description: measured cost of a session that guesses EYG syntax instead of opening the reference, why the tool's own hint does not get it there, and what this package should do about it.
date: 2026-11-20
---

**The fact.** A session whose every effect is policy-gated also has no way to *read* this
package's prose through an effect: the roots cover its working directory, not the package, so
`perform ReadFile` on `guides/syntax.md` answers `read_file denied by policy` (measured
2026-11-20, five of six measured sessions tried; `docs/world/entities/usability.without-language-skill.md`).
The tool's own error hint - `check the builtin name against the builtins reference` - names no
path, so a model that has not been told reads the hint as an instruction to ask the operator for
a grant over documentation that is already installed. One such session spent 86 calls and 7 m 27 s
and wrote nothing.

**What it costs to guess.** In six fresh one-shot sessions over the same three-file task, the ones
that opened no reference used 25-93 tool calls and produced 5-57 `builtin undefined` errors each:
invented builtins, infix `+`, `match` without braces, invented effect syntax (`handle`, `attempt`,
`.value`). The arithmetic and the refusal reports were still right, so the damage is cost and
latency, not correctness. Told to open `guides/syntax.md` and `guides/builtins_reference.md`
first, a session used 11 calls, 0 `builtin undefined`, 89 s (n=1 each).

**What was done here.** `skills/eyg-codemode/SKILL.md` now says, before writing EYG, to open those
two files with the harness `read` tool and not to try to reach them through an effect. That is the
cheapest fix measured: it needs no new effect, no preset change, no second copy of the prose, and
the mirrors already live in `guides/` (`docs/world/entities/guides.index.md`).

**Not done, and why.** The tool could answer a builtin question itself - an `action` that prints
the builtin table costs no new effect and no policy decision, because the runner already has the
prelude it enforces. Deferred deliberately: it is a tool-surface change with a rendering and a test
of its own, and the skill line may be enough. Trigger: the next measured session that invents a
builtin after reading the skill - then add the action rather than more prose. The second deferred
item is naming the guide path inside the hint text itself (`lib/render-helpers.mjs` builds the
error rows); trigger: the first session that reads the hint and still asks for a grant over the
package's own docs.

**What this is not evidence for.** Whether the language-skill package should be vendored or
published: that decision, its two options and its triggers are
`notes/pi-codemode-language-skill-packaging.md`, and the hole is tracked as
`docs/world/entities/gap.language-skill-home-undecided.md`. This page measures only what a
session can reach from inside the tree.
