#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# РАЗОШЛОСЬ ЛИ ОПУБЛИКОВАННОЕ С ДЕРЕВОМ. Одна команда, секунды, без node.
#
# ── Зачем ────────────────────────────────────────────────────────────────────
# Проект говорит о себе числами: «библиотека — столько-то модулей», «доказано
# столько-то процентов», «всё написано на flang». Числа эти сняты прогонами, но
# прогоны стоят часы, а дерево меняется за минуты. Разовая сверка протухает за
# неделю, и тогда опубликованное начинает описывать дерево, которого нет.
#
# 29 августа 2026 это измерено: из 24 дешёвых ключей `docs/site/numbers.json`
# разошлись 17. `библиотека.файлов` стоял 26 при 42 в дереве, `корпус.файлов` —
# 322 при 210. Ни одна проверка дерева этого не ловила: `числа:проверка` умеет,
# но зовёт двоичный по всему корпусу — это часы, и ни один CI её не гоняет.
#
# Этот сторож берёт ровно ту часть, которую можно пересчитать БЕЗ двоичного и
# без прогона: правила счёта переписаны сюда из `docs/site/site-numbers.mjs`
# один в один. Дорогие ключи (`корпус.функций`, `утверждения.*`, `носители.*`,
# `сторож.*`, `словарь.*`) он не трогает и об этом говорит вслух.
#
# ── Как звать ────────────────────────────────────────────────────────────────
#   sh scripts/published-vs-tree.sh            сверить; код 0 — сошлось, 1 — нет
#   sh scripts/published-vs-tree.sh --числа    только ключи numbers.json
#   sh scripts/published-vs-tree.sh --доля     только доля доказанного
#   sh scripts/published-vs-tree.sh --перепись только перепись не-flang
#   sh scripts/published-vs-tree.sh --выпуск  только выпуск: версия и теги
#   sh scripts/published-vs-tree.sh --карта   только карта раскладки в README
#
# ИМЕНА ЗДЕСЬ ЛАТИНИЦЕЙ, как в scripts/raskrutka.sh и в `ярлык`: ни dash, ни
# bash не принимают кириллицу в именах переменных.

set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

CHISLA=docs/site/numbers.json
DOLYA=scripts/proved-share.json
VEDOMOST=scripts/proved-share-ledger.txt
VREMENNO=${TMPDIR:-/tmp}/published-vs-tree.$$

razdel=${1:---всё}
plohih=0

znach() { grep -oE "\"$1\": *[0-9\"][^,}]*" "$2" | head -1 | sed 's/.*: *//; s/^"//; s/"$//'; }

skazat() { # ключ опубликовано вдереве
  if [ "$2" = "$3" ]; then
    [ -n "${PODROBNO:-}" ] && printf '  %-22s %s\n' "$1" "сошлось: $2" || true
  else
    printf '  %-22s опубликовано %-9s в дереве %-9s РАЗОШЛОСЬ\n' "$1" "$2" "$3"
    plohih=$((plohih + 1))
  fi
}

# Правила счёта — из docs/site/site-numbers.mjs, функции «библиотека» и «модуль».
fn()  { grep -acE '^[[:space:]]*(тотальная функция|функция)[[:space:]]' "$1" || true; }
tot() { grep -acE '^[[:space:]]*тотальная функция[[:space:]]' "$1" || true; }
pr()  { grep -acE '^[[:space:]]*пример[[:space:]]' "$1" || true; }

# ── Числа сайта ──────────────────────────────────────────────────────────────
chisla_sayta() {
  echo "ЧИСЛА САЙТА ($CHISLA) — дешёвые ключи, пересчитаны по исходникам:"
  lf=0; lstrok=0; lfn=0
  for f in flang/stdlib/*.flang flang/stdlib/*.fp flang/stdlib/*.фп flang/stdlib/*.фланг; do
    [ -f "$f" ] || continue
    lf=$((lf + 1)); lstrok=$((lstrok + $(wc -l < "$f"))); lfn=$((lfn + $(fn "$f")))
  done
  skazat библиотека.файлов  "$(znach библиотека.файлов "$CHISLA")"  "$lf"
  skazat библиотека.строк   "$(znach библиотека.строк "$CHISLA")"   "$lstrok"
  skazat библиотека.функций "$(znach библиотека.функций "$CHISLA")" "$lfn"

  # Корпус — тот же набор, что у flang/scripts/proof-ledger.mjs (ФАЙЛЫ).
  kf=0; kstrok=0
  for f in $(find flang -type f \( -name '*.flang' -o -name '*.fp' -o -name '*.фп' -o -name '*.фланг' \) \
             | grep -v '^flang/test/fixtures/' | grep -v '^flang/self/bootstrap/compiler\.flang$' | sort); do
    kf=$((kf + 1)); kstrok=$((kstrok + $(wc -l < "$f")))
  done
  skazat корпус.файлов "$(znach корпус.файлов "$CHISLA")" "$kf"
  skazat корпус.строк  "$(znach корпус.строк "$CHISLA")"  "$kstrok"

  skazat база.строк      "$(znach база.строк "$CHISLA")"      "$(wc -l < flang/stdlib/postgres.flang)"
  skazat база.функций    "$(znach база.функций "$CHISLA")"    "$(fn flang/stdlib/postgres.flang)"
  skazat база.тотальных  "$(znach база.тотальных "$CHISLA")"  "$(tot flang/stdlib/postgres.flang)"
  skazat база.примеров   "$(znach база.примеров "$CHISLA")"   "$(pr flang/stdlib/postgres.flang)"
  skazat провод.строк    "$(znach провод.строк "$CHISLA")"    "$(wc -l < flang/stdlib/wire.flang)"
  skazat провод.функций  "$(znach провод.функций "$CHISLA")"  "$(fn flang/stdlib/wire.flang)"
  skazat провод.примеров "$(znach провод.примеров "$CHISLA")" "$(pr flang/stdlib/wire.flang)"
  skazat план.строк      "$(znach план.строк "$CHISLA")"      "$(wc -l < examples/db/postgres-plan.flang)"
  skazat план.примеров   "$(znach план.примеров "$CHISLA")"   "$(pr examples/db/postgres-plan.flang)"
  skazat планировщик.строк    "$(znach планировщик.строк "$CHISLA")"    "$(wc -l < flang/conc/scheduler.flang)"
  skazat планировщик.функций  "$(znach планировщик.функций "$CHISLA")"  "$(fn flang/conc/scheduler.flang)"
  skazat планировщик.примеров "$(znach планировщик.примеров "$CHISLA")" "$(pr flang/conc/scheduler.flang)"
  skazat связь.строк     "$(znach связь.строк "$CHISLA")"     "$(wc -l < flang/conc/link.flang)"
  skazat связь.функций   "$(znach связь.функций "$CHISLA")"   "$(fn flang/conc/link.flang)"
  skazat связь.примеров  "$(znach связь.примеров "$CHISLA")"  "$(pr flang/conc/link.flang)"

  skazat цели.всего     "$(znach цели.всего "$CHISLA")"     "$(find flang/src/emit -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  skazat цели.близнецов "$(znach цели.близнецов "$CHISLA")" "$(find flang/self -maxdepth 1 -name 'emit-*.flang' | wc -l | tr -d ' ')"
  skazat выпуск.версия  "$(znach выпуск.версия "$CHISLA")"  "$(znach version package.json)"

  o1=$(grep -oE 'FLANG_PROOF_[A-Z_]+' flang/self/obligations.flang | sort -u | wc -l | tr -d ' ')
  o2=$(grep -oE 'FLANG_PROOF_[A-Z_]+' flang/self/proofterm.flang | sort -u | wc -l | tr -d ' ')
  skazat отказы.обязательств "$(znach отказы.обязательств "$CHISLA")" "$o1"
  skazat отказы.вывода       "$(znach отказы.вывода "$CHISLA")"       "$o2"
  skazat отказы.всего        "$(znach отказы.всего "$CHISLA")"        "$((o1 + o2))"

  echo "  (дорогие ключи — корпус.функций, утверждения.*, носители.*, сторож.*,"
  echo "   словарь.* — здесь НЕ проверены: им нужен прогон двоичного по корпусу.)"
}

# ── Доля доказанного ─────────────────────────────────────────────────────────
dolya_dokazannogo() {
  echo "ДОЛЯ ДОКАЗАННОГО ($DOLYA):"
  if [ ! -f "$DOLYA" ] || [ ! -f "$VEDOMOST" ]; then
    echo "  доля не записана — сверять нечего ($DOLYA, $VEDOMOST)"
    plohih=$((plohih + 1)); return
  fi
  zapisano_znam=$(znach знаменатель "$DOLYA")
  zapisano_chisl=$(znach числитель "$DOLYA")
  zapisano_dvoich=$(znach двоичный "$DOLYA")

  # Знаменатель считается по ИСХОДНИКАМ: строка, первое слово которой
  # «обеспечивает», «требует» или «закон». Двоичный для этого не нужен.
  znam=$(git -c core.quotePath=false ls-files -z '*.flang' \
         | xargs -0 grep -hacE '^[[:space:]]*(обеспечивает|требует|закон)[[:space:]]' \
         | awk '{s += $1} END {print s + 0}')
  skazat "написано обязательств" "$zapisano_znam" "$znam"

  # Числитель воспроизводим ровно настолько, насколько не сдвинулись файлы, по
  # которым он снят. Ведомость хранит md5 и число обязательств на файл, поэтому
  # устаревание меряется числом, а не словом «протухло».
  git -c core.quotePath=false ls-files '*.flang' | while IFS= read -r f; do
    n=$(grep -acE '^[[:space:]]*(обеспечивает|требует|закон)[[:space:]]' "$f" || true)
    [ "${n:-0}" -gt 0 ] || continue
    printf '%s|%s|%s\n' "$(md5sum "$f" | cut -d' ' -f1)" "$n" "$f"
  done > "$VREMENNO"

  itog=$(awk -F'|' '
    FNR == NR { if ($0 !~ /^\/\//) { bylo[$3] = $1; obyaz[$3] = $2 }; next }
    {
      est[$3] = 1
      if (!($3 in bylo))        { pribylo += 1 }
      else if (bylo[$3] != $1)  { sdvinulos += 1; podvoprosom += obyaz[$3]; imena = imena "    сдвинулся " $3 " (" obyaz[$3] ")\n" }
    }
    END {
      for (p in bylo) if (!(p in est)) { ushlo += 1; podvoprosom += obyaz[p] }
      printf "%d %d %d %d\n%s", sdvinulos + 0, ushlo + 0, pribylo + 0, podvoprosom + 0, imena
    }' "$VEDOMOST" "$VREMENNO")
  n_sdv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f1)
  n_ush=$(printf '%s' "$itog" | head -1 | cut -d' ' -f2)
  n_pri=$(printf '%s' "$itog" | head -1 | cut -d' ' -f3)
  ob_sdv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f4)

  if [ "$n_sdv" = 0 ] && [ "$n_ush" = 0 ] && [ "$n_pri" = 0 ]; then
    printf '  числитель %s — ЖИВ: ни один файл с обязательствами не сдвинулся\n' "$zapisano_chisl"
  else
    printf '  числитель %s — под вопросом на %s обязательств из %s\n' "$zapisano_chisl" "$ob_sdv" "$zapisano_znam"
    printf '    файлов сдвинулось %s, ушло %s, прибыло %s\n' "$n_sdv" "$n_ush" "$n_pri"
    [ -n "${PODROBNO:-}" ] && printf '%s\n' "$itog" | tail -n +2 || true
    plohih=$((plohih + 1))
  fi
  rm -f "$VREMENNO"

  if [ -x bootstrap/flang ]; then
    skazat "двоичный (md5)" "$zapisano_dvoich" "$(md5sum bootstrap/flang | cut -d' ' -f1)"
  else
    echo "  двоичный не собран — сверить нечем (make -C bootstrap -j8)"
  fi

  # Заслон, без которого всякая доля доказанного лжёт: двоичный собран из СЕМЕНИ,
  # и пока семя отстало, он судит по старым правилам.
  # Ключ обхода спрашивается ЗДЕСЬ, а не отдаётся заслону. Заслон при ключе
  # отвечает нулём — то же, что «семя свежее», — и сверка печатала бы «семя
  # отвечает исходникам» там, где семя не сверяли вовсе. Зелёное, полученное
  # обходом, остаётся зелёным, но обязано называть себя.
  if [ -n "${SEMYA_OTSTALO_ZNAYU:-}" ]; then
    echo "  СЕМЯ НЕ СВЕРЯЛОСЬ: судим по прямому указанию (SEMYA_OTSTALO_ZNAYU)."
    echo "    свежесть семени держит своя проверка: sh scripts/seed-freshness.sh"
  elif sh scripts/seed-freshness.sh --chto "доля доказанного" >/dev/null 2>&1; then
    echo "  семя отвечает исходникам — приговоры про это дерево"
  else
    echo "  СЕМЯ ОТСТАЛО: двоичный судит по старым правилам, и всякая доля"
    echo "    доказанного описывает дерево, которого нет (sh scripts/seed-freshness.sh)"
    plohih=$((plohih + 1))
  fi
}

# ── Перепись не-flang ────────────────────────────────────────────────────────
perepis() {
  echo 'ЧТО В ДЕРЕВЕ НЕ НА FLANG (за утверждением «всё написано на flang»):'
  git -c core.quotePath=false ls-files '*.c' '*.h' '*.js' '*.mjs' '*.py' '*.sh' '*.java' \
      '*.cs' '*.go' '*.rs' '*.ex' '*.erl' '*.rb' '*.lua' '*.vim' '*.awk' '*.html' '*.css' \
  | while IFS= read -r f; do
      n=$(wc -l < "$f")
      if head -3 "$f" | grep -q 'Сгенерировано flang'; then k="напечатано компилятором"
      else
        case "$f" in
          flang/src/emit/*)         k="рантайм цели печати" ;;
          flang/conc/bin/node.*)    k="хозяин узла на цели" ;;
          benchmarks/*|examples/host-boundary/*) k="замеряемый материал" ;;
          packaging/postinstall.mjs|packaging/flang-launch.mjs|flang/bin/flang-lsp.mjs|editors/*|packaging/homebrew/*|docs/site/poisk.js|docs/site/poisk-proverka.mjs|web/wasm/probe.mjs|scripts/wasm-run.mjs)
                                    k="чужая среда" ;;
          *)                        k="ДОЛГ" ;;
        esac
      fi
      echo "$k|$n"
    done \
  | awk -F'|' '{c[$1]++; s[$1]+=$2; vc++; vs+=$2}
               END {for (k in s) printf "  %-24s файлов %4d  строк %7d\n", k, c[k], s[k];
                    printf "  %-24s файлов %4d  строк %7d\n", "ВСЕГО НЕ НА FLANG", vc, vs}' \
  | sort
  git -c core.quotePath=false ls-files -z '*.flang' | xargs -0 wc -l | tail -1 \
  | awk '{printf "  %-24s               строк %7d\n", "НА FLANG", $1}'
}

# ── Выпуск: объявленная версия против выпущенных ─────────────────────────────
#
# ЗАЧЕМ ЭТО ЗДЕСЬ. Свод при каждом прогоне печатает рекомендацию вида
# «версия: 0.6.2 → 0.7.0», и она молча не исполняется: рекомендация — не факт, и
# в дереве от неё не остаётся следа. Факты, которые проверить МОЖНО, два:
# объявленная версия обязана быть выпущена (иначе `npm i` даёт не то, что
# описывает дерево), и невыпущенная работа обязана быть НАЗВАНА ЧИСЛОМ, а не
# словом «накопилось». Первое краснеет, второе печатается.
#
# «Теги не выгружены» и «тега нет» — РАЗНЫЕ исходы, и смешивать их нельзя:
# `actions/checkout` по умолчанию тянет одну ревизию без единого тега, и на таком
# клоне «тега нет» означало бы только то, что его не выгружали.
vypusk() {
  echo "ВЫПУСК (объявленное деревом против выпущенного):"
  v_paket=$(znach version package.json)
  echo "  версия в package.json    $v_paket"

  if [ -z "$(git tag -l 'v[0-9]*' 2>/dev/null)" ]; then
    echo "  теги не выгружены — сверить нечем (git fetch --tags, в CI fetch-depth: 0)"
    return
  fi

  svezhiy=$(git tag -l 'v[0-9]*' | sed 's/^v//' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
  skazat "самый свежий тег" "$svezhiy" "$v_paket"

  if git rev-parse -q --verify "refs/tags/v$v_paket" >/dev/null 2>&1; then
    posle=$(git rev-list --count "v$v_paket..HEAD" 2>/dev/null || echo 0)
    umeniy=$(git log --format=%s "v$v_paket..HEAD" 2>/dev/null | grep -c '^feat' || true)
    pochinok=$(git log --format=%s "v$v_paket..HEAD" 2>/dev/null | grep -c '^fix' || true)
    printf '  после тега v%s: коммитов %s, из них новых умений %s, починок %s\n' \
      "$v_paket" "$posle" "$umeniy" "$pochinok"
    echo "    это НЕ беда: число — мера того, сколько работы стоит невыпущенной."
    echo "    Решение «выпускать» принимает человек; здесь оно перестаёт быть незаметным."
  else
    printf '  тега v%s НЕТ: дерево объявляет версию, которой никто не выпускал\n' "$v_paket"
    plohih=$((plohih + 1))
  fi
}

# ── Карта раскладки: README против корня дерева ──────────────────────────────
#
# ЗАЧЕМ. Карта каталогов в README сверялась пробой `flang/test/readme-layout.test.mjs`.
# Проба удалена вместе с реализацией на JavaScript, и с того дня карта держалась
# рукой. Держалась плохо: 29 августа 2026 README на обоих языках говорил «у корня
# 10 каталогов» при одиннадцати, а каталога `tasks/` в карте не было вовсе —
# читатель, искавший открытую работу дерева, узнать о ней из README не мог.
#
# Здесь восстановлено ровно то, что делала проба, и без единой зависимости:
# число у корня и состав карты. Скрытые каталоги (`.github/`, `.claude/`) карта
# называть вправе, но не обязана; НЕскрытый каталог обязана назвать каждый.
#
# Сортировка идёт под LC_ALL=C: `comm` сличает строки байтами, и в другой
# раскладке он объявляет «input is not in sorted order» на ровном месте.
karta() {
  echo "КАРТА РАСКЛАДКИ (README против корня дерева):"
  find . -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%f\n' | LC_ALL=C sort > "$VREMENNO.derevo"
  n_dereve=$(wc -l < "$VREMENNO.derevo" | tr -d ' ')

  for f in README.md README.ru.md; do
    skazano=$(grep -aoE '(There are|У корня) [0-9]+ (directories at the root|каталогов)' "$f" \
              | head -1 | grep -oE '[0-9]+')
    skazat "$f: число у корня" "${skazano:-нет}" "$n_dereve"

    awk '/КАРТА-НАЧАЛО/{v=1; next} /КАРТА-КОНЕЦ/{v=0} v' "$f" \
      | grep -aoE '^[^[:space:]/]+/' | tr -d '/' | LC_ALL=C sort -u > "$VREMENNO.karta"

    ne_nazvan=$(LC_ALL=C comm -23 "$VREMENNO.derevo" "$VREMENNO.karta" | tr '\n' ' ')
    if [ -n "$(printf '%s' "$ne_nazvan" | tr -d ' ')" ]; then
      printf '  %-22s в дереве есть, в карте нет: %s  РАЗОШЛОСЬ\n' "$f" "$ne_nazvan"
      plohih=$((plohih + 1))
    fi

    vydumano=$(LC_ALL=C comm -13 "$VREMENNO.derevo" "$VREMENNO.karta" | grep -v '^\.' | tr '\n' ' ')
    if [ -n "$(printf '%s' "$vydumano" | tr -d ' ')" ]; then
      printf '  %-22s в карте есть, в дереве нет: %s  РАЗОШЛОСЬ\n' "$f" "$vydumano"
      plohih=$((plohih + 1))
    fi
  done
  rm -f "$VREMENNO.derevo" "$VREMENNO.karta"
}

case "$razdel" in
  --числа)    chisla_sayta ;;
  --доля)     dolya_dokazannogo ;;
  --перепись) perepis ;;
  --выпуск)   vypusk ;;
  --карта)    karta ;;
  --всё)      chisla_sayta; echo; dolya_dokazannogo; echo; perepis; echo; vypusk; echo; karta ;;
  *) echo "непонятный довод: $razdel" >&2; exit 2 ;;
esac

echo
if [ "$plohih" = 0 ]; then
  echo "опубликованное сходится с деревом"
  exit 0
fi
echo "ОПУБЛИКОВАННОЕ РАЗОШЛОСЬ С ДЕРЕВОМ в $plohih местах."
echo "Числа сайта переписываются прогоном: ./ярлык числа  (часы, зовёт двоичный)."
echo "Доля доказанного снимается заново по scripts/proved-share.json."
exit 1
