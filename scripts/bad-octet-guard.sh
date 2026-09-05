#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# НА НЕГОДНОМ ОКТЕТЕ ПРОГОНЩИК ОБЯЗАН ОТКАЗАТЬ, А НЕ ЗАМОЛЧАТЬ.
#
#   scripts/bad-octet-guard.sh              судить все восемь целей
#   scripts/bad-octet-guard.sh --цель rust  судить одну
#   scripts/bad-octet-guard.sh --порча      проверить самого сторожа
#
# Коды возврата:
#   0  все судимые цели отказали одинаково, здоровый вход при этом прошёл;
#   1  нашлась цель, которая на негодном октете молчит, падает или расходится
#      с остальными текстом отказа;
#   2  тулчейна нет — судить было нечем. ЭТО НЕ ПРОЙДЕННАЯ ПРОВЕРКА (AGENTS.md);
#   3  беда самого прогона: не напечаталось, не собралось.
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# Замер 22 августа 2026: одна и та же напечатанная программа, один и тот же
# негодный октет во входной строке — и ПЯТЬ РАЗНЫХ поведений у восьми целей, из
# которых отказом языка не было ни одно:
#
#   цель     было                                                     код
#   ───────  ───────────────────────────────────────────────────────  ───
#   c        возил октеты как есть, отвечал FLANG_UNKNOWN_NAME на них   0
#   go       подменял октет знаком замены U+FFFD, ответ тот же          0
#   java     то же                                                      0
#   csharp   то же                                                      0
#   js       то же                                                      0
#   elixir   звал не-текст «неразборчивым запросом»                     0
#   rust     МОЛЧА обрывал цикл: ни ответа, ни отказа                   0
#   python   падал трассировкой UnicodeDecodeError…                     1
#            …но при LC_ALL=C и LC_ALL=C.UTF-8 протаскивал октет
#            суррогатом и отвечал как ни в чём не бывало                0
#
# Худшее здесь — Rust: код 0 и тишина читаются как «всё хорошо», а работа не
# сделана. Пять целей не лучше: они ОТВЕЧАЛИ, но отвечали о содержимом, которое
# сами же и подменили, — то есть врали тихо. У Python поведение вдобавок
# зависело от локали хозяина: две разные беды на одном и том же входе, и какая
# из них случится, решала переменная окружения.
#
# Замер снят прогоном на этой машине 22 августа 2026 (cc 15.2, go, rustc 1.97.1,
# openjdk 26, dotnet 10.0.110, node 26.7, python 3.14.4, elixir на OTP-29).
#
# Образец поведения у языка уже был: `FLANG_IO_NOT_TEXT` у текстовой пары
# ввода-вывода называет номер октета, его значение и чем возить октеты
# (docs/adr/0006-octets-for-files.md). Прогонщики сведены к нему же.
#
# ── Что проверяется по каждой цели ──────────────────────────────────────────
# ДВЕ вещи, и вторая без первой ничего не стоит:
#
#   1. ЗДОРОВЫЙ ВХОД проходит: три запроса (среди них пустая строка, строка с
#      CRLF и последняя строка без перевода строки) дают ровно три ответа и код
#      возврата 0. Без этой половины сторож был бы зелен и у прогонщика,
#      который отказывает ВСЕГДА.
#   2. НЕГОДНЫЙ ОКТЕТ отказывает: код возврата не ноль, а поток ошибок —
#      ПОБАЙТОВО тот же текст, что у остальных целей. Не «похожий», а тот же:
#      восемь похожих текстов — это и есть восемь разных поведений.
#
# ── Долг, названный вслух ───────────────────────────────────────────────────
# Цель `js` из первой стопки ВЫЧТЕНА, и вычитание красит с двух сторон.
# Прогонщик JavaScript — рукописный `flang/src/emit/js/flang_cli.js`, а править
# рукописный JavaScript в этом дереве запрещено (`zadanie-poslednie-ostatki-
# javascript`): его исходник не печатается из flang, а уезжает в вывод
# дословно. Поэтому js судится ОБРАТНЫМ ожиданием: он обязан вести себя ПЛОХО,
# и в тот день, когда он начнёт отказывать как все, сторож покраснеет и
# потребует снять вычитание. Долг, тихо исчезнувший из списка, остаётся долгом.
#
# ── Ключи среды ─────────────────────────────────────────────────────────────
#   FLANG=<путь>    каким двоичным печатать (по умолчанию bootstrap/flang)
#   RANTAJM=<путь>  где лежат исходники прогонщиков, каталог с подкаталогами по
#                   целям (по умолчанию flang/src/emit). Ключ нужен порче и
#                   сверке со стволом: тем же сторожем судится ЧУЖОЕ дерево
#                   прогонщиков, а своё при этом не трогается.
#   RABOTA=<путь>   рабочий каталог (по умолчанию mktemp -p /srv/tmp)
#
# ── ЕСЛИ ЗОВЁТЕ ЧЕРЕЗ ВОРОТА, СТАВЬТЕ PAMYAT=150G ───────────────────────────
# Ворота (`flang-rabota/vorota/flang-vorota`) ставят RLIMIT_AS, по умолчанию
# 40 ГиБ. Для flang это безопасно, а для сборщиков — нет: JVM, .NET и cargo
# РЕЗЕРВИРУЮТ адресное пространство впрок. Замер здесь же: под умолчанием ворот
# `dotnet build` упал «Out of memory» из Roslyn на ровном месте, а сама сборка
# занимает мегабайты. Зовите так:
#
#   PAMYAT=150G flang-vorota -- scripts/bad-octet-guard.sh
#
# Имена переменных здесь латиницей: bash не принимает кириллицу в
# идентификаторах, и написанный так скрипт молча делает не то, что читается.

set -u
export LC_ALL=C.UTF-8

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 3

FL=${FLANG:-$ROOT/bootstrap/flang}
RT=${RANTAJM:-$ROOT/flang/src/emit}
ONE=
PORCHA=0

while [ $# -gt 0 ]; do
  case "$1" in
    --цель|--cel) ONE=${2:-}; shift 2 ;;
    --порча|--porcha) PORCHA=1; shift ;;
    *) echo "неизвестный довод: $1" >&2; exit 3 ;;
  esac
done

[ -x "$FL" ] || { echo "нет двоичного $FL — соберите: make -C bootstrap" >&2; exit 3; }

WORK=${RABOTA:-$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" storozh-oktet.XXXXXX)}
mkdir -p "$WORK"

# Программа судится любая: сторож смотрит на прогонщик, а не на программу.
# Взят пример с мерой — он собирается всеми девятью целями и уже стоит в
# docs/ifl/measure-across-targets.sh, то есть проверен переносимостью.
SRC=examples/measure/euclid.flang
CEL="{\"fn\":\"НОД\",\"args\":[{\"n\":\"1071\"},{\"n\":\"462\"}]}"

# Здоровый вход: пустая строка, CRLF и последняя строка без перевода строки —
# всё то, обо что построчное чтение по октетам спотыкается, если написано
# наспех.
{
  printf '%s\n' "$CEL"
  printf '\n'
  printf '{"fn":"НОК","args":[{"n":"6"},{"n":"8"}]}\r\n'
  printf '{"fn":"НОД","args":[{"n":"97"},{"n":"89"}]}'
} > "$WORK/zdorovyy.jsonl"

# Негодный вход: тот же запрос, но во ВТОРОЙ строке восьмым октетом стоит 0xFF.
# Строк три нарочно: ответ на первую обязан остаться, а третья — та работа,
# которую молчащий прогонщик не делает и о которой не говорит.
{
  printf '%s\n' "$CEL"
  printf '{"fn":"\377\254=","args":[]}\n'
  printf '%s\n' "$CEL"
} > "$WORK/negodnyy.jsonl"

# Эталон отказа. Он ЗДЕСЬ, а не берётся у первой отозвавшейся цели: сторож,
# сверяющий цели друг с другом, зеленеет и тогда, когда все девять сломаны
# одинаково.
ETALON='FLANG_IO_NOT_TEXT: строка 2 не текст: октет 8 из 22 (0xFF) не складывается в UTF-8; запрос обязан ехать в UTF-8'

VSE="c cpp go rust python java csharp elixir js"
[ -n "$ONE" ] && VSE="$ONE"

KRASNYH=0
BEZ_TULCHEJNA=0

# ── сборка и запуск по целям ────────────────────────────────────────────────
#
# Рецепты те же, что в docs/ifl/measure-across-targets.sh: второй набор команд
# запуска разошёлся бы с первым молча.
sobrat() {
  case "$1" in
    c)      ( cd "$WORK/c" && make -s ) ;;
    cpp)    ( cd "$WORK/cpp" && make -s ) ;;
    go)     ( cd "$WORK/go" && go build -o flang_cli ./cli ) ;;
    rust)   ( cd "$WORK/rust" && cargo build --quiet --release --offline ) ;;
    python) : ;;
    java)   ( cd "$WORK/java" && make -s build ) ;;
    csharp) ( cd "$WORK/csharp" && dotnet build -v quiet --nologo ) ;;
    elixir) ( cd "$WORK/elixir" && make -s build ) ;;
    js)     : ;;
  esac
}

est_tulchejn() {
  case "$1" in
    c)      command -v cc >/dev/null ;;
    cpp)    command -v g++ >/dev/null || command -v c++ >/dev/null ;;
    go)     command -v go >/dev/null ;;
    rust)   command -v cargo >/dev/null ;;
    python) command -v python3 >/dev/null ;;
    java)   command -v javac >/dev/null && command -v java >/dev/null ;;
    csharp) command -v dotnet >/dev/null ;;
    elixir) command -v elixir >/dev/null && command -v elixirc >/dev/null ;;
    js)     command -v node >/dev/null ;;
  esac
}

progon() {
  target=$1; vhod=$2; vyhod=$3; oshibki=$4
  case "$target" in
    c)      "$WORK/c/flang_cli" ;;
    cpp)    "$WORK/cpp/flang_cli" ;;
    go)     "$WORK/go/flang_cli" ;;
    rust)   "$WORK/rust/target/release/flang_cli" ;;
    python) ( cd "$WORK/python" && python3 -B flang_cli.py evklid ) ;;
    java)   ( cd "$WORK/java" && java -cp . FlangCli Evklid ) ;;
    csharp) ( cd "$WORK/csharp" && dotnet bin/Debug/net8.0/flang.dll Evklid ) ;;
    elixir) ( cd "$WORK/elixir" && elixir -pa _build -e 'Flang.Cli.main(["Evklid"])' ) ;;
    js)     ( cd "$WORK/js" && node flang_cli.js ./evklid.js ) ;;
  esac < "$vhod" > "$vyhod" 2> "$oshibki"
}

# ── суд ─────────────────────────────────────────────────────────────────────
# Столбцы разделителем, а не выравниванием: printf в bash считает БАЙТЫ, а
# кириллица идёт по два на знак — «ровная» таблица разъехалась бы молча.
stroka() { printf '%-8s | %-22s | %-28s | %s\n' "$1" "$2" "$3" "$4"; }
stroka цель "здоровый вход" "негодный октет" вердикт
printf '%s\n' "───────────────────────────────────────────────────────────────────────────────"

for target in $VSE; do
  if ! est_tulchejn "$target"; then
    stroka "$target" — — "тулчейна нет — не судилось"
    BEZ_TULCHEJNA=$((BEZ_TULCHEJNA + 1))
    continue
  fi
  # У «cpp» договор ключа «--runtime» СВОЙ, и это замерено 5 сентября 2026, а
  # не предположено: восемь целей ждут каталог самой цели («flang/src/emit/c»),
  # а девятая — КОРЕНЬ («flang/src/emit»), потому что ищет в нём «cpp/flang_cpp.hpp».
  # Передай ей то же, что остальным, — печать отказывает кодом 2.
  if [ "$target" = cpp ]; then RT_CEL=$RT; else RT_CEL=$RT/$target; fi
  if ! "$FL" emit "$SRC" --target "$target" --out "$WORK/$target" \
        --runtime "$RT_CEL" > "$WORK/$target.pechat" 2>&1; then
    stroka "$target" — — "НЕ НАПЕЧАТАЛОСЬ (см. $WORK/$target.pechat)"
    KRASNYH=$((KRASNYH + 1))
    continue
  fi
  if ! sobrat "$target" > "$WORK/$target.sborka" 2>&1; then
    stroka "$target" — — "НЕ СОБРАЛОСЬ (см. $WORK/$target.sborka)"
    KRASNYH=$((KRASNYH + 1))
    continue
  fi

  progon "$target" "$WORK/zdorovyy.jsonl" "$WORK/$target.zd.out" "$WORK/$target.zd.err"
  ZKOD=$?
  ZOTV=$(grep -c '"ok"' "$WORK/$target.zd.out")

  progon "$target" "$WORK/negodnyy.jsonl" "$WORK/$target.ng.out" "$WORK/$target.ng.err"
  NKOD=$?
  NERR=$(cat "$WORK/$target.ng.err")
  NOTV=$(grep -c '"ok"' "$WORK/$target.ng.out")

  zdorovo="код $ZKOD, ответов $ZOTV"
  [ "$ZKOD" = 0 ] && [ "$ZOTV" = 3 ] && zdorovo="прошёл (3 ответа, код 0)"

  # Три разные беды, и звать их одним словом нельзя: молчание, ложь и
  # расхождение лечатся по-разному.
  if [ "$NERR" = "$ETALON" ] && [ "$NKOD" != 0 ]; then
    negodno="отказ, код $NKOD"
  elif [ "$NKOD" = 0 ] && [ "$NOTV" = 0 ]; then
    negodno="МОЛЧИТ: код 0, ни слова"
  elif [ "$NKOD" = 0 ] && [ "$NOTV" -lt 2 ]; then
    # Здоровых запросов во входе ДВА (первая и третья строки). Ответов меньше —
    # значит работа брошена посреди трубы, и код 0 об этом умолчал.
    negodno="МОЛЧА бросил: код 0, ответов $NOTV из 2"
  elif [ "$NKOD" = 0 ]; then
    negodno="код 0, ответил и на мусор"
  elif [ -z "$NERR" ]; then
    negodno="код $NKOD, ни слова"
  else
    negodno="код $NKOD, текст не тот"
  fi

  # Долг: js обязан вести себя плохо, пока его прогонщик рукописный.
  if [ "$target" = js ]; then
    if [ "$NERR" = "$ETALON" ] && [ "$NKOD" != 0 ]; then
      verdikt="ДОЛГ ПОГАШЕН — снимите вычитание в этом сторожe"
      KRASNYH=$((KRASNYH + 1))
    else
      verdikt="вычтен: рукописный flang_cli.js, править запрещено"
    fi
    stroka "$target" "$zdorovo" "$negodno" "$verdikt"
    continue
  fi

  if [ "$zdorovo" != "прошёл (3 ответа, код 0)" ]; then
    verdikt="КРАСНО: здоровый вход не прошёл"
    KRASNYH=$((KRASNYH + 1))
  elif [ "$NKOD" = 0 ]; then
    verdikt="КРАСНО: отказа нет"
    KRASNYH=$((KRASNYH + 1))
  elif [ "$NERR" != "$ETALON" ]; then
    verdikt="КРАСНО: текст отказа разошёлся"
    KRASNYH=$((KRASNYH + 1))
  else
    verdikt="сошлось"
  fi
  stroka "$target" "$zdorovo" "$negodno" "$verdikt"
done

printf '%s\n' "────────────────────────────────────────────────────────────────────────────"
echo "эталон отказа: $ETALON"
echo "красных: $KRASNYH; без тулчейна: $BEZ_TULCHEJNA; работа: $WORK"

if [ "$PORCHA" = 1 ]; then
  echo
  echo "── ПОРЧА: сторож обязан покраснеть на подложенной тишине ──────────────────"
  # Копия дерева прогонщиков, в которой Rust возвращают к прежней болезни:
  # негодный октет обрывает цикл БЕЗ единого слова и без кода возврата.
  PORTA=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" porcha-oktet.XXXXXX)
  cp -r "$RT"/. "$PORTA"/
  python3 - "$PORTA/rust/flang_cli.rs" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
staryy = "            refuse_not_text(number, &raw, at);"
if staryy not in s:
    sys.exit("порча не легла: строки отказа в прогонщике Rust нет")
s = s.replace(staryy, "            let _ = refuse_not_text;\n            break;", 1)
open(p, 'w', encoding='utf-8').write(s)
PY
  [ $? -eq 0 ] || exit 3
  echo "подложено: rust отказывать перестал, обрывает цикл молча"
  RANTAJM="$PORTA" RABOTA=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" storozh-porcha.XXXXXX) \
    "$0" --цель rust
  PKOD=$?
  rm -rf "$PORTA"
  if [ "$PKOD" = 0 ]; then
    echo "СТОРОЖ СЛЕП: на подложенной тишине он остался зелёным."
    exit 1
  fi
  echo "сторож покраснел (код $PKOD) — порча видна."
fi

if [ "$BEZ_TULCHEJNA" -gt 0 ] && [ "$KRASNYH" = 0 ]; then
  echo "Тулчейна нет у $BEZ_TULCHEJNA целей. Пропуск не есть пройденная проверка."
  exit 2
fi
[ "$KRASNYH" = 0 ] || exit 1
exit 0
