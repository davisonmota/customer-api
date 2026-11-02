import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { CustomerEventsPublisher } from '../messaging/customer-events.publisher.js';
import { CustomersRepository } from './customers.repository.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { CustomerCreatedEvent } from './events/customer-created.event.js';

describe('CustomersService', () => {
  let repository: CustomersRepository;
  let service: CustomersService;
  let publishCustomerCreated: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    repository = new CustomersRepository();
    publishCustomerCreated = vi.fn().mockResolvedValue(undefined);
    service = new CustomersService(repository, {
      publishCustomerCreated,
    } as unknown as CustomerEventsPublisher);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const buildDto = (
    overrides: Partial<CreateCustomerDto> = {},
  ): CreateCustomerDto => ({
    name: 'Ana Silva',
    email: 'ana@example.com',
    ...overrides,
  });

  it('creates a customer with a generated id and timestamps', async () => {
    const customer = await service.create(buildDto());

    expect(customer.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(customer.name).toBe('Ana Silva');
    expect(customer.email).toBe('ana@example.com');
    expect(customer.phone).toBeUndefined();
    expect(customer.createdAt).toBeInstanceOf(Date);
    expect(customer.updatedAt).toBeInstanceOf(Date);
  });

  it('trims the name and normalizes the email', async () => {
    const customer = await service.create(
      buildDto({ name: '  Ana Silva  ', email: '  ANA@Example.COM ' }),
    );

    expect(customer.name).toBe('Ana Silva');
    expect(customer.email).toBe('ana@example.com');
  });

  it('rejects duplicated emails regardless of casing', async () => {
    await service.create(buildDto());

    await expect(
      service.create(
        buildDto({ name: 'Outra Pessoa', email: 'ANA@example.com' }),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('publishes customer.created after saving the customer', async () => {
    const customer = await service.create(buildDto());

    expect(publishCustomerCreated).toHaveBeenCalledTimes(1);

    const event = publishCustomerCreated.mock
      .calls[0]?.[0] as CustomerCreatedEvent;

    expect(event).toBeInstanceOf(CustomerCreatedEvent);
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.eventName).toBe('customer.created');
    expect(event.version).toBe(1);
    expect(event.occurredAt).toEqual(expect.any(String));
    expect(event.customer).toEqual({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    });
    expect(Object.isFrozen(event.customer)).toBe(true);
  });

  it('does not publish customer.created when the email is duplicated', async () => {
    await service.create(buildDto());
    publishCustomerCreated.mockClear();

    await expect(
      service.create(buildDto({ name: 'Outra Pessoa' })),
    ).rejects.toThrow(ConflictException);

    expect(publishCustomerCreated).not.toHaveBeenCalled();
  });

  it('keeps the customer when publishing the event fails', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    publishCustomerCreated.mockRejectedValue(new Error('broker indisponível'));

    const customer = await service.create(buildDto());

    expect(customer.id).toBeDefined();
    expect(service.findAll()).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao publicar o evento "customer.created"'),
      expect.stringContaining('broker indisponível'),
    );
  });

  it('lists all customers', async () => {
    await service.create(buildDto());
    await service.create(
      buildDto({ name: 'Bruno Souza', email: 'bruno@example.com' }),
    );

    expect(service.findAll()).toHaveLength(2);
  });

  it('finds a customer by id', async () => {
    const created = await service.create(buildDto());

    expect(service.findOne(created.id)).toEqual(created);
  });

  it('throws NotFoundException when the customer does not exist', () => {
    expect(() =>
      service.findOne('00000000-0000-4000-8000-000000000000'),
    ).toThrow(NotFoundException);
  });

  it('updates the provided fields and refreshes updatedAt', async () => {
    const created = await service.create(buildDto());
    const previousUpdatedAt = created.updatedAt;

    const updated = service.update(created.id, {
      name: 'Ana Souza',
      phone: '+55 11 99999-0000',
    });

    expect(updated.name).toBe('Ana Souza');
    expect(updated.phone).toBe('+55 11 99999-0000');
    expect(updated.email).toBe('ana@example.com');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      previousUpdatedAt.getTime(),
    );
  });

  it('normalizes the email on update', async () => {
    const created = await service.create(buildDto());

    const updated = service.update(created.id, { email: 'NOVA@Example.com' });

    expect(updated.email).toBe('nova@example.com');
  });

  it('rejects an update that uses another customer email', async () => {
    await service.create(buildDto());
    const bruno = await service.create(
      buildDto({ name: 'Bruno Souza', email: 'bruno@example.com' }),
    );

    expect(() =>
      service.update(bruno.id, { email: 'ana@example.com' }),
    ).toThrow(ConflictException);
  });

  it('allows updating a customer keeping its own email', async () => {
    const created = await service.create(buildDto());

    const updated = service.update(created.id, { email: 'ana@example.com' });

    expect(updated.email).toBe('ana@example.com');
  });

  it('removes a customer', async () => {
    const created = await service.create(buildDto());

    service.remove(created.id);

    expect(service.findAll()).toHaveLength(0);
  });

  it('throws NotFoundException when removing a missing customer', () => {
    expect(() =>
      service.remove('00000000-0000-4000-8000-000000000000'),
    ).toThrow(NotFoundException);
  });
});
