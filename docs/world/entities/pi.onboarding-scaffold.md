---
id: pi.onboarding-scaffold
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "grep -qF 'extensions: [\"-builtin:codemode\"]' bin/agent/new-project.mjs && grep -q 'exists, so this is a project someone already configured' bin/agent/new-project.mjs && grep -q 'the project directory must be absolute' bin/agent/new-project.mjs && grep -qF 'pi list --approve' bin/agent/new-project.mjs && grep -q '^## Start a project that loads this package' guides/first-session.md && grep -qF 'Two things the printout does not do for you' bin/agent/new-project.mjs && t=$(mktemp -d) && node bin/agent/new-project.mjs \"$t/try\" >/dev/null && node bin/agent/new-project.mjs \"$t/try\" 2>&1 | grep -q 'nothing written' && (cd \"$t/try\" && pi list --approve) | grep -qF \"$(pwd)\" && rm -rf \"$t\""
confidence: high
sources: [bin/agent/new-project.mjs, guides/first-session.md, notes/pi-codemode-onboarding-scaffold.md, .pi/settings.json]
supersedes: null
superseded_by: null
---

# A scratch project that loads this package is one file, and one script writes it

`bin/agent/new-project.mjs <absolute project directory>` writes the one file a project needs to
load this package - `.pi/settings.json` - and prints what it wrote and the commands that start a
session there. A first session that runs in this workspace writes into the files every check here
reads, so `guides/first-session.md` sends a reader to a project somewhere else before it asks for
a call, and this script is what makes that project exist.

The file is two keys: `packages` declaring the package by absolute path, and `extensions`
dropping pi's built-in coding tool so the session has exactly one coding tool - this package's
`eyg`. The declaration **resolves** rather than copies, so the scratch project runs the guard, the
policies and the libraries that live in the checkout, and a change there is a change here. Why
each key is there, and why the script is a script rather than an action of the tool, is
`notes/pi-codemode-onboarding-scaffold.md`.

The script refuses two things and takes no flag past `--package <absolute package path>`: a
relative project directory, and a project that already has a `.pi/settings.json` - that file
belongs to a project someone configured, and the script starts projects, it does not edit them.

## What one run measured

All offline, in the temporary directory, 0.37 s for the chain in this record's `verify`:

| step | the answer |
| --- | --- |
| `node bin/agent/new-project.mjs "$t/try"` | `wrote: <t>/try/.pi/settings.json`, then the declares block, then the two commands to run |
| the same command a second time | `new-project: <t>/try/.pi/settings.json exists, so this is a project someone already configured; nothing written`, `exit=1`, and the file unchanged |
| `cd "$t/try" && pi list --approve` | `Project packages:` names the package twice - the declaration and the path it resolved to |
| `cd "$t/try" && pi list` (no `--approve`) | no `Project packages:` section at all |

The last row is the trap in this step: pi reads a project's `.pi` files only after project
trust, so an untrusted directory answers as though it declared nothing - an empty answer that
reads the opposite of what it means. `--approve` trusts the project files for one command; a
session started in the new directory asks for trust instead, and answering once is enough. This
workspace is under a directory trust was granted for, which is why plain `pi list` prints the
section here and prints nothing for a fresh project on the temporary directory.

## Not this

- what the tool does once the session is started, and which policy that call gets:
  `guides/first-session.md`, and `pi.policy-config`;
- whether a project package contributes its skills, and the fact that an unparsed `SKILL.md`
  front matter silently contributes none: `docs/world/traps.md`;
- the registry scopes a started session reads, and who owns the modules in them:
  `pi.registry-scope-persistence`;
- a project declaring a package with a relative path, and how pi resolves it: `docs/world/traps.md`.

@measured 2026-11-25 by the four-step chain in this record's `verify` (0.37 s wall, run in the
temporary directory, offline) and by the scaffold at `.ai-work/scaffold/try-eyg`, which is under
the gitignore line for `.ai-work/` and is where the one-shot session that proves the registry
listings ran.
