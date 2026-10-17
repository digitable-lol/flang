[Back to README](../../README.md) · [Documentation index](../README.md)

# The shell: statements and syllogisms

The `flang` shell (`flang repl`) judges a claim as soon as it is entered. There
are two ways to enter one: declare a statement in the language, or type an
argument in Russian sentences with the `.syllogism` command. The decision and
its limits are in
[ADR-0148](../adr/0148-the-shell-judges-statements-and-syllogisms.md).

Every session below was taken from a run: it was fed to the shell on standard
input from an empty directory (`NO_COLOR=1 flang repl < session.txt`). The same
sessions are in
[`flang/proof/probes/repl-statements/programs`](../../flang/proof/probes/repl-statements/programs),
and `bootstrap/flang io flang/proof/probes/repl-statements/run.fscript --plan Binary`
compares their output with `expected.tsv`.

## Statements

`statement`, `theorem` and `follows` (`утверждение`, `теорема`, `следует`) are
declarations in the shell. An empty line ends the input. When the input holds a
statement or a theorem, the shell runs its own binary as
`flang check --proof --strict --json` on the whole session and answers for every
claim with one of three lines. The codes are those of `check --proof --strict`
([ADR-0115](../adr/0115-the-exit-code-of-a-proof-check-names-what-was-proved.md)):

| Answer | Code | Meaning |
| --- | --- | --- |
| `доказано` (proved) | 0 | the kernel derived the claim about every input, and the checker did not object |
| `опровергнуто` (refuted) | 1 | an input on which the claim is false was found; it follows the words «пример против» |
| `не доказано` (not proved) | 3 | there is no proof; the second line carries the ledger's words about what was missing |

The line under the answer carries the ledger's words: which rule proved the
claim, or why it was not proved.

```
утверждение «сложение перестановочно»
  для всех а: число и б: число
  утверждаем а плюс б равно б плюс а

.объявления
```

```
объявлено: утверждение «сложение перестановочно»
утверждение «сложение перестановочно»: доказано (код 0)
  сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
1. утверждение «сложение перестановочно» — доказано
```

The kernel does not prove a false statement. When the check finds no input on
which it is false, the statement stays in the session, marked «не доказано»:

```
утверждение «всякое натуральное меньше тысячи»
  для всех а: нат
  утверждаем а меньше 1000

.объявления
```

```
объявлено: утверждение «всякое натуральное меньше тысячи»
утверждение «всякое натуральное меньше тысячи»: не доказано (код 3)
  объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
1. утверждение «всякое натуральное меньше тысячи» — не доказано
```

### What stays in the session

- **Proved and unproved claims** stay. An unproved one is marked in
  `.list`. A theorem entered later can prove it, and the shell then says
  «теперь доказано».
- **A refuted claim** does not enter the session. The session stays as it was,
  and the answer says «ввод в сессию не принят».
- **An input after which the session check fails** (for example, a theorem
  step is not derived) is not taken either, and the first diagnostic is
  printed.
- **The check failed before this input as well** (the session has a function
  with a false example): the claim is taken as «не доказано», and the earlier
  diagnostic is named as the reason.

A claim that leans on an unproved one does not become proved itself:

```
утверждение «всякое натуральное меньше тысячи»
  для всех а: нат
  утверждаем а меньше 1000

утверждение «пять меньше тысячи»
  для всех б: нат таких что б равно 5
  утверждаем б меньше 1000

следует «пять меньше тысячи»
  дано б: нат
  дано б равно 5
  утверждаем б меньше 1000
  по свойству «всякое натуральное меньше тысячи»
```

```
объявлено: утверждение «всякое натуральное меньше тысячи»
утверждение «всякое натуральное меньше тысячи»: не доказано (код 3)
  объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
объявлено: утверждение «пять меньше тысячи»
утверждение «пять меньше тысячи»: не доказано (код 3)
  объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
объявлено: теорема «пять меньше тысячи»
теорема «пять меньше тысячи»: не доказано (код 3)
  доказано ПРИ УСЛОВИИ: терм принят ядром, 1 шаг — но шаг «по свойству» засчитал фактом 1 посылку, которых ядро не доказало: постусловие «всякое натуральное меньше тысячи» функции «». Обо ВСЕХ входах это утверждение доказано ровно настолько, насколько доказана эта посылка
```

### A syllogism as declarations

Notions and properties are flags of a record. The premises become `таких что`
restrictions, and the conclusion becomes a `следует` block:

```
объект «Предмет»
  «человек»: признак
  «смертен»: признак

утверждение «Сократ смертен»
  для всех «Сократ»: «Предмет» таких что (если «Сократ».«человек» то «Сократ».«смертен» иначе да) и притом «Сократ».«человек»
  утверждаем «Сократ».«смертен»

следует «Сократ смертен»
  дано «Сократ»: «Предмет»
  дано (если «Сократ».«человек» то «Сократ».«смертен» иначе да)
  дано «Сократ».«человек»
  утверждаем «Сократ».«смертен»
  по предположению
```

```
объявлено: запись «Предмет»
объявлено: утверждение «Сократ смертен»
утверждение «Сократ смертен»: доказано (код 0)
  сведением цели с телом функции: правило «цель есть допущение», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
объявлено: теорема «Сократ смертен»
теорема «Сократ смертен»: доказано (код 0)
  доказано: терм принят ядром, 1 шаг, правило «цель есть допущение» — утверждение обо ВСЕХ входах
```

Affirming the consequent ("Socrates is mortal, so he is a man"), entered as one
input with a false theorem, is not taken: the kernel does not derive the step.

```
объект «Предмет»
  «человек»: признак
  «смертен»: признак

утверждение «Сократ — человек»
  для всех «Сократ»: «Предмет» таких что (если «Сократ».«человек» то «Сократ».«смертен» иначе да) и притом «Сократ».«смертен»
  утверждаем «Сократ».«человек»
следует «Сократ — человек»
  дано «Сократ»: «Предмет»
  дано (если «Сократ».«человек» то «Сократ».«смертен» иначе да)
  дано «Сократ».«смертен»
  утверждаем «Сократ».«человек»
  по предположению

.объявления
```

```
объявлено: запись «Предмет»
не принято: FLANG_PROOF_STEP в сессии, строка 14, столбец 3: шаг 1, теорема «Сократ — человек»: «по предположению» вне индукции: цель не выведена из допущений теоремы — весь ответ ядра: «.сохранить» и flang check --proof
ввод в сессию не принят: сессия осталась прежней (код 1)
1. запись «Предмет»
```

### English words

`statement`, `for all` and `claim` are parsed like the Russian words. The
checker (`flang/proof/checker`) reads the English surface differently from the
kernel and does not accept the proof record. So a statement proved by the
kernel in English words gets «не доказано» and code 3, not 0:

```
statement «addition commutes»
  for all a: number и b: number
  claim a plus b equals b plus a
```

```
объявлено: утверждение «addition commutes»
утверждение «addition commutes»: не доказано (код 3)
  НЕ СОШЛОСЬ СО СВЕРЩИКОМ — сверщик не принял запись доказательства файла без ввоза: НЕ СОШЛОСЬ: в исходнике постусловий 0, а в записи утверждений 1 — запись говорит не обо всей программе
```

## The `.syllogism` command

`.syllogism` (`.силлогизм`) reads a text up to an empty line or from a file
(`.syllogism argument.txt`) and hands it to the syllogism judge
`flang/proof/probes/syllogism/sentences/run.fscript` (plan `Judge`). The judge
translates the text into a program and checks it with `check --proof --strict`.
The dictionary lines `Понятие:`, `Свойство:`, `Имя:` (notion, property, name)
name the word forms.

```
.силлогизм
Понятие: человек, люди.
Свойство: смертен, смертны.
Имя: Сократ.
Все люди смертны. Сократ — человек. Следовательно, Сократ смертен.
```

```
1. посылка: Все люди смертны.
2. посылка: Сократ — человек.
3. заключение: Следовательно, Сократ смертен.
СЛЕДУЕТ: предложение 3 выведено из посылок 1, 2
ядро: ДОКАЗАНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
силлогизм: следует (код 0)
```

When the conclusion does not follow, the judge prints a counterexample. The
translator picks it and the kernel does not check it, and the judge says so:

```
.syllogism
Понятие: человек, люди.
Свойство: смертен, смертны.
Имя: Сократ.
Все люди смертны. Сократ смертен. Следовательно, Сократ — человек.
```

```
1. посылка: Все люди смертны.
2. посылка: Сократ смертен.
3. заключение: Следовательно, Сократ — человек.
НЕ СЛЕДУЕТ: предложение 3 «Следовательно, Сократ — человек.» не выведено из посылок 1, 2
ядро: FLANG_PROOF_STEP, строка 16 проверенной программы — цель не выведена из допущений теоремы
пример против, подсказка переводчика, ядром не проверена — «Сократ»: человек — нет, смертен — да
силлогизм: не следует (код 1)
```

### Without a dictionary

When the text has no dictionary line, the words are read by the morphology in
`flang/experimental/ru-syllogism-demo.fscript` (plan `Demo`). The dictionary it
reads goes to the same judge:

```
.силлогизм
Все мохнатые тихи. Барсик тих. Значит, Барсик — мохнатый.
```

```
словаря в тексте нет: слова читает морфология (flang/experimental/ru-syllogism-demo.fscript)
── ввод ──
текст, как его написал человек:
  1. Все мохнатые тихи.
  2. Барсик тих.
  3. Значит, Барсик — мохнатый.
что прибор прочитал сам, без единого объявления:
  Имя: Барсик
  Свойство: тих, тихи; она тиха; оно тихо
  Понятие: мохнатый, мохнатые
где язык двоится и нужна строка от человека:
  негде
приговор судьи, код 1:
  1. посылка: Все мохнатые тихи.
  2. посылка: Барсик тих.
  3. заключение: Следовательно, Барсик — мохнатый.
  НЕ СЛЕДУЕТ: предложение 3 «Следовательно, Барсик — мохнатый.» не выведено из посылок 1, 2
  ядро: FLANG_PROOF_STEP, строка 16 проверенной программы — цель не выведена из допущений теоремы
  пример против, подсказка переводчика, ядром не проверена — «Барсик»: тих — да, мохнатый — нет
силлогизм: не следует (код 1)
```

Where the morphology cannot derive a form, it names the dictionary line to add
and gives no verdict:

```
.силлогизм
Все люди смертны. Сократ — человек. Следовательно, Сократ смертен.
```

```
словаря в тексте нет: слова читает морфология (flang/experimental/ru-syllogism-demo.fscript)
── ввод ──
текст, как его написал человек:
  1. Все люди смертны.
  2. Сократ — человек.
  3. Следовательно, Сократ смертен.
что прибор прочитал сам, без единого объявления:
  Имя: Сократ
где язык двоится и нужна строка от человека:
  предложение 1, «люди»: по месту в предложении нужно понятие во множественном
    морфология даёт чтений 2 — различить: «понятие» — подлежащее или сказуемое через тире «свойство» — сказуемое без тире
    а формы не даёт: единственное существительного из множественного не выводится: «киты» дают «кит», а «люди» — «человек»; впишите форму руками
    допишите одну строку: Понятие: человек, люди
  предложение 1, «смертны»: по месту в предложении нужно свойство во множественном
    морфология даёт чтений 2 — различить: «понятие» — подлежащее или сказуемое через тире «свойство» — сказуемое без тире
    а формы не даёт: мужская краткая форма из прочих не выводится: вставляется ли гласная и какая, по форме не читается; выберите форму руками
    допишите одну строку: Свойство: смертен, смертны
приговора нет: словарь неполон — допишите строку выше в текст и прогоните снова
силлогизм: без словаря не судится — допишите в текст строки, названные выше (код 3)
```

The judge and the morphology are looked up next to the binary, in the source
tree (`../flang/…` from the `bootstrap` directory). When they are not there,
the command says so and judges nothing.

## Exit code of a session

Under a pipe (`flang repl < session.txt`) the shell exits with 1 when an input
was not taken or a syllogism does not follow, with 3 when a claim stayed
unproved or a text got no verdict, and with 0 otherwise. At a terminal the
code is always 0.

## Cost

Every input with a claim is one run of `check --proof` on the whole session; on
the sessions above it takes less than a second. `.syllogism` takes longer: the
judge checks its own plan before it works, and one text takes about 8 seconds.
