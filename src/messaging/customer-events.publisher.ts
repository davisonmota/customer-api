import { CustomerCreatedEvent } from '../customers/events/customer-created.event.js';

export abstract class CustomerEventsPublisher {
  abstract publishCustomerCreated(event: CustomerCreatedEvent): Promise<void>;
}
