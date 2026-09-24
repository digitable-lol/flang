---
номер: 1428
заголовок: Транслитные имена скриптов переименовать на английский, и сорок четыре скрипта перенести на flang
статус: свободна (часть 2 взята 17 сентября; на 22 сентября 2026 scripts/raskrutka.sh в дереве и зовётся из 225 файлов)
исполнитель: —
ветка: —
команда: первая
карта: Куда идём
рядом: 1427, 5821
нужность: 2 — имена вроде raskrutka.sh и доказуемость.sh читаются только своими; язык при этом умеет всё, что этим скриптам нужно
---

## Часть 1. Почему скрипты не на flang — измерено, и прежний ответ был неверен

**Язык умеет всё, что им нужно.** Словарь поручений (`flang/self/parser.flang`,
блок около строки 6595) несёт 23 поручения, среди них: «Запустить процесс»,
«Запустить процесс с вводом», «Прочитать доводы», «Прочитать переменную среды»,
«Завести временный каталог», «Удалить файл». Среди откликов — «Срок вышел»,
«Процесс завершён», «Процесс убит» с сигналом. То есть процессы, сроки, доводы
и среда в языке ЕСТЬ.

**Это уже используется:** 73 скрипта на flang зовут процессы, и зовут именно
`git`, `make`, `sh`, `sha256sum`. Переносимость доказана фактом, а не рассуждением.

**Настоящих исключений два**, и они принципиальные: `scripts/bootstrap-c.sh` и
`scripts/raskrutka.sh` СОБИРАЮТ сам двоичный (cc, make -C bootstrap). Написать
их на языке, который они производят, нельзя — курица и яйцо. `semya-osvezhit.sh`
тоже собирает, то есть третий такой же.

У остальных 41 скрипта принципиального препятствия нет: 38 пользуются
управлением процессами (trap/ulimit/фон), 24 зовут git, 20 — сборку, и всё это
язык умеет. Осталась работа, а не запрет.

## Часть 2. Таблица переименований

Имена латиницей, по образцу уже принятому в дереве (`seed-freshness.sh`,
`binary-origin.sh`, `two-prints-identical.sh`, `*-guard.flang`):

| сейчас | предлагается | живых файлов |
|---|---|---:|
| `scripts/raskrutka.sh` | `scripts/bootstrap-reprint.sh` | 126 |
| `scripts/доказуемость.sh` | `scripts/provability-gate.sh` | 63 |
| `scripts/seed/chto-otstalo-ot-semeni.sh` | `scripts/seed/what-lags-the-seed.sh` | 15 |
| `scripts/guards/storozha-bez-podloga.sh` | `scripts/guards/guards-without-forgery-probe.sh` | 11 |
| `scripts/guards/kto-zovet-storozhey.sh` | `scripts/guards/who-calls-the-guards.sh` | 8 |
| `scripts/guards/pol-dokazannogo-sverka.sh` | `scripts/guards/proved-share-vs-tree.sh` | 5 |
| `scripts/seed/semya-rantayma-eto-istochnik.sh` | `scripts/seed/seed-runtime-is-source.sh` | 5 |
| `scripts/repl-proba.sh` | `scripts/repl-probe.sh` | 5 |
| `scripts/flangtutor-proba.sh` | `scripts/tutor-probe.sh` | 5 |
| `scripts/guards/сторож-дарвина.fscript` | `scripts/guards/darwin-guard.flang` | 4 |
| `scripts/seed/semya-osvezhit.sh` | `scripts/seed/seed-refresh.sh` | 4 |
| `scripts/seed/pechat-povtorima.sh` | `scripts/seed/print-is-repeatable.sh` | 3 |

## Цена, померена поимённо

Живых файлов со ссылками — около 254. Исторических (завершённые задачи,
отклонённые, заметки, архив) — 64: их НЕ трогать, там имена описывают то, что
было тогда.

Машинно-важные места, которые обязаны переименоваться вместе с файлами:
  · `.githooks/pre-push` — 9 строк;
  · `.github/workflows/*.yml` — 35 строк;
  · `ХРАПОВИК` — 3 (все у `доказуемость.sh`);
  · `ярлыки.flang` — 9;
  · реестры сторожей — запись «Ждущее» про `raskrutka.sh` в `file-extensions.fscript`
    и упоминания в шапках четырёх сторожей;
  · приметы «СНЯТО» — НОЛЬ (проверено).

⚠ По образцу скрипты никто не перечисляет (`find scripts/`, `scripts/*.sh` — ноль
вхождений в хуке, прогонах и flang-скриптах), так что молча ничего не отвалится.

## Порядок

Переименование делать ОДНИМ коммитом: `git mv` + правка всех живых ссылок +
хук + прогоны + храповики + ярлыки + реестры. Половина переименования оставляет
хук зовущим несуществующий файл и ломает пуш всем.

## Как понять, что сделано

`sh .githooks/pre-push` зелен, все прогоны зелены, `./ярлык` перечисляет прежние
ярлыки с новыми командами, и `git grep -l raskrutka.sh` находит только историю.

## Замер 17 сентября 2026 (часть 2 — имена без транслита и сторож)

Снято на ветке `a/1428-translit-file-names-to-english` над main `4ac13dc99`.

| что | до | после | чем снято |
|---|---:|---:|---|
| транслитных латинских имён в области сторожа (scripts, flang/test, flang/scripts, docs/site, docs/zettel, .github) | 150 | 67, все в ведомости долга с доводом | `sh scripts/guards/translit-file-names-guard.sh --список \| wc -l` (на базе — сторож, подложенный в копию базы) |
| переименовано файлов | — | 83 | `git diff -M --name-status 4ac13dc99 \| grep -c ^R` |
| сторож `--check` / `--подлог` | — | 0 / 1 (подлог пойман, дерево чистое) | `sh scripts/guards/translit-file-names-guard.sh --check`, `--подлог` |
| ссылок на старые имена вне летописи (completed, rejected, changelog, release-notes, таблица этой задачи) | 143 строки после черновика | 0 в стеке T; 3 комментария вне стека (`flang/proof/tables-guard.sh:87`, `flang/src/emit/c/flang_repl.c:269` и его семя) | `git grep -n -P '(?<![\w-])<старое имя>(?![\w-])'` по каждому из 83 имён |
| `proba` в коде (без docs и *.md) | 165 | 83 — из них в стеке T 10 (строки ведомостей `link-guard-known-not-a-path.tsv`, `uncalled-guards.json`, `guards-without-forgery-probe.json`, привязанные к тексту документов и к имени порождённого cpp-заголовка); 73 вне стека (flang/proof 59, raskrutka.sh 11, flang_repl.c ×2, flang/self/cli.flang) | `git grep -c -i -E '\bprob[aiy]\b\|proba' -- . ':!docs' ':!*.md'` |
| ярлыков в `ярлыки.flang` | 144 | 146 (`транслит:проверка`, `транслит:подлог`) | `bootstrap/flang check ярлыки.flang` |

Коды переименованных скриптов, тот же ключ до и после (двоичный один — `bootstrap/flang` ветки):

| было | стало | ключ | до | после |
|---|---|---|---:|---:|
| `scripts/guards/kto-zovet-storozhey.sh` | `scripts/guards/who-calls-the-guards.sh` | `--check` | 0 | 0 |
| `scripts/guards/storozha-bez-podloga.sh` | `scripts/guards/guards-without-forgery-probe.sh` | `--check` | 0 | 0 |
| `scripts/guards/pol-dokazannogo-sverka.sh` | `scripts/guards/proved-share-vs-tree.sh` | `--числа` | 0 | 0 |
| `scripts/seed/semya-osvezhit.sh` | `scripts/seed/seed-refresh.sh` | `--help` | 0 | 0 |
| `scripts/seed/pechat-povtorima.sh` | `scripts/seed/print-is-repeatable.sh` | `--help` (незнакомый ключ) | 2 | 2 |
| `scripts/seed/chto-otstalo-ot-semeni.sh` | `scripts/seed/what-lags-the-seed.sh` | без ключа | 0 | 0 |
| `scripts/seed/semya-rantayma-eto-istochnik.sh` | `scripts/seed/seed-runtime-is-source.sh` | `--help` (незнакомый ключ) | 2 | 2 |
| `scripts/repl-proba.sh` | `scripts/repl-probe.sh` | `--отпечаток` | 0 | 0 |
| `scripts/flangtutor-proba.sh` | `scripts/tutor-probe.sh` | `<двоичный>` | 0 | 0 |

Что оставлено в долге (`scripts/ledgers/translit-file-names-debt.txt`, у каждой группы довод): `scripts/otpechatok-semeni`, `scripts/raskrutka.sh` (собирают двоичный и печать семени — идёт печать); `.github/workflows/target-twins.yml` (workflow на GitHub — переименование заводит новый включённый workflow, ручное выключение сбросится); 42 подделки и 3 честных файла `flang/test/fixtures/*.flang` (имя — ключ записи доказательства стека K: `flang/proof/forgeries/manifest.tsv`, записи чекера); 14 планов `flang/test/fixtures/plany/*` (ключи снимков `record-oracle.json`, `record-grid.json`, `proofterm-witness.json`); `flang/test/uzel-osnastka.{flang,mjs}` (ввозит `flang/concurrency/bench/node-death-targets.mjs`, называет `flang/self/emit-js.flang`); три пробы-двойника `flang/test/{nadzor-uzla,planirovshchik-celi,svyaz-celi}.test.mjs` (названы в `docs/flang/concurrency/RESILIENCE.md` и `flang/concurrency/bin/peer.py`); две заметки `docs/zettel/emptiness-guards-are-written-with-pusto-…` и `vyvod-na-vetke-ne-vyvod-o-dereve.md` (на них ссылаются `flang/self/proof-kernel.flang` и `docs/flang/proof/SPEC.md`); `zhi-shi.fts` (имя правила орфографии).

Полная таблица переименований (83):

| было | стало |
|---|---|
| `docs/site/dlya-ii.md` | `docs/site/ai-assistant.md` |
| `docs/site/dlya-ii.ru.md` | `docs/site/ai-assistant.ru.md` |
| `docs/site/storozh-kontrasta.flang` | `docs/site/contrast-guard.flang` |
| `docs/site/podsvetka.flang` | `docs/site/highlighting.flang` |
| `docs/site/podsvetka.mjs` | `docs/site/highlighting.mjs` |
| `docs/site/matematika.md` | `docs/site/mathematics.md` |
| `docs/site/matematika.ru.md` | `docs/site/mathematics.ru.md` |
| `docs/site/poisk-proverka.mjs` | `docs/site/search-check.mjs` |
| `docs/site/poisk.flang` | `docs/site/search.flang` |
| `docs/site/poisk.js` | `docs/site/search.js` |
| `docs/site/poisk.mjs` | `docs/site/search.mjs` |
| `docs/site/kak-dokazat.md` | `docs/site/what-the-kernel-accepts.md` |
| `docs/site/kak-dokazat.ru.md` | `docs/site/what-the-kernel-accepts.ru.md` |
| `docs/zettel/proverka-zovushchaya-kompilyator-perenositsya-na-flang-mehanicheski.md` | `docs/zettel/a-check-that-calls-the-compiler-ports-to-flang-mechanically.md` |
| `docs/zettel/dizyunkciya-v-dopushchenii-razbiraetsya-sluchayami-a-ne-rasshchepliaetsya.md` | `docs/zettel/a-disjunction-in-a-hypothesis-is-split-by-cases-not-torn-apart.md` |
| `docs/zettel/darovoe-utverzhdenie-uznayotsya-podmenoy-tela-zaglushkoy.md` | `docs/zettel/a-free-statement-is-exposed-by-replacing-the-body-with-a-stub.md` |
| `docs/zettel/nezagruzhennaya-proba-v-otchyote-neotlichima-ot-otsutstvuyushchey.md` | `docs/zettel/a-test-file-that-failed-to-load-looks-absent-in-the-report.md` |
| `docs/zettel/posle-udaleniya-vtoroy-realizacii-nabor-prob-otdayot-nol.md` | `docs/zettel/after-the-second-implementation-is-deleted-the-test-suite-returns-zero.md` |
| `docs/zettel/keshirovat-dokazatelstvo-dorozhe-chem-dokazat.md` | `docs/zettel/caching-a-proof-costs-more-than-proving-it.md` |
| `docs/zettel/chto-nelzya-napisat-v-obespechivaet.md` | `docs/zettel/four-things-a-postcondition-cannot-say.md` |
| `docs/zettel/razbor-tseli-mimo-chislitelya.md` | `docs/zettel/goal-case-split-closes-sites-but-misses-the-numerator.md` |
| `docs/zettel/zakony-kak-ukazatel.md` | `docs/zettel/laws-as-a-pointer-not-a-conclusion.md` |
| `docs/zettel/node-ushyol-s-puti-sborki.md` | `docs/zettel/node-left-the-build-path.md` |
| `docs/zettel/pechat-plana-obeshchana-naiznanku-i-sverit-eyo-nechem.md` | `docs/zettel/plan-printing-is-promised-inside-out-and-nothing-verifies-it.md` |
| `docs/zettel/refleksivnost-i-cel-vybor-vmeste-dayut-nol.md` | `docs/zettel/reflexivity-and-goal-choice-together-give-zero.md` |
| `docs/zettel/pokazat-otvechaet-sboem-a-ne-ronyaet-progon.md` | `docs/zettel/show-answers-with-a-refusal-and-does-not-crash-the-run.md` |
| `docs/zettel/chisla-sayta-tuhnut-vmeste-so-slovaryom-i-lechatsya-odnoy-komandoy.md` | `docs/zettel/site-numbers-go-stale-with-the-dictionary-and-one-command-cures-both.md` |
| `docs/zettel/indukciya-po-stroke-zakryla-odno-utverzhdenie-a-ne-sotnyu.md` | `docs/zettel/string-induction-closed-one-statement-not-a-hundred.md` |
| `docs/zettel/dvoichnyy-v-main-otstal-ot-svoih-ischodnikov.md` | `docs/zettel/the-binary-in-main-lagged-its-own-sources.md` |
| `docs/zettel/vedomost-dvoichnogo-byvaet-slabee-i-nikogda-ne-silnee.md` | `docs/zettel/the-binary-ledger-can-be-weaker-and-never-stronger.md` |
| `docs/zettel/storozh-stolknoveniy-ne-znal-o-variantah-summy.md` | `docs/zettel/the-collision-guard-did-not-know-sum-variants.md` |
| `docs/zettel/cikl-porucheniy-prinadlezhit-hozyainu-a-ne-yazyku.md` | `docs/zettel/the-command-loop-belongs-to-the-host-not-the-language.md` |
| `docs/zettel/instrument-yazyka-pishetsya-na-yazyke-krome-effektov.md` | `docs/zettel/the-corpus-runner-is-written-in-flang-except-for-effects.md` |
| `docs/zettel/flang-bliznec-storozha-stolknoveniy-zelenel-na-treh-nastoyashchih-stolknoveniyah.md` | `docs/zettel/the-flang-twin-of-the-collision-guard-stayed-green-on-three-real-collisions.md` |
| `docs/zettel/veer-osnastki-schitaetsya-po-yadram-a-konchaetsya-pamyat.md` | `docs/zettel/the-harness-fan-is-sized-by-cores-but-memory-runs-out-first.md` |
| `docs/zettel/izmeritel-chisla-umiraet-ran-she-chem-chislo-v-proze.md` | `docs/zettel/the-measurer-dies-before-the-number-in-prose.md` |
| `docs/zettel/vypusk-ne-mog-sostoyatsya-nabor-treboval-arhiv-kotorogo-nikto-ne-sobiral.md` | `docs/zettel/the-release-was-closed-on-itself-the-suite-needed-an-archive-nobody-built.md` |
| `docs/zettel/tri-fakta-o-dline-dali-tri-utverzhdeniya.md` | `docs/zettel/three-length-facts-gave-three-statements.md` |
| `docs/zettel/dve-mery-stroki-delyat-vstroennye-formy.md` | `docs/zettel/two-string-measures-divided-the-builtin-forms.md` |
| `docs/zettel/dva-pravila-zavershaemosti-vmeste-dayut-574.md` | `docs/zettel/two-termination-rules-together-give-574.md` |
| `docs/zettel/ukazatel.flang` | `docs/zettel/zettel-index.flang` |
| `flang/test/fixtures/fts-slovar/slovar-chuzhoy-tip.fts` | `flang/test/fixtures/fts-slovar/dictionary-foreign-type.fts` |
| `flang/test/fixtures/fts-slovar/slovar-net-polya.fts` | `flang/test/fixtures/fts-slovar/dictionary-no-field.fts` |
| `flang/test/fixtures/fts-slovar/slovar-net-obyekta.fts` | `flang/test/fixtures/fts-slovar/dictionary-no-object.fts` |
| `flang/test/fixtures/fts-slovar/slovar.fts` | `flang/test/fixtures/fts-slovar/dictionary.fts` |
| `flang/test/fixtures/fts-slovar/prodazhi.fts` | `flang/test/fixtures/fts-slovar/sales.fts` |
| `flang/test/fixtures/korpus/chistyy.flang` | `flang/test/fixtures/korpus/clean.flang` |
| `flang/test/fixtures/korpus/lozhnyy.flang` | `flang/test/fixtures/korpus/lying.flang` |
| `flang/test/fixtures/razrez-kruga/krug-cherez-nagruzku.flang` | `flang/test/fixtures/razrez-kruga/circle-through-payload.flang` |
| `flang/test/fixtures/razrez-kruga/krug-so-svyortkoy.flang` | `flang/test/fixtures/razrez-kruga/circle-with-a-fold.flang` |
| `flang/test/fixtures/razrez-kruga/prodolzhenie-cherez-vlozhennuyu-nagruzku.flang` | `flang/test/fixtures/razrez-kruga/continuation-through-a-nested-payload.flang` |
| `flang/test/fixtures/razrez-kruga/poddelka-prodolzhenie-tem-zhe-dovodom.flang` | `flang/test/fixtures/razrez-kruga/forgery-continuation-with-the-same-argument.flang` |
| `flang/test/fixtures/razrez-kruga/poddelka-pustoy-spisok-otdelno.flang` | `flang/test/fixtures/razrez-kruga/forgery-empty-list-separately.flang` |
| `flang/test/fixtures/razrez-kruga/poddelka-shag-svyortki.flang` | `flang/test/fixtures/razrez-kruga/forgery-fold-step.flang` |
| `flang/test/fixtures/razrez-kruga/poddelka-uzel-celikom.flang` | `flang/test/fixtures/razrez-kruga/forgery-whole-node.flang` |
| `flang/test/fixtures/razrez-kruga/sverka-pechati-literala.flang` | `flang/test/fixtures/razrez-kruga/literal-print-comparison.flang` |
| `flang/test/fixtures/zapis-setki.json` | `flang/test/fixtures/record-grid.json` |
| `flang/test/fixtures/zapis-oracula.json` | `flang/test/fixtures/record-oracle.json` |
| `flang/test/oblast/01-prodlenie.c` | `flang/test/oblast/01-extension.c` |
| `flang/test/oblast/02-vnutri.c` | `flang/test/oblast/02-inside.c` |
| `flang/test/oblast/03-musor.c` | `flang/test/oblast/03-garbage.c` |
| `flang/test/oblast/04-perekladka.c` | `flang/test/oblast/04-relayout.c` |
| `flang/test/oblast/05-podgraf.c` | `flang/test/oblast/05-subgraph.c` |
| `flang/test/oblast/06-mimo-bolshe.c` | `flang/test/oblast/06-past-larger.c` |
| `flang/test/oblast/07-mimo-menshe.c` | `flang/test/oblast/07-past-smaller.c` |
| `flang/test/oblast/08-melkiy.c` | `flang/test/oblast/08-small.c` |
| `flang/test/oblast/09-otkaz.c` | `flang/test/oblast/09-refusal.c` |
| `flang/test/oblast/10-bez-areny.c` | `flang/test/oblast/10-without-arena.c` |
| `flang/test/oblast/11-vlozhennye.c` | `flang/test/oblast/11-nested.c` |
| `flang/test/oblast/preludiya.h` | `flang/test/oblast/prelude.h` |
| `scripts/guards/postavka-guard.flang` | `scripts/guards/delivery-guard.flang` |
| `scripts/guards/storozha-bez-podloga.sh` | `scripts/guards/guards-without-forgery-probe.sh` |
| `scripts/guards/pol-dokazannogo-sverka.sh` | `scripts/guards/proved-share-vs-tree.sh` |
| `scripts/guards/kto-zovet-storozhey.sh` | `scripts/guards/who-calls-the-guards.sh` |
| `scripts/ledgers/storozha-bez-podloga.json` | `scripts/ledgers/guards-without-forgery-probe.json` |
| `scripts/ledgers/storozha-bez-zova.json` | `scripts/ledgers/uncalled-guards.json` |
| `scripts/repl-proba.sh` | `scripts/repl-probe.sh` |
| `scripts/seed/pechat-povtorima.sh` | `scripts/seed/print-is-repeatable.sh` |
| `scripts/seed/semya-osvezhit.sh` | `scripts/seed/seed-refresh.sh` |
| `scripts/seed/semya-rantayma-eto-istochnik.sh` | `scripts/seed/seed-runtime-is-source.sh` |
| `scripts/seed/chto-otstalo-ot-semeni.sh` | `scripts/seed/what-lags-the-seed.sh` |
| `scripts/targets/lico-celi-cpp.flang` | `scripts/targets/cpp-target-face.flang` |
| `scripts/flangtutor-proba.sh` | `scripts/tutor-probe.sh` |

## Два имени, которые держит перепечатка, а не осторожность (18 сентября 2026)

`scripts/otpechatok-semeni` и `scripts/raskrutka.sh` остались в ведомости долга, и
причина у них теперь названа прогоном, а не «идёт печать».

Сначала я думал, что дело только в строке внутри семени: путь
«scripts/otpechatok-semeni» набран в `bootstrap/flang_repl.c:616` — а это
КОПИРУЕМАЯ часть семени, её обновляет быстрый пересев за минуты. Поставил опыт:
переименовал оба файла, свёл 132 живых читателя, пересобрал двоичный и спросил
приборы. Ответ другой, и он решает дело:

    sh scripts/seed/seed-freshness.sh
      ОТКАЗЫВАЮСЬ СУДИТЬ: семя отстало от исходников на 3 файла
      • flang/self/bootstrap/compiler.flang: изменён после перепечатки
    sh scripts/seed/seed-refresh.sh --check
      быстрый пересев здесь не годится — он трогает только копируемые файлы,
      а разошлось замыкание

Имена встречаются и в ПЕЧАТАЕМОЙ части исходников: `flang/self/bootstrap/compiler.flang`
строки 83 и 1157 (комментарии) и `flang/self/cli.flang:200` (строка справки). Любая
правка `flang/self`, хоть в комментарии, отбрасывает семя назад — и тогда цена
переименования сегодня равна полной перепечатке, около десяти часов.

Поэтому переименование едет ВМЕСТЕ с партией семени №2, где печать и так будет:
правка исходников и ведомостей, перепечатка, и только после неё дерево и сам
двоичный называют новые имена — `scripts/seed-fingerprint` и
`scripts/bootstrap-reprint.sh`. Опыт откачен, дерево оставлено как было.

## Чем кончилось

Приём задачи — «`git grep -l raskrutka.sh` находит только историю». Прогон 22 сентября
2026 на стволе `d0763e8b6`: файл `scripts/raskrutka.sh` в дереве, зовущих файлов **225**,
среди них живые — `.github/workflows/{binary,ci,install-path,reprint}.yml`,
`flang/proof/{доля-корпуса,сверить,сличить}.sh`, `flang/proof/checker/Makefile`,
`bootstrap/flang_repl.c`. Не сделана; ветка `a/1428-translit-file-names-to-english` на
сервере не живёт.
