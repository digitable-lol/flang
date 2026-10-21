#!/bin/sh
# Installs a prebuilt flang (package flang-package) without sudo.
#
#   curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
#
# Environment:
#   FLANG_VERSION  version to install, e.g. 0.7.29 (default: the latest release)
#   PREFIX         where to install (default: $HOME/.local); the binary goes
#                  to $PREFIX/bin/flang
#
# What it does: picks the build for this OS and CPU, downloads it and the
# release's SHA256SUMS from GitHub, refuses to go on if the checksum differs,
# and copies bin/, libexec/, share/ (and lib/, include/ on macOS) into PREFIX.
set -eu

repo="digitable-lol/flang"
prefix="${PREFIX:-$HOME/.local}"

say() { printf 'flang: %s\n' "$*"; }
die() { printf 'flang: error: %s\n' "$*" >&2; exit 1; }

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=macos ;;
  MINGW* | MSYS* | CYGWIN* | Windows_NT)
    die "there is no native Windows build yet. Install flang inside WSL: open a WSL shell and run this command there." ;;
  *) die "no prebuilt build for $(uname -s). Build from source: https://github.com/digitable-lol/flang#from-source" ;;
esac

machine="$(uname -m)"
case "$machine" in
  x86_64 | amd64) arch=x86_64 ;;
  aarch64 | arm64) if [ "$os" = macos ]; then arch=arm64; else arch=aarch64; fi ;;
  *) die "no prebuilt build for the $machine CPU. Build from source: https://github.com/digitable-lol/flang#from-source" ;;
esac
# A shell running under Rosetta reports x86_64 on an Apple Silicon Mac;
# the native arm64 build is the right one there.
if [ "$os" = macos ] && [ "$arch" = x86_64 ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = 1 ]; then
  arch=arm64
fi

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL -o "$2" "$1"; }
  fetch_text() { curl -fsSL "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q -O "$2" "$1"; }
  fetch_text() { wget -q -O - "$1"; }
else
  die "neither curl nor wget is installed; install one of them and run this again."
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  die "neither sha256sum nor shasum is installed, so the download cannot be verified."
fi

version="${FLANG_VERSION:-}"
version="${version#v}"
if [ -z "$version" ]; then
  version="$(fetch_text "https://api.github.com/repos/$repo/releases/latest" \
    | sed -n 's/^ *"tag_name": *"v\([^"]*\)".*/\1/p' | head -1)" || true
  [ -n "$version" ] || die "could not find the latest release on GitHub. Set FLANG_VERSION=<version> and try again."
fi

name="flang-package-$version-$os-$arch"
# FLANG_DOWNLOAD_URL replaces the release URL (a mirror, or a file:// directory
# for a test); it must hold $name.tar.gz and SHA256SUMS.
base="${FLANG_DOWNLOAD_URL:-https://github.com/$repo/releases/download/v$version}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

say "installing flang $version for $os-$arch into $prefix"
if ! fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS"; then
  die "release $version has no SHA256SUMS at $base. Prebuilt builds start with 0.7.29; for older versions build from source: https://github.com/digitable-lol/flang#from-source"
fi
if ! fetch "$base/$name.tar.gz" "$tmp/$name.tar.gz"; then
  die "release $version has no build $name.tar.gz. See https://github.com/$repo/releases/tag/v$version"
fi

expected="$(awk -v f="$name.tar.gz" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS" | head -1)"
[ -n "$expected" ] || die "SHA256SUMS of $version does not list $name.tar.gz; not installing an unverified file."
actual="$(sha256 "$tmp/$name.tar.gz")"
if [ "$actual" != "$expected" ]; then
  die "checksum mismatch for $name.tar.gz: expected $expected, got $actual. The download is damaged or was tampered with; nothing was installed."
fi
say "checksum ok: $actual"

tar -xzf "$tmp/$name.tar.gz" -C "$tmp"
src="$tmp/$name"
[ -x "$src/bin/flang" ] || die "the archive has no bin/flang; nothing was installed."

mkdir -p "$prefix/bin" 2>/dev/null || die "cannot create $prefix/bin. Choose a directory you own: PREFIX=\$HOME/.local"
[ -w "$prefix/bin" ] || die "$prefix/bin is not writable. Choose a directory you own: PREFIX=\$HOME/.local (no sudo needed)"

for dir in bin libexec share lib include; do
  if [ -d "$src/$dir" ]; then
    mkdir -p "$prefix/$dir"
    cp -R "$src/$dir/." "$prefix/$dir/"
  fi
done
mkdir -p "$prefix/share/doc/flang-package"
cp "$src/LICENSE" "$prefix/share/doc/flang-package/LICENSE"

installed="$("$prefix/bin/flang" --version | head -1)" || die "$prefix/bin/flang does not run on this machine."
say "installed $installed: $prefix/bin/flang"

found="$(command -v flang 2>/dev/null || true)"
case ":$PATH:" in
  *":$prefix/bin:"*) on_path=yes ;;
  *) on_path=no ;;
esac
if [ "$on_path" = no ]; then
  say "$prefix/bin is not on your PATH. Add this line to your shell profile (~/.profile, ~/.bashrc or ~/.zshrc):"
  say "  export PATH=\"$prefix/bin:\$PATH\""
elif [ -n "$found" ] && [ "$found" != "$prefix/bin/flang" ]; then
  say "warning: \`flang\` on your PATH is $found, not this install."
  say "It is probably LLVM Flang (the Fortran compiler), which has the same command name."
  say "Put $prefix/bin first on PATH, or call $prefix/bin/flang directly."
fi
extra="$(cd "$src" && find lib include -type f 2>/dev/null | sed "s|^|$prefix/|" | tr '\n' ' ')"
say "to uninstall: rm -rf $prefix/bin/flang $prefix/bin/flangtutor $prefix/libexec/flang $prefix/share/flang $prefix/share/flang-tutor $prefix/share/flang-fspec $prefix/share/man/man1/flang.1 $prefix/share/doc/flang-package $extra"
