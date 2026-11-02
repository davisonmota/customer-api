import type { Options } from 'amqplib';

export const CUSTOMER_CREATED_PATTERN = 'customer.created';

export const CUSTOMER_EVENTS_CLIENT = 'CUSTOMER_EVENTS_CLIENT';
export const WELCOME_EMAIL_RETRY_CLIENT = 'WELCOME_EMAIL_RETRY_CLIENT';

export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://app:app@localhost:5672';

export const NOTIFICATIONS_DLX = 'notifications.dlx';

export const WELCOME_EMAIL_QUEUE = 'notifications.welcome-email';
export const WELCOME_EMAIL_RETRY_QUEUE = 'notifications.welcome-email.retry';
export const WELCOME_EMAIL_DLQ = 'notifications.welcome-email.dlq';

export const WELCOME_EMAIL_RETRY_ROUTING_KEY = 'welcome-email.retry';
export const WELCOME_EMAIL_DLQ_ROUTING_KEY = 'welcome-email.dlq';

export const WELCOME_EMAIL_MAX_RETRIES = Number(
  process.env.WELCOME_EMAIL_MAX_RETRIES ?? 3,
);

export const WELCOME_EMAIL_RETRY_DELAY_MS = Number(
  process.env.WELCOME_EMAIL_RETRY_DELAY_MS ?? 30_000,
);

export const WELCOME_EMAIL_QUEUE_OPTIONS = {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': NOTIFICATIONS_DLX,
    'x-dead-letter-routing-key': WELCOME_EMAIL_DLQ_ROUTING_KEY,
  },
} satisfies Options.AssertQueue;

export const WELCOME_EMAIL_RETRY_QUEUE_OPTIONS = {
  durable: true,
  arguments: {
    'x-message-ttl': WELCOME_EMAIL_RETRY_DELAY_MS,
    'x-dead-letter-exchange': NOTIFICATIONS_DLX,
    'x-dead-letter-routing-key': WELCOME_EMAIL_RETRY_ROUTING_KEY,
  },
} satisfies Options.AssertQueue;

export const WELCOME_EMAIL_DLQ_OPTIONS = {
  durable: true,
} satisfies Options.AssertQueue;
