/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import { useReducer } from 'react'
import { nachalnayaKorzina, shag, strokiVitriny, itogi, Sbrosit } from '../printed/storefront.js'
import { Stroka } from './Stroka.tsx'
import { Itogi } from './Itogi.tsx'

export default function App() {
  const [korzina, dispatch] = useReducer(shag, nachalnayaKorzina())
  return (
    <main>
      <h1>Витрина — ядро на flang, React только рисует</h1>
      <table>
        <thead>
          <tr><th>товар</th><th>цена</th><th>кол-во</th><th>стоимость</th></tr>
        </thead>
        <tbody>
          {strokiVitriny(korzina).map((stroka) => (
            <Stroka key={stroka['артикул']} stroka={stroka} dispatch={dispatch} />
          ))}
        </tbody>
      </table>
      <Itogi itogi={itogi(korzina)} />
      <p>
        <button onClick={() => dispatch(Sbrosit())}>Сбросить корзину</button>
      </p>
      <footer>
        Данные, суммы, скидку, границы количества и запись рублей считает
        <code>core/vitrina.flang</code>; в компонентах React нет ни строки логики.
      </footer>
    </main>
  )
}
