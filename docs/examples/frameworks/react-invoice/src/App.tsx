/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

// Хозяин — React. Он держит состояние корзины (сколько чего) и рисует счёт.
// Решение — flang: все суммы, скидку и строки счёта считает доказанно-тотальное
// ядро cart_service.js. Цены и суммы в КОПЕЙКАХ, целым числом: 0,1 + 0,2 в
// машинном числе не даёт 0,3, и счёт из трёх позиций разошёлся бы на копейку.
// Здесь этого не может быть — арифметику ведёт ядро, а не JS-число.
import { useState } from 'react'
import {
  sozdatKatalog, sozdatTovar, sozdatKorzina, sozdatPoziciya,
  summaKorziny, skidkaVProcentah, summaSoSkidkoy,
} from '../printed/cart_service.js'

// Каталог — данные хозяина (в жизни пришли бы из БД). Цена в копейках.
const tovary = [
  { 'артикул': 'ч-1', 'название': 'чайник', 'цена': 250000, 'остаток': 3 },
  { 'артикул': 'к-7', 'название': 'кружка', 'цена': 39000, 'остаток': 10 },
]
const catalog = sozdatKatalog({ 'товары': tovary.map((t) => sozdatTovar(t)) })

const рубли = (копейки: number) =>
  (копейки / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function App() {
  const [кол, setКол] = useState<Record<string, number>>({ 'ч-1': 2, 'к-7': 3 })

  const cart = sozdatKorzina({
    'позиции': tovary
      .filter((t) => (кол[t['артикул']] ?? 0) > 0)
      .map((t) => sozdatPoziciya({ 'артикул': t['артикул'], 'количество': кол[t['артикул']] })),
  })

  const сумма = summaKorziny(catalog, cart)
  const скидка = skidkaVProcentah(сумма)
  const итог = summaSoSkidkoy(сумма)

  return (
    <main>
      <h1>Счёт — ядро на flang, форма на React</h1>
      <table>
        <thead>
          <tr><th>товар</th><th>цена</th><th>кол-во</th></tr>
        </thead>
        <tbody>
          {tovary.map((t) => (
            <tr key={t['артикул']}>
              <td>{t['название']}</td>
              <td>{рубли(t['цена'])} ₽</td>
              <td>
                <input
                  type="number" min={0} max={t['остаток']}
                  value={кол[t['артикул']] ?? 0}
                  onChange={(e) =>
                    setКол({ ...кол, [t['артикул']]: Math.max(0, Number(e.target.value)) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl>
        <dt>Сумма</dt><dd>{рубли(сумма)} ₽ <small>({сумма} коп.)</small></dd>
        <dt>Скидка</dt><dd>{скидка} %</dd>
        <dt>К оплате</dt><dd><b>{рубли(итог)} ₽</b> <small>({итог} коп.)</small></dd>
      </dl>

      <footer>
        Суммы считает <code>core/cart.flang</code> в целых копейках; React только
        хранит количества и рисует. Скидка ступенями (0/5/10 %) — тоже решение ядра.
      </footer>
    </main>
  )
}
