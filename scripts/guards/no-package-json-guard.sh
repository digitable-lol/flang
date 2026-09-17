#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# package.json В ДЕРЕВЕ НЕТ — и не появится молча.
#
#   sh scripts/guards/no-package-json-guard.sh --check    код 1, если файл отслеживается git или лежит в корне
#   sh scripts/guards/no-package-json-guard.sh --подлог   подложить файл в копии дерева: обязан покраснеть (код 1)
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# 17 сентября 2026 владелец сказал: «package.json выбросить, заменив
# читателей» (задача 3570). npm ушёл из дерева 3 сентября (задача 8649), и всё,
# что от файла оставалось, — место, откуда читали версию, лицензию и два
# адреса. Читатели переведены на `.flangrc` (ключи `версия`, `имя`,
# `лицензия`, `склад`, `беды`), а источник значений один —
# scripts/release/emit-package.flang.
#
# Файл, который удалили, возвращается двумя путями, и оба тихие: кто-то
# перепечатает его старым ярлыком из чужой копии, или `npm init` заведёт новый
# «на минутку». Ни git, ни CI сами по себе на это не краснеют. Этот сторож —
# краснеет, и стоит он в хуке перед пушем (без двоичного) и в CI.
#
# ── Что смотрится ───────────────────────────────────────────────────────────
# Два вопроса, и оба нужны:
#   · `git ls-files package.json` — отслеживается ли файл (пустой ответ — нет);
#   · лежит ли `package.json` в корне дерева физически — неотслеживаемый файл
#     git не покажет, а Node его прочтёт (`"type": "module"` меняет загрузку
#     каждого `.js` в дереве).
# Только КОРЕНЬ: `docs/editors/vscode/package.json` — манифест расширения
# VS Code, а `docs/examples/frameworks/*/package.json` — чужие проекты-примеры;
# они не читатели корневого файла и остаются.
#
# ИМЕНА ПЕРЕМЕННЫХ ЛАТИНИЦЕЙ, как в `ярлык`: ни dash, ни bash не принимают
# кириллицу в именах переменных.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$KOREN" || exit 2
REZHIM=${1:---check}

proverit() { # печатает беды; код 1 при любой
  bedy=0
  if [ -n "$(git ls-files package.json 2>/dev/null)" ]; then
    echo "package.json ОТСЛЕЖИВАЕТСЯ git — файл выброшен 17 сентября 2026 (задача 3570), читатели читают .flangrc; уберите: git rm package.json" >&2
    bedy=$((bedy+1))
  fi
  if [ -e package.json ]; then
    echo "package.json ЛЕЖИТ В КОРНЕ дерева ($KOREN) — даже неотслеживаемый он меняет загрузку .js (\"type\") и возвращает второе место версии; уберите файл" >&2
    bedy=$((bedy+1))
  fi
  [ "$bedy" -eq 0 ]
}

case "$REZHIM" in
  --check)
    if proverit; then
      echo "package.json в дереве нет: git его не отслеживает, в корне не лежит — версия, имя, лицензия и адреса читаются из .flangrc"
      exit 0
    fi
    exit 1
    ;;
  --подлог)
    # Копия дерева, а не само дерево: подлог не оставляет следа в рабочей копии.
    # Раскладка повторяет дерево (scripts/guards/), чтобы сторож нашёл корень
    # тем же путём, что и в жизни, — иначе проба ловила бы не подлог, а
    # собственную раскладку (грабли version-derivations-guard.sh 13 сентября).
    KOP=${FLANG_TMP:-/srv/tmp}/no-package-json-podlog.$$
    rm -rf "$KOP"; mkdir -p "$KOP/scripts/guards" || exit 2
    trap 'rm -rf "$KOP"' EXIT INT TERM
    cp "$0" "$KOP/scripts/guards/" || exit 2
    git -C "$KOP" init -q || exit 2
    printf '{\n  "name": "podlog",\n  "version": "0.0.0"\n}\n' > "$KOP/package.json"
    git -C "$KOP" add package.json || exit 2
    sh "$KOP/scripts/guards/no-package-json-guard.sh" --check > "$KOP/out" 2>&1
    kod=$?
    if [ "$kod" -eq 0 ]; then
      echo "ПОДЛОГ НЕ ПОЙМАН — сторож сломан: подложенный package.json (отслеживаемый и лежащий в корне копии) прошёл" >&2
      exit 0
    fi
    if [ "$kod" -ne 1 ]; then
      echo "ПРОБА ХОЛОСТА: сторож ответил кодом $kod, а не 1 — это не «поймал подлог», это «не смог посмотреть»" >&2
      sed 's/^/  /' "$KOP/out" >&2
      exit 0
    fi
    if ! grep -q 'ОТСЛЕЖИВАЕТСЯ' "$KOP/out" || ! grep -q 'ЛЕЖИТ В КОРНЕ' "$KOP/out"; then
      echo "ПРОБА ХОЛОСТА: сторож покраснел не тем — ждали обе беды (отслеживается, лежит в корне), а сказано:" >&2
      sed 's/^/  /' "$KOP/out" >&2
      exit 0
    fi
    echo "подлог пойман: подложенный package.json назван обеими бедами, код $kod"
    sed 's/^/  /' "$KOP/out"
    exit 1
    ;;
  *)
    echo "сторож package.json: непонятный ключ «$REZHIM» (--check, --подлог)" >&2
    exit 2
    ;;
esac
# ярлык «без-пакета:проверка» sh --check — package.json в дереве нет: git его не отслеживает и в корне он не лежит; версия, имя, лицензия и адреса читаются из .flangrc, куда их разносит ./ярлык версия из scripts/release/emit-package.flang
