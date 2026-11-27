---
id: gap.language-skill-home-undecided
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -q 'pi-eyg[-_]expressions' .pi/settings.json && grep -q language-skill docs/world/runbooks/runbook.next-milestone.md && ! ls docs/world/decisions/*language-skill* >/dev/null 2>&1"
confidence: high
sources: [.pi/settings.json, notes/pi-codemode-language-skill-packaging.md, docs/world/entities/usability.without-language-skill.md, docs/world/runbooks/runbook.next-milestone.md]
supersedes: null
superseded_by: null
---

# Gap: the language-skill package's home is undecided, and it is this tree's one outside line

`.pi/settings.json` declares the EYG language-skill pi package by path, one directory above
this one (`@measured 2026-11-20` by `grep -q 'pi-eyg[-_]expressions' .pi/settings.json` - the
name is written with a bracket so this page does not match its own sweep, and the one place it
is spelled out is the settings line itself). It is the
only declaration in the tree that reaches outside it: the extension resolves its policy, roots
and libraries from `import.meta.url` (`pi.codemode-tool`), and the world-model tool is vendored
*inside* the package (`world-model.package`). Three shapes are possible and none is chosen:

- **as it stands** - a sibling checkout, declared by relative path. It works only where that
  checkout sits where the settings file expects, and a scratch project two directories deep
  writes `../../..` and loads nothing (`docs/world/traps.md`).
- **vendored** - a copy inside this package, the way `pi-simple-world-model/` sits here. No
  dangling declaration, at the cost of a second copy of prose the language owns.
- **published** - declared by name, the way `npm:@woksin/pi-context-budget` is declared in the
  same file. The normal shape of a dependency, but someone must own a release first.

The measured recommendation is on record and unexecuted: keep it outside, do not vendor it, and
ask for the one-line `SKILL.md` front-matter fix in that package, because as declared it loads
no skill at all (`usability.without-language-skill`, `@measured 2026-11-20`). The decision is
the operator's - it is a publishing decision, and publishing is out of scope for a session here
(`AGENTS.md`, hard rules). Options, costs and the reasoning are
`notes/pi-codemode-language-skill-packaging.md`.

## What to do about it

One step for the next goal, no code: read the note, re-run the A/B if the upstream front-matter
fix has landed and the loaded skill now beats this package's `guides/` mirrors, and write the
choice as a decision record named for the topic (`docs/world/decisions/`). This record's
`verify` fails the moment such a record exists, which is how it retires.

Trigger to decide, either of: the front-matter fix lands upstream and a re-run beats the
surface this package generates, plus its own skill, by more than reading those costs; or the first `npm` or git release of either
package, which lets the declaration be written by name instead of by path.

## Not this

It does not say the declaration is broken - the path resolves, the *skill* does not load, and
that is `usability.without-language-skill`. It is not about this package's own skill
(`skills/eyg-codemode/SKILL.md`), which is inside the tree and does load. It does not propose
vendoring, publishing or editing the other package: those are the operator's acts, and the other
workspace is read-only from here.
