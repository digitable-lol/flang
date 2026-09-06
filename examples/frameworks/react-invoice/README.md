# flang + React: точный счёт

Корзина на React, деньги — на flang. Хозяин (React) хранит, сколько чего в
корзине, и рисует счёт; суммы, скидку и итог считает доказанно-тотальное ядро —
целыми копейками, без ошибок float.

```
core/cart.flang                 решение: сумма корзины, скидка, итог, строки счёта
core/catalog.flang              зависимость ядра: товары, цена, поиск по артикулу
printed/cart_service.js        оба модуля, напечатанные в JS одним файлом (zero-dep)
printed/flang_cli.js           прогонщик ядра для CLI-проверки границы входа
src/App.tsx                     хозяин: состояние корзины, разметка, рендер
src/main.tsx                    точка входа React
```

## Граница и почему копейки

На flang написано то, что **решает**: `Сумма корзины`, `Скидка в процентах`
(ступени 0/5/10 %), `Сумма со скидкой`, `Строка позиции`, `Счёт корзины`. Цены
и суммы — целым числом минорных единиц (копеек). Рубли дробным числом были бы
ошибкой: `0,1 + 0,2` в машинном числе не даёт `0,3`, и счёт из трёх позиций
разошёлся бы с суммой на копейку. Ядро этого избегает по устройству, а его
тотальность проверил компилятор.

Хозяину (React) остаётся то, что **держит состояние и рисует**: количество
каждого товара, поля ввода, DOM. Своей денежной арифметики в `App.tsx` нет ни
строки — только вызовы ядра и деление на 100 для показа.

## Стык

`src/App.tsx` импортирует напечатанный модуль напрямую:

```ts
import {
  sozdatKatalog, sozdatTovar, sozdatKorzina, sozdatPoziciya,
  summaKorziny, skidkaVProcentah, summaSoSkidkoy,
} from '../printed/cart_service.js'
```

Имена translit из русских: «Сумма корзины» → `summaKorziny`, «Сумма со скидкой»
→ `summaSoSkidkoy`. Записи строят фабрики `sozdat…` — поля с русскими ключами
(`«артикул»`, `«цена»`, `«количество»`). Значения: список → массив, запись →
объект.

## Проверка без фреймворка

Ядро zero-dep, сервер поднимать не нужно:

```
node --input-type=module -e 'import("./printed/cart_service.js").then(m=>{
  const cat = m.sozdatKatalog({ "товары": [
    m.sozdatTovar({ "артикул":"ч-1","название":"чайник","цена":250000,"остаток":3 }),
    m.sozdatTovar({ "артикул":"к-7","название":"кружка","цена":39000,"остаток":10 }),
  ]});
  const cart = m.sozdatKorzina({ "позиции": [
    m.sozdatPoziciya({ "артикул":"ч-1","количество":2 }),
    m.sozdatPoziciya({ "артикул":"к-7","количество":3 }),
  ]});
  const s = m.summaKorziny(cat, cart);
  console.log(s, m.skidkaVProcentah(s), m.summaSoSkidkoy(s)); // 617000 5 586150
})'
```

## Запуск фреймворком

```
npm install
npm run dev        # режим разработки
npm run build      # production-сборка в dist/ (генерат ядра попадает в бандл)
npm run typecheck  # tsc --noEmit
```

## Переиздать ядро

Из корня дерева flang (печатается `cart.flang`, `catalog.flang` берётся рядом):

```
bootstrap/flang emit examples/frameworks/react-invoice/core/cart.flang \
  --target js --out examples/frameworks/react-invoice/printed
```

Файлы в `printed/` печатает компилятор — руками их не правят, правят
`core/*.flang` и печатают заново.
