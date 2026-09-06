/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

// Хозяин — NestJS. Он принимает HTTP-соединение, разбирает метод/путь/строку
// запроса и отдаёт ответ. Решение — flang: маршрут, коды, проверка
// обязательных полей считает доказанно-тотальное ядро orders_api.js. Ни разбора
// маршрута, ни кодов ответа в этом контроллере нет — только вызов ядра.
import { All, Controller, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { obrabotatZapros, kodOtveta, teloOtveta } from '../printed/orders_api.js'

@Controller()
export class OrdersController {
  @All('*')
  handle(@Req() req: Request, @Res() res: Response): void {
    // Путь express отдаёт percent-encoded (для «/заказы» — «/%D0%B7…»), а
    // ядро сверяет с русским «/заказы». Раскодировать — работа хозяина; ядро
    // тотально и на кривом пути (ответит 404, а не упадёт), поэтому URIError на
    // битом вводе просто гасим и отдаём путь как есть.
    let путь = req.path
    try { путь = decodeURIComponent(req.path) } catch { /* оставить как пришло */ }

    // Строку запроса собираем из уже разобранного express-ом словаря —
    // ключи и значения приходят декодированными («товар=ч-1&количество=2»).
    const хвост = Object.entries(req.query)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : String(v)}`)
      .join('&')

    // Единственная строка стыка: хозяин зовёт ядро и исполняет, что оно решило.
    const ответ = obrabotatZapros(req.method, путь, хвост)
    res.status(kodOtveta(ответ)).send(teloOtveta(ответ))
  }
}
