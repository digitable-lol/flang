---
номер: 0026
заголовок: Имена заметок базы знаний — английские слова, а не транслит
статус: свободна (ветка из шапки не существует; сделано ли — НЕ УСТАНОВЛЕНО)
исполнитель: —
ветка: —
команда: вторая
карта: —
рядом: —
---

# 0026. Имена заметок базы знаний — английские слова, а не транслит

По дереву транслит переименован — 292 файла за сутки. `docs/zettel/` остался: там
231 заметка, и часть имён — русские слова латиницей, которые не читает ни
русский, ни иностранец.

## Как понять, что сделано

`node docs/site/build.mjs --check` зелёный после переименования, битых ссылок
столько же, сколько было.

## Чем ограничено

Переименование заметки ломает три вещи разом: указатель базы знаний
(`docs/zettel/README.md` печатается прогоном, а не правится руками), адреса
страниц сайта `knowledge-<слаг>.html` и вики-ссылки `[[слаг]]` из соседних
заметок. Поэтому это не `git mv`, а переименование плюс правка всех ссылающихся
заметок плюс перепечатка указателя.

Существующие русские имена кириллицей (`ярлык`, `образцы.flang`) — выбор
владельца, их не трогают.

## Откуда

`/srv/work/zadachi-dlya-vtoroy-komandy.md`, общий раздел.

## Что сделано (ветка `b/zettel-english-names`)

Заметок в `docs/zettel/` на 24 августа 2026 — 507 файлов: указатель, 2 заметки
с русскими именами кириллицей (выбор владельца, не трогаются) и 504 с именами
латиницей. Из них транслитных — **218**, а не 231, как сказано выше.

Переименована **191**. Правлены все ссылающиеся: **443 ссылки в 234 файлах** —
вики-ссылки `[[слаг]]`, markdown-ссылки и пути `docs/zettel/<слаг>.md` в
комментариях `.flang`, `.c`, `.json`, `.yml`. Битых вики-ссылок было 12, стало
12 — те же самые, все из образцов кода.

## Не тронуто: 27 имён под чужими долями

7 заметок держит `b/targets-cyrillic` напрямую:
`chisla-sayta-tuhnut…`, `dizyunkciya-v-dopushchenii…`, `flang-bliznec-storozha…`,
`nezagruzhennaya-proba…`, `proverka-zovushchaya-kompilyator…`,
`tri-fakta-o-dline…`, `veer-osnastki…`.

20 упомянуты из файлов чужих долей — переименовать нельзя, не сломав ссылку в
файле, который держит сосед:

| заметка | держит файл | ветка |
|---|---|---|
| `pechat-plana-obeshchana-naiznanku…` | `docs/guide/limits.md`, `.ru.md` | `b/guide-proofread` |
| `darovoe-utverzhdenie-uznayotsya…` | `docs/emptiness-of-what-is-proved.md` | `b/targets-cyrillic` |
| `vedomost-dvoichnogo-byvaet-slabee…` | `docs/course/13-where-next.md` | `b/targets-cyrillic` |
| `zakony-kak-ukazatel` | `docs/guide/naming.md`, `.ru.md` | `b/targets-cyrillic` |
| `dva-pravila-zavershaemosti-vmeste-dayut-574` | `docs/site/what-is-proved.md`, `.ru.md` | `b/targets-cyrillic` |
| `vyvod-na-vetke-ne-vyvod-o-dereve` | `flang/proof/SPEC.md` | `b/targets-cyrillic` |
| `keshirovat-dokazatelstvo-dorozhe-chem-dokazat`, `node-ushyol-s-puti-sborki`, `vypusk-ne-mog-sostoyatsya…` | `flang/scripts/code-guard.flang` | `b/targets-cyrillic` |
| 11 остальных | 6 заметок из доли `b/targets-cyrillic` | `b/targets-cyrillic` |

Их берёт следующая работа — после свода этих веток.

## Ждёт прогона

Перепечатка семени идёт на машине, прогоны запрещены. Ветка отдаётся с
незакрытым хвостом:

1. `bootstrap/flang io docs/zettel/ukazatel.flang --max-orders 4000 --timeout 900000`
   (цель `указатель:печать`; в `b/targets-cyrillic` её переименовывают в
   кириллицу) — до неё в `docs/zettel/README.md` ровно 191 битая ссылка.
2. `bootstrap/flang io scripts/link-guard.flang` — красный до пункта 1, зелёный
   после; других битых ссылок работа не добавила.
3. `node docs/site/build.mjs --check` — сверка адресов `knowledge-<слаг>.html`.

`bootstrap/flang_repl.c` называет `docs/zettel/dvoichnyy-hozyain-obryvaet-soderzhimoe-na-pervom-nule.md`
в комментарии. Семя руками не правится; исходник
`flang/src/emit/c/flang_repl.c` поправлен, семя догонит перепечаткой.

## ⚑ Статус перепроверен 5 сентября 2026

Стояло «в работе», исполнитель `b`, ветка `b/zettel-english-names`. Ветки НЕТ:
у удалённого всего три ветки (`dev`, `main` и одна рабочая), и ни
одна из тридцати шести веток, названных задачами «в работе», среди
них не значится. Значит за задачей никто не стоит.

**Улика, что работа могла быть сделана.** Все файлы `docs/zettel/*.md` носят английские имена через дефис. Похоже, работа сделана, а статус не обновили.

Статус переведён в «свободна», НО это не значит «не сделано»:
установлено только то, что работы никто не ведёт. Взявшийся обязан
сперва проверить, не сделано ли уже, и если сделано — закрыть.
