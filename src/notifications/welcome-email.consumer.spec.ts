import { Logger } from '@nestjs/common';
import { ClientProxy, RmqContext, RmqRecord } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { of, throwError } from 'rxjs';
import { Customer } from '../customers/entities/customer.entity.js';
import { CustomerCreatedEvent } from '../customers/events/customer-created.event.js';
import {
  CUSTOMER_CREATED_PATTERN,
  WELCOME_EMAIL_MAX_RETRIES,
} from '../messaging/messaging.constants.js';
import { WelcomeEmailConsumer } from './welcome-email.consumer.js';
import { WelcomeEmailService } from './welcome-email.service.js';

const customer: Customer = {
  id: 'b6209f72-fe03-45cc-8f7b-250f36ad87b2',
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '+55 11 99999-0000',
  createdAt: new Date('2026-11-02T19:42:27.331Z'),
  updatedAt: new Date('2026-11-02T19:42:27.331Z'),
};

const createContext = (headers: Record<string, string> = {}) => {
  const ack = vi.fn();
  const nack = vi.fn();
  const message = {
    content: Buffer.from('{}'),
    properties: { headers },
    fields: {},
  } as unknown as ConsumeMessage;
  const channel = { ack, nack } as unknown as Channel;

  return {
    context: new RmqContext([
      message as unknown as Record<string, any>,
      channel,
      CUSTOMER_CREATED_PATTERN,
    ]),
    ack,
    nack,
  };
};

describe('WelcomeEmailConsumer', () => {
  let sendWelcomeEmail: ReturnType<typeof vi.fn>;
  let emitRetry: ReturnType<typeof vi.fn>;
  let consumer: WelcomeEmailConsumer;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    sendWelcomeEmail = vi.fn().mockResolvedValue(undefined);
    emitRetry = vi.fn().mockReturnValue(of(undefined));

    consumer = new WelcomeEmailConsumer(
      { sendWelcomeEmail } as unknown as WelcomeEmailService,
      { emit: emitRetry } as unknown as ClientProxy,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('acknowledges the message after sending the welcome email', async () => {
    const { context, ack, nack } = createContext();
    const event = new CustomerCreatedEvent(customer);

    await consumer.handleCustomerCreated(event, context);

    expect(sendWelcomeEmail).toHaveBeenCalledWith(event.customer);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();
    expect(emitRetry).not.toHaveBeenCalled();
  });

  it('ignores duplicate events without sending the email twice', async () => {
    const { context, ack, nack } = createContext();
    const event = new CustomerCreatedEvent(customer);

    await consumer.handleCustomerCreated(event, context);
    await consumer.handleCustomerCreated(event, context);

    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(2);
    expect(nack).not.toHaveBeenCalled();
  });

  it('republishes to the retry queue and acknowledges the original', async () => {
    sendWelcomeEmail.mockRejectedValue(new Error('smtp indisponível'));
    const { context, ack, nack } = createContext();
    const event = new CustomerCreatedEvent(customer);

    await consumer.handleCustomerCreated(event, context);

    expect(emitRetry).toHaveBeenCalledTimes(1);

    const [pattern, record] = emitRetry.mock.calls[0] as [
      string,
      RmqRecord<CustomerCreatedEvent>,
    ];

    expect(pattern).toBe(CUSTOMER_CREATED_PATTERN);
    expect(record.data).toEqual(event);
    expect(record.options?.headers).toEqual({ 'x-retry-count': '1' });
    expect(record.options?.persistent).toBe(true);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();
  });

  it('sends malformed events straight to the DLQ', async () => {
    const { context, ack, nack } = createContext();

    await consumer.handleCustomerCreated({} as CustomerCreatedEvent, context);

    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(emitRetry).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });

  it('sends to the DLQ after the last allowed retry', async () => {
    sendWelcomeEmail.mockRejectedValue(new Error('smtp indisponível'));
    const { context, ack, nack } = createContext({
      'x-retry-count': String(WELCOME_EMAIL_MAX_RETRIES),
    });
    const event = new CustomerCreatedEvent(customer);

    await consumer.handleCustomerCreated(event, context);

    expect(emitRetry).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });

  it('sends to the DLQ when publishing the retry fails', async () => {
    sendWelcomeEmail.mockRejectedValue(new Error('smtp indisponível'));
    emitRetry.mockReturnValue(
      throwError(() => new Error('broker indisponível')),
    );
    const { context, ack, nack } = createContext();
    const event = new CustomerCreatedEvent(customer);

    await consumer.handleCustomerCreated(event, context);

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });
});
