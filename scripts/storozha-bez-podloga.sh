#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# У КАКИХ СТОРОЖЕЙ НЕТ ПРОБЫ ПОРЧИ — поимённо, прибором, а не рукой.
#
#   sh scripts/storozha-bez-podloga.sh            # перепись целиком
#   sh scripts/storozha-bez-podloga.sh --check     # сверка с ведомостью, код 1 при расхождении
#   sh scripts/storozha-bez-podloga.sh --список    # только имена беспробных, по одному в строке
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# СТОРОЖ, КОТОРОГО НЕЛЬЗЯ ПОКРАСИТЬ, НЕОТЛИЧИМ ОТ ВЫКЛЮЧЕННОГО. За одни сутки
# 5 сентября 2026 эта порода поймана четыре раза, и ни разу прибором — всякий
# раз случайно:
#
#   · `слова:проверка` ПРОВЕРЯЛ ПУСТОТУ. Подделку, на которой он стоит,
#     заменили тривиальным модулем без единого занятого слова — сторож остался
#     зелёным и написал «занятые слова экранированы (8 из 8)». Раздел 1 не
#     делал ничего, и сказать об этом было некому (задача 3223).
#   · Шесть проверок чекера (`сверщик.c:1199`) НЕ ОТРАБАТЫВАЛИ НИ РАЗУ: они
#     читают исходник по привязке `пример строка N`, а записи корпуса её не
#     несут — напечатаны двоичным постарше (задача 8690).
#   · Проба под правило 9999 ЛЕЖАЛА В ДЕРЕВЕ, а `прогон.sh` её не звал —
#     сторож без зовущего (задача 9999).
#   · Две пробы порчи у разных работников НЕ СОБРАЛИСЬ: правка не изменила
#     файл, сторож честно остался зелёным, и заметно это было только по тому,
#     что числа не сдвинулись (задачи 7855, 9751).
#
# Общее у всех четырёх — беспроверочная вера в то, что проверка работает.
# Прибор `kto-zovet-storozhey.sh` отвечает на вопрос «кого CI зовёт»; этот
# отвечает на второй, без которого первый мало стоит: «а показано ли, что
# позванный вообще способен покраснеть».
#
# ── Что считается пробой порчи ──────────────────────────────────────────────
# Проба — это то, что ЛОМАЕТ проверяемое и требует, чтобы сторож на этом
# покраснел. В дереве проба бывает ПОСТРОЕНА и отдельно — ПОЗВАНА, и путать
# эти два состояния нельзя: построенная, но никем не званная проба не
# срабатывает никогда, ровно как сторож без зовущего.
#
#   ПРОБА ПОСТРОЕНА — в дереве есть парный ярлык `X:подлог` или `X:порча`
#     рядом со сторожем `X:проверка`:
#         "коды:проверка"  … error-code-guard.flang --plan 'Коды целы'
#         "коды:подлог"    … error-code-guard.flang --plan 'Подлог кода'
#     Такой ярлык портит вход изнутри сторожа: он не зависит от номеров строк
#     и портит ровно то, что сторож смотрит. Лучший вид пробы.
#
#   ПРОБА ПОЗВАНА — в теле `run:` какого-нибудь workflow стоит вызов сторожа
#     В УСЛОВИИ `if`, и в том же теле есть `exit 1`:
#         if sh scripts/seed-knows-type-words-guard.sh --подлог; then exit 1; fi
#     либо, для внешней порчи, — с правкой файла и откатом:
#         sed -i '5s/|[0-9]*$/|9999/' "$podlog"
#         if ./ярлык доказанное:проверка; then git checkout -- "$podlog"; exit 1; fi
#     Признак один и тот же и от вида порчи не зависит: шаг падает ровно
#     тогда, когда сторож промолчал.
#
# Прибор считает оба и печатает раздельно. В долг («без пробы») попадает тот,
# у кого НЕТ НИ ОДНОГО из двух.
#
# ── Чего этот прибор НЕ говорит ─────────────────────────────────────────────
# Он НЕ говорит, что проба хороша. Проба бывает холостой: правка не собралась
# (строка съехала — `sed` смолчал), или испорчено не то, что сторож смотрит.
# Такую пробу прибор считает существующей, потому что отличить её от рабочей
# он не может — для этого надо прогнать сторожа с порчей и без. Это делает
# сама проба в CI; здесь считается только ЕЁ НАЛИЧИЕ.
#
# Отсюда же ловушка, о которой стоит знать: внешняя проба прибита к НОМЕРУ
# СТРОКИ. Съедет строка — `sed` смолчит, файл останется цел, сторож честно
# останется зелёным, и шаг покраснеет со словами «сторож промолчал», хотя
# виноват подлог. Поэтому у внешних проб в `ci.yml` стоит отдельная защита
# «ПОДЛОГ НЕ СОБРАЛСЯ» (сравнение файла до и после правки), и всякая новая
# внешняя проба обязана её нести. Прибор наличие этой защиты НЕ проверяет —
# это работа для следующего.
#
# ── Ведомость, а не запрет ──────────────────────────────────────────────────
# Беспробных сторожей больше половины; правило «беспробных быть не должно»
# красило бы CI всегда, а вечно красный сторож — это выключенный сторож.
# Поэтому `--check` сверяет с ведомостью `scripts/storozha-bez-podloga.json`
# В ОБЕ СТОРОНЫ, как заведено у сторожа ключей (flang/scripts/cli-keys-debt.json)
# и у переписи зова (scripts/storozha-bez-zova.json):
#   · беспробный, которого в ведомости НЕТ, — красно: появился новый долг;
#   · запись, у которой проба УЖЕ есть, — тоже красно: долг закрыт, запись
#     стала неправдой, и убрать её обязан тот, кто долг закрыл.
set -eu

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$KOREN"

VEDOMOST=scripts/storozha-bez-podloga.json
REZHIM=${1:-}

LC_ALL=C.UTF-8 python3 - "$REZHIM" "$VEDOMOST" <<'PY'
import glob, io, json, os, re, sys

rezhim, vedomost = sys.argv[1], sys.argv[2]

try:
    import yaml
except ImportError:
    print("нет модуля yaml — поставить: pip install pyyaml", file=sys.stderr)
    sys.exit(3)

# ── Имена ярлыков: только записи в позиции элемента списка ───────────────────
# Правило то же, что в scripts/kto-zovet-storozhey.sh, и по той же причине:
# в самом ярлыки.flang слова «запись «Ярлык» с «имя» равным» встречаются ещё и
# внутри блоков «пример», и подстрочный счёт даёт лишние имена.
YARLYK = re.compile(
    r'^\[?\s*запись «Ярлык» с «имя» равным "([^"]+)" и «команда» равным "([^"]*)"')
yarlyki = {}
for stroka in io.open("ярлыки.flang", encoding="utf-8"):
    sovpalo = YARLYK.match(stroka.strip())
    if sovpalo:
        yarlyki[sovpalo.group(1)] = sovpalo.group(2)

storozha = sorted(i for i in yarlyki
                  if i.endswith(":проверка") or i.endswith(":сверка"))

# ── Тела `run:` целиком, а не построчно ─────────────────────────────────────
# Проба — конструкция из нескольких строк: порча, условие, откат. Резать её на
# строки значит потерять связь между вызовом и `exit 1`.
def tela_run(uzel, kuda):
    if isinstance(uzel, dict):
        for klyuch, znachenie in uzel.items():
            if klyuch == "run" and isinstance(znachenie, str):
                kuda.append(znachenie)
            else:
                tela_run(znachenie, kuda)
    elif isinstance(uzel, list):
        for znachenie in uzel:
            tela_run(znachenie, kuda)

tela = []
for fajl in sorted(glob.glob(".github/workflows/*.yml")):
    # Сломанный workflow — не повод падать трассировкой, но и молча пропустить
    # его нельзя: сторожа, чьи пробы он держит, стали бы «беспробными», и
    # сверка покраснела бы, назвав не ту причину.
    try:
        derevo = yaml.safe_load(io.open(fajl, encoding="utf-8"))
    except yaml.YAMLError as beda:
        print(f"{fajl} не разбирается как YAML — перепись неполна и потому"
              f" не считается:\n  {beda}", file=sys.stderr)
        sys.exit(3)
    sobrano = []
    tela_run(derevo, sobrano)
    for telo in sobrano:
        tela.append((os.path.basename(fajl), telo))

# ── Признак пробы: вызов в условии `if`, и в том же теле `exit 1` ───────────
ZOV_PO_IMENI = re.compile(r"\./ярлык\s+([^\s;&|`\"')]+)")
PUT = re.compile(r"[\w./-]+\.(?:flang|mjs|sh|js)")
# Список запускающих снят с дерева тем же способом, что в переписи зова: путь,
# УПОМЯНУТЫЙ в строке, ещё не вызов — он бывает доводом echo, телом heredoc,
# целью перенаправления. Вызовом он считается, только если перед ним стоит
# запускающий.
ZAPUSKAYUSCHIE = {"sh", "bash", "io", "node", "python3", "python",
                  "check", "emit", "run", "--test", "--proof"}

def zovy_v_stroke(stroka, puti_storozhey):
    """Имена сторожей, которых зовёт эта строка — по имени и по файлу."""
    nashli = set()
    for sovpalo in ZOV_PO_IMENI.finditer(stroka):
        if sovpalo.group(1) in puti_storozhey["po_imeni"]:
            nashli.add(sovpalo.group(1))
    slova = stroka.split()
    for nomer, slovo in enumerate(slova):
        slovo = slovo.strip("\"'`();&|")
        if slovo not in puti_storozhey["po_fajlu"]:
            continue
        pered = slova[nomer - 1].strip("\"'`();&|") if nomer else None
        if pered is None or pered in ZAPUSKAYUSCHIE:
            nashli.update(puti_storozhey["po_fajlu"][slovo])
    return nashli

# Разложение «путь файла → какие сторожа за ним стоят». Один файл бывает за
# двумя ярлыками (у сторожа с ключом и без), поэтому значение — множество.
po_imeni = set(storozha)
po_fajlu = {}
for imya in storozha:
    for put in PUT.findall(yarlyki[imya]):
        po_fajlu.setdefault(put, set()).add(imya)
puti = {"po_imeni": po_imeni, "po_fajlu": po_fajlu}

s_proboj, gde_proba = {}, {}
for fajl, telo in tela:
    if "exit 1" not in telo:
        continue                      # шаг не падает — требования покраснеть нет
    for stroka in telo.split("\n"):
        golaya = stroka.strip()
        if golaya.startswith("#"):
            continue                  # комментарий оболочки
        # Вызов обязан стоять В УСЛОВИИ: `if <вызов>; then … exit 1`.
        # Голый вызов в теле шага — это рабочий прогон, а не проба.
        if not (golaya.startswith("if ") or golaya.startswith("elif ")):
            continue
        for imya in zovy_v_stroke(golaya, puti):
            s_proboj.setdefault(imya, (fajl, golaya[:70]))

# ── Проба, ПОСТРОЕННАЯ ярлыком: `X:подлог` или `X:порча` рядом с `X:проверка` ─
# Приставка берётся отбрасыванием последней доли имени: у «коды:проверка» это
# «коды», у «семя:слова:проверка» было бы «семя:слова». Так парность видна и у
# составных имён.
postroena = {}
for imya in storozha:
    pristavka = imya.rsplit(":", 1)[0]
    for hvost in ("подлог", "порча"):
        parnyj = f"{pristavka}:{hvost}"
        if parnyj in yarlyki:
            postroena[imya] = parnyj
            break

# ── Долг: у кого проба НЕ ПОКАЗАНА ──────────────────────────────────────────
# Задача 1389 говорит «ПОКАЗАНО, что он краснеет». Показывает прогон, а не
# наличие: построенная, но никем не званная проба не срабатывает никогда и
# показывает ровно столько же, сколько её отсутствие. Поэтому в долг идут оба
# рода, а построенность отмечается причиной — она говорит, что доделать дёшево.
bez_proby = [i for i in storozha if i not in s_proboj]

if rezhim == "--список":
    for imya in bez_proby:
        print(imya)
    sys.exit(0)

if rezhim != "--check":
    prichiny = {}
    if os.path.exists(vedomost):
        prichiny = {k: v for k, v in json.load(io.open(vedomost, encoding="utf-8")).items()
                    if not k.startswith("//")}
    tolko_postroena = sorted(i for i in postroena if i not in s_proboj)
    print("ПЕРЕПИСЬ ПРОБ ПОРЧИ: у кого показано, что он краснеет\n")
    print(f"  сторожей в дереве              {len(storozha)}")
    print(f"  ПРОБА ПОЗВАНА (CI требует красноты)   {len(s_proboj)}")
    print(f"  проба построена, но НЕ позвана        {len(tolko_postroena)}")
    print(f"  ПРОБА НЕ ПОКАЗАНА (долг)              {len(bez_proby)}")
    print("\nПРОБА ПОЗВАНА, и где стоит:\n")
    for imya in sorted(s_proboj):
        fajl, stroka = s_proboj[imya]
        istochnik = postroena.get(imya, "порча внешняя, в самом шаге")
        print(f"  {imya:30} {fajl:12} {istochnik}")
    if tolko_postroena:
        print("\nПРОБА ПОСТРОЕНА, НО НИКТО ЕЁ НЕ ЗОВЁТ"
              " — она не срабатывает никогда:\n")
        for imya in tolko_postroena:
            print(f"  {imya:30} ярлык {postroena[imya]}")
    print("\nДОЛГ — проба не показана, поимённо:\n")
    for imya in bez_proby:
        prichina = prichiny.get(imya, "причина в ведомости не названа")
        if imya in postroena:
            prichina = f"проба ПОСТРОЕНА ярлыком {postroena[imya]}, но её не зовут"
        print(f"  {imya:30} {prichina[:80]}")
    print("\nСверка с ведомостью — тем же прибором:"
          "\n  sh scripts/storozha-bez-podloga.sh --check")
    sys.exit(0)

# ── Сверка с ведомостью в обе стороны ───────────────────────────────────────
if not os.path.exists(vedomost):
    print(f"ведомости {vedomost} нет — сверять не с чем", file=sys.stderr)
    sys.exit(3)

zapisano = json.load(io.open(vedomost, encoding="utf-8"))
zapisano = {k: v for k, v in zapisano.items() if not k.startswith("//")}

novye = [i for i in bez_proby if i not in zapisano]        # долг вырос
zakrytye = [i for i in zapisano if i not in bez_proby]     # долг закрыт

if not novye and not zakrytye:
    print(f"сторожа без пробы порчи: {len(bez_proby)},"
          " все названы в ведомости — сходится")
    sys.exit(0)

for imya in sorted(novye):
    print(f"НОВЫЙ БЕЗ ПРОБЫ: «{imya}» заведён, но ни один шаг CI не требует,"
          f" чтобы он покраснел на порче, и в {vedomost} его нет.", file=sys.stderr)
    print("  Либо построить пробу, либо записать в ведомость с причиной:"
          " сторож без пробы неотличим от выключенного.", file=sys.stderr)
for imya in sorted(zakrytye):
    if imya in s_proboj:
        fajl, _ = s_proboj[imya]
        poyasnenie = f"проба стоит в {fajl}"
    else:
        poyasnenie = "ярлык уже не заведён"
    print(f"ЗАПИСЬ СТАЛА НЕПРАВДОЙ: «{imya}» числится беспробным,"
          f" а {poyasnenie}.", file=sys.stderr)
    print(f"  Долг закрыт — убрать запись из {vedomost} обязан тот, кто закрыл.",
          file=sys.stderr)
sys.exit(1)
PY
