#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Печать браузерных приложений: .flang → .js рядом со страницей.
#
# ── Что и почему ─────────────────────────────────────────────────────────────
# Страница не может исполнить flang: браузер знает JavaScript и WebAssembly.
# Поэтому программа приложения ПЕЧАТАЕТСЯ в JavaScript тем же двоичным
# компилятором, что проверяет её типы и завершаемость. Печатается ПОСЛЕ
# проверки: `flang emit` судит программу той же дорогой, что `flang check`, и
# при замечании не пишет ни файла.
#
# Ключ `--no-cli` снимает прогонщик (`flang_cli.js`): он для запуска из Node, и
# во вкладку ему ехать незачем.
#
# ── Почему не npm и не node ──────────────────────────────────────────────────
# Здесь нет ни того, ни другого, и это не экономия: точка входа проекта — не
# менеджер пакетов. Нужен ровно один двоичный `bootstrap/flang`, который
# собирается одним `make -C bootstrap` из напечатанного C.
#
# ── Имена выходных файлов не выбираются здесь ────────────────────────────────
# Имя файла даёт печать — по имени МОДУЛЯ, переведённому в латиницу
# («Градины» → gradiny.js). Поэтому скрипт не переименовывает ничего: страница
# называет в признаке `данные-модуль` то же имя, что напечатает компилятор.
#
# Имена переменных латиницей: dash не принимает кириллицу в именах.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

FLANG=${FLANG:-./bootstrap/flang}
if [ ! -x "$FLANG" ]; then
  echo "двоичного нет — собираю: make -C bootstrap" >&2
  make -C bootstrap >&2
fi

PROGRAMS="web/app/hailstone.flang web/shortener/klient.flang"

status=0
for source in $PROGRAMS; do
  out=$(dirname "$source")
  printf '%s → %s/  ' "$source" "$out"
  if "$FLANG" emit "$source" --target js --no-cli --runtime flang/src/emit/js --out "$out" >/dev/null 2>&1; then
    echo "напечатано"
  else
    echo "ОТКАЗ"
    "$FLANG" emit "$source" --target js --no-cli --runtime flang/src/emit/js --out "$out" >&2 || true
    status=1
  fi
done

if [ "$status" -eq 0 ]; then
  echo
  echo "размеры напечатанного:"
  ls -l web/app/*.js web/shortener/*.js 2>/dev/null | awk '{ printf "  %9d  %s\n", $5, $9 }'
  echo
  echo "стенд:  $FLANG io web/stend.flang --max-orders 100000"
  echo "адрес:  http://127.0.0.1:8908/"
fi
exit "$status"
