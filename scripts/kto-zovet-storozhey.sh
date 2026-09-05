#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# КАКИХ СТОРОЖЕЙ CI НЕ ЗОВЁТ — поимённо, прибором, а не рукой.
#
#   sh scripts/kto-zovet-storozhey.sh            # перепись целиком
#   sh scripts/kto-zovet-storozhey.sh --check     # сверка с ведомостью, код 1 при расхождении
#   sh scripts/kto-zovet-storozhey.sh --список    # только имена незваных, по одному в строке
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# По дереву весь день ходило число «сторожей 56, CI зовёт 29». ПРИБОРА, который
# его даёт, не было: его считали рукой при каждом упоминании. КРИТЕРИЙ.md
# называет это главной породой беды — число, невоспроизводимое из репозитория,
# не число. Ровно так уже вышло с долей Г5, и прибор тогда пришлось внести в
# дерево нарочно, сломав правило «оснастку не коммитим».
#
# ── Почему это НЕ подстрочный поиск ─────────────────────────────────────────
# Первая попытка считать грепом дала мусор в обе стороны, и обе ошибки стоит
# знать, потому что они не очевидны:
#
#   ЛОЖНЫЙ ЗОВ.  `grep -o 'ярлык [^ ]*'` по workflow-файлам вылавливает прозу
#   из комментариев: «`сторожа:проверка`),» и «тесты`.» попадали в список имён.
#   Хуже того, путь сторожа стоит в фильтре `paths:` — «запускать работу, если
#   этот файл менялся». Это НЕ вызов, а условие запуска, и по нему сторож
#   числился званым, ни разу не будучи позван. Так вышло у `путь:проверка`
#   (install-path.yml:68), `контраст:проверка` (pages.yml:35) и
#   `журнал:проверка` (pages.yml:24). У `контраста` это особенно скверно:
#   правка его файла ЗАПУСКАЕТ работу, которая его не зовёт.
#
#   ЛОЖНАЯ ЗАПИСЬ. В самом `ярлыки.flang` слова «запись «Ярлык» с «имя»
#   равным» встречаются не только в списке, но и внутри блоков `пример`
#   («дано я равно запись «Ярлык» …»). Их четыре, и подстрочный счёт давал
#   115 ярлыков вместо 111, причём «тесты» и «сайт» выглядели заведёнными
#   дважды.
#
# Поэтому здесь: имя ярлыка берётся ТОЛЬКО из записи, стоящей в позиции
# элемента списка; вызов — ТОЛЬКО из значения ключа `run:`, взятого разбором
# YAML, а не строкой. Комментарии внутри `run:` отбрасываются.
#
# ── Два пути зова, и оба нужны ──────────────────────────────────────────────
# Сторожа зовут двумя способами, и считать один из них — недосчитать:
#   ПО ИМЕНИ:  `run: ./ярлык длина:проверка`
#   ПО ФАЙЛУ:  `run: bootstrap/flang io scripts/license-guard.flang`
# Второй способ распространённее: по имени зовут 10 ярлыков, по файлу — 40.
#
# ── Что этот прибор НЕ говорит ──────────────────────────────────────────────
# Он не говорит, что незваный сторож плох или что его надо звать. Часть
# незваных не зовут по названной причине: у `времянки:проверка` прогон не
# сходится (4,9 млрд шагов за 25 минут и продолжает), у троих подлог не
# построен, и сторожу без подлога верить нельзя. Прибор говорит одно: СКОЛЬКО
# их и КТО они. Причина каждого — в ведомости рядом.
#
# ── Ведомость, а не запрет ──────────────────────────────────────────────────
# Незваных два с половиной десятка; правило «незваных быть не должно» красило
# бы CI всегда, а вечно красный сторож — это выключенный сторож. Поэтому
# `--check` сверяет с ведомостью `scripts/storozha-bez-zova.json` В ОБЕ
# СТОРОНЫ, как это уже заведено у сторожа ключей (flang/scripts/cli-keys-debt.json):
#   · незваный, которого в ведомости НЕТ, — красно: появился новый долг;
#   · запись, по которой сторож УЖЕ зовут, — тоже красно: долг закрыт, запись
#     стала неправдой, и убрать её обязан тот, кто долг закрыл.
set -eu

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$KOREN"

VEDOMOST=scripts/storozha-bez-zova.json
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
YARLYK = re.compile(
    r'^\[?\s*запись «Ярлык» с «имя» равным "([^"]+)" и «команда» равным "([^"]*)"')
yarlyki, primerov = {}, 0
for stroka in io.open("ярлыки.flang", encoding="utf-8"):
    sovpalo = YARLYK.match(stroka.strip())
    if sovpalo:
        yarlyki[sovpalo.group(1)] = sovpalo.group(2)
    elif "запись «Ярлык» с «имя» равным" in stroka:
        primerov += 1  # внутри блока «пример» — не ярлык дерева

# ── Команды: только значения ключа run:, взятые разбором YAML ────────────────
def komandy(uzel, kuda):
    if isinstance(uzel, dict):
        for klyuch, znachenie in uzel.items():
            if klyuch == "run" and isinstance(znachenie, str):
                kuda.append(znachenie)
            else:
                komandy(znachenie, kuda)
    elif isinstance(uzel, list):
        for znachenie in uzel:
            komandy(znachenie, kuda)

stroki_komand = []
for fajl in sorted(glob.glob(".github/workflows/*.yml")):
    # Разбор сломанного workflow — не повод падать трассировкой. Молча
    # пропустить его тоже нельзя: сторожа, которых он звал, стали бы «незваными»
    # и сверка покраснела бы, назвав не ту причину.
    try:
        derevo = yaml.safe_load(io.open(fajl, encoding="utf-8"))
    except yaml.YAMLError as beda:
        print(f"{fajl} не разбирается как YAML — перепись неполна и потому"
              f" не считается:\n  {beda}", file=sys.stderr)
        sys.exit(3)
    sobrano = []
    komandy(derevo, sobrano)
    for komanda in sobrano:
        for stroka in komanda.split("\n"):
            if stroka.lstrip().startswith("#"):
                continue                      # комментарий оболочки внутри run:
            stroki_komand.append(
                (os.path.basename(fajl), re.split(r"\s#", stroka, maxsplit=1)[0]))

# ── Два пути зова ───────────────────────────────────────────────────────────
ZOV_PO_IMENI = re.compile(r"\./ярлык\s+([^\s;&|`\"')]+)")
PUT = re.compile(r"[\w./-]+\.(?:flang|mjs|sh|js)")

po_imeni, gde = {}, {}
for fajl, stroka in stroki_komand:
    for sovpalo in ZOV_PO_IMENI.finditer(stroka):
        po_imeni.setdefault(sovpalo.group(1), fajl)

# Путь, УПОМЯНУТЫЙ в строке, — ещё не вызов. Он бывает доводом echo, телом
# heredoc, целью перенаправления `>`. Вызовом он считается, только если перед
# ним стоит запускающий. Список снят с самого дерева: по всем `run:` перед
# путём стоит одно из семи слов, и ни одного случая «путь первым словом» нет.
# Проверено на себе: подлог CI ПИШЕТ путь пустышки внутрь ярлыки.flang, и по
# прежнему правилу пустышка числилась позванной — половина сверки была мертва.
ZAPUSKAYUSCHIE = {"sh", "bash", "io", "node", "python3", "python",
                  "check", "emit", "run", "--test", "--proof"}

po_fajlu = {}
for imya, komanda in yarlyki.items():
    puti = set(PUT.findall(komanda))
    if not puti:
        continue
    nashli = None
    for fajl, stroka in stroki_komand:
        slova = stroka.split()
        for nomer, slovo in enumerate(slova):
            if slovo not in puti:
                continue
            pered = slova[nomer - 1] if nomer else None
            if pered is None or pered in ZAPUSKAYUSCHIE:
                nashli = fajl
                break
        if nashli:
            break
    if nashli:
        po_fajlu[imya] = nashli

for imya in yarlyki:
    if imya in po_imeni:
        gde[imya] = ("по имени", po_imeni[imya])
    elif imya in po_fajlu:
        gde[imya] = ("по файлу", po_fajlu[imya])

storozha = sorted(i for i in yarlyki
                  if i.endswith(":проверка") or i.endswith(":сверка"))
nezvanye = [i for i in storozha if i not in gde]

if rezhim == "--список":
    for imya in nezvanye:
        print(imya)
    sys.exit(0)

if rezhim != "--check":
    print("ПЕРЕПИСЬ СТОРОЖЕЙ: кого CI зовёт, а кого нет\n")
    print(f"  ярлыков заведено в дереве      {len(yarlyki)}")
    print(f"  записей внутри блоков «пример» {primerov}  (не ярлыки, не считаны)")
    print(f"  из ярлыков — сторожа           {len(storozha)}"
          "  (имя оканчивается на :проверка или :сверка)")
    print()
    print(f"  зовёт CI по имени              {len(po_imeni.keys() & yarlyki.keys())}"
          "  (run: ./ярлык ИМЯ)")
    print(f"  зовёт CI по файлу              {len(po_fajlu)}"
          "  (run: … путь/к/сторожу)")
    print()
    print(f"  СТОРОЖЕЙ ЗОВЁТ CI              {len(storozha) - len(nezvanye)}"
          f" из {len(storozha)}")
    print(f"  СТОРОЖЕЙ НЕ ЗОВЁТ              {len(nezvanye)}")
    print("\nНЕЗВАНЫЕ, поимённо:\n")
    prichiny = {}
    if os.path.exists(vedomost):
        prichiny = {k: v for k, v in json.load(io.open(vedomost, encoding="utf-8")).items()
                    if not k.startswith("//")}
    for imya in nezvanye:
        prichina = prichiny.get(imya, "причина в ведомости не названа")
        print(f"  {imya:28} {prichina[:88]}")
    print("\nСверка с ведомостью — тем же прибором:"
          "\n  sh scripts/kto-zovet-storozhey.sh --check")
    sys.exit(0)

# ── Сверка с ведомостью в обе стороны ───────────────────────────────────────
if not os.path.exists(vedomost):
    print(f"ведомости {vedomost} нет — сверять не с чем", file=sys.stderr)
    sys.exit(3)

zapisano = json.load(io.open(vedomost, encoding="utf-8"))
zapisano = {k: v for k, v in zapisano.items() if not k.startswith("//")}

novye = [i for i in nezvanye if i not in zapisano]           # долг вырос
zakrytye = [i for i in zapisano if i not in nezvanye]        # долг закрыт

if not novye and not zakrytye:
    print(f"сторожа без зова: {len(nezvanye)}, все названы в ведомости — сходится")
    sys.exit(0)

for imya in sorted(novye):
    print(f"НОВЫЙ НЕЗВАНЫЙ: «{imya}» заведён, но ни один workflow его не зовёт,"
          f" и в {vedomost} его нет.", file=sys.stderr)
    print("  Либо позвать его из CI, либо записать в ведомость с причиной.",
          file=sys.stderr)
for imya in sorted(zakrytye):
    poyasnenie = "по имени" if imya in po_imeni else (
        "по файлу" if imya in po_fajlu else "уже не заведён")
    print(f"ЗАПИСЬ СТАЛА НЕПРАВДОЙ: «{imya}» числится незваным,"
          f" а CI его зовёт ({poyasnenie}).", file=sys.stderr)
    print(f"  Долг закрыт — убрать запись из {vedomost} обязан тот, кто закрыл.",
          file=sys.stderr)
sys.exit(1)
PY
