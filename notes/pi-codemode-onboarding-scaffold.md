---
name: pi-codemode-onboarding-scaffold
description: Why a first project is scaffolded by a script a human runs rather than by an eyg action, why the package is declared by absolute path instead of copied, and why the scaffold drops pi's built-in coding tool
date: 2026-11-25
---

A first session that runs in this workspace writes into the files every check here reads, so
the onboarding guide sends a reader to a project somewhere else, and one script writes the file
that project needs. The choices in that script do not show in its lines.

## A script outside a session, not an action inside one

Scaffolding could have been a call - `action: "scaffold"` writing the settings file - and it
isn't. The tool's roots are the session's own directory, so the call that scaffolds a *new*
project would have to write where the session does not currently reach, and the way it reaches
there would be a grant for a directory that does not exist yet. The roots and the policy are a
statement about where a session may write; scaffolding is the step *before* a session exists, so
it is a script the operator runs, and the script writes with `node:fs` under no policy at all -
which is only safe because the file it writes is one the reader can read back, and because the
script refuses to write where a file already exists.

The alternative that was not taken: a second package or a `pi install`-style command of the
language's. This package does not own pi's install surface, and the file it writes is three
lines, so owning a command over it is a smaller thing than owning an installer.

## The declaration is by absolute path, not a copy

pi identifies a local package by the path it resolves a declaration to, so
`"packages": ["<absolute package path>"]` *resolves* - the scratch project loads the package
that lives in the checkout, reads its `policies/` and `host/` from there, and the day that
checkout changes, the project sees the change. A copy would be a second package: two trees, two
guards, and the drift between them invisible, which is the same shape as the three copies of the
world-model tool that `AGENTS.md` names as open. One copy, declared.

The path has to be absolute and it has to be the *resolved* one: a relative `packages` entry
resolves against the `.pi` directory that holds the settings file, one level deeper than the
count from the project directory, and pi prints the declaration and the path it resolved to in
one line so the reader can see the difference (`docs/world/traps.md`).

## The built-in coding tool is dropped on purpose

`"extensions": ["-builtin:codemode"]` removes pi's built-in JavaScript coding tool, so the
session has exactly one coding tool - this package's `eyg`, whose every effect goes through
`host/guard.eyg` and a policy. Left in, the session has two: one whose effects a policy decides
and one whose effects nothing here decides, and the model picks between them. The scaffold is the
one place a reader can get the pair wrong, so the script that writes the file drops it rather
than noting it.

This is not a claim that the built-in tool is unsafe on a machine; it is the claim that a session
started from this scaffold is a session in which the coding tool is the guarded one, so that an
experiment here measures what the package does rather than what pi does.

## Two refusals in the script, one printout that stops short

The script refuses a relative project path and an existing `.pi/settings.json`. The first is the
rule every path in this package follows (the policy sees absolute paths), and the second is the
difference between scaffolding and editing: the file that exists belongs to a project someone
configured, and overwriting it is a change to someone's project made by a script that was meant
to start one. Neither refusal is loosened by a flag; `--package` names a different package, not
a different project file.

The printout stops short of one thing, and that thing surprised me: pi reads a project's `.pi`
files only after project trust, so on a directory whose trust was never granted, plain
`pi list` answers with no `Project packages:` section at all - an empty answer that reads like a
project declaring nothing, which is the opposite of what a scaffold reader wants to see. Measured
2026-11-25: a fresh scaffold under the temporary directory answered plain `pi list` with the five
user packages and no project section; the same command with `--approve` printed
`Project packages:` and the package twice (declaration and resolved path), 0.5 s. The script
prints the `--approve` form and says why, rather than trusting whatever this machine has granted,
and a session started in the new directory asks for trust once instead.
