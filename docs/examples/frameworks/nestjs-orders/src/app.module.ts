import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller.js'

@Module({
  controllers: [OrdersController],
})
export class AppModule {}
