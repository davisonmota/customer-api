import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { Customer } from '../customers/entities/customer.entity.js';
import { CustomerCreatedEvent } from '../customers/events/customer-created.event.js';
import { CUSTOMER_CREATED_PATTERN } from './messaging.constants.js';
import { RabbitMqCustomerEventsPublisher } from './rabbitmq-customer-events.publisher.js';

const customer: Customer = {
  id: 'b6209f72-fe03-45cc-8f7b-250f36ad87b2',
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '+55 11 99999-0000',
  createdAt: new Date('2026-11-02T19:42:27.331Z'),
  updatedAt: new Date('2026-11-02T19:42:27.331Z'),
};

describe('RabbitMqCustomerEventsPublisher', () => {
  it('emits customer.created with the event payload', async () => {
    const emit = vi.fn().mockReturnValue(of(undefined));
    const publisher = new RabbitMqCustomerEventsPublisher({
      emit,
    } as unknown as ClientProxy);
    const event = new CustomerCreatedEvent(customer);

    await publisher.publishCustomerCreated(event);

    expect(emit).toHaveBeenCalledWith(CUSTOMER_CREATED_PATTERN, event);
  });
});
