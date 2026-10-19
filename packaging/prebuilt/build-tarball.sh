#!/bin/sh
# Builds one prebuilt tarball of flang from the C release archive.
#
#   sh packaging/prebuilt/build-tarball.sh <flang-VERSION-c.tar.gz> <os> <arch> <out-dir>
#
# <os> is linux or macos; <arch> is what `uname -m` prints there (x86_64,
# aarch64 on Linux, arm64 on macOS), so the installer can name the asset
# without a lookup table. The result is
#
#   <out-dir>/flang-package-VERSION-OS-ARCH.tar.gz
#
# with one top directory flang-package-VERSION-OS-ARCH/ holding the layout
# Homebrew and asdf install today:
#
#   bin/flang  bin/flangtutor  libexec/flang/checker  share/flang/<target>/
#   share/flang-tutor/  share/man/man1/flang.1  LICENSE
#   lib/ include/            macOS only, see below
#
# The binary is built from the C archive, not from the tree: the published
# tarball is the same C99 that `brew` and `asdf` already compile, so the
# prebuilt build and a source build differ only in the compiler.
#
# Linux: run inside Alpine (musl). The binary is linked statically and runs on
# any Linux of that architecture, whatever its libc. The seed flags are kept
# (with -flto): without -flto gcc stops on a -Wformat-truncation warning that
# -Werror turns into an error. lib/ and include/ are not shipped: an archive
# compiled against musl cannot be linked by the system cc of a glibc machine,
# so the shell evaluates expressions only in a source build there.
#
# macOS: the flags of the Homebrew formula (no -flto), so lib/ and include/ are
# ordinary objects the system clang links and the shell evaluates expressions.
#
# libexec/flang/checker is the independent proof checker, built from checker.c
# of the archive: `flang check --proof` runs it from ../libexec/flang/checker
# next to its own binary. Archives before 0.7.30 have no checker.c, and the
# tarball then has no checker.
set -eu

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <flang-VERSION-c.tar.gz> <linux|macos> <arch> <out-dir>" >&2
  exit 2
fi
archive=$1
os=$2
arch=$3
out=$4

base=$(basename "$archive")
version=${base#flang-}
version=${version%-c.tar.gz}
case "$version" in
  [0-9]*.[0-9]*) : ;;
  *) echo "cannot read a version from the archive name: $base" >&2; exit 2 ;;
esac
case "$os" in
  linux | macos) : ;;
  *) echo "unknown os: $os (linux or macos)" >&2; exit 2 ;;
esac

jobs=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)
name="flang-package-$version-$os-$arch"
mkdir -p "$out"
out=$(cd "$out" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/src"
tar -xzf "$archive" -C "$work/src"

checker_flags="-std=c99 -O2"
case "$os" in
  linux)
    make -C "$work/src" -j"$jobs" LDLIBS="-lm -lpthread -static" flang
    checker_flags="$checker_flags -static"
    ;;
  macos)
    make -C "$work/src" -j"$jobs" CFLAGS="-std=c99 -Wall -Wextra -Werror -pedantic -O2"
    ;;
esac
if [ -f "$work/src/checker.c" ]; then
  # shellcheck disable=SC2086 # the flags are words on purpose
  ${CC:-cc} $checker_flags -o "$work/src/flang-checker" "$work/src/checker.c" -lm
fi

root="$work/$name"
mkdir -p "$root/bin" "$root/share/man/man1" "$root/share/flang"
cp "$work/src/flang" "$root/bin/flang"
chmod 0755 "$root/bin/flang"
if [ -f "$work/src/flangtutor" ]; then
  cp "$work/src/flangtutor" "$root/bin/flangtutor"
  chmod 0755 "$root/bin/flangtutor"
fi
if [ -f "$work/src/flang-checker" ]; then
  mkdir -p "$root/libexec/flang"
  cp "$work/src/flang-checker" "$root/libexec/flang/checker"
  chmod 0755 "$root/libexec/flang/checker"
fi
if [ -d "$work/src/tutor" ]; then
  mkdir -p "$root/share/flang-tutor"
  cp -R "$work/src/tutor/." "$root/share/flang-tutor/"
fi
# Runtime sources of every emit target: `flang emit` copies them into its output
# and looks for them in ../share/flang next to the binary.
cp -R "$work/src/runtime/." "$root/share/flang/"
cp "$work/src/flang.1" "$root/share/man/man1/flang.1"
cp "$work/src/LICENSE" "$root/LICENSE"
if [ "$os" = macos ]; then
  mkdir -p "$root/lib" "$root/include"
  cp "$work/src"/lib*.a "$root/lib/"
  cp "$work/src"/*.h "$root/include/"
fi
find "$root" -type d -exec chmod 0755 {} +
find "$root" -type f ! -path "$root/bin/*" ! -path "$root/libexec/flang/checker" -exec chmod 0644 {} +

# GNU tar when there is one (gtar on macOS): sorted names, zero owners and
# times, so two packings of the same files give the same bytes.
TAR=tar
if command -v gtar >/dev/null 2>&1; then TAR=gtar; fi
if "$TAR" --version 2>/dev/null | head -1 | grep -q 'GNU tar'; then
  "$TAR" --sort=name --format=ustar --owner=0 --group=0 --numeric-owner \
    --mtime=@0 -C "$work" -cf - "$name" | gzip -9n > "$out/$name.tar.gz"
else
  "$TAR" -C "$work" -cf - "$name" | gzip -9n > "$out/$name.tar.gz"
fi
ls -l "$out/$name.tar.gz"
