---
name: pi-codemode-preset-inlining
description: Why the policy modules carry their preset inline instead of importing eyg_packages/overlay/policy.eyg, and the check that shows the inlined preset is the same decision
date: 2026-11-18
---

The snippet below is what the modules looked like before this port, while the package sat
inside the language workspace (`/home/chexxor/Git/eyg-lang`); it is quoted as history, and
nothing in this package imports it.

`policies/agent-roots.eyg` and `policies/deny-all.eyg` used to be three lines of
vocabulary plus one import:

```eyg
let policy = import "../../eyg_packages/overlay/policy.eyg"
policy.read_write(roots)
```

That import reached outside the pi package. Moved into its own workspace the package
would still depend on the EYG language repository sitting two directories up, and a
policy - the thing a session's permissions are made of - could not be read where it was
used. Both modules now carry the preset inline and import nothing.

**The trade-off made:** the preset (18 rules and the path helpers) is duplicated here
rather than shared. The language repository stays the definition of that vocabulary; this
package states one decision in one place, and if the runtime's vocabulary changes the fix
is here, not in an upstream library the package never had. What is lost is a security
suite the language repository owns: `eyg_packages/codemode_policy/test/security_test.eyg`
exercises the presets for every effect, and this workspace cannot run it (no `eyg_packages`,
and the runner on `PATH` has no `--policy`). The rules are therefore held by the check
below, not by that suite.

## The check that the inlined preset is the same decision

Both forms were type-checked side by side on 2026-11-18 with `eyg check` (`eyg --version`
printed `eyg v0.1.0`), which prints the policy record with the result type of every rule.

- `eyg check policies/deny-all.eyg` exit 0, 18 fields.
- `eyg check policies/agent-roots.eyg` exit 0, 18 fields.
- `/tmp/eyg-preset-compare.eyg` imported the language repository's preset
  (`/home/chexxor/Git/eyg-lang/eyg_packages/overlay/policy.eyg`) and printed
  `{deny_all: policy.deny_all, read_write: policy.read_write(["/abs/root"])}`; `eyg check`
  exit 0.

Field by field the shapes agree:

| field | `deny-all.eyg` | `policy.deny_all` | `agent-roots.eyg` | `policy.read_write(roots)` |
| --- | --- | --- | --- | --- |
| `append_file` | `Mock(Error String)` | same | `Pass({path: String,..}) \| Mock(Error String)` | same |
| `write_file` | `Mock(Error String)` | same | `Pass({path,..}) \| Mock(Error String)` | same |
| `delete_file`, `make_directory` | `Mock(Error String)` | same | `Pass(String) \| Mock(Error String)` | same |
| `read_file` | `Mock(Error String)` | same | `Mock(Error String) \| Pass({path,..})` | same (the `Mock` before the `Pass` is the secret check wrapping the root check) |
| `read_directory` | `Mock(Error String)` | same | `Pass(String) \| Mock(Error String)` | same |
| `cwd` | `Mock(Error({}))` | same | `Pass` | same |
| `env` | `Mock(None({}))` | same | `Mock(None({}))` | same |
| `exit`, `flip`, `now`, `random`, `sleep`, `standard_error`, `standard_out` | `Pass` | same | `Pass` | same |
| `create_key`, `fetch`, `standard_in` | `Mock(Error String)` | same | `Mock(Error String)` | same |

The 18 fields are exactly the values of `POLICY_FIELDS` in `lib/render-helpers.mjs`
(the 23 effects the CLI names, `DecodeJSON`/`EYGParse`/`Hash`/`Sign` carry no field, and
`Search` shares the `read_file` field), and `test/render-helpers.test.mjs` compares that
record against the recorded `rule_mapping` in `test/fixtures/rule_mapping.gleam`.

What the check does **not** cover: the decisions at run time. A denial is a value, so
`policy.read_write(["/x"])` refusing a path can only be observed by running a program
through a runner that has the `--policy` flag. `which eyg` is `/home/chexxor/.local/bin/eyg`,
`eyg --version` prints `eyg v0.1.0`, and `eyg --help` advertises no `--policy`, so this host
has no runner that can gate. End-to-end gate behaviour in this workspace is UNVERIFIED until
a policy-capable runner is installed (`guides/install_from_source.md` in this workspace covers
building one, or set `EYG_CODEMODE_RUNNER`).
