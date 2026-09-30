# Ловушка проверки 1: по одной цели на каждый вид обязательства

Проверка 1 вердикта (`scripts/provability.fscript`) отвечает на вопрос, не
заменяет ли проверяющая программа доказательство вычислением. Ловушка — таблица
целей `flang/proof/checker/tests/trap/kinds.tsv`: у каждой цели сказано, обязана
ли проверяющая программа переиграть её сама или обязана оставить на слове ядра.

## Таблица

Первая строка — заголовок, дальше по строке на цель, восемь колонок через
табуляцию:

| колонка | что в ней |
|---|---|
| `kind` | имя вида обязательства; единственное в таблице, им называется беда в вердикте |
| `awaited` | `removed` — цель обязана быть переиграна; `kept` — цель обязана остаться на слове ядра |
| `source` | путь к исходнику; его sha256 подаётся проверяющей программе третьим доводом |
| `record` | путь к записи доказательства, вне `tests/records/corpus` |
| `goal` | имя утверждения, теоремы или функции в записи |
| `trace` | подстрока, обязанная стоять в записи: по ней цель принадлежит своему виду |
| `sign` | образец, обязанный найтись в сводке проверяющей программы; `[1-9]` — любая цифра, кроме нуля; `—` — не спрашивается |
| `code` | ожидаемый код возврата на паре целиком: 0 либо 3 |

Сами пары «исходник и запись» лежат в `tests/families/**` и `tests/records/**`,
вне корпуса, поэтому доля проигрыванием от ловушки не зависит.

## Две половины

**`kept`.** Цель доказуема только вычислением. Проверяющая программа обязана
назвать её строкой «за узел не взялся». Сняла хоть одну — проверка 1 отвечает
«НЕТ».

**`removed`.** По одной цели на каждый вид обязательства, который проверяющая
программа переигрывает. Без этой половины проверку 1 проходила бы и программа,
не доказывающая ничего. У каждой цели сверяются четыре вещи: код возврата равен
ожидаемому; имя цели в выводе не названо; `trace` стоит в записи; `sign` стоит в
сводке. Любое расхождение — «НЕТ» с именем вида.

Число строк каждой половины держит [храповик](../../../ratchets.md): ключи
`trap-kinds` и `trap-goals-on-kernel-word`.

## Виды

| `kind` | `awaited` | что это за обязательство |
|---|---|---|
| `identity-sign-for-sign` | `removed` | тождество знак в знак |
| `forall-neighbours-swapped` | `kept` | ∀-цель: перестановка соседей |
| `forall-length-after-append` | `kept` | ∀-цель: мера прибавления |
| `node-carrier-segment` | `removed` | узел «разбором по случаям», носитель segment |
| `node-carrier-algebra-nonnegative` | `removed` | узел, носитель algebra, домен неотрицательности |
| `node-carrier-algebra-boolean` | `removed` | узел, носитель algebra, булева цель |
| `node-carrier-algebra-identity` | `removed` | узел, носитель algebra, тождество с развёрткой по конструктору |
| `node-carrier-fold` | `removed` | узел, носитель fold |
| `carrier-declared-segment-synonym` | `removed` | носитель с объявления: синоним имени отрезка |
| `carrier-declared-segment-alias` | `removed` | носитель с объявления: псевдоним к отрезку |
| `goal-split-by-condition` | `removed` | разбор цели по условию |
| `moves-neighbours` | `removed` | ходы под постусловием: соседи |
| `moves-unfold-and-identity` | `removed` | ходы под постусловием: развёртка и закрыть тождеством |
| `moves-division-and-choice` | `removed` | ходы разбора цели: деление и выбор |
| `step-by-example-in-case` | `removed` | шаг теоремы «по примеру» в случае |
| `step-by-property` | `removed` | шаг теоремы «по свойству» |
| `step-by-example-outside-case` | `removed` | шаг теоремы вне случая: подстановка тела |
| `step-over-list-body` | `removed` | шаг теоремы над списочным телом: оглавление печати |
| `inference-family-nonnegative` | `removed` | вывод, семейство Н (неотрицательность) |
| `inference-family-ceiling` | `removed` | вывод, семейство П (потолок) |
| `inference-family-representable` | `removed` | вывод, семейство Пред (представимость → П3) |
| `inference-family-assumption` | `removed` | вывод, семейство Т (цель есть допущение) |
| `inference-family-unfolding` | `removed` | вывод, семейство Разв (развёртка плоского определения) |
| `inference-family-order` | `removed` | вывод, семейство О (порядок) |
| `inference-family-floor` | `removed` | вывод, семейство Д (дно терма) |
| `inference-family-strict-order` | `removed` | вывод, семейство С (строгий порядок) |
| `inference-family-adjacent-order` | `removed` | вывод, семейство СС (порядок соседних) |
| `inference-family-membership` | `removed` | вывод, семейство В (вхождение) |
| `inference-family-string-prefix` | `removed` | вывод, семейство Ч (начало строки) |
| `input-obligation-closed-by-caller` | `removed` | обязательство входа, закрытое зовущим |
| `totality-composition` | `removed` | тотальность composition |
| `totality-structure` | `removed` | тотальность structure |
| `totality-step` | `removed` | тотальность step |
| `node-carrier-algebra-at-most` | `removed` | узел, носитель algebra, домен «не больше» (порядок/потолок по телу случая) |
| `node-carrier-algebra-guard` | `removed` | узел, носитель algebra, домен охраны «если У то Ц иначе да» (конъюнкт охраны по конструктору) |
| `statement-reduced-to-postcondition` | `removed` | утверждение без функции: доказательство переиграно, сведением к постусловию вызываемой функции |
| `statement-forall-neighbours-swapped` | `kept` | утверждение без функции: ∀-цель перестановки соседей без ходов |
| `statement-several-binders-neighbours` | `removed` | утверждение без функции: несколько связываний в одной строке «для всех», ход «соседи» |
| `statement-neutral-zero` | `removed` | утверждение без функции: нейтральный ноль при посылке «таких что н больше 0» (Тожд2) |
| `statement-closed-goal-computed` | `removed` | утверждение без функции и без связываний: вычисление замкнутой цели (Выч) |
| `statement-node-own-sum` | `removed` | узел утверждения без функции, носитель algebra по СВОЕЙ сумме |
| `inference-family-all-elements` | `removed` | вывод по семейству Э: цель «для всех э из Л: П» выведена по построению списка |

## Проверить копию таблицы

```sh
FLANG_TRAP_TABLE=/путь/копия.tsv bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000
```

Строка, убранная из копии, даёт «ловушка ослабла: видов N при храповике M».
