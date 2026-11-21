---
name: reference-answer-shape
description: Why `action: "reference"` reads the shipped guide instead of asking the runner, why it prints the surface rather than verdicts, and what that costs
date: 2026-11-20
---
Three choices the code makes and does not argue.

**The guide file is the source, not the runner.** The runtime has no builtin for listing builtins,
and inventing one would be a new effect in the language to answer a documentation question. So the
tool parses `guides/builtins_reference.md`, the offline copy this package already ships for a
session that cannot load a page, and says so in the first line of its answer ("an offline mirror of
the language's page; the compiler is the source"). The cost is a stale answer when the copy is
stale: the mirror is dated 2026-11-18 and this tree has never built a compiler to re-check it
(`docs/world/entities/guides.index.md`). The scan is narrow on purpose - the first table cell is
the name, the rest of the row travels with it - because a signature may contain `|`
(`(a, a) -> True({}) | False`) and a cell split on `|` would cut a real signature in half.

**Surface, not verdicts.** The answer prints each effect with the policy *field* that decides it, and
points at `action: "effects"` for what the preset in force decides. Asking the policy 19 questions
to answer "what is the surface" would make the cheap question cost a probe run, and would make the
answer depend on a runner being present. As it is, the action spawns nothing, so it answers on a
machine whose every run is refused with `no runner that accepts \`--policy\`` - which is exactly
when a new user most needs to know what the surface is.

**The `read` tool sentence.** The rows say pi's own `read` tool is not policy-gated while `ReadFile`
reaches only the roots. That is the fact a session got wrong often enough to burn a whole session
asking for a grant over this package's own documentation
(`docs/world/entities/usability.without-language-skill.md`, 86 calls, 7 m 27 s, nothing written).
Naming it costs one line and closes a wrong inference; the cost is that a child session started with
`--tools eyg` has no `read` tool, so for it that sentence is information about a door it does not
have - still the honest description of the tool's standing, and the child's own tool surface is the
spawner's to set (`docs/world/entities/pi.subagent-spawn.md`).

Trigger to revisit: when the language ships a builtins listing the runner can print, or when the
mirror is re-checked against a compiler built here - then the answer's source line changes and this
note's first paragraph shrinks to a pointer.
