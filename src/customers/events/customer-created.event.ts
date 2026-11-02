import { randomUUID } from 'node:crypto';
import { Customer } from '../entities/customer.entity.js';

export interface CustomerSnapshot {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export class CustomerCreatedEvent {
  readonly eventId: string;
  readonly eventName = 'customer.created';
  readonly version = 1;
  readonly occurredAt: string;
  readonly customer: Readonly<CustomerSnapshot>;

  constructor(customer: Customer) {
    this.eventId = randomUUID();
    this.occurredAt = new Date().toISOString();
    this.customer = Object.freeze({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    });
  }
}
