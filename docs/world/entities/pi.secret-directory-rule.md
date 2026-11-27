---
id: pi.secret-directory-rule
type: entity
owner: delegate
status: current
verified_at: 2026-11-27
verify: "node bin/agent/secret-rule-probe.mjs > /dev/null && eyg check policies/agent-roots.eyg > /dev/null && grep -qF 'let secret_directory_names = [' policies/agent-roots.eyg && grep -qF 'let secret_directory_names = [' policies/spawner-effects.eyg && grep -qF 'hide_secrets(\"read_file\", request_path, under(\"read_file\", roots, request_path))' policies/agent-roots.eyg && grep -qF 'run_check \"the hidden-name rule refuses in every direction\" secret_rule' bin/agent/audit.sh && test -f test/fixtures/secret-directory-probe.eyg"
confidence: high
sources: [policies/agent-roots.eyg, policies/spawner-effects.eyg, bin/agent/secret-rule-probe.mjs, test/fixtures/secret-directory-probe.eyg, bin/agent/refusal-probe.mjs, notes/pi-codemode-threat-model.md, guides/how-to-write-a-policy.md, guides/tool-reference.md, docs/world/entities/gap.policy-record-extension.md, docs/world/entities/pi.spawner-policy.md]
supersedes: null
superseded_by: null
---
# The hidden-name rule: a path effect refuses a named secret directory in every direction

`policies/agent-roots.eyg` decides a path in two steps. `under(effect, roots, path_of)` (`:128`) asks
whether the path is under a root; `hide_secrets(effect, path_of, rule)` (`:189`) wraps that rule and
refuses the path first if `hidden(path)` (`:172`) is true. `hidden` splits the absolute path on `/`
and refuses it if any segment equals a name in `secret_directory_names` (`:151`) or the path ends in
`secret_file_suffix` (`:154`). All seven path fields - `read_file`, `write_file`, `append_file`,
`delete_file`, `make_directory`, `read_directory`, `search` - are wrapped, so the name is refused for
writes and listings and the search walk as well as for reads. A refused path is answered
`"<effect> denied by policy: <path> (a name this policy hides)"`; the wrapper runs before the roots
are consulted, so a hidden name is refused under a root and outside one alike.

**Why a directory and not a name.** The suffix test alone is beaten by the name. `test/fixtures/spelling-probe.eyg`,
run 2026-11-24 against the suffix-only rule, read `.ENV.EYG`, `.env.eyg.`, `.env.eyg ` and both
encodings of `café.txt` while plain `.env.eyg` was refused: the filesystem compares exact bytes, so
spelling reached past the rule. A directory is not a name a file can spell its way around.

Measured 2026-11-25, `node bin/agent/secret-rule-probe.mjs`, 0.48 s, against a root the probe builds
in the system temporary directory (`@measured 2026-11-25 by running that command in this tree`):

| asked | answer |
| --- | --- |
| read `ordinary/nested/file.txt`, write `ordinary/nested/new.txt` | performed - the rule narrows, it does not replace the roots |
| read, write, append, delete, mkdir, list, search under `secrets/` | refused, seven different `<effect> denied by policy: ... (a name this policy hides)` |
| search rooted at the root itself, with a hidden directory inside it | performed; the walk refuses the hidden directory when it reaches it |
| read `.ssh/config`, read `.env.eyg` | refused |
| read `ordinary/id_rsa` | performed - the bound: the rule knows the names it was given, not what a secret is |
| read `ordinary/secrets` (a *file* named like the directory) | refused - the cost of a path-text rule |
| after the run, on disk | `secrets/planted` does not exist; `secrets/id_rsa` still holds its bytes |

The probe is falsifiable: `--policy` points the call at any module, and a copy of the shipped policy
whose `hidden` returns `False({})` printed 14 `DRIFT` rows and exit 1 while the shipped one printed
16 `holds` and exit 0. It is an audit row - `run_check "the hidden-name rule refuses in every
direction" secret_rule` in `bin/agent/audit.sh`. Pointed at the spawner's copy with `--policy`, the same
probe prints the same refusals for the child (`docs/world/entities/pi.spawner-policy.md`).

**What it is not.** It is not a secret scanner: nothing looks inside a file, and a secret in a
directory nobody named is reachable under a root. It is applied to a spawned session as well:
`policies/spawner-effects.eyg` repeats the two name rules inside its own record, because a policy
cannot extend another policy's record (`docs/world/entities/gap.policy-record-extension.md`) - so a
rule fixed in one copy stays wrong in the other until someone mirrors it, and the drift between the
two is counted by the command in that record's `verify` when it matters, not by a line count that
rots. `notes/pi-codemode-threat-model.md` carries that row and its trigger. It does not close the symlink route: a link whose own path is
outside a hidden directory still resolves wherever it points
(`docs/world/entities/gap.symlinks-escape-the-roots.md`).

## Not this

- which policy a call gets, and how to point the tool at one of your own:
  `docs/world/entities/pi.policy-config.md`;
- the roots rule the wrapper sits on top of, and what an empty root list means:
  `docs/world/entities/codemode.effect-surface.md`, `docs/world/entities/pi.policy-config.md`;
- the host shield over `host/` and `policies/`, which fires before any rule:
  `docs/world/entities/host.guard-boundary.md`;
- the symlink route, which this rule does not touch:
  `docs/world/entities/gap.symlinks-escape-the-roots.md`.
