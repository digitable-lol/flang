#!/bin/sh
# Fills the package manifests of a release from its SHA256SUMS.
#
#   sh packaging/prebuilt/manifests.sh <version> <SHA256SUMS> <out-dir> [base-url]
#
# Writes into <out-dir>:
#   flang-package.rb   Homebrew formula for digitable-lol/homebrew-tap
#   PKGBUILD, .SRCINFO AUR package flang-package-bin
#
# The checksums come from the release run, never from a local build: the
# tarballs are built on the runners and cannot be reproduced byte for byte
# elsewhere. <base-url> defaults to the GitHub release of <version>; a test
# passes a file:// directory instead.
set -eu

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
  echo "usage: $0 <version> <SHA256SUMS> <out-dir> [base-url]" >&2
  exit 2
fi
version=$1
sums=$2
out=$3
base=${4:-https://github.com/digitable-lol/flang/releases/download/v$version}
here=$(cd "$(dirname "$0")" && pwd)
packaging=$(dirname "$here")

sum_of() {
  file="flang-package-$version-$1.tar.gz"
  value=$(awk -v f="$file" '$2 == f || $2 == "*" f { print $1 }' "$sums" | head -1)
  if [ -z "$value" ]; then
    echo "$sums does not list $file" >&2
    exit 1
  fi
  printf '%s' "$value"
}

macos_arm64=$(sum_of macos-arm64)
macos_x86_64=$(sum_of macos-x86_64)
linux_aarch64=$(sum_of linux-aarch64)
linux_x86_64=$(sum_of linux-x86_64)

fill() {
  sed -e '/^#@/d' \
      -e "s|@VERSION@|$version|g" \
      -e "s|@BASE_URL@|$base|g" \
      -e "s|@SHA_MACOS_ARM64@|$macos_arm64|g" \
      -e "s|@SHA_MACOS_X86_64@|$macos_x86_64|g" \
      -e "s|@SHA_LINUX_AARCH64@|$linux_aarch64|g" \
      -e "s|@SHA_LINUX_X86_64@|$linux_x86_64|g" \
      "$1" > "$2"
  if grep -n '@[A-Z0-9_]*@' "$2"; then
    echo "$2: placeholders left unfilled" >&2
    exit 1
  fi
}

mkdir -p "$out"
fill "$packaging/homebrew/flang-package.rb.in" "$out/flang-package.rb"
fill "$packaging/aur/PKGBUILD.in" "$out/PKGBUILD"
fill "$packaging/aur/SRCINFO.in" "$out/.SRCINFO"
echo "manifests for $version written to $out: flang-package.rb PKGBUILD .SRCINFO"
