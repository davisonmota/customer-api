import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerEventsPublisher } from './customer-events.publisher.js';
import {
  CUSTOMER_EVENTS_CLIENT,
  RABBITMQ_URL,
  WELCOME_EMAIL_QUEUE,
  WELCOME_EMAIL_QUEUE_OPTIONS,
} from './messaging.constants.js';
import { RabbitMqCustomerEventsPublisher } from './rabbitmq-customer-events.publisher.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: CUSTOMER_EVENTS_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: WELCOME_EMAIL_QUEUE,
          queueOptions: WELCOME_EMAIL_QUEUE_OPTIONS,
          persistent: true,
        },
      },
    ]),
  ],
  providers: [
    {
      provide: CustomerEventsPublisher,
      useClass: RabbitMqCustomerEventsPublisher,
    },
  ],
  exports: [CustomerEventsPublisher],
})
export class MessagingModule {}
