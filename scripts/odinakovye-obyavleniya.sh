#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Сколько столкнувшихся объявлений можно НЕ переименовывать, а ввезти.
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# Столкновение имён разводят двумя способами, и они не равны по цене:
#
#   • ПЕРЕИМЕНОВАТЬ в том модуле, который пришёл последним. Работает всегда,
#     но копия остаётся копией: замыкание двоичного растёт на весь модуль.
#   • ВВЕЗТИ (`использует … только «Имя»`) и своё объявление убрать. Так уже
#     сделаны три генератора из восьми: `emit-go.flang`, `emit-rust.flang` и
#     `emit-js.flang` ввозят помощников из `emit-c.flang`. Работает только
#     если объявления ОДИНАКОВЫ — иначе это молчаливая подмена поведения.
#
# Этот замер отвечает, для скольких имён верно второе. Одинаковость судится по
# разобранному дереву, а разбирает его flang: `flang ast -` со стандартного
# ввода даёт дерево ОДНОГО файла без связывания (`flang/bin/flang.mjs`,
# `parseFlang`: для «-» связывание не запускается вовсе). Из дерева выбрасываются
# места (`span`) — номер строки у копии другой, а объявление то же.
#
# ── Прогон ──────────────────────────────────────────────────────────────────
#   scripts/odinakovye-obyavleniya.sh                          все семь
#   FLANG=/путь/к/двоичному scripts/odinakovye-obyavleniya.sh  судит двоичный

set -u
export LC_ALL=C.UTF-8
export LC_COLLATE=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# Модули, уже стоящие в замыкании двоичного: с ними и сличаем. Список — из
# самого `compiler.flang`, чтобы он не разошёлся с ним при первой же правке.
#
# Сужение видимости (`только «А», «Б»`) здесь НЕ применяется: берутся все свои
# объявления каждого модуля. Оттого «столкнулось» расходится со связыванием на
# единицы имён — оно судит по суженному. Для вопроса «одинаково ли объявление»
# это безразлично, а мера остаётся в одну сторону завышенной, не заниженной.
ENTRY=flang/self/bootstrap/compiler.flang
: >"$TMP/base.decl"
while IFS= read -r rel; do
  path=$(cd flang/self/bootstrap && realpath -m --relative-to="$ROOT" "$rel")
  decls "$path" >>"$TMP/base.decl"
done < <(grep '^  использует ' "$ENTRY" | grep -o 'из "[^"]*"' | sed 's/^из "//; s/"$//')

# База пуста — значит смотреть было НЕЧЕМ, а не «столкновений нет». Раньше
# здесь звался `flang ast -`, которого у двоичного нет: он уходил кодом 2,
# отказ глотался в /dev/null, и отчёт печатал нули по всем целям. Ноль от
# «чисто» неотличим, поэтому пустая база теперь красная.
if [ ! -s "$TMP/base.decl" ]; then
  printf 'НЕ СУДИЛ: база объявлений пуста — ни один модуль замыкания не разобран.\n' >&2
  printf 'Это не «столкновений нет», это «смотреть нечем».\n' >&2
  exit 3
fi
sort -t"$(printf '\t')" -k1,1 -u "$TMP/base.decl" -o "$TMP/base.decl"

printf 'объявлений в базе (свои у пятнадцати модулей): %s\n\n' "$(wc -l <"$TMP/base.decl")"
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
