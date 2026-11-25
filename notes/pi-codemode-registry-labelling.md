---
name: pi-codemode-registry-labelling
description: Why a registry entry names its scope with a tag and gets an owner line only when the tag is not the package's, instead of a label on every row
date: 2026-11-25
---

`action: list_functions` prints the three scopes one call can bind from, and the listing is a
channel into a later session's context: a planted module's own `description` line comes back as
this tool's documentation of a function. Attribution was the fix, and the shape of it is not in
the two lines that print it.

## A tag on every row plus an owner line on the rows that are not the package's

Every entry already carried its scope tag (`[package]`, `[workspace]`, `[home]`); what was added is
one line, `owner:`, on the entries whose tag is not `[package]`, and three header lines that say
what the tags mean. The shipped entries carry no owner line, so the listing a session here prints
stays the length it was; the entries that came from somewhere else - this project's
`.pi/eyg-functions`, or the machine's - are the ones that grew a line, which is the half a reader
has to act on.

The alternative was a label on every row, which says more often and reads worse: a package listing
of two shipped modules with three "shipped with this package" lines is noise, and the noise is what
hides the one line that matters. A second alternative was to label nothing and put the warning in
the tool description, which loses it: the description is one block for the whole tool, and the
warning has to sit beside the row the reader is about to bind.

`describe_function` is the other half, and it prints the owner line for every scope including the
package's: a reader who has singled out one module wants to know whose module it is even when the
answer is "shipped", because that call is the one that decides whether to read the source.

## The strings live in `lib/render-helpers.mjs`, not in the extension

`scopeOwner` and `registryScopeLegend` are exported from the lib the tests share, so the unit group
`the registry labels: whose module an entry is` pins the exact words, and a claim's `verify` can
grep the extension for the two call sites. Inline strings in the TypeScript would have been
unchangeable by a test and rewordable without anything noticing - which is the failure mode
`docs/world/traps.md` already records for a claim that greps a string the tool prints. Rewording
one of these is therefore a deliberate act: move the unit group, the claim's greps and this page in
one commit.

## What is not measured

The `[home]` owner line is pinned by the unit group only. Nothing was planted in the operator's
`$HOME/.pi/eyg-functions`, and the record of why that scope reaches every workspace is
`docs/world/entities/pi.registry-scope-persistence.md`, which marks the real-home case UNVERIFIED
for the same reason.
