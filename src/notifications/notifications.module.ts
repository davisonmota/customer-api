import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  RABBITMQ_URL,
  WELCOME_EMAIL_RETRY_CLIENT,
  WELCOME_EMAIL_RETRY_QUEUE,
  WELCOME_EMAIL_RETRY_QUEUE_OPTIONS,
} from '../messaging/messaging.constants.js';
import { RabbitMqTopologyService } from './rabbitmq-topology.service.js';
import { WelcomeEmailConsumer } from './welcome-email.consumer.js';
import { WelcomeEmailService } from './welcome-email.service.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: WELCOME_EMAIL_RETRY_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [RABBITMQ_URL],
          queue: WELCOME_EMAIL_RETRY_QUEUE,
          queueOptions: WELCOME_EMAIL_RETRY_QUEUE_OPTIONS,
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [WelcomeEmailConsumer],
  providers: [WelcomeEmailService, RabbitMqTopologyService],
})
export class NotificationsModule {}
