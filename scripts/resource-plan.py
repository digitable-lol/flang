#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ресурсный план: пропускная способность кластера и цена работы — по истории.

Плана здесь нет ни одного вписанного руками числа. Всё, что печатается,
снимается прогоном в минуту вызова:

  * скорость и цена — из `git log` ствола;
  * потери — из веток приёмной, журнала отказов и книги долей;
  * силы — из ворот (`flang-vorota --schet`) или из ключей.

Зачем отдельной программой, а не текстом. Числа стареют за сутки: за 30 августа
ствол принял 48 веток, и любой вписанный руками итог к вечеру уже неверен.
Владельцу нужно сказать «у меня сейчас столько-то исполнителей и такой-то
предел памяти» и получить пересчёт, а не править таблицу.

Звать:

    python3 scripts/resource-plan.py                       # как есть сейчас
    python3 scripts/resource-plan.py --agents 24           # «а если 24?»
    python3 scripts/resource-plan.py --tasks-left 60       # счёт даёт ROADMAP
    python3 scripts/resource-plan.py --out docs/resource-plan.md

Чего программа НЕ делает: не судит о частях цели и не читает ROADMAP.md.
Сколько работы осталось — число со стороны (`--tasks-left`); программа отвечает
только на «почём одна штука и сколько их выходит в сутки».
"""

import argparse
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

# ── откуда читаем ────────────────────────────────────────────────────────────
DOM = "/srv/priyom"                     # приёмная
GOLYY = "/srv/flang-priyom.git"         # голый склад веток
VOROTA = "/srv/flang-rabota/vorota/flang-vorota"

# Свод пишет заголовок слияния одним из двух способов: до 23 августа своими
# словами, после — «влита <ветка>». Оба разбираем, иначе половина истории
# пропадёт молча.
RE_SVOD = re.compile(r"^chore\(svod\): влита (\S+) — ")
RE_MERGE = re.compile(r"^Слияние ветки (\S+) в main$")


def run(args, cwd=None, ok=(0,)):
    """Позвать программу и вернуть её вывод. Молчание не выдаём за пустоту."""
    # Байты, а не текст: ворота режут чужие командные строки по символам и
    # могут оборвать букву посередине. Падать из-за этого нельзя — считаем
    # такой обрыв порчей одного символа, а не отказом измерителя.
    try:
        p = subprocess.run(args, cwd=cwd, capture_output=True, timeout=300)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, str(e)
    out = p.stdout.decode("utf-8", "replace")
    err = p.stderr.decode("utf-8", "replace")
    if p.returncode not in ok:
        return None, err.strip()[:400]
    return out, None


def kod(args):
    """Только код возврата. Нужен там, где ответ — да/нет, а не текст."""
    try:
        p = subprocess.run(args, capture_output=True, timeout=300)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return p.returncode


def git(repo, *args, ok=(0,)):
    out, err = run(["git", "-C", repo, *args], ok=ok)
    return out


def iso(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def kvantili(v):
    """Медиана и хвост. Хвост важнее: он показывает, на чём кластер застревает."""
    v = sorted(v)
    n = len(v)
    if not n:
        return None
    at = lambda f: v[min(n - 1, int(f * n))]
    return dict(n=n, med=statistics.median(v), p75=at(.75), p90=at(.90),
                p95=at(.95), p99=at(.99), max=v[-1], sum=sum(v))


# ── 1. что ствол принял ──────────────────────────────────────────────────────
def sobrat_vlivaniya(repo, since):
    """Каждое вливание ветки в ствол: когда, чья, что принесла, когда начата.

    «Когда начата» — время САМОГО РАННЕГО коммита ветки, а не время долей:
    книга долей покрывает считанные проценты веток (см. poteri()). Это нижняя
    оценка: она не видит часов до первого коммита.
    """
    fmt = "C|%H|%aI|%P|%s"
    out = git(repo, "log", f"--since={since}", "--diff-merges=first-parent",
              "--name-only", f"--format={fmt}")
    if out is None:
        sys.exit("git log не прошёл — считать нечего")

    vliv, tek = [], None
    for line in out.splitlines():
        if line.startswith("C|"):
            _, sha, ts, parents, subj = line.split("|", 4)
            m = RE_SVOD.match(subj) or RE_MERGE.match(subj)
            tek = None
            if m:
                tek = dict(sha=sha, ts=ts, roditeli=parents.split(),
                           vetka=m.group(1), fajly=[])
                vliv.append(tek)
        elif line and tek is not None:
            tek["fajly"].append(line)

    # Самый ранний коммит ветки — по разнице с первым родителем.
    for v in vliv:
        p = v["roditeli"]
        rng = [f"{p[0]}..{p[1]}"] if len(p) >= 2 else ["-1", v["sha"]]
        d = git(repo, "log", "--format=%aI", *rng)
        d = sorted((d or "").split())
        v["kommitov"] = len(d)
        v["nachalo"] = d[0] if d else v["ts"]
        v["chas"] = (iso(v["ts"]) - iso(v["nachalo"])).total_seconds() / 3600
        v["kto"] = v["vetka"].split("/")[0]
        v["den"] = v["ts"][:10]
        v["semya"] = any(f.startswith("flang/self/") for f in v["fajly"])
    return vliv


# ── 2. что задачник закрыл ───────────────────────────────────────────────────
def zadachi(repo, since):
    """Переходы статуса в tasks/, по diff-у шапки, а не по тексту заголовков.

    Считаем ТОЛЬКО настоящий переход: строка `-статус: …` и `+статус: сделана`
    в одном и том же файле. Задача, заведённая сразу закрытой, — не работа
    смены, и в скорость её класть нельзя.
    """
    out = git(repo, "log", f"--since={since}", "--date=short",
              "--pretty=format:C|%ad", "-p", "--unified=0", "--", "tasks/")
    zakryto, vzyato, zavedeno_gotovoj, otkryto_zanovo = Counter(), Counter(), Counter(), Counter()
    den = None
    bylo = None
    for line in (out or "").splitlines():
        if line.startswith("C|"):
            den = line[2:]
            bylo = None
        elif line.startswith("+++ b/"):
            bylo = None
        elif line.startswith("-статус:"):
            bylo = line.split(":", 1)[1].strip()
        elif line.startswith("+статус:"):
            stalo = line.split(":", 1)[1].strip()
            if stalo == "сделана":
                (zakryto if bylo else zavedeno_gotovoj)[den] += 1
            elif stalo == "в работе":
                vzyato[den] += 1
            if bylo == "сделана" and stalo != "сделана":
                otkryto_zanovo[den] += 1
            bylo = None
    return dict(zakryto=zakryto, vzyato=vzyato,
                zavedeno_gotovoj=zavedeno_gotovoj, otkryto_zanovo=otkryto_zanovo)


def zadachnik_seychas(repo):
    """Сколько задач какого статуса лежит в дереве ПРЯМО СЕЙЧАС.

    Читаем шапки файлов, а не зовём `задачник:проверка`: он падает с кодом 3 на
    пределе глубины вызовов и на чистом дереве (см. tasks/2469). Инструмент,
    который не отвечает, в счёт брать нельзя.
    """
    d = os.path.join(repo, "tasks")
    s = Counter()
    if not os.path.isdir(d):
        return s
    for f in sorted(os.listdir(d)):
        if not f.endswith(".md") or f == "README.md":
            continue
        try:
            t = open(os.path.join(d, f), encoding="utf-8").read(4000)
        except OSError:
            continue
        m = re.search(r"^статус:\s*(.+)$", t, re.M)
        s[m.group(1).strip() if m else "БЕЗ СТАТУСА"] += 1
    return s


# ── 3. потери ────────────────────────────────────────────────────────────────
def poteri(repo, vliv, teper):
    """Работа, которая сделана и не доехала.

    Три разных потери, и путать их нельзя:
      * ветка лежит в приёмной и в ствол не вошла;
      * ветку не пустили на входе (журнал отказов);
      * двое правили один файл в одни сутки.
    """
    p = {}

    # 3.1 ветки, до ствола не дошедшие
    golova = git(GOLYY, "for-each-ref", "--format=%(refname:short)\t%(objectname)\t%(committerdate:iso-strict)",
                 "refs/heads/")
    stvol = git(GOLYY, "rev-parse", "refs/heads/main")
    lezhat = []
    if golova and stvol:
        stvol = stvol.strip()
        for line in golova.splitlines():
            br, sha, ts = line.split("\t")
            if br == "main" or br.startswith("rezerv/"):
                continue
            # Код 0 — ветка уже в стволе, 1 — нет. Ошибку (None) за «нет» не
            # выдаём: неотвеченный вопрос это не отрицательный ответ.
            k = kod(["git", "-C", GOLYY, "merge-base", "--is-ancestor", sha, stvol])
            if k == 1:
                n = git(GOLYY, "rev-list", "--count", f"{stvol}..{sha}")
                lezhat.append(dict(vetka=br, ts=ts, kommitov=int((n or "0").strip() or 0)))
    # Свежее часа — это не потеря, а работа в руках.
    porog = teper - timedelta(hours=1)
    p["lezhat"] = [x for x in lezhat if iso(x["ts"]) < porog]
    p["v_rukah"] = [x for x in lezhat if iso(x["ts"]) >= porog]

    # 3.2 отказы на входе
    otkazy = []
    try:
        for line in open(os.path.join(DOM, "refused.log"), encoding="utf-8"):
            f = line.rstrip("\n").split("\t")
            if len(f) >= 4:
                otkazy.append(dict(ts=f[0], kto=f[1], vetka=f[2], prichina=f[3]))
    except OSError:
        pass
    p["otkazy"] = otkazy

    # 3.3 книга долей: чем она покрыта
    doli = defaultdict(list)
    try:
        for line in open(os.path.join(DOM, "claims.tsv"), encoding="utf-8"):
            f = line.rstrip("\n").split("\t")
            if len(f) >= 4:
                doli[f[2]].append(f[0])
    except OSError:
        pass
    vetki = {v["vetka"] for v in vliv}
    p["vlitye_imena"] = vetki
    p["doli_vsego"] = len(doli)
    p["doli_sovpalo"] = len(set(doli) & vetki)
    p["vetok_vlito"] = len(vetki)

    # 3.4 столкновения: две ветки правили один файл и слились в одни сутки
    svod = defaultdict(lambda: dict(f=set(), ts=None))
    for v in vliv:
        s = svod[v["vetka"]]
        s["f"].update(v["fajly"])
        t = iso(v["ts"])
        if s["ts"] is None or t < s["ts"]:
            s["ts"] = t
    fajl_vetki = defaultdict(list)
    for br, s in svod.items():
        for f in s["f"]:
            fajl_vetki[f].append(br)
    pary = Counter()
    for f, bs in fajl_vetki.items():
        if len(bs) < 2:
            continue
        for i in range(len(bs)):
            for j in range(i + 1, len(bs)):
                a, b = sorted((bs[i], bs[j]))
                if abs((svod[a]["ts"] - svod[b]["ts"]).total_seconds()) <= 86400:
                    pary[(a, b)] += 1
    zadety = {x for k in pary for x in k}
    p["par_stolknovenij"] = len(pary)
    p["vetok_v_stolknovenii"] = len(zadety)
    p["vetok_vsego"] = len(svod)
    p["hudshie_pary"] = sorted(pary.items(), key=lambda x: -x[1])[:8]

    # 3.5 переделка: ветка с числовым хвостом при живом основании
    imena = set(svod) | {x["vetka"] for x in lezhat}
    hvost = re.compile(r"^(.*?)-(\d{1,2})$")
    peredelka = []
    for n in imena:
        m = hvost.match(n)
        if m and m.group(1) in imena and m.group(1) not in vetki:
            # основание в ствол не вошло, а его продолжение — вошло: это второй заход
            peredelka.append((m.group(1), n))
    p["peredelka"] = sorted(peredelka)
    return p


# ── 3б. смерти исполнителей ──────────────────────────────────────────────────
# Записи о прогоне исполнителя на машине НЕТ (см. раздел 7). Единственный след
# смерти по пределу времени сессии — стенограмма самого исполнителя. Читаем
# ПОСЛЕДНЮЮ запись каждой стенограммы: у убитого там `"error":"rate_limit"` и
# подставной ответ, у доработавшего — его собственный текст.
#
# Считаем не головы, а ЧАСЫ. 30 августа умерло больше всех исполнителей и
# пропало меньше всех времени: они были молодые. Счёт по головам обманывает.
STENOGRAMMY = "/home/m/.claude/projects/-home-m"


def smerti(koren=STENOGRAMMY, razryv_min=30):
    import glob
    mertvye = []
    zhivyh = 0
    for f in glob.glob(os.path.join(koren, "*", "subagents", "agent-*.jsonl")):
        try:
            with open(f, "rb") as fh:
                fh.seek(0, 2)
                sz = fh.tell()
                fh.seek(max(0, sz - 8000))
                hvost = fh.read().decode("utf-8", "replace").strip().splitlines()
            if not hvost:
                continue
            posl = hvost[-1]
            if '"error":"rate_limit"' not in posl:
                zhivyh += 1
                continue
            r = json.loads(posl)
            nachalo = None
            with open(f, encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    try:
                        nachalo = json.loads(line).get("timestamp")
                        break
                    except ValueError:
                        continue
            if not (nachalo and r.get("timestamp")):
                continue
            # В первой записи стенограммы стоит задание исполнителю, и в нём
            # иногда названа ветка. Это единственная ниточка от умершего
            # исполнителя к работе, которую он вёл.
            vetka = None
            try:
                with open(f, encoding="utf-8", errors="replace") as fh:
                    m = re.search(r"ВЕТКА:\s*([A-Za-z0-9/_.-]+)", fh.readline())
                if m:
                    vetka = m.group(1)
            except OSError:
                pass
            mertvye.append(dict(nachalo=nachalo, konec=r["timestamp"], vetka=vetka,
                                chas=(iso(r["timestamp"]) - iso(nachalo)).total_seconds() / 3600))
        except (OSError, ValueError, IndexError):
            continue
    if not mertvye:
        return dict(est=False, vsego=0, chasov=0.0, sobytiya=[], stenogramm=zhivyh)
    mertvye.sort(key=lambda x: x["konec"])
    sob, tek = [], []
    for d in mertvye:
        if tek and (iso(d["konec"]) - iso(tek[-1]["konec"])).total_seconds() > razryv_min * 60:
            sob.append(tek)
            tek = []
        tek.append(d)
    if tek:
        sob.append(tek)
    return dict(est=True, vsego=len(mertvye), stenogramm=zhivyh + len(mertvye),
                chasov=sum(d["chas"] for d in mertvye),
                s_vetkoj=[d["vetka"] for d in mertvye if d["vetka"]],
                sobytiya=[dict(ot=e[0]["konec"], do=e[-1]["konec"], skolko=len(e),
                               chasov=sum(x["chas"] for x in e),
                               dolgozhitel=max(x["chas"] for x in e)) for e in sob])


# ── 4. силы ──────────────────────────────────────────────────────────────────
def sily(pamyat_gib, na_progon_gib, mest):
    """Сколько тяжёлых прогонов помещается разом.

    Спрашиваем ворота. Не ответили — берём ключи. Не дали ключей — говорим, что
    не знаем, и НЕ подставляем «наверное». Молчание измерителя — это молчание,
    а не «свободно всё» (та же ошибка стоила воротам раздачи мест вслепую).
    """
    z = dict(istochnik="ключи", pamyat_gib=pamyat_gib, na_progon_gib=na_progon_gib,
             mest=mest, zanyato=None, progonov=None, mimo_vorot=None)
    if pamyat_gib is None and os.access(VOROTA, os.X_OK):
        out, _ = run([VOROTA, "--schet"])
        if out:
            z["istochnik"] = "ворота"
            m = re.search(r"роздано (\d+) ГиБ из (\d+)", out)
            if m:
                z["zanyato"] = int(m.group(1))
                z["pamyat_gib"] = int(m.group(2))
            m = re.search(r"мест в пуле (\d+), занято (\d+)", out)
            if m:
                z["mest"] = int(m.group(1))
                z["mest_zanyato"] = int(m.group(2))
            m = re.search(r"при пределе (\d+)G", out)
            if m:
                z["na_progon_gib"] = int(m.group(1))
            m = re.search(r"прогонов \S+ на машине: (\d+)", out)
            if m:
                z["progonov"] = int(m.group(1))
    if z["pamyat_gib"] is None:
        z["veer"] = None
        return z
    if z["na_progon_gib"] is None:
        z["na_progon_gib"] = na_progon_gib or 40
    z["veer"] = z["pamyat_gib"] // z["na_progon_gib"]
    # Ворота считают только тех, кто зашёл через них. 27 августа из 87 прогонов
    # 43 шли мимо — счёт мест меньше настоящей нагрузки, и это надо сказать.
    if z["progonov"] is not None and z.get("mest_zanyato") is not None:
        z["mimo_vorot"] = max(0, z["progonov"] - z["mest_zanyato"])
    return z


# ── печать ───────────────────────────────────────────────────────────────────
def chislo(x, z=1):
    return f"{x:.{z}f}".replace(".", ",")


def skl(n, odna, dve, mnogo):
    """Согласовать существительное с целым числом: 1 ветка, 2 ветки, 5 веток."""
    n = abs(int(n))
    if n % 100 // 10 == 1:
        return mnogo
    return {1: odna, 2: dve, 3: dve, 4: dve}.get(n % 10, mnogo)


def postroit(a):
    repo = a.repo
    teper = datetime.now(timezone.utc)
    since = a.since

    vliv = sobrat_vlivaniya(repo, since)
    if not vliv:
        sys.exit(f"с {since} ствол не принял ни одной ветки — окно пустое, считать нечего")
    z = zadachi(repo, since)
    seychas = zadachnik_seychas(repo)
    p = poteri(repo, vliv, teper)
    sm = smerti()
    s_sily = sily(a.memory_gib, a.run_memory_gib, a.slots)

    dni = sorted({v["den"] for v in vliv})
    vsego = len(vliv)
    sut = len(dni)
    lezh = p["lezhat"]
    n_s = sum(1 for v in vliv if v["semya"])
    # Исполнитель — приставка из одной буквы: это учётная запись на машине.
    # Всё прочее (`docs/…`, `proba/…`) — ветки старого порядка, до соглашения
    # об именах; в счёт по исполнителям их класть нельзя, но из общего итога
    # выбрасывать тоже: работа была.
    schet = Counter(v["kto"] for v in vliv)
    ispolniteli = [k for k, _ in schet.most_common() if len(k) == 1]
    prochee = sum(c for k, c in schet.items() if len(k) != 1)

    # ветка-сутки: сколько разных веток получали коммиты в этот день
    aktivnye = defaultdict(set)
    for v in vliv:
        aktivnye[v["ts"][:10]].add(v["vetka"])
    # ветка «активна» в день своего первого коммита и в день слияния
    for v in vliv:
        aktivnye[v["nachalo"][:10]].add(v["vetka"])

    L = []
    W = L.append
    W("# Ресурсный план: чего стоит работа и сколько её влезает")
    W("")
    W(f"Снято прогоном `python3 scripts/resource-plan.py` "
      f"{teper.strftime('%Y-%m-%d %H:%M')} UTC. Окно — с {since}.")
    W("")
    W("**Руками этот файл не правят.** Числа стареют за сутки; чтобы получить")
    W("сегодняшние, позовите программу заново. Чтобы спросить «а если сил")
    W("будет столько-то» — позовите её с ключами (внизу, раздел «Пересчёт»).")
    W("")
    W("## Коротко")
    W("")
    k0 = kvantili([v["chas"] for v in vliv])
    lezh0 = p["lezhat"]
    W(f"* ствол принимает **{chislo(vsego/sut)} ветки в сутки**; задачник закрывает "
      f"**{chislo(sum(z['zakryto'].values())/max(1,len(z['zakryto'])),1)} задачи в сутки**, "
      f"а берёт {chislo(sum(z['vzyato'].values())/max(1,len(z['vzyato'])),1)};")
    W(f"* цена ветки: медиана **{chislo(k0['med'],2)} ч**, но десятая часть веток "
      f"съедает большую часть времени — хвост до **{chislo(k0['max'],1)} ч**;")
    W(f"* мимо ствола лежит **{len(lezh0)} "
      f"{skl(len(lezh0),'ветка','ветки','веток')}** "
      f"({sum(x['kommitov'] for x in lezh0)} "
      f"{skl(sum(x['kommitov'] for x in lezh0),'коммит','коммита','коммитов')}), из них "
      f"{sum(1 for x in lezh0 if (teper-iso(x['ts'])).days>=3)} старше трёх суток;")
    if sm["est"]:
        W(f"* со смертями исполнителей по пределу сессии пропало до "
          f"**{chislo(sm['chasov'])} часа** их жизни ({sm['vsego']} "
          f"{skl(sm['vsego'],'исполнитель','исполнителя','исполнителей')}, "
          f"{len(sm['sobytiya'])} {skl(len(sm['sobytiya']),'событие','события','событий')});")
    W(f"* на перепечатке компилятора стоит **{chislo(100*sum(1 for v in vliv if v['semya'])/vsego)} % работы**; "
      "остальное параллелится свободно;")
    if s_sily["veer"]:
        W(f"* тяжёлых прогонов помещается **{s_sily['veer']}** — предел памяти, "
          "а не число мест и не число исполнителей.")
    W("")

    # ── 1. скорость
    W("## 1. Скорость: сколько ствол принимает в сутки")
    W("")
    W("Считаем вливания веток в ствол, а не коммиты: коммит — не единица работы,")
    W("одна ветка несёт от одного до семидесяти пяти коммитов.")
    W("")
    W("| сутки | вливаний | " + " | ".join(ispolniteli) + " | веток в работе | вливаний на ветку |")
    W("|---|---:|" + "---:|" * len(ispolniteli) + "---:|---:|")
    for d in dni:
        sub = [v for v in vliv if v["den"] == d]
        c = Counter(v["kto"] for v in sub)
        akt = len(aktivnye.get(d, ()))
        na = f"{chislo(len(sub)/akt, 2)}" if akt else "—"
        W(f"| {d} | {len(sub)} | " + " | ".join(str(c.get(e, 0)) for e in ispolniteli)
          + f" | {akt} | {na} |")
    W(f"| **всего** | **{vsego}** | "
      + " | ".join(str(sum(1 for v in vliv if v['kto'] == e)) for e in ispolniteli)
      + f" | | |")
    W("")
    if prochee:
        W(f"Ещё {prochee} {skl(prochee,'вливание','вливания','вливаний')} — ветки без")
        W("буквенной приставки, из порядка до соглашения об именах. В итог они")
        W("входят, по исполнителям не делятся.")
        W("")
    if dni[0] > since:
        W(f"⚠ Окно просили с {since}, а таблица начинается с {dni[0]}. Раньше этого")
        W("дня **ствол не записывал, какая ветка влита**: слияния назывались своими")
        W("словами («Ядро читает факты о встроенных формах…»), и имени ветки в")
        W("заголовке нет. Такие слияния не разбираются никакой программой, и")
        W("считать по ним нельзя. Это первая из отсутствующих записей — см. раздел 7.")
        W("")
    W(f"За {sut} суток окна ствол принял **{vsego} вливаний**, это "
      f"**{chislo(vsego/sut)} в сутки**. Медиана по суткам — "
      f"{chislo(statistics.median([sum(1 for v in vliv if v['den']==d) for d in dni]))}.")
    W("")
    W("«Веток в работе» — сколько разных веток в эти сутки либо начались, либо")
    W("влились. Это НЕ число исполнителей: один исполнитель ведёт несколько")
    W("веток, и обратного счёта из git не выходит — см. раздел 5.")
    W("")

    # задачник
    zk, zv, zg, zo = z["zakryto"], z["vzyato"], z["zavedeno_gotovoj"], z["otkryto_zanovo"]
    dz = sorted(set(zk) | set(zv) | set(zg) | set(zo))
    if dz:
        W("### Задачник: взято и закрыто")
        W("")
        W("Считаем переход шапки `статус:` в самом файле задачи, а не слова в")
        W("заголовке коммита. Задача, заведённая сразу `сделана`, вынесена")
        W("отдельным столбцом: это опись прошлого, а не работа смены.")
        W("")
        W("| сутки | закрыто | взято | заведено готовой | открыто заново |")
        W("|---|---:|---:|---:|---:|")
        for d in dz:
            W(f"| {d} | {zk[d]} | {zv[d]} | {zg[d]} | {zo[d]} |")
        W(f"| **всего** | **{sum(zk.values())}** | **{sum(zv.values())}** | "
          f"**{sum(zg.values())}** | **{sum(zo.values())}** |")
        W("")
        vz, zak = sum(zv.values()), sum(zk.values())
        W(f"**Берут быстрее, чем закрывают: {vz} против {zak}.** Разница "
          f"{vz-zak} — это то, что осело в «в работе» и не вышло обратно.")
        if seychas:
            W("")
            W("В дереве прямо сейчас: " + ", ".join(
                f"{v} {k}" for k, v in sorted(seychas.items(), key=lambda x: -x[1])) + ".")
        W("")

    # ── 2. цена
    W("## 2. Цена ветки: распределение, а не среднее")
    W("")
    W("Мера — часы от первого коммита ветки до её вливания. **Это нижняя")
    W("оценка**, и вот почему: git знает, когда работу ЗАПИСАЛИ, а не когда за")
    W("неё сели. Настоящее начало знает только книга долей, и она покрывает")
    W(f"{p['doli_sovpalo']} веток из {p['vetok_vlito']} влитых "
      f"({chislo(100*p['doli_sovpalo']/max(1,p['vetok_vlito']))} %) — по такой")
    W("выборке распределения не строят. Что с этим делать — раздел 6.")
    W("")
    W("| кто | веток | медиана, ч | 75 % | 90 % | 95 % | 99 % | хвост, ч |")
    W("|---|---:|---:|---:|---:|---:|---:|---:|")
    k = kvantili([v["chas"] for v in vliv])
    W(f"| **все** | {k['n']} | {chislo(k['med'],2)} | {chislo(k['p75'],2)} | "
      f"{chislo(k['p90'],2)} | {chislo(k['p95'],2)} | {chislo(k['p99'],2)} | {chislo(k['max'],1)} |")
    for e in ispolniteli:
        kk = kvantili([v["chas"] for v in vliv if v["kto"] == e])
        if kk:  # только буквенные приставки: остальное — не исполнитель
            W(f"| {e} | {kk['n']} | {chislo(kk['med'],2)} | {chislo(kk['p75'],2)} | "
              f"{chislo(kk['p90'],2)} | {chislo(kk['p95'],2)} | {chislo(kk['p99'],2)} | {chislo(kk['max'],1)} |")
    W("")
    dolgie = [v for v in vliv if v["chas"] >= k["p90"]]
    dolya_hvosta = sum(v["chas"] for v in dolgie) / max(1e-9, k["sum"])
    W(f"**Хвост решает.** Медиана {chislo(k['med'],2)} ч — это цена мелкой")
    W(f"правки, которую записали и тут же сдали. Но десятая часть веток "
      f"(их {len(dolgie)}) занимает **{chislo(100*dolya_hvosta)} % всего")
    W("времени**: планировать по медиане — значит промахнуться в разы.")
    W("")
    kk = kvantili([v["kommitov"] for v in vliv])
    W(f"Коммитов в ветке: медиана {chislo(kk['med'],0)}, 90 % — {kk['p90']}, "
      f"хвост {kk['max']}.")
    W("")
    W("### На чём застревает хвост")
    W("")
    W("| ч | ветка | коммитов | правит `flang/self/**` |")
    W("|---:|---|---:|---|")
    for v in sorted(vliv, key=lambda x: -x["chas"])[:10]:
        W(f"| {chislo(v['chas'],1)} | `{v['vetka']}` | {v['kommitov']} | "
          f"{'да' if v['semya'] else 'нет'} |")
    W("")

    # ── 3. потери
    W("## 3. Потери: что сделано и не доехало")
    W("")
    W("### 3.1. Ветки, лежащие мимо ствола")
    W("")
    kom = sum(x["kommitov"] for x in lezh)
    W(f"В приёмной **{len(lezh)} {skl(len(lezh),'ветка','ветки','веток')} старше часа "
      f"{skl(len(lezh),'не вошла','не вошли','не вошли')} в ствол**, "
      f"в них **{kom} {skl(kom,'коммит','коммита','коммитов')}**.")
    W(f"Ещё {len(p['v_rukah'])} моложе часа — это работа в руках, не потеря.")
    W("")
    vozr = Counter()
    vozr_k = Counter()
    for x in lezh:
        h = (teper - iso(x["ts"])).total_seconds() / 3600
        b = "1–6 ч" if h < 6 else "6–24 ч" if h < 24 else "1–3 суток" if h < 72 else "старше 3 суток"
        vozr[b] += 1
        vozr_k[b] += x["kommitov"]
    W("| возраст | веток | коммитов |")
    W("|---|---:|---:|")
    for b in ["1–6 ч", "6–24 ч", "1–3 суток", "старше 3 суток"]:
        if vozr[b]:
            W(f"| {b} | {vozr[b]} | {vozr_k[b]} |")
    W("")
    W("Чем ветка старше, тем вернее она мертва: ствол ушёл вперёд, и вливать её")
    W("уже дороже, чем написать заново. Разбор старших — отдельная работа.")
    W("")
    W("| ветка | последний коммит | коммитов |")
    W("|---|---|---:|")
    for x in sorted(lezh, key=lambda x: x["ts"])[:12]:
        W(f"| `{x['vetka']}` | {x['ts'][:16].replace('T',' ')} | {x['kommitov']} |")
    W("")

    W("### 3.2. Отказы на входе")
    W("")
    if p["otkazy"]:
        pr = Counter(re.sub(r"\s*\(.*", "", x["prichina"]) for x in p["otkazy"])
        raznyh = len({x["vetka"] for x in p["otkazy"]})
        W(f"Записей в журнале отказов — {len(p['otkazy'])}, разных веток — {raznyh}.")
        W("")
        W("| причина | раз |")
        W("|---|---:|")
        for r, c in pr.most_common():
            W(f"| {r} | {c} |")
        W("")
        W("Отказ — не потеря работы, ветка остаётся у автора. Но это потеря")
        W("времени: тот же заголовок отвергался по нескольку раз подряд, то есть")
        W("автор не увидел причину и пушил снова.")
    else:
        W("Журнал отказов пуст.")
    W("")

    W("### 3.3. Двое над одним файлом")
    W("")
    W(f"Пар веток, которые правили общий файл и слились в одни сутки — "
      f"**{p['par_stolknovenij']}**. Задето **{p['vetok_v_stolknovenii']} веток из "
      f"{p['vetok_vsego']}** ({chislo(100*p['vetok_v_stolknovenii']/max(1,p['vetok_vsego']))} %).")
    W("")
    W("**Это верхняя оценка, а не доказанная переделка**: двое могут править")
    W("разные места одного файла и не мешать друг другу. Нижняя оценка — пары с")
    W("большим числом общих файлов, там случайностью уже не объяснить:")
    W("")
    W("| общих файлов | ветки |")
    W("|---:|---|")
    for (x, y), c in p["hudshie_pary"]:
        W(f"| {c} | `{x}` и `{y}` |")
    W("")
    if p["peredelka"]:
        W(f"Второй заход по тому же делу (основание в ствол не вошло, вошёл его")
        W(f"продолжатель с номером) — **{len(p['peredelka'])} случаев**: "
          + ", ".join(f"`{b}`→`{n}`" for b, n in p["peredelka"][:8]) + ".")
        W("")
    W(f"Книга долей — тот самый инструмент, который это ловит, — покрывает "
      f"**{p['doli_sovpalo']} влитых веток из {p['vetok_vlito']}**. Пока покрытие")
    W("такое, столкновения ловятся глазами, и цена этого — в таблице выше.")
    W("")

    W("### 3.4. Исполнители, умершие по пределу времени сессии")
    W("")
    if not sm["est"]:
        W("Стенограмм на месте нет — посчитать нечем. Это не «потерь не было»:")
        W("это «мерить нечем», и разницу надо держать в голове.")
    else:
        W(f"Прочитано стенограмм: {sm['stenogramm']}. **Не доработав, умерло "
          f"исполнителей: {sm['vsego']}**, и с ними пропало "
          f"**{chislo(sm['chasov'])} исполнительского часа**.")
        W("")
        W("| когда (UTC) | умерло | часов пропало | самый долгий |")
        W("|---|---:|---:|---:|")
        for e in sm["sobytiya"]:
            W(f"| {e['ot'][:16].replace('T',' ')} | {e['skolko']} | "
              f"{chislo(e['chasov'])} | {chislo(e['dolgozhitel'])} ч |")
        W(f"| **всего** | **{sm['vsego']}** | **{chislo(sm['chasov'])}** | |")
        W("")
        hud = max(sm["sobytiya"], key=lambda e: e["chasov"])
        mnog = max(sm["sobytiya"], key=lambda e: e["skolko"])
        W("**Считать надо часы, а не головы, и вот доказательство.** Больше всего")
        W(f"исполнителей ({mnog['skolko']}) умерло {mnog['ot'][:10]}, а времени с ними")
        W(f"пропало всего {chislo(mnog['chasov'])} ч — они были молодые. Самое дорогое")
        W(f"событие — {hud['ot'][:10]}: {hud['skolko']} исполнителей и "
          f"{chislo(hud['chasov'])} ч.")
        W("Событие с одним-единственным исполнителем может стоить дороже события с")
        W("восемнадцатью. Отсюда правило: **чем дольше исполнитель живёт без")
        W("промежуточного `git push`, тем дороже он обходится, когда умирает.**")
        W("")
        W("**Что именно значат эти часы.** Это время жизни исполнителя от первой")
        W("записи до смерти, а не потраченное машинное время: исполнитель мог")
        W("часть срока ждать. Верхняя граница потерянного, не счёт за работу.")
        W("")
        vb = sm.get("s_vetkoj") or []
        if vb:
            doshli = [b for b in vb if b in p["vlitye_imena"]]
            W(f"**Ветку назвал только {len(vb)} из {sm['vsego']}.** Остальные —")
            W("подручные исполнители: они не вели ветку, а собирали ответ для")
            W("старшего, и их работа пропадала не из дерева, а из чужого разбора.")
            W(f"Из названных веток до ствола дошло {len(doshli)}: "
              + ", ".join(f"`{b}`" for b in sorted(set(vb))[:6]) + ".")
        else:
            W("**Ветку не назвал ни один из умерших.** Все они — подручные")
            W("исполнители: работа пропадала не из дерева, а из чужого разбора,")
            W("и связать её с веткой нечем.")
        W("")
        W("Смерть по пределу сессии **нигде на машине не записывается**. Эти числа")
        W("сняты разбором стенограмм — они живут, пока стенограммы не почищены, и")
        W("исчезнут вместе с ними. Что завести — раздел 7.")
    W("")

    # ── 4. критический путь
    W("## 4. Критический путь: перепечатка компилятора")
    W("")
    W("Правка в `flang/self/**` не доезжает до собранного двоичного, пока не")
    W("прогнана перепечатка семени (`sh scripts/raskrutka.sh`). Всё остальное —")
    W("документация, примеры, задачи, оснастка — от неё не зависит вовсе.")
    W("")
    W(f"**Упирается в перепечатку {n_s} вливаний из {vsego} — "
      f"{chislo(100*n_s/vsego)} %.**")
    W("")
    W("| кто | вливаний | из них в `flang/self/**` | доля |")
    W("|---|---:|---:|---:|")
    for e in ispolniteli:
        a1 = [v for v in vliv if v["kto"] == e]
        a2 = [v for v in a1 if v["semya"]]
        W(f"| {e} | {len(a1)} | {len(a2)} | {chislo(100*len(a2)/max(1,len(a1)))} % |")
    del a1, a2
    W("")
    W("Что это значит для плана:")
    W("")
    W(f"* **{chislo(100-100*n_s/vsego)} % работы параллелится свободно** — её")
    W("  можно вести сколько угодно широко, лишь бы хватало памяти;")
    W(f"* **{chislo(100*n_s/vsego)} % встаёт в очередь за перепечаткой.** Она на")
    W("  машине ОДНА: второй заход одновременно с первым положил машину на шесть")
    W("  часов в ночь на 24 августа (`tasks/0003`);")
    W("* перепечатка просит `PAMYAT=400G` при потолке около 300 ГиБ, то есть")
    W("  пускают её только на почти пустой машине. Пока она идёт, широкого веера")
    W("  рядом не бывает.")
    W("")
    W("Сколько она стоит. **Единственная таблица в этом файле, которую программа")
    W("НЕ считает**: машинного учёта заходов перепечатки не ведётся, и числа")
    W("списаны из журналов и из `tasks/0003` поимённо.")
    W("")
    W("| заход | шёл | чем кончился | откуда число |")
    W("|---|---:|---|---|")
    W("| 24 августа | 3 ч 02 мин | код 1, предел глубины | `/srv/work/semya2.log` |")
    W("| 24 августа | 5 ч 30 мин | **код 0** | `/srv/work/semya3.log` |")
    W("| 25–26 августа | 14 ч 05 мин | смерть на пределе глубины | `tasks/0003` |")
    W("| 26–27 августа | 14 ч 37 мин | печать прошла, умерла сверка | `tasks/0003` |")
    W("| 30 августа | — | **дошёл**, семя перепечатано | коммит `52996005` |")
    W("")
    W("**Шесть-восемь часов — не та цена.** Заходов было по меньшей мере шесть")
    W("(`tasks/0003` называет заход 26 августа шестым), до конца дошли два из")
    W("перечисленных выше. Неудачный заход стоит не меньше удачного, а дважды —")
    W("вдвое больше: 14 ч 05 мин и 14 ч 37 мин против 5 ч 30 мин у дошедшего.")
    W("")
    W("Отсюда честная ставка для плана: **перепечатка — это сутки машины, а не")
    W("восемь часов, и примерно каждый третий заход доходит.** Считать её")
    W("восьмичасовой работой — значит трижды промахнуться: по времени, по числу")
    W("попыток и по тому, что рядом с ней ничего тяжёлого идти не может.")
    W("")

    # ── 5. силы
    W("## 5. Силы: чем ограничен веер")
    W("")
    if s_sily["veer"] is None:
        W("**Ворота не ответили, и ключей не дано — сколько помещается, я не знаю.**")
        W("Подставлять сюда правдоподобное число нельзя: ровно так ворота однажды")
        W("раздавали места вслепую. Позовите с `--memory-gib` и `--run-memory-gib`.")
    else:
        W(f"Источник чисел — {s_sily['istochnik']}.")
        W("")
        W("| что | сколько |")
        W("|---|---:|")
        W(f"| памяти под раздачу | {s_sily['pamyat_gib']} ГиБ |")
        if s_sily["zanyato"] is not None:
            W(f"| роздано сейчас | {s_sily['zanyato']} ГиБ |")
        W(f"| просит один тяжёлый прогон | {s_sily['na_progon_gib']} ГиБ |")
        W(f"| **тяжёлых прогонов разом** | **{s_sily['veer']}** |")
        if s_sily["mest"]:
            W(f"| мест в пуле | {s_sily['mest']} |")
        if s_sily.get("mest_zanyato") is not None:
            W(f"| мест занято | {s_sily['mest_zanyato']} |")
        if s_sily["progonov"] is not None:
            W(f"| прогонов `flang` на машине | {s_sily['progonov']} |")
        W("")
        if s_sily["mest"]:
            W(f"**Предел здесь память, а не число мест.** Мест в пуле "
              f"{s_sily['mest']}, а памяти хватает на {s_sily['veer']} тяжёлых")
            W(f"прогонов: {s_sily['mest'] - s_sily['veer']} мест из пула не дают ничего.")
        else:
            W(f"Памяти хватает на {s_sily['veer']} тяжёлых прогонов разом.")
        if s_sily["mimo_vorot"]:
            W("")
            W(f"⚠ Прогонов на машине {s_sily['progonov']}, а мест занято "
              f"{s_sily['mest_zanyato']}: **{s_sily['mimo_vorot']} прогонов идут мимо учёта**.")
            W("Ворота считают только тех, кто зашёл через них. 27 августа так шли")
            W("43 прогона из 87. Значит число «свободно» — верхняя оценка, и веер,")
            W("посчитанный по нему, шире настоящего.")
    W("")
    W("**Числа исполнителей в записях нет.** Приставка ветки (`m/`, `u/`, `b/`) —")
    W("это учётная запись на машине, а не исполнитель: под одной записью работает")
    W("вся смена. Поэтому «сколько даёт один исполнитель в сутки» из git не")
    W("выводится, и я его не вывожу. Что даёт одна ВЕТКА — выводится, и стоит в")
    W("разделе 1.")
    W("")

    # ── 6. пересчёт
    W("## 6. Пересчёт под заданные силы")
    W("")
    v_sutki_na_vetku = statistics.median(
        [len([v for v in vliv if v["den"] == d]) / max(1, len(aktivnye[d])) for d in dni])
    poter = len(lezh) / max(1, p["vetok_vsego"] + len(lezh))
    zakryto_vsego = sum(z["zakryto"].values())
    na_zadachu = vsego / zakryto_vsego if zakryto_vsego else None
    W("Ставки, снятые выше. Всё, что ниже, считается только из них.")
    W("")
    W("| ставка | значение | откуда |")
    W("|---|---:|---|")
    W(f"| вливаний в сутки, как есть | {chislo(vsego/sut)} | ствол за {sut} суток |")
    W(f"| вливаний на ветку в сутки | {chislo(v_sutki_na_vetku,2)} | медиана по суткам |")
    W(f"| доля веток мимо ствола | {chislo(100*poter)} % | раздел 3.1 |")
    W(f"| доля за перепечаткой | {chislo(100*n_s/vsego)} % | раздел 4 |")
    if na_zadachu:
        W(f"| вливаний на закрытую задачу | {chislo(na_zadachu,1)} | {vsego} вливаний на {zakryto_vsego} закрытых |")
    if sm["est"]:
        W(f"| часов пропало со смертями | {chislo(sm['chasov'])} | раздел 3.4 |")
    if s_sily["veer"]:
        W(f"| тяжёлых прогонов разом | {s_sily['veer']} | раздел 5 |")
    W("")
    W("### Сколько выходит при разной ширине")
    W("")
    W("Ширина — сколько веток ведётся разом. Столбец «дойдёт» — за вычетом того,")
    W("что ляжет мимо ствола; это не прогноз, а та же снятая доля, перенесённая")
    W("на другую ширину.")
    W("")
    shir = sorted({6, 12, 24, 48, int(sum(len(aktivnye[d]) for d in dni) / sut)}
                  | ({a.agents} if a.agents else set()))
    W("| веток разом | вливаний в сутки | дойдёт до ствола | за перепечаткой |"
      + (" суток до цели |" if a.tasks_left and na_zadachu else ""))
    W("|---:|---:|---:|---:|" + ("---:|" if a.tasks_left and na_zadachu else ""))
    for n in shir:
        if n <= 0:
            continue
        val = n * v_sutki_na_vetku
        net = val * (1 - poter)
        za = net * n_s / vsego
        stroka = (f"| {'**' + str(n) + '**' if n == a.agents else n} | {chislo(val)} | "
                  f"{chislo(net)} | {chislo(za)} |")
        if a.tasks_left and na_zadachu:
            stroka += f" {chislo(a.tasks_left*na_zadachu/max(1e-9,net))} |"
        W(stroka)
    W("")
    if not a.tasks_left:
        W("Столбца «суток до цели» здесь нет намеренно: сколько работы осталось —")
        W("число со стороны. Дайте его ключом `--tasks-left`, и столбец появится.")
        W(f"Пересчёт простой: одна закрытая задача стоит {chislo(na_zadachu,1) if na_zadachu else '—'} вливаний.")
        W("")
    W("**Две оговорки, без которых таблица врёт.**")
    W("")
    if s_sily["veer"]:
        W(f"1. **Память кончается раньше веток.** Тяжёлых прогонов помещается "
          f"{s_sily['veer']}, а ширина в таблице доходит до {max(shir)}. Ширина сверх")
        W("   этого работает только на том, чему тяжёлый прогон не нужен —")
        W("   документация, задачи, примеры. Ветка, которой нужен прогон по")
        W("   `flang/self/**`, встанет в очередь.")
    else:
        W("1. **Сколько помещается — неизвестно**: ворота не ответили и ключей не")
        W("   дано. Ширину сверх измеренной читать нельзя.")
    W("")
    W("2. **Ставка «вливаний на ветку» снята при нынешней ширине.** Веер вдвое")
    W("   шире её не сохранит: столкновений по файлам уже сейчас "
      f"{chislo(100*p['vetok_v_stolknovenii']/max(1,p['vetok_vsego']))} % "
      "(раздел 3.3), и чем")
    W("   шире веер, тем их больше. Таблица — потолок, а не обещание.")
    W("")
    W("### Спросить иначе")
    W("")
    W("```sh")
    W("python3 scripts/resource-plan.py --agents 24        # веток разом")
    W("python3 scripts/resource-plan.py --tasks-left 60    # счёт даёт ROADMAP.md")
    W("python3 scripts/resource-plan.py --memory-gib 600 --run-memory-gib 40")
    W("python3 scripts/resource-plan.py --since 2026-08-01 # другое окно")
    W("python3 scripts/resource-plan.py --out docs/resource-plan.md")
    W("```")
    W("")

    # ── 7. чего не посчитать
    W("## 7. Чего по нынешним записям НЕ посчитать")
    W("")
    W("Не догадки, а список отсутствующих записей. Пока их нет, эти числа")
    W("никаким прогоном не берутся — их можно только списать руками, и тогда они")
    W("устареют молча.")
    W("")
    W("| вопрос | почему не берётся | что завести |")
    W("|---|---|---|")
    W("| Сколько даёт один исполнитель в сутки | приставка ветки — учётная запись, а не исполнитель; под `m/` работает вся смена | имя исполнителя в шапке коммита или в записи о доле |")
    W(f"| Что было до {dni[0]} | слияния назывались своими словами, имени ветки в заголовке нет | заголовок слияния по образцу `влита <ветка>`; программа слияния (`svod.sh`) так и делает с 23 августа |")
    W(f"| Сколько часов ушло на ветку | git знает время записи, а не время начала; книга долей покрывает {p['doli_sovpalo']} веток из {p['vetok_vlito']} | звать `/srv/priyom/claim взять` всегда, а не иногда |")
    W("| Сколько исполнителей умерло по пределу сессии | на машине не пишется нигде; числа раздела 3.4 сняты разбором стенограмм и исчезнут вместе с ними | журнал прогонов: начало, конец, код возврата, ветка |")
    W("| Сколько работы сделано дважды | видно только столкновение по файлу, а не совпадение по существу | доли до начала работы; тогда столкновение ловится, а не считается задним числом |")
    W("| Сколько на самом деле стоит перепечатка | заходы нигде не учитываются: журнал каждый раз зовут по-своему и кладут куда придётся | заход пишет строку в общий журнал: начало, конец, код, на чём умер |")
    W("")
    W("Первое и третье — одна и та же дыра: **на машине нет записи о прогоне")
    W("исполнителя**. Ворота ведут счёт мест, но место — это тяжёлый прогон, а не")
    W("исполнитель, и часть прогонов идёт мимо ворот вовсе.")
    W("")
    W("Самая дешёвая починка — один файл через запятую-табуляцию, рядом с")
    W("`claims.tsv`, и в нём по строке на исполнителя: когда начал, когда кончил,")
    W("чем кончил, какая ветка. Тогда три из четырёх строк таблицы выше")
    W("закрываются одним `awk`, а раздел 3.4 перестанет зависеть от того, чистил")
    W("ли кто-то стенограммы.")
    W("")
    W("Четвёртая строка чинится не файлом, а привычкой: доли объявляются до")
    W(f"начала работы. Сейчас их объявляют для {p['doli_sovpalo']} веток из "
      f"{p['vetok_vlito']}, и пока так — столкновения считаются задним числом.")
    W("")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(
        description="Ресурсный план кластера: пропускная способность и цена работы, по истории.")
    ap.add_argument("--repo", default=None, help="дерево (по умолчанию — где лежит эта программа)")
    ap.add_argument("--since", default=None,
                    help="начало окна, ГГГГ-ММ-ДД (по умолчанию 14 суток назад)")
    ap.add_argument("--agents", type=int, default=None,
                    help="сколько веток вести разом — для пересчёта")
    ap.add_argument("--tasks-left", type=int, default=None,
                    help="сколько задач осталось; число приходит из ROADMAP.md, не отсюда")
    ap.add_argument("--memory-gib", type=int, default=None,
                    help="памяти под раздачу, ГиБ (иначе спрашиваем ворота)")
    ap.add_argument("--run-memory-gib", type=int, default=None,
                    help="сколько просит один тяжёлый прогон, ГиБ")
    ap.add_argument("--slots", type=int, default=None, help="мест в пуле")
    ap.add_argument("--out", default=None, help="куда положить (иначе на экран)")
    a = ap.parse_args()

    if a.repo is None:
        a.repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if a.since is None:
        a.since = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    if not shutil.which("git"):
        sys.exit("git не найден — считать нечем")

    text = postroit(a)
    if a.out:
        path = a.out if os.path.isabs(a.out) else os.path.join(a.repo, a.out)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"написано: {path} ({len(text.splitlines())} строк)")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
