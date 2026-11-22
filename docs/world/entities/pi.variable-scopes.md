---
id: pi.variable-scopes
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "grep -q 'VARIABLE_SCOPES.includes(extern)' extensions/eyg-codemode.ts && grep -q variableWriteOutcomes extensions/eyg-codemode.ts && grep -q eyg-variable lib/render-helpers.mjs && node --test test/render-helpers.test.mjs"
confidence: high
sources: [extensions/eyg-codemode.ts, lib/render-helpers.mjs, test/render-helpers.test.mjs, guides/how-to-keep-bindings.md, bin/agent/check-variable-shapes.mjs, notes/pi-codemode-kept-bindings.md]
supersedes: null
superseded_by: null
---
# A kept binding: three scopes, and a write the policy decides

An `eyg` call keeps the top-level `let` bindings it defines by naming a scope with `extern`:
`session`, `workspace` (`<cwd>/.pi/eyg-variables/`) or `user` (`$HOME/.pi/eyg-variables/`). What
the store holds is the binding's **source text**, so the call that uses the name evaluates it again
(`VARIABLE_SCOPES`, `variablePrelude`, `variableModule`, `variableWriteProgram`,
`variableWriteOutcomes` in `lib/render-helpers.mjs`, used by `extensions/eyg-codemode.ts`). The
how-to is `guides/how-to-keep-bindings.md`.

- **The next call sees the name with no `libraries` argument.** The tool prepends one line per
  binding visible to it: `let {name} = import "<module>"` for a file scope, `let name = <source>`
  for a session binding. Furthest scope first, this session last, so the nearer definition wins the
  name and the shadowed one is reported (`keptBindings` in `extensions/eyg-codemode.ts`); the lines
  reach `details.prelude` and the names reach `details.kept`.
- **Keeping a file scope runs a program**, under the same policy and roots as the call that asked:
  `perform MakeDirectory(...)`, then one `perform WriteFile(...)` per binding, each answer printed
  by that program - a run prints no value of its own, so a program that only returns its results
  says nothing. A refusal is the ordinary `<field> denied by policy: <path>` value and the call adds
  the rows naming the grant that would have allowed it.
- **Kept needs both halves**: no refusal for that path, the write program finished, and the file
  present in the scope directory afterwards. A program that printed nothing and wrote nothing comes
  back `no file at <path> after the write program ran`, never as a success
  (`variableWriteOutcomes`).
- **A call that did not finish keeps nothing**: `nothing kept: the program exited 1, so its
  bindings were not written`.
- **Session scope is the session branch**, not a directory:
  `pi.appendEntry("eyg-variable", {op: "define", name, source})`, replayed by
  `variableEvents`/`replayVariables` off `ctx.sessionManager.getBranch()` - the same store shape as
  a grant (`docs/world/entities/pi.session-grants.md`), so a fork or a `/tree` jump replays the
  definitions the branch carries and a truncated branch drops them. There is no file to delete, and
  the newest definition of a name wins.
- **A name is checked before anything is written** (`variableName`): lower snake_case, because that
  is the case EYG binds, so `let myWebSearch` answers `... so name it my_web_search`. The words the
  parser reserves (`let`, `handle`, `perform`, `match`, `import`), a `_lib` suffix, a source using a
  `<name>_lib` alias, a binding naming itself and a mutual-reference cycle are each refused with the
  reason; a destructuring `let` is reported rather than guessed at.
- **A module that does not parse is answered with the fix** (`variableImportProblems`): the file,
  the runner's reason, and the two ways out - re-`extern` the name, or `DeleteFile` the module.

Measured 2026-11-22 by `node bin/agent/check-variable-shapes.mjs` (0.40 s, scratch under
`.ai-work/`, the officially installed CLI, **no policy module in that run**): the scan of a program
carrying a comment bracket, a destructuring `let`, and a string with a quote, a backslash, a tab and
a newline kept `signature, greet, greeting` in dependency order; the write program it generated
type-checked, made `.pi/eyg-variables/` and wrote three modules; the prelude lines imported them
back and `eval` answered `"a\"b\\c\td\ne!"` for `greet("!")`; the module for `greet` imported its
sibling as `./signature.eyg` and carried no machine path; a write aimed at a directory that does not
exist printed its reason and came back as not kept. `node --test 'test/*.mjs'` (39 tests, pass 39,
fail 0) pins the refusal rows, the name refusals, the branch replay, and the two-half rule.

Seen live 2026-11-22 in one fresh one-shot session (`pi --print --mode json --tools eyg --offline
--approve --no-session --no-context-files --no-skills`, 17 s, over a scratch project whose
`.pi/eyg-variables/note.eyg` existed before the session started): `extern: "bogus"` answered
`extern must name one of user, workspace, session, got bogus`, and `extern` on `action: "effects"`
answered `it belongs on action run or eval, not effects` - both before a program was spawned. Every
later call carried `let {note} = import "<scratch>/.pi/eyg-variables/note.eyg"` in
`details.prelude` and `note (workspace)` in `details.kept`, so the binding on disk was aliased by
name with no `libraries` argument. Both of those calls ended
`nothing kept: the program exited 1, so its bindings were not written`, because the installed
binary read the mode word as a file name.

UNVERIFIED from here: an `extern` call of this package's tool performing a write, and a policy
module deciding one. No officially installed build takes `--policy`, so on this host every call
through the tool is refused before a program runs
(`docs/world/entities/cli.runner-official-install-only.md`); the writes in the paragraph above
landed precisely because no policy was loaded, and the camelCase name refusal was not reached in
the live session for the same reason - the unit test pins that row. The feature stays unproved in
use, as the package does (`docs/world/entities/pi.first-draft.md`).

## Not this

- the read-only registry of function-sets: `docs/world/entities/pi.codemode-tool.md`, and the
  `metadata` record a `<name>_lib` module carries;
- which policy and roots the write program runs under: `docs/world/entities/pi.policy-config.md`;
- why source text rather than a value, why the branch rather than a file, and why a host-side read
  paired with an effect-side write: `notes/pi-codemode-kept-bindings.md`.

@measured 2026-11-22 by `node bin/agent/check-variable-shapes.mjs`, by
`node --test 'test/*.mjs'`, and by that one-shot session (`out.jsonl` under `.ai-work/`, the four
rows quoted above read off its `details`); all offline.
