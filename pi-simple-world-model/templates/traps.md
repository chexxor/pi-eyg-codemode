# Traps - what looks right and is wrong

Append-only. One entry per trap, three lines at most, naming the wrong path taken and the
command that proves the trap still applies. Earn an entry only after losing at least five
tool calls to a wrong assumption.

- 2026-11-14 — this line is the template's own proof that the file exists; replace it
  with a trap you actually hit. verify: `test -f docs/world/traps.md`
