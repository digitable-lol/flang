#!/bin/sh
# Отвечает ли языковой сервер, ПОКА ВВОД ОТКРЫТ.
#
# Редактор держит стандартный ввод сервера открытым весь сеанс и ждёт ответов
# по ходу дела. Сервер, который копит ответы до закрытия ввода, для редактора
# неотличим от висящего: ни диагностик, ни подсказок, и ни одного сообщения об
# ошибке.
#
# Сверка потоками, а не глазами: одно и то же сообщение `initialize` подаётся
# двум серверам, и меряется, сколько байт пришло ЗА ДВЕ СЕКУНДЫ при открытом
# вводе и сколько — после его закрытия.
#
# ── Почему это не написано на flang ─────────────────────────────────────────
# Поручение «Запустить процесс» отдаёт программе имя и аргументы и приносит
# обратно код, вывод и ошибки. ПИСАТЬ В СТАНДАРТНЫЙ ВВОД запущенного процесса
# оно не умеет — такого поля в словаре поручений нет вовсе, — а вся проверка
# ровно об этом. Поэтому здесь оболочка; решение по числам принимает план на
# flang, который эту оболочку зовёт.
set -eu

kuda=$(mktemp -d)
trap 'rm -rf "$kuda"' EXIT

telo='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":1,"rootUri":null,"capabilities":{}}}'
dlina=$(printf '%s' "$telo" | wc -c)

# Один замер: имя сервера и команда запуска.
zamer() {
  imya=$1
  shift
  vyvod="$kuda/$imya.bin"
  : > "$vyvod"
  {
    printf 'Content-Length: %d\r\n\r\n%s' "$dlina" "$telo"
    # Ввод держим открытым: именно так его держит редактор.
    sleep 4
  } | "$@" > "$vyvod" 2>/dev/null &
  rebyonok=$!
  sleep 2
  pri_otkrytom=$(wc -c < "$vyvod")
  wait "$rebyonok" 2>/dev/null || true
  posle_zakrytiya=$(wc -c < "$vyvod")
  printf '%s: при открытом вводе %s байт, после закрытия %s байт\n' \
    "$imya" "$pri_otkrytom" "$posle_zakrytiya"
}

koren=$(cd "$(dirname "$0")/../../.." && pwd)

if [ -x "$koren/bootstrap/flang" ]; then
  zamer 'двоичный flang lsp' "$koren/bootstrap/flang" lsp --stdio
else
  printf 'двоичный flang lsp: не собран (bootstrap/flang), замера нет\n'
fi

if command -v node > /dev/null 2>&1; then
  zamer 'flang-lsp на Node' node "$koren/flang/bin/flang-lsp.mjs" --stdio
else
  printf 'flang-lsp на Node: node не найден, замера нет\n'
fi
