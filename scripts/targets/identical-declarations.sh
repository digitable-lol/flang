#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Сколько столкнувшихся объявлений можно не переименовывать, а ввезти: объявления
# семи генераторов сличаются с замыканием двоичного по разобранному дереву без мест.
#
# Как звать:
#   scripts/targets/identical-declarations.sh                          все семь
#   FLANG=/путь/к/двоичному scripts/targets/identical-declarations.sh  судит двоичный
#
# Коды: 0 — замер снят; 3 — база объявлений пуста, смотреть нечем («не проверено»).
# см. docs/zettel/a-closure-list-taken-by-grep-guards-the-spelling-of-the-import-not-the-import.md
set -u
export LC_ALL=C.UTF-8
export LC_COLLATE=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 3

FL=${FLANG:-}
if [ -z "$FL" ]; then FL="$ROOT/bootstrap/flang"; fi

TMP="$(mktemp -d -p "${TMPDIR:-/srv/tmp}")"
trap 'rm -rf "$TMP"' EXIT

# «род|имя<TAB>отпечаток объявления» для одного файла.
decls() {
  local src="$1"
  local ast
  if ! ast=$("$FL" ast "$src" 2>&1); then
    printf 'НЕ ВЗЯТ %s: %s\n' "$src" "$(printf '%s' "$ast" | head -1)" >&2
    return 1
  fi
  printf '%s' "$ast" | jq -r '
    def bez: walk(if type == "object" then del(.span) else . end);
    (.functions[]? | "функция|" + .name + "\t" + ((. | bez) | @json)),
    (.types[]?     | "тип|"     + .name + "\t" + ((. | bez) | @json))
  ' | sort -t"$(printf '\t')" -k1,1
}

ENTRY=flang/self/bootstrap/compiler.flang
: >"$TMP/base.decl"
while IFS= read -r path; do
  [ "$path" = "$ENTRY" ] && continue
  decls "$path" >>"$TMP/base.decl"
done < <(node --input-type=module -e '
  import { замыкание } from "./flang/scripts/link-collision-guard.mjs"
  const { порядок, пропали } = замыкание(process.argv[1])
  if (пропали.length > 0) {
    process.stderr.write("НЕ РАЗРЕШЕНЫ ввозы: " + пропали.join(", ") + "\n")
    process.exit(3)
  }
  for (const файл of порядок) console.log(файл.путь)
' "$ENTRY")

if [ ! -s "$TMP/base.decl" ]; then
  printf 'НЕ СУДИЛ: база объявлений пуста — ни один модуль замыкания не разобран.\n' >&2
  printf 'Это не «столкновений нет», это «смотреть нечем».\n' >&2
  exit 3
fi
sort -t"$(printf '\t')" -k1,1 -u "$TMP/base.decl" -o "$TMP/base.decl"

printf 'объявлений в базе (свои у модулей замыкания): %s\n\n' "$(wc -l <"$TMP/base.decl")"
printf '%-12s %10s %10s %10s\n' цель столкнулось одинаковых разошлось
for module in emit-go emit-rust emit-python emit-java emit-csharp emit-elixir emit-js; do
  decls "flang/self/$module.flang" >"$TMP/t.decl"
  join -t"$(printf '\t')" -j1 "$TMP/t.decl" "$TMP/base.decl" >"$TMP/j"
  same=$(awk -F"$(printf '\t')" '$2 == $3' "$TMP/j" | wc -l)
  diff=$(awk -F"$(printf '\t')" '$2 != $3' "$TMP/j" | wc -l)
  printf '%-12s %10s %10s %10s\n' "$module" "$((same + diff))" "$same" "$diff"
  awk -F"$(printf '\t')" -v m="$module" '$2 != $3 {print "    разошлось: " $1}' "$TMP/j" >>"$TMP/raznica"
done
printf '\n'
printf 'столкнулось — имён, объявленных и здесь, и в замыкании двоичного\n'
printf 'одинаковых  — дерево объявления совпало байт в байт: можно ввезти\n'
printf 'разошлось   — дерево разное: ввозить нельзя, только переименовывать\n'
printf '\n'
if [ -s "$TMP/raznica" ]; then
  printf 'РАЗОШЕДШИЕСЯ ПОИМЁННО\n'
  sort -u "$TMP/raznica"
fi
