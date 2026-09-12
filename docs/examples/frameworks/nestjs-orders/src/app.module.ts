/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller.js'

@Module({
  controllers: [OrdersController],
})
export class AppModule {}
