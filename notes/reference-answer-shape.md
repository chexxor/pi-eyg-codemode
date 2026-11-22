---
name: reference-answer-shape
description: Why `action: "reference"` reads the generated surface file instead of asking the runner, why it prints the surface rather than verdicts, and what that costs
date: 2026-11-20
---
Three choices the code makes and does not argue.

**The surface file is the source, not the runner.** The runtime has no builtin for listing builtins,
and inventing one would be a new effect in the language to answer a documentation question. So the
tool reads `guides/eyg-surface.tsv`, the one generated surface file this package ships, and says so
in the first line of its answer ("a capture of the language's page; the compiler is the source under
it"). The cost is a stale answer when the capture is stale, and the answer says which rows are a
capture and which are generated: the effect rows are re-derived from the recorded `rule_mapping` by
`node bin/agent/gen-surface.mjs --check`, the builtin rows are a dated capture of the language's
page (`test/fixtures/surface.PROVENANCE.md`), and this tree has never built a compiler to re-check
them. The capture scan is narrow on purpose - the page's first table cell is the name and the rest
of the row travels with it - because a signature may contain `|` (`(a, a) -> True({}) | False`) and
a cell split on `|` would cut a real signature in half. The file the scan writes is tab-separated,
so the hazard does not follow the rows into it.

**Surface, not verdicts.** The answer prints each effect with the policy *field* that decides it, and
points at `action: "effects"` for what the policy in force decides. Asking the policy 19 questions
to answer "what is the surface" would make the cheap question cost a probe run, and would make the
answer depend on a runner being present. As it is, the action spawns nothing, so it answers on a
machine whose every run ends with the line naming the install - which is exactly
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
