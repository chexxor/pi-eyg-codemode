---
id: gap.windows-is-undocumented
type: entity
owner: delegate
status: current
verified_at: 2026-11-22
verify: "! grep -qi 'windows' README.md && grep -qi 'windows' guides/install_prebuilt.md"
confidence: medium
sources: [README.md, guides/install_prebuilt.md, extensions/eyg-codemode.ts]
supersedes: null
superseded_by: null
---

# Gap: the Windows route is named by the install guide and answered by no page

`guides/install_prebuilt.md` offers `eyg-windows-x64.exe` as a release asset, and `README.md` mentions Windows nowhere. What the package does on that platform is untested and undocumented: the runner candidates are `eyg` and `<cwd>/packages/gleam_cli/dist/eyg`, resolved through pi's `exec`, and the shipped preset reads `EYG_ALLOWED_ROOTS`, which is set and restored around the call. Nothing here proves either half works without a POSIX shell.

## What to do about it

Two steps, in order: run one session on Windows with a `--policy` build and record the rows and the provenance line; if the environment hand-off fails, the fix is a flag the tool passes rather than an environment variable, which is a change to the extension and its test, not to the docs. Confidence is `medium` because the asset exists in the release and the platform behaviour has never been observed here.

Trigger: the first Windows user of this package, or the operator's own move onto Windows.

## Not this

It does not claim Windows is unsupported - nothing here has observed it, which is why the record
is `medium` confidence. It is not about the language's own Windows support; the claim is that
this package documents nothing for that platform.
