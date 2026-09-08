/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import { itogi } from '../printed/storefront.js'

type Props = { itogi: ReturnType<typeof itogi> }

export function Itogi({ itogi }: Props) {
  return (
    <dl>
      <dt>Сумма</dt><dd>{itogi['сумма']} <small>({itogi['сумма копеек']} коп.)</small></dd>
      <dt>Скидка</dt><dd>{itogi['скидка']}</dd>
      <dt>К оплате</dt><dd><b>{itogi['к оплате']}</b> <small>({itogi['к оплате копеек']} коп.)</small></dd>
    </dl>
  )
}
