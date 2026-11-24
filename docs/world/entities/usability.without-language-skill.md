---
id: usability.without-language-skill
type: entity
owner: delegate
status: current
verified_at: 2026-11-24
verify: "grep -q 'eyg-surface.tsv' skills/eyg-codemode/SKILL.md && grep -q 'mapping values are not allowed' docs/world/traps.md && grep -q 'do not vendor' notes/pi-codemode-language-skill-packaging.md"
confidence: medium
sources: [skills/eyg-codemode/SKILL.md, notes/pi-codemode-language-skill-packaging.md, notes/pi-codemode-language-reference-reachability.md, docs/world/traps.md, .pi/settings.json, docs/world/entities/pi.reference-action.md, guides/eyg-surface.tsv]
---
# Writing EYG with and without the language-skill package

One task, run in fresh one-shot sessions over two scratch projects whose `.pi/settings.json`
differ only in whether the EYG language-skill package is declared. Task: read three data files
with the `eyg` tool, add their byte sizes in one program, write the total to `out/total.txt`,
try one write outside the roots, report that refusal text. Command
(`@measured 2026-11-20`): `pi --print --mode json --offline --approve --no-session
--no-context-files --tools eyg,read --model strata/qwen3.8-flash-next-iq3_s --thinking low
"<task>"`. Driver, prompts and transcripts: `.ai-work/usability/` (gitignored).
Three alternating rounds per condition, one model, `--thinking low`. Every round ran through a
development build of the language CLI this tree no longer has
(`docs/world/entities/cli.runner-official-install-only.md`), so the table describes a working tool
that no installed build provides today.

| condition | calls | calls with exit != 0 | `builtin undefined` | `read` calls | wall | total written |
| --- | --- | --- | --- | --- | --- | --- |
| skill package not declared | 41, 93, 44 | 26, 85, 28 | 19, 57, 16 | 0, 0, 0 | 130, 418, 157 s | `36`, `36`, `36` |
| skill package declared | 32, 25, 26 | 20, 13, 10 | 8, 5, 7 | 0, 0, 4 | 180, 168, 147 s | `36`, `36`, `36` |
| declared, told to open a reference first | 11 (6 `eyg`) | 2 | 0 | 5 | 104 s | `36` |
| not declared, told to open a reference first | 11 (8 `eyg`) | 3 | 0 | 3 | 89 s | `36` |

- **The declaration, as it stands, loads nothing.** With the declaration present the model's
  skill list is byte-identical to without it (1542 characters, the same three names), measured
  by dumping the system prompt of a probe run in each scratch project (`@measured 2026-11-20`).
  Cause: the language package's `SKILL.md` front matter is not valid YAML - its `description:`
  is an unquoted scalar containing `source: expressions`, and a parser answers
  `mapping values are not allowed here`. Pi advertises a skill only if its front matter parses
  (`docs/skills.md`: malformed `SKILL.md` files are not loaded). Reproduced in a scratch copy:
  with the description quoted, the same declaration lists a fourth skill (2217 characters).
- **Listing is not loading.** Pi puts a skill's name and description in the system prompt and
  the body in only when the model opens it (`docs/skills.md`, "A model might fail to load a
  relevant skill"). In 5 of the 6 rounds no session opened any reference at all - it wrote EYG
  from memory. The one session that did opened the language skill and then this package's
  `guides/cli_effects_reference.md`.
- **What guessing costs.** Across the six rounds with nothing opened: invented builtins
  (`!inspect`, `!binary_length`, `!binary_to_string`, `!length`, `!result_unwrap`, `!unwrap`,
  `!and_then`, `!byte_length`, `!decode_utf8`, `!binary_decode`, `!constructor_name`, 16-57
  errors a run), infix `+`, `match` written without braces or with `=>` arms, and invented
  effect syntax (`handle`, `attempt`, `catch`, `!perform`, `.value`) to unwrap the
  `Result(Binary)` a performed effect binds. Every round still got the arithmetic and the
  refusal text right; the cost was calls and time, not correctness.
- **The reference is not reachable through EYG.** 5 of the 6 sessions tried to read a
  `guides/` or `skills/` path with `perform ReadFile` and were refused - `read_file denied by
  policy: <workspace>/guides` - because the roots cover the project, not the package. One
  session stopped there and asked the operator for `/eyg-grant` over this package's own
  documentation: 86 calls, 7 m 27 s, nothing written (`@measured 2026-11-20`). The `read` tool
  is decided by no policy, and the hint said nothing of it: the tool's own hint was `check the builtin name
  against the builtins reference` and named no path.
- **What did change the cost** was an instruction to open a reference first - and this
  package's own mirrors are enough: told to read `guides/syntax.md` and
  `guides/builtins_reference.md`, a session with no language-skill package at all used 11 calls,
  hit 0 `builtin undefined`, and finished in 89 s. `skills/eyg-codemode/SKILL.md` now says to
  do that; that line is what this page's `verify` greps for.
- **What changed the cost with no instruction at all** is the tool answering the reference. On
  2026-11-20 the same not-told task, in the same scratch project, ran against a package whose `eyg`
  tool has `action: "reference"` and names the guide paths in its rows: 20 calls, 0
  `builtin undefined`, and the session asked the action on its own. That run, its numbers and what
  stays untested live in `docs/world/entities/pi.reference-action.md`.

UNVERIFIED: the two "told to open a reference first" runs are n=1. One model, one thinking
level, one task. The drop in invented builtins when the skill is listed (5-8 vs 16-57) is
directional at n=3 and 2 of those 3 runs never opened the skill, so the mechanism may be the
675 characters of description text in the prompt rather than the skill body. The YAML finding
was reproduced on a scratch copy of the skill, not on the declared package's own file, which is
outside this tree.

## Not this

- what a policy allows and where the roots come from: `docs/world/entities/pi.policy-config.md`
- the grant loop the sessions above asked for: `docs/world/entities/pi.session-grants.md`
- where the `guides/` prose comes from: `docs/world/entities/guides.index.md`
- whether the language-skill package stays a separate package:
  `docs/world/entities/gap.language-skill-home-undecided.md`
