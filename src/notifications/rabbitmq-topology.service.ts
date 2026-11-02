import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import {
  NOTIFICATIONS_DLX,
  RABBITMQ_URL,
  WELCOME_EMAIL_DLQ,
  WELCOME_EMAIL_DLQ_OPTIONS,
  WELCOME_EMAIL_DLQ_ROUTING_KEY,
  WELCOME_EMAIL_QUEUE,
  WELCOME_EMAIL_QUEUE_OPTIONS,
  WELCOME_EMAIL_RETRY_QUEUE,
  WELCOME_EMAIL_RETRY_QUEUE_OPTIONS,
  WELCOME_EMAIL_RETRY_ROUTING_KEY,
} from '../messaging/messaging.constants.js';

@Injectable()
export class RabbitMqTopologyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqTopologyService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  async onModuleInit(): Promise<void> {
    this.connection = await connect(RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(NOTIFICATIONS_DLX, 'direct', {
      durable: true,
    });
    await this.channel.assertQueue(
      WELCOME_EMAIL_QUEUE,
      WELCOME_EMAIL_QUEUE_OPTIONS,
    );
    await this.channel.assertQueue(
      WELCOME_EMAIL_RETRY_QUEUE,
      WELCOME_EMAIL_RETRY_QUEUE_OPTIONS,
    );
    await this.channel.assertQueue(
      WELCOME_EMAIL_DLQ,
      WELCOME_EMAIL_DLQ_OPTIONS,
    );

    await this.channel.bindQueue(
      WELCOME_EMAIL_QUEUE,
      NOTIFICATIONS_DLX,
      WELCOME_EMAIL_RETRY_ROUTING_KEY,
    );
    await this.channel.bindQueue(
      WELCOME_EMAIL_DLQ,
      NOTIFICATIONS_DLX,
      WELCOME_EMAIL_DLQ_ROUTING_KEY,
    );

    this.logger.log(
      'Topologia do RabbitMQ declarada (fila principal, retry, DLQ e DLX).',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch((error: unknown) => {
      this.logger.error('Falha ao fechar o canal do RabbitMQ.', error);
    });
    await this.connection?.close().catch((error: unknown) => {
      this.logger.error('Falha ao fechar a conexão com o RabbitMQ.', error);
    });

    this.channel = undefined;
    this.connection = undefined;
  }
}
