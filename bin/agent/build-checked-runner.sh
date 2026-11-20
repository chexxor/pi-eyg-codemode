#!/usr/bin/env bash
# Build an EYG CLI that answers for an effect, and prove it before naming it.
#
# A human runs this. Nothing in this package runs it: the package has no effect that
# starts a shell command, and a build of another repository is not this tree's work
# (AGENTS.md). The steps it automates are the ones
# guides/how-to-get-a-checked-runner.md describes.
#
# It needs the language CLI's source. This tree deliberately names no repository - the
# clone URL lives on https://eyg.run/guides/install-from-source, which is the source for
# these steps (docs/world/decisions/ADR-003-doc-delegation.md).
#
# Usage:
#   bin/agent/build-checked-runner.sh --source <checkout of the language repository>
#   bin/agent/build-checked-runner.sh --clone-url <url> [--ref <ref>] [--dest <dir>]
#
# Options:
#   --source <dir>  build this checkout instead of cloning
#   --ref <ref>     check this ref out of the cloned repository
#   --dest <dir>    where to clone (default: a directory under $HOME/.cache)
#   --link <path>   after the checks pass, symlink the artifact at this absolute path
#                   (<cwd>/.local/eyg-checked is the place the tool probes)
set -euo pipefail

pkg=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
source_dir=""
clone_url=""
ref=""
dest=""
link=""

die() {
  echo "$@" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --source) source_dir=${2:-}; shift 2 ;;
    --clone-url) clone_url=${2:-}; shift 2 ;;
    --ref) ref=${2:-}; shift 2 ;;
    --dest) dest=${2:-}; shift 2 ;;
    --link) link=${2:-}; shift 2 ;;
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

if [ -n "$source_dir" ] && [ -n "$clone_url" ]; then
  die "pass --source or --clone-url, not both"
fi
if [ -z "$source_dir" ] && [ -z "$clone_url" ]; then
  die "no source: pass --source <checkout> or --clone-url <the URL on the install-from-source page>"
fi

for tool in gleam bun git; do
  command -v "$tool" >/dev/null 2>&1 ||
    die "$tool is not on PATH. The build needs Gleam >= 1.7 and Bun: guides/install_from_source.md, and <https://eyg.run/guides/install-from-source> is its source."
done

if [ -n "$clone_url" ]; then
  [ -n "$dest" ] || dest="${HOME}/.cache/pi-eyg-codemode/gleam_cli"
  if [ ! -d "$dest/.git" ]; then
    echo "cloning $clone_url -> $dest"
    git clone "$clone_url" "$dest"
  else
    echo "using the existing clone at $dest"
  fi
  source_dir=$dest
  if [ -n "$ref" ]; then
    echo "checking out $ref"
    git -C "$source_dir" fetch --all --tags
    git -C "$source_dir" checkout "$ref"
  fi
fi

[ -d "$source_dir" ] || die "no such checkout: $source_dir"
cli_dir="$source_dir/packages/gleam_cli"
[ -x "$cli_dir/bin/compile" ] ||
  die "$cli_dir has no executable bin/compile. That is the build this mirror describes (guides/install_from_source.md); read that checkout's own README for its current build."

echo "building $cli_dir"
( cd "$cli_dir" && ./bin/compile )

artifact="$cli_dir/dist/eyg"
[ -x "$artifact" ] || die "the build produced no executable at $artifact"

# Half one of the proof: does this artifact answer for an effect at all?
count=$("$artifact" --help 2>&1 | grep -c -- --policy || true)
if [ "${count:-0}" -eq 0 ]; then
  echo
  echo "$artifact built, and its --help does not mention --policy."
  echo "So it cannot be this package's runner: every effect would be refused before a program ran."
  echo "This is the recorded gap, not a build error - the release and the default branch both lack"
  echo "the flag (docs/world/entities/gap.runner-release-lacks-policy.md,"
  echo "docs/world/entities/gap.policy-runner-not-on-main.md)."
  echo "Ask the language repository which ref carries 'run --policy', then build that ref with --ref."
  exit 1
fi
echo "--help mentions --policy $count times"

# Half two of the proof: the preset answered, and nothing was written.
fixture="$pkg/test/fixtures/refusal-probe.eyg"
preset="$pkg/policies/deny-all.eyg"
out=$("$artifact" run --policy "$preset" "$fixture" 2>&1)
if ! printf '%s\n' "$out" | grep -q 'write_file denied by policy'; then
  die "the artifact takes the flag but the preset did not refuse the write. Its output:
$out
Do not use this artifact as the runner until that is understood."
fi
echo "the shipped preset refused the fixture's write: the checks are in force"

if [ -n "$link" ]; then
  case "$link" in
    /*) ;;
    *) die "--link needs an absolute path, got $link" ;;
  esac
  mkdir -p "$(dirname -- "$link")"
  rm -f "$link"
  ln -s "$artifact" "$link"
  echo "linked $link -> $artifact"
fi

echo
echo "Name it one of two ways (guides/how-to-get-a-checked-runner.md):"
echo "  export EYG_CODEMODE_RUNNER=$artifact"
echo "  ln -s $artifact <cwd>/.local/eyg-checked    # .local/ is gitignored"
echo
echo "Then prove the tool found it: one eyg call with action \"effects\", expanded, prints"
echo "runner: $artifact on its last line."
