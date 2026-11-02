import { Controller, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
  RmqRecordBuilder,
} from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { lastValueFrom } from 'rxjs';
import { CustomerCreatedEvent } from '../customers/events/customer-created.event.js';
import {
  CUSTOMER_CREATED_PATTERN,
  WELCOME_EMAIL_MAX_RETRIES,
  WELCOME_EMAIL_RETRY_CLIENT,
} from '../messaging/messaging.constants.js';
import { WelcomeEmailService } from './welcome-email.service.js';

const MAX_PROCESSED_EVENT_IDS = 1000;

@Controller()
export class WelcomeEmailConsumer {
  private readonly logger = new Logger(WelcomeEmailConsumer.name);
  private readonly processedEventIds = new Set<string>();

  constructor(
    private readonly welcomeEmailService: WelcomeEmailService,
    @Inject(WELCOME_EMAIL_RETRY_CLIENT)
    private readonly retryClient: ClientProxy,
  ) {}

  @EventPattern(CUSTOMER_CREATED_PATTERN)
  async handleCustomerCreated(
    @Payload() event: CustomerCreatedEvent,
    @Ctx() context: unknown,
  ): Promise<void> {
    const rmqContext = context as RmqContext;
    const channel = rmqContext.getChannelRef() as Channel;
    const message = rmqContext.getMessage() as unknown as ConsumeMessage;

    if (!this.isValidEvent(event)) {
      this.logger.error(
        'Evento "customer.created" inválido recebido; enviando para a DLQ.',
      );
      channel.nack(message, false, false);
      return;
    }

    if (this.processedEventIds.has(event.eventId)) {
      this.logger.warn(
        `Evento "${event.eventId}" já processado; ignorando duplicata.`,
      );
      channel.ack(message);
      return;
    }

    try {
      await this.welcomeEmailService.sendWelcomeEmail(event.customer);
      this.markAsProcessed(event.eventId);
      channel.ack(message);
    } catch (error) {
      await this.handleFailure(event, message, channel, error);
    }
  }

  private async handleFailure(
    event: CustomerCreatedEvent,
    message: ConsumeMessage,
    channel: Channel,
    error: unknown,
  ): Promise<void> {
    const retryCount = this.getRetryCount(message);

    this.logger.error(
      `Falha ao enviar e-mail de boas-vindas para "${event.customer.email}" (tentativa ${retryCount + 1}/${WELCOME_EMAIL_MAX_RETRIES + 1}).`,
      this.errorDetails(error),
    );

    if (retryCount >= WELCOME_EMAIL_MAX_RETRIES) {
      this.logger.error(
        `Evento "${event.eventId}" excedeu o limite de tentativas; enviando para a DLQ.`,
      );
      channel.nack(message, false, false);
      return;
    }

    try {
      await lastValueFrom(
        this.retryClient.emit(
          CUSTOMER_CREATED_PATTERN,
          new RmqRecordBuilder(event)
            .setOptions({
              persistent: true,
              headers: {
                'x-retry-count': String(retryCount + 1),
              },
            })
            .build(),
        ),
      );

      channel.ack(message);
    } catch (publishError) {
      this.logger.error(
        `Falha ao republicar o evento "${event.eventId}" na fila de retry; enviando para a DLQ.`,
        this.errorDetails(publishError),
      );
      channel.nack(message, false, false);
    }
  }

  private getRetryCount(message: ConsumeMessage): number {
    const raw = message.properties.headers?.['x-retry-count'];
    const retryCount = Number(raw ?? 0);

    return Number.isInteger(retryCount) && retryCount >= 0 ? retryCount : 0;
  }

  private isValidEvent(event: CustomerCreatedEvent): boolean {
    return (
      typeof event?.eventId === 'string' &&
      typeof event.customer?.id === 'string' &&
      typeof event.customer?.email === 'string'
    );
  }

  private markAsProcessed(eventId: string): void {
    this.processedEventIds.add(eventId);

    if (this.processedEventIds.size > MAX_PROCESSED_EVENT_IDS) {
      const oldestEventId = this.processedEventIds.values().next().value;

      if (oldestEventId) {
        this.processedEventIds.delete(oldestEventId);
      }
    }
  }

  private errorDetails(error: unknown): string {
    return error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
  }
}
