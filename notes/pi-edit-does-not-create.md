---
name: pi-edit-does-not-create
description: The harness `edit` tool answers ENOENT for a path that does not exist instead of creating it, which reads as a policy refusal; why that hazard is a note rather than a trap entry
date: 2026-11-22
---

**`edit` changes a file, it never makes one.** Asked to edit a path that is not there it answers
`Could not edit file: <path>. Error code: ENOENT.` (`@measured 2026-11-22`, against a scratch path
under `.ai-work/`). `write` creates, and creates parents.

**Why the error reads as something else.** In this package the sentence a session expects when a
path is unreachable is a refusal from a policy - `read_file denied by policy: <path>` - so a bare
ENOENT on an edit invites the same reading: that a boundary was hit and a grant is owed. It is not.
The two cases are told apart by whether the file exists, which is one `ls` away, and the fix for
ENOENT is the other tool, not the operator. This is a harness fact, not a property of a policy or
of the guard: no effect was performed and no policy was consulted.

**Why this sits in `notes/` and not in `docs/world/traps.md`.** A trap entry has to carry the
command that re-proves it, and the only way to re-prove this is to make the tool call, which is
not a command anyone can run from a shell. A hazard with no runnable command is a note.

Trigger to delete: a pi release whose `edit` creates the missing file, or the harness's own
documentation stating this behaviour, at which point the fact is someone else's to carry.
