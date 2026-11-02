import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CustomerCreatedEvent } from '../customers/events/customer-created.event.js';
import {
  CUSTOMER_CREATED_PATTERN,
  CUSTOMER_EVENTS_CLIENT,
} from './messaging.constants.js';
import { CustomerEventsPublisher } from './customer-events.publisher.js';

@Injectable()
export class RabbitMqCustomerEventsPublisher implements CustomerEventsPublisher {
  constructor(
    @Inject(CUSTOMER_EVENTS_CLIENT) private readonly client: ClientProxy,
  ) {}

  async publishCustomerCreated(event: CustomerCreatedEvent): Promise<void> {
    await lastValueFrom(this.client.emit(CUSTOMER_CREATED_PATTERN, event));
  }
}
