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
#   sh scripts/published-vs-tree.sh --команды только напечатанные команды
#   sh scripts/published-vs-tree.sh --проза   только числа прозы (README и страницы)
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

# Проза читается плоской: перенос строки не должен решать, задан вопрос или нет.
plosko() { tr '\n' ' ' < "$1"; }

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
  # `провод.тотальных` спрашивается ровно потому, что 29 августа 2026 он оказался
  # ЕДИНСТВЕННЫМ дешёвым ключом, которого сверка не спрашивала, — и стоял 31 при
  # 34 в дереве. Сосед по строке (`провод.функций`) краснел, а этот молчал:
  # незаданный вопрос не краснеет никогда. `база.тотальных` спрашивался с самого
  # начала и разошёлся вместе со своим соседом — то есть дело не в ключе, а в
  # том, что его забыли внести сюда.
  skazat провод.тотальных "$(znach провод.тотальных "$CHISLA")" "$(tot flang/stdlib/wire.flang)"
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
  vozrast_dorogih
}

# ── Возраст дорогих ключей ───────────────────────────────────────────────────
#
# ЗАЧЕМ. Дешёвая половина `numbers.json` пересчитывается здесь за секунды, и
# разойдясь, краснеет. Дорогая половина не пересчитывается ничем дешевле
# `./ярлык числа` — прогон двоичного по всему корпусу, — и потому не краснела
# НИГДЕ И НИКОГДА. 29 августа 2026 это стоило вот чего: `корпус.файлов` в том же
# файле разошёлся 322 против 212, то есть корпус пересчитан заново, — а
# `корпус.функций` рядом остался стоять 24063 от 23 августа, и ни одна проверка
# об этом не сказала.
#
# ЧИСЛОМ, А НЕ СЛОВОМ. «Протухло» — не мера; мера — сколько файлов с тех пор
# сдвинулось. Приём тот же, что у ведомости доли доказанного: устаревание
# меряется числом.
#
# ПЕЧАТАЕТ, А НЕ КРАСНЕЕТ, и это решение, а не недосмотр. Работа CI, красная от
# того, чего ни один пуш починить не может (прогон стоит часы, а семя вдобавок
# отстало), за неделю приучает не смотреть. Тот же довод уже применён к разделу
# `--доля` и к невыпущенной работе в `--выпуск`.
vozrast_dorogih() {
  otkuda=$(sed -n 's/.*"дорогиеКоммит": *"\([^"]*\)".*/\1/p' "$CHISLA" | head -1)
  kogda=$(sed -n 's/.*"дорогиеДата": *"\([^"]*\)".*/\1/p' "$CHISLA" | head -1)
  if [ -z "$otkuda" ]; then
    echo "  дорогие ключи не говорят, когда сняты — происхождения в $CHISLA нет"
    return
  fi
  if ! git rev-parse -q --verify "$otkuda^{commit}" >/dev/null 2>&1; then
    # Коммит замера не в этом клоне — обычное дело при fetch-depth: 1, и это
    # НЕ беда: «не выгружен» и «не существует» здесь неразличимы.
    printf '  дорогие ключи сняты %s на %s — коммита нет в этом клоне, возраст не измерен\n' \
      "${kogda:-без даты}" "$otkuda"
    return
  fi
  sdvig=$(git diff --name-only "$otkuda" -- '*.flang' 2>/dev/null | wc -l | tr -d ' ')
  kommitov=$(git rev-list --count "$otkuda..HEAD" 2>/dev/null || echo '?')
  printf '  дорогие ключи сняты %s на %s: с тех пор коммитов %s, файлов .flang сдвинулось %s\n' \
    "${kogda:-без даты}" "$otkuda" "$kommitov" "$sdvig"
  if [ "${sdvig:-0}" -gt 0 ]; then
    echo "    значит они описывают дерево, которого нет. Пересъёмка — ./ярлык числа"
    echo "    (прогон двоичного по корпусу, часы), и она ждёт перепечатки семени."
  fi
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

  # Знаменатель считается по ИСХОДНИКАМ: строка, где обязательство объявлено.
  # Двоичный для этого не нужен.
  #
  # «для всех н обеспечивает …» — то же обязательство, написанное с явной
  # переменной. Счёт по ПЕРВОМУ СЛОВУ строки его не видел: строка начинается
  # с «для всех», а не с «обеспечивает». Так терялось 140 обязательств в
  # 76 файлах (замерено 30 августа 2026 на этом дереве: 13478 по прежнему
  # правилу против 13618 по нынешнему). Правило здесь обязано совпадать с
  # правилом scripts/proved-share-of-a-file.py, иначе знаменатель сверки и
  # знаменатель ведомости расходятся молча.
  OBYAZ='^[[:space:]]*(для всех .*)?(обеспечивает|требует|закон)[[:space:]]'
  znam=$(git -c core.quotePath=false ls-files -z '*.flang' \
         | xargs -0 grep -hacE "$OBYAZ" \
         | awk '{s += $1} END {print s + 0}')
  skazat "написано обязательств" "$zapisano_znam" "$znam"

  # Числитель воспроизводим ровно настолько, насколько не сдвинулись файлы, по
  # которым он снят. Ведомость хранит на файл md5, число написанных
  # обязательств И приговор — поэтому устаревание меряется числом, а вклад
  # сдвинувшегося файла можно вычесть поимённо.
  git -c core.quotePath=false ls-files '*.flang' | while IFS= read -r f; do
    n=$(grep -acE "$OBYAZ" "$f" || true)
    [ "${n:-0}" -gt 0 ] || continue
    printf '%s|%s|%s\n' "$(md5sum "$f" | cut -d' ' -f1)" "$n" "$f"
  done > "$VREMENNO"

  # ПУТЬ БЕРЁТСЯ ИЗ ПОСЛЕДНЕГО ПОЛЯ, а не из третьего. Ведомость сменила
  # устройство: было «md5|написано|путь» (3 поля), стало
  # «md5|написано|доказано|сетка|объявлено|без приговора|путь» (7 полей).
  # При счёте по $3 путь читался из числа «доказано», ни одна строка не
  # сходилась с деревом, и сверка печатала «ушло 56, прибыло 439» — цифры,
  # не значащие ничего. $NF читает оба устройства и не заметит третьего.
  #
  # ЧИСЛИТЕЛЬ ТЕПЕРЬ СЧИТАЕТСЯ ПОИМЁННО. Прежняя опись держала на файл только
  # md5 и число НАПИСАННЫХ обязательств, поэтому вклад сдвинувшегося файла
  # вычесть было не из чего и доля снималась только целиком — 437 прогонов,
  # 12,7 ч. Теперь на каждый файл записан приговор, и числитель складывается
  # из несдвинувшихся файлов, а сдвинувшийся стоит отдельной строкой со своей
  # ценой: переснять надо ЕГО, а не дерево.
  itog=$(awk -F'|' '
    FNR == NR {
      if ($0 ~ /^\/\// || NF < 3) next
      p = $NF; bylo[p] = $1; obyaz[p] = $2
      if (NF >= 7 && $3 ~ /^[0-9]+$/) { dok[p] = $3; sudili[p] = 1 }
      next
    }
    {
      p = $NF; est[p] = 1
      if (!(p in bylo))        { pribylo += 1 }
      else if (bylo[p] != $1)  { sdvinulos += 1; podvoprosom += obyaz[p]
                                 if (p in dok) dok_sdv += dok[p]
                                 imena = imena "    сдвинулся " p " (" obyaz[p] ")\n" }
      else if (p in dok)       { chisl_zhiv += dok[p]; n_zhiv += 1 }
    }
    END {
      for (p in bylo) if (!(p in est)) { ushlo += 1; podvoprosom += obyaz[p]
                                        if (p in dok) dok_sdv += dok[p] }
      printf "%d %d %d %d %d %d %d\n%s", sdvinulos + 0, ushlo + 0, pribylo + 0, \
             podvoprosom + 0, chisl_zhiv + 0, n_zhiv + 0, dok_sdv + 0, imena
    }' "$VEDOMOST" "$VREMENNO")
  n_sdv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f1)
  n_ush=$(printf '%s' "$itog" | head -1 | cut -d' ' -f2)
  n_pri=$(printf '%s' "$itog" | head -1 | cut -d' ' -f3)
  ob_sdv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f4)
  ch_zhiv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f5)
  n_zhiv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f6)
  dok_sdv=$(printf '%s' "$itog" | head -1 | cut -d' ' -f7)

  if [ "$n_sdv" = 0 ] && [ "$n_ush" = 0 ] && [ "$n_pri" = 0 ]; then
    printf '  числитель %s — ЖИВ: ни один файл с обязательствами не сдвинулся\n' "$zapisano_chisl"
  else
    printf '  числитель %s — под вопросом на %s обязательств из %s\n' "$zapisano_chisl" "$ob_sdv" "$zapisano_znam"
    printf '    файлов сдвинулось %s, ушло %s, прибыло %s\n' "$n_sdv" "$n_ush" "$n_pri"
    [ -n "${PODROBNO:-}" ] && printf '%s\n' "$itog" | tail -n +2 || true
    plohih=$((plohih + 1))
  fi

  # Пересчёт ПО ФАЙЛАМ. Возможен только с ведомостью, несущей приговор: старая
  # (md5 и число написанных) этого не давала, и доля снималась целиком.
  if [ "$n_zhiv" -gt 0 ]; then
    printf '  доказано у несдвинувшихся файлов: %s (файлов %s)\n' "$ch_zhiv" "$n_zhiv"
    if [ "$dok_sdv" -gt 0 ]; then
      printf '    из числителя под вопросом %s доказанных у %s файлов — переснять надо их, а не дерево\n' \
             "$dok_sdv" "$((n_sdv + n_ush))"
    fi
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

# ── Числа прозы: README и страницы против дерева ─────────────────────────────
#
# ЗАЧЕМ. Числа `numbers.json` держит подстановка `{{ключ}}`, и разойтись молча им
# больше не дают. Но добрая половина чисел, которые проект говорит о себе, стоит
# в прозе НАБРАННОЙ РУКОЙ — в README, в шапке `AGENTS.md`, на страницах сайта, —
# и её не сторожило ничто. 29 августа 2026 замер показал цену этого: примеров
# было объявлено 190 при 191 в дереве и «ещё 183» при 176; отпечаток семени
# объявлял 37 файлов при 42 строках; «три решающих правила» стояли на той же
# странице, где двенадцать. Ни одно из этих чисел не появилось со зла — каждое
# было верным в день, когда его написали.
#
# Здесь спрашиваются те из них, которые считаются БЕЗ двоичного: пересчёт стоит
# доли секунды, и потому вопрос можно задавать на каждый пуш.
#
# ЧТО СЮДА НЕ ВХОДИТ. Числа, для которых нужен прогон компилятора (доля
# доказанного, носители, утверждения) — их держит `--числа` и своя оговорка.
proza() {
  echo "ЧИСЛА ПРОЗЫ (README и страницы против дерева):"

  # Примеры: сколько программ и сколько наборов.
  pr_vsego=$(find examples -name '*.flang' | wc -l | tr -d ' ')
  pr_naborov=$(find examples -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  pr_ostalnyh=$(find examples -name '*.flang' \
                | grep -vE '^examples/(web/shortener|library-api)/' | wc -l | tr -d ' ')
  skazat "README.ru: программ"  "$(grep -oE 'examples/ +[0-9]+ программ' README.ru.md | grep -oE '[0-9]+')" "$pr_vsego"
  skazat "README: программ"     "$(grep -oE 'examples/ +[0-9]+ flang programs' README.md | grep -oE '[0-9]+')" "$pr_vsego"
  skazat "README.ru: наборов"   "$(grep -oE 'программ[а-я]* на flang в [0-9]+ наборах' README.ru.md | grep -oE '[0-9]+' | tail -1)" "$pr_naborov"
  skazat "README: наборов"      "$(grep -oE 'flang programs in [0-9]+ sets' README.md | grep -oE '[0-9]+')" "$pr_naborov"
  skazat "README.ru: остальных" "$(grep -oE 'ещё [0-9]+ программ' README.ru.md | grep -oE '[0-9]+')" "$pr_ostalnyh"
  skazat "README: остальных"    "$(grep -oE '[0-9]+ more programs in' README.md | grep -oE '[0-9]+')" "$pr_ostalnyh"

  # Библиотека: модулей, функций, тотальных, примеров — одной фразой в обоих README.
  bf=0; bfn=0; btot=0; bpr=0
  for f in flang/stdlib/*.flang; do
    [ -f "$f" ] || continue
    bf=$((bf + 1)); bfn=$((bfn + $(fn "$f"))); btot=$((btot + $(tot "$f"))); bpr=$((bpr + $(pr "$f")))
  done
  skazat "README.ru: модулей"   "$(grep -oE '\*\*[0-9]+ модул[а-я]+, [0-9]+ функц' README.ru.md | grep -oE '[0-9]+' | head -1)" "$bf"
  skazat "README.ru: функций"   "$(grep -oE '\*\*[0-9]+ модул[а-я]+, [0-9]+ функц' README.ru.md | grep -oE '[0-9]+' | tail -1)" "$bfn"
  skazat "README: модулей"      "$(grep -oE '\*\*[0-9]+ modules, [0-9]+' README.md | grep -oE '[0-9]+' | head -1)" "$bf"
  skazat "README: функций"      "$(grep -oE '\*\*[0-9]+ modules, [0-9]+' README.md | grep -oE '[0-9]+' | tail -1)" "$bfn"

  # Теоремы: всего в дереве и в библиотеке. Ключ -a обязателен — без него
  # flang/conc/link.flang пропускается молча (это уже ловили).
  #
  # Проза читается ПЛОСКОЙ — переносы строк заменены пробелами. Иначе вопрос
  # зависит от того, где редактор перенёс строку: «из них 55 в\nстандартной»
  # не совпадает с образцом, а «из них 55 в стандартной» совпадает, и обёртка
  # молча превращает проверку в непроверку.
  t_vsego=$(grep -racE '^[[:space:]]*теорема ' flang --include='*.flang' | awk -F: '{s+=$2} END {print s+0}')
  t_bibl=$(grep -racE '^[[:space:]]*теорема ' flang/stdlib --include='*.flang' | awk -F: '{s+=$2} END {print s+0}')
  skazat "index.ru: теорем"    "$(plosko docs/site/index.ru.md | grep -oE 'теорем в дереве языка \*\*[0-9]+\*\*' | grep -oE '[0-9]+')" "$t_vsego"
  skazat "index: теорем"       "$(plosko docs/site/index.md | grep -oE 'There are \*\*[0-9]+\*\* such theorems' | grep -oE '[0-9]+')" "$t_vsego"
  skazat "proofs.ru: теорем"   "$(plosko docs/site/proofs.ru.md | grep -oE 'таких теорем [0-9]+' | grep -oE '[0-9]+')" "$t_vsego"
  skazat "proofs: теорем"      "$(plosko docs/site/proofs.md | grep -oE 'There are [0-9]+ such theorems' | grep -oE '[0-9]+')" "$t_vsego"
  skazat "index.ru: в библиотеке"  "$(plosko docs/site/index.ru.md | grep -oE 'из них \*\*[0-9]+\*\* в стандартной' | grep -oE '[0-9]+')" "$t_bibl"
  skazat "proofs.ru: в библиотеке" "$(plosko docs/site/proofs.ru.md | grep -oE 'из них [0-9]+ в стандартной' | grep -oE '[0-9]+')" "$t_bibl"

  # Решающих правил ядра — счёт берётся у самого ядра, и на обеих страницах он
  # стоит дважды: цифрой в скобках при команде и словом в прозе.
  pravil=$(grep -c 'тотальная функция «Правило' flang/self/proof-kernel.flang | tr -d ' ')
  skazat "proofs: правил ядра"    "$(plosko docs/site/proofs.md | grep -oE 'proof-kernel\.flang. → [0-9]+' | grep -oE '[0-9]+')" "$pravil"
  skazat "proofs.ru: правил ядра" "$(plosko docs/site/proofs.ru.md | grep -oE 'proof-kernel\.flang. → [0-9]+' | grep -oE '[0-9]+')" "$pravil"
  if grep -q 'три решающих правила\|the three decision rules' docs/site/proofs.ru.md docs/site/proofs.md docs/site/learning.ru.md 2>/dev/null; then
    echo "  правил ядра словом    на странице «три решающих правила» при $pravil в ядре  РАЗОШЛОСЬ"
    plohih=$((plohih + 1))
  fi

  # Отпечаток семени: сколько в нём строк. Число ходит с каждой перепечаткой.
  otp=$(awk 'NF==2 && $1 ~ /^[0-9a-f]{64}$/' scripts/otpechatok-semeni | wc -l | tr -d ' ')
  skazat "README.ru: строк отпечатка" "$(grep -oE 'хешированной строке на файл — [0-9]+ строк' README.ru.md | grep -oE '[0-9]+')" "$otp"
  skazat "README: строк отпечатка"    "$(grep -oE 'one hashed line each — [0-9]+ lines' README.md | grep -oE '[0-9]+')" "$otp"

  # Подделок в каталоге — то же число называет сторож ядра.
  pod=$(find flang/test/fixtures -maxdepth 1 -name 'poddelka-*' | wc -l | tr -d ' ')
  skazat "ROADMAP: подделок" "$(plosko ROADMAP.md | grep -oE 'wc -l. отвечает \*\*[0-9]+\*\*' | grep -oE '[0-9]+')" "$pod"
}

# ── Напечатанные команды: работают ли они как напечатаны ─────────────────────
#
# ЗАЧЕМ. Число, которого нельзя воспроизвести командой, публиковать нельзя, — но
# и команда, которая не работает как напечатана, ничем не лучше числа с потолка.
# 29 августа 2026 таких команд в дереве нашлось ТРИДЦАТЬ ПЯТЬ, и одну из них
# читатель встречал на главной странице сайта первым же абзацем.
#
# Ловушка. `--plan` берёт имя плана КАК ЕСТЬ. Ёлочки — способ языка писать имена
# в исходнике, но в командной строке они становятся частью имени, а пробел без
# кавычек оболочки разбивает имя на два довода. Обе половины проверены прогоном:
#
#   flang io ярлыки.flang --plan «Целость»          FLANG_UNKNOWN_PLAN, код 3
#   flang io …kernel-forgeries.flang --plan «Аксиом ноль»
#                                       «непонятный ключ «ноль»»», код 2
#   flang io ярлыки.flang --plan Целость            код 0
#   flang io …kernel-forgeries.flang --plan 'Аксиом ноль'   код 0
#
# ЧТО СПРАШИВАЕТСЯ. Только строки вида `flang io … --plan «…»`, то есть команды,
# а не проза о ключе: «единственный отбор — `--plan «Имя»`» — рассказ об
# устройстве, его трогать незачем.
#
# ЧЕГО СПРАШИВАТЬ НЕЛЬЗЯ, и это не поблажка, а обратная сторона того же правила:
#
#   flang/self/cli.flang, flang/src/emit/**, bootstrap/**  — сама справка
#       двоичного. Она печатает `--plan «Имя»`, показывая ёлочками место под
#       имя. Справка сбивает с толку, и об этом сказано на странице про командную
#       строку, но переписать её можно только перепечаткой семени.
#   docs/javascript-inventory.md — ДОСЛОВНАЯ выписка вывода `flang io --help`.
#       Поправить выписку значило бы соврать о том, что двоичный печатает.
#   docs/site/cli.md, docs/site/cli.ru.md — там ломаная форма показана НАРОЧНО,
#       рядом с рабочей: страница учит именно этой разнице.
#   docs/zettel/flang-io-cannot-be-the-entry-point-for-shortcuts.md — заметка, в
#       которой ловушка и была измерена; она тоже показывает обе формы.
#   этот файл — по той же причине: разбор ловушки стоит десятью строками выше.
komandy() {
  echo "НАПЕЧАТАННЫЕ КОМАНДЫ (работают ли они как напечатаны):"
  git -c core.quotePath=false grep -n -- '--plan «' -- \
      ':!bootstrap' ':!flang/self/cli.flang' ':!flang/src/emit' \
      ':!docs/javascript-inventory.md' ':!docs/site/cli.md' ':!docs/site/cli.ru.md' \
      ':!docs/zettel/flang-io-cannot-be-the-entry-point-for-shortcuts.md' \
      ':!scripts/published-vs-tree.sh' \
    | grep 'flang io ' > "$VREMENNO.kmd" || true

  n=$(wc -l < "$VREMENNO.kmd" | tr -d ' ')
  if [ "$n" = 0 ]; then
    [ -n "${PODROBNO:-}" ] && echo "  ни одной команды с ёлочками в имени плана" || true
  else
    printf '  команд с ёлочками в имени плана: %s — как напечатаны, они ОТКАЗЫВАЮТ\n' "$n"
    sed 's/^/    /' "$VREMENNO.kmd"
    echo "    лечится так: --plan 'Имя плана' — без ёлочек, в кавычках оболочки"
    plohih=$((plohih + n))
  fi
  rm -f "$VREMENNO.kmd"
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
  --команды)  komandy ;;
  --проза)    proza ;;
  --всё)      chisla_sayta; echo; proza; echo; dolya_dokazannogo; echo; perepis; echo; vypusk; echo; karta; echo; komandy ;;
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
