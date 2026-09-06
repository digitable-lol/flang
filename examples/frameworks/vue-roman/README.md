# flang + Vue: римские цифры

Форма на Vue, арифметика — на flang. Ввод и разметку держит хозяин (Vue),
перевод числа в римскую запись и обратно считает доказанно-тотальное ядро.

```
core/roman-numerals.flang       решение: 2024 ↔ MMXXIV, диапазон 1..3999
printed/roman_numerals.js      то же ядро, напечатанное в JS (zero-dep, ESM)
printed/flang_cli.js           прогонщик ядра для CLI-проверки границы входа
src/App.vue                      хозяин: поля ввода, реактивность, разметка
src/main.ts                      точка входа Vue
```

## Граница

На flang написано то, что **решает**: `В римские` (число → строка) и
`Из римских` (строка → число), плюс `Туда и обратно` — утверждение, что запись
и чтение обратны друг другу, проверенное на краях диапазона. Все функции ядра
тотальны: цикла «пока остаток больше нуля» здесь нет, запись идёт по четырём
разрядам, чтение — свёрткой по списку символов.

Хозяину (Vue) остаётся то, что **ждёт и рисует**: поля ввода, реактивное
пересчитывание, DOM. Своей арифметики в `App.vue` нет ни строки — только вызовы
ядра.

## Стык

`src/App.vue` импортирует напечатанный модуль напрямую:

```ts
import { vRimskie, izRimskih, tudaIObratno } from '../printed/roman_numerals.js'
```

Имена translit из русских: «В римские» → `vRimskie`, «Из римских» → `izRimskih`,
«Туда и обратно» → `tudaIObratno`. Модуль самодостаточен — ни одной зависимости,
идёт и в Node, и в браузере.

## Проверка без фреймворка

Ядро zero-dep, сервер поднимать не нужно:

```
node --input-type=module -e 'import("./printed/roman_numerals.js").then(m=>{
  console.log(m.vRimskie(2024));      // MMXXIV
  console.log(m.izRimskih("MCMLXXXIV"));  // 1984
  console.log(m.tudaIObratno(3888));  // true
})'
```

## Запуск фреймворком

```
npm install
npm run dev        # режим разработки
npm run build      # production-сборка в dist/ (генерат ядра попадает в бандл)
npm run typecheck  # vue-tsc --noEmit
```

## Переиздать ядро

Из корня дерева flang:

```
bootstrap/flang emit examples/frameworks/vue-roman/core/roman-numerals.flang \
  --target js --out examples/frameworks/vue-roman/printed
```

Файлы в `printed/` печатает компилятор — руками их не правят, правят
`core/roman-numerals.flang` и печатают заново.
