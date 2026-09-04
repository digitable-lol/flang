#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# scripts/test-remote.sh — прогон набора на машине, где есть все восемь тулчейнов.
#
# ЗАЧЕМ. Тест бэкенда доказывает кодогенерацию тем, что настоящий компилятор
# принял порождённый код. Восьми тулчейнов на ноутбуке обычно нет, и тесты
# отсутствующих молча пропускаются — набор зелёный, а половина бэкендов не
# проверена ни разу. Так ушёл выпуск 0.4.6 с дефектом кодогенерации Go.
#
# Лечится не уговорами, а местом прогона: на хосте, где стоят все восемь,
# пропусков нет по построению, и там же прогон банально быстрее — ядер больше.
#
#   scripts/test-remote.sh                  весь набор (ярлык «тесты»)
#   scripts/test-remote.sh спеки:проверка   любой ярлык из ярлыки.flang
#   scripts/test-remote.sh --shell "cmd"    произвольная команда в копии
#   scripts/test-remote.sh --sync           только синхронизировать
#   scripts/test-remote.sh --info           что за хост и что на нём стоит
#
# Хост задаёт FLANG_REMOTE — алиас ssh, по которому пускают без пароля.
# Умолчания у него нет намеренно: чужая машина не должна называться в дереве.
#
# Каталог на хосте: FLANG_REMOTE_DIR (по умолчанию ~/.cache/flang-remote/<имя>).
# Отдельный каталог под кэшем, а не рабочий клон: содержимое копии одноразовое,
# её затирает каждый прогон, и настоящему клону это стоило бы веток.

set -euo pipefail

REMOTE="${FLANG_REMOTE:-}"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd)
NAME=$(basename "$ROOT")
REMOTE_DIR="${FLANG_REMOTE_DIR:-.cache/flang-remote/$NAME}"

# FTS_REQUIRE_TOOLCHAINS=all — главное отличие удалённого прогона от местного:
# отсутствие тулчейна там не пропуск, а провал. Ради этого всё и затевалось.
REQUIRE="${FTS_REQUIRE_TOOLCHAINS:-all}"

BOLD=$'\033[1m'; RED=$'\033[31m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'
say()  { printf '%s==> %s%s\n' "$BOLD" "$*" "$RST"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '%sОШИБКА%s %s\n' "$RED" "$RST" "$*" >&2; exit 1; }

command -v rsync >/dev/null 2>&1 || die "нужен rsync"
[ -n "$REMOTE" ] \
  || die "не задан хост. FLANG_REMOTE=<ваш ssh-алиас> scripts/test-remote.sh — нужна машина, где стоят все восемь тулчейнов и куда пускают по ключу"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$REMOTE" true 2>/dev/null \
  || die "хост «$REMOTE» недоступен по ssh без пароля"

# PATH для неинтерактивного ssh: Go, Rust и Elixir нередко лежат в /usr/local,
# а ~/.local/bin в PATH добавляет только login shell, до которого мы не доходим.
REMOTE_ENV='export PATH="$HOME/.local/bin:/usr/local/go/bin:/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin"; export LC_ALL=C.UTF-8 LANG=C.UTF-8;'

remote_run() { ssh "$REMOTE" "$REMOTE_ENV cd '$REMOTE_DIR' && $1"; }

show_info() {
  say "Хост $REMOTE"
  ssh "$REMOTE" "$REMOTE_ENV"'
    printf "    %s, %s ядер, %s ГБ RAM, свободно %s\n" \
      "$(. /etc/os-release; echo "$PRETTY_NAME")" "$(nproc)" \
      "$(free -g | awk "/^Mem:/{print \$2}")" "$(df -h / | awk "NR==2{print \$4}")"
    printf "    %-12s %s\n" \
      c        "$(cc --version 2>/dev/null | head -1 || echo НЕТ)" \
      go       "$(go version 2>/dev/null || echo НЕТ)" \
      rust     "$(rustc --version 2>/dev/null || echo НЕТ)" \
      java     "$(javac --version 2>/dev/null || echo НЕТ)" \
      csharp   "$(dotnet --version 2>/dev/null || echo НЕТ)" \
      python   "$(python3 --version 2>/dev/null || echo НЕТ)" \
      elixir   "$(elixir --version 2>/dev/null | tail -1 || echo НЕТ)" \
      node     "$(node --version 2>/dev/null || echo НЕТ)"'
}

sync_tree() {
  say "Синхронизация $ROOT → $REMOTE:$REMOTE_DIR"
  ssh "$REMOTE" "mkdir -p '$REMOTE_DIR'"
  # node_modules и dist не едут: это продукты сборки, а не исходники
  # tsc. Копировать чужую сборку — это опять мерить не то, что думаешь.
  rsync -a --delete --info=stats1 \
    --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' \
    --exclude '*.log' --exclude '.cache/' \
    "$ROOT/" "$REMOTE:$REMOTE_DIR/" | sed 's/^/    /'
}

# ЗДЕСЬ БЫЛ `npm ci`. Снят 3 сентября 2026 вместе с npm: зависимостей у дерева
# ноль, `package-lock.json` удалён, и без замка `npm ci` отвечает кодом 1
# («can only install with an existing package-lock.json») — то есть шаг стал бы
# ронять прогон, ничего не поставив. Двоичный, который нужен ярлыку, собирает
# сам `./ярлык` на той стороне.

case "${1:-}" in
  --info) show_info; exit 0 ;;
  --sync) show_info; sync_tree; exit 0 ;;
  --shell)
    shift
    [ $# -gt 0 ] || die "--shell без команды"
    sync_tree
    remote_run "$*"
    exit $?
    ;;
  -h|--help)
    sed -n '4,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

TARGET="${1:-тесты}"

show_info
sync_tree

say "Прогон: ./ярлык $TARGET (FTS_REQUIRE_TOOLCHAINS=$REQUIRE)"
info "${DIM}отсутствие любого тулчейна на хосте — провал, а не пропуск${RST}"
START=$(date +%s)
set +e
remote_run "FTS_REQUIRE_TOOLCHAINS='$REQUIRE' ./ярлык $TARGET"
STATUS=$?
set -e
ELAPSED=$(( $(date +%s) - START ))

printf '\n%s==> Итог%s\n' "$BOLD" "$RST"
info "хост:  $REMOTE:$REMOTE_DIR"
info "время: ${ELAPSED} с"
if [ "$STATUS" -eq 0 ]; then
  printf '    %sНАБОР ПРОЙДЕН%s — все восемь тулчейнов присутствовали, пропусков по тулчейнам не было\n' "$GRN" "$RST"
else
  printf '    %sНАБОР НЕ ПРОЙДЕН%s (код %d)\n' "$RED" "$RST" "$STATUS"
fi
exit "$STATUS"
