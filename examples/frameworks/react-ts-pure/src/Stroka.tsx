/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import type { Dispatch } from 'react'
import { Bolshe, Menshe, shag, strokiVitriny } from '../printed/storefront.js'

type Props = { stroka: ReturnType<typeof strokiVitriny>[number]; dispatch: Dispatch<Parameters<typeof shag>[1]> }

export function Stroka({ stroka, dispatch }: Props) {
  return (
    <tr>
      <td>{stroka['название']}</td>
      <td>{stroka['цена']}</td>
      <td>
        <button disabled={stroka['меньше нельзя']} onClick={() => dispatch(Menshe({ 'артикул': stroka['артикул'] }))}>−</button>
        <output>{stroka['количество']}</output>
        <button disabled={stroka['больше нельзя']} onClick={() => dispatch(Bolshe({ 'артикул': stroka['артикул'] }))}>+</button>
      </td>
      <td>{stroka['стоимость']}</td>
    </tr>
  )
}
