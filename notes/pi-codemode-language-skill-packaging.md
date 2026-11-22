---
name: the language-skill package is the one line of this tree that reaches outside it - decide whether it stays outside
description: .pi/settings.json declares the EYG language-skill pi package from outside this tree; this note records the two ways that could change (vendor it here, or publish it as its own installable package) and the trigger for choosing.
date: 2026-11-20
---

**The fact.** `.pi/settings.json` declares four project packages. `pi list` on 2026-11-20
resolves `..` to this workspace's root and `../pi-simple-world-model` to the copy vendored
*inside* it, and resolves the language-skill declaration to a checkout **outside** this
tree. It is the only one: nothing else in the package reads anything beyond its own
directory (`extensions/eyg-codemode.ts` resolves its policy, roots and libraries from
`import.meta.url`; `invariant.policy-self-contained`).

Why it is there: the tool's refusal is a value the model must read, and the model writes
EYG in the language's own forms. `skills/eyg-codemode/SKILL.md` carries the harness side -
what a refusal means, which effect to ask for, when to consult the registry. The language
side - the surface syntax, the builtins, the effect vocabulary a program can name - is that
other package's skill. Before it is loaded, a session here has `guides/` (this tree's copy
of the language's prose) and nothing else.

**Option one - vendor it, as `pi-simple-world-model/` is vendored.** The tree becomes
self-contained: a `pi install <this package> -l` gives a session everything it needs, and no
declaration can dangle on a machine without the sibling checkout. The cost is a second copy
of prose the language owns, which is exactly the drift this package already tracks for the
world-model tool ("three copies of the world model tool", `AGENTS.md`) and for the guide
copies this tree carried until 2026-11-22 (`docs/world/traps.md`, the offline-copy trap). Two
copies of the *language* would
be worse than two copies of a tool: the language changes with every release.

**Option two - publish it as its own package** and declare it by name, the way
`npm:@woksin/pi-context-budget` is declared in the same file. Then the dependency is
declared the way a dependency is normally declared, a new user installs it from the same
place they install this package from, and this tree keeps no copy. The cost: someone must
own a release, and until that release exists the declaration cannot be written that way.

**The recommendation, measured 2026-11-20: keep it outside, and do not vendor it.** The first
trigger has already fired - with the declaration present the model's skill list is
byte-identical to without it, because that package's `SKILL.md` front matter does not parse. The
numbers, and what a session can reach today without that package, are recorded once in
`docs/world/entities/usability.without-language-skill.md` and
`notes/pi-codemode-language-reference-reachability.md`; they are not repeated here. What they buy
for this decision: vendoring would copy a skill that points outside itself and a second copy of
the language's prose, and buy nothing `action: "reference"` and `guides/eyg-surface.tsv` do not
already buy. So: keep the declaration as the operator's convenience, ask for the one-line
front-matter fix in the other workspace (not this tree's to edit), and rely on
`skills/eyg-codemode/SKILL.md` pointing at the surface this package generates.

**Not chosen, and why.** 2026-11-20: the operator asked for this to be reviewed later rather
than answered now, and the choice is theirs - it is a publishing decision, and publishing is
out of scope for a session here (`AGENTS.md`, hard rules). Vendoring is the option this tree
would pick if forced, because it needs no release; publishing is the option that stops the
drift.

**Trigger.** The first trigger fired on 2026-11-20: a session rooted here cannot load the
language-skill package (front matter, not the path - the path resolves, the skill does not load).
Reopen the decision when either of two things happens: the front-matter fix lands and a re-run of
the same A/B shows the loaded skill beating the reference this package generates by more than the
surface read costs; or the first `npm` or git release of either package, which lets the declaration
be written
by name. Both are written on the record that tracks the hole,
`docs/world/entities/gap.language-skill-home-undecided.md`, whose `verify` fails once a decision
record exists. Until then `README.md` and `AGENTS.md` say the skill is a separate package and
`pi list` prints where the declaration resolves.
