#!/bin/sh
# Puts the Homebrew formula of a published release into the tap.
#
#   sh packaging/prebuilt/publish-tap.sh <version> [--sums <SHA256SUMS>] [--tap <dir>] [--no-push]
#   bootstrap/flang run-script release:tap <version>
#
# The checksums of the prebuilt builds exist only after the release run, so
# the tap is updated after the tag, never before it. This script takes the
# SHA256SUMS of the release (downloaded from GitHub unless --sums names a
# file), fills the formula with packaging/prebuilt/manifests.sh, commits it in
# the tap and pushes. --tap defaults to the submodule packaging/homebrew-tap;
# with the submodule the new pointer is staged in the tree, and the commit of
# the tree is left to the caller. --no-push stops before the push.
set -eu

usage() {
  echo "usage: $0 <version> [--sums <SHA256SUMS>] [--tap <dir>] [--no-push]" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
version=${1#v}
shift
sums=
tap=
push=yes
while [ "$#" -gt 0 ]; do
  case "$1" in
    --sums) [ "$#" -ge 2 ] || usage; sums=$2; shift 2 ;;
    --tap) [ "$#" -ge 2 ] || usage; tap=$2; shift 2 ;;
    --no-push) push=no; shift ;;
    *) usage ;;
  esac
done

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
submodule=no
if [ -z "$tap" ]; then
  tap="$root/packaging/homebrew-tap"
  submodule=yes
fi
if [ ! -f "$tap/Formula/flang-package.rb" ]; then
  echo "publish-tap: $tap/Formula/flang-package.rb is missing. For the submodule run: git submodule update --init packaging/homebrew-tap" >&2
  exit 1
fi

# Start from the published tap, not from wherever the checkout stands: the
# release run may have pushed this very formula already, and a commit made on
# an older checkout would be refused by the push.
if [ -n "$(git -C "$tap" status --porcelain)" ]; then
  echo "publish-tap: $tap has uncommitted changes; commit or discard them first" >&2
  exit 1
fi
git -C "$tap" fetch --quiet origin main
git -C "$tap" checkout --quiet --detach FETCH_HEAD

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM
if [ -z "$sums" ]; then
  sums="$work/SHA256SUMS"
  url="https://github.com/digitable-lol/flang/releases/download/v$version/SHA256SUMS"
  if ! curl -fsSL --retry 3 -o "$sums" "$url"; then
    echo "publish-tap: release $version has no SHA256SUMS at $url. The tap follows a published release: wait for the Release run of tag v$version to finish." >&2
    exit 1
  fi
fi

sh "$here/manifests.sh" "$version" "$sums" "$work/out" >/dev/null
cp "$work/out/flang-package.rb" "$tap/Formula/flang-package.rb"

if [ -z "$(git -C "$tap" status --porcelain -- Formula/flang-package.rb)" ]; then
  echo "publish-tap: the tap already serves flang-package $version ($(git -C "$tap" rev-parse --short HEAD)); nothing to commit"
else
  git -C "$tap" add Formula/flang-package.rb
  git -C "$tap" commit --quiet -m "flang-package $version"
  echo "publish-tap: committed flang-package $version in the tap ($(git -C "$tap" rev-parse --short HEAD))"
  if [ "$push" = yes ]; then
    git -C "$tap" push --quiet origin HEAD:refs/heads/main
    echo "publish-tap: pushed to the tap"
  else
    echo "publish-tap: not pushed (--no-push)"
  fi
fi

if [ "$submodule" = yes ]; then
  git -C "$root" add packaging/homebrew-tap
  echo "publish-tap: the submodule pointer is staged; commit it together with the release pages"
fi
