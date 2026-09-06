/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const порт = Number(process.env.PORT ?? 3000)
  await app.listen(порт)
  // eslint-disable-next-line no-console
  console.log(`orders-api слушает :${порт} — решает ядро на flang`)
}

void bootstrap()
