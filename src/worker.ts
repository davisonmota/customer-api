import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  RABBITMQ_URL,
  WELCOME_EMAIL_QUEUE,
  WELCOME_EMAIL_QUEUE_OPTIONS,
} from './messaging/messaging.constants.js';
import { WorkerModule } from './workers/worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [RABBITMQ_URL],
        queue: WELCOME_EMAIL_QUEUE,
        queueOptions: WELCOME_EMAIL_QUEUE_OPTIONS,
        noAck: false,
        prefetchCount: 10,
        persistent: true,
      },
    },
  );

  await app.listen();
}

await bootstrap();
