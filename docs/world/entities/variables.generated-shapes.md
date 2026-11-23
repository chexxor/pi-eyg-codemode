---
id: variables.generated-shapes
type: entity
owner: delegate
status: current
verified_at: 2026-11-23
verify: "node bin/agent/check-variable-shapes.mjs | grep -qx 'variable shapes: ok'"
confidence: high
sources: [bin/agent/check-variable-shapes.mjs, lib/render-helpers.mjs, bin/agent/audit.sh, docs/world/entities/pi.variable-scopes.md]
supersedes: null
superseded_by: null
---
# The kept-binding shapes are run, not only written

`bin/agent/check-variable-shapes.mjs` builds the text an `extern` call builds and runs it through
the CLI on `PATH`: scan, dependency order, module text, write program, prelude read-back, and a
write that does not land. It is one row in `bin/agent/audit.sh`, and its `verify` is the script
itself answered by `grep -qx`. Cost 0.40 s, in scratch under `.ai-work/check-variable-shapes/`,
removed unless `--keep` names it.

- **The scan sample is written so a wrong scan shows up**: a `let` inside a function body, a bracket
  inside a comment, a destructuring `let`, and a string holding a quote, a backslash, a tab and a
  newline. A scan that took the last newline of a multi-line value, or read a comment bracket as
  depth, fails the row; so does an escape writer that mangles one of those four characters, because
  the last step compares the imported binding's answer against the exact string.
- **The generated write program is type-checked and then run** - `eyg check <file>` then
  `eyg run <file>` - and the check is that the directory and the three modules exist afterwards.
- **The read-back is the prelude the tool writes**: one `let {name} = import "<abs module>"` per
  binding plus the call, and `eyg eval` answers exactly `"a\"b\\c\td\ne!"` for `greet("!")`. A
  module read back is one import line per binding, so a prelude that gained or lost a line fails.
- **A written module names a sibling of its own scope as `./signature.eyg`**, and the row asserts
  the module carries no absolute machine path at all - which is what keeps a workspace-scope binding
  safe to track in git.
- **A write that does not land is reported as not kept**: the program prints
  `write <path>: <reason>` for its own step, and the outcome built from that output plus the
  directory listing says so too. The failure this row forces is the host's (a missing directory),
  not a policy's.

What it does **not** prove: that a policy decided the write. The script starts `eyg run <file>` with
no policy module, so those writes are the CLI performing what the program asked. The policy half of
the claim lives in `docs/world/entities/pi.variable-scopes.md`, which proves a keep through the tool
live for `extern: "session"` - a scope that writes no file - and labels a file scope kept under a
refusal as not live.

## Not this

- the behaviour a session sees - scopes, refusals, what `kept` means:
  `docs/world/entities/pi.variable-scopes.md`;
- the unit suite, which pins the same shapes without running a CLI:
  `docs/world/entities/pi.codemode-tool.md`;
- the decision to keep source text rather than a value: `notes/pi-codemode-kept-bindings.md`.

@measured 2026-11-22 by `node bin/agent/check-variable-shapes.mjs` (0.40 s wall, eleven `ok` rows and
`variable shapes: ok`, exit 0) with `command -v eyg` answering `$HOME/.local/bin/eyg`.
