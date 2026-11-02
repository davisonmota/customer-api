import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.config.js';
import { CustomerCreatedEvent } from './../src/customers/events/customer-created.event.js';
import { CustomerEventsPublisher } from './../src/messaging/customer-events.publisher.js';

interface CustomerResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

describe('CustomersController (e2e)', () => {
  let app: INestApplication<App>;
  let publishCustomerCreated: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    publishCustomerCreated = vi.fn().mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CustomerEventsPublisher)
      .useValue({ publishCustomerCreated })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const createCustomer = async (
    payload: Record<string, unknown> = {
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '+55 11 99999-0000',
    },
  ): Promise<CustomerResponse> => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .send(payload)
      .expect(201);

    return response.body as CustomerResponse;
  };

  it('runs the full CRUD flow', async () => {
    const created = await createCustomer();

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Ana Silva');
    expect(created.email).toBe('ana@example.com');

    const listResponse = await request(app.getHttpServer())
      .get('/customers')
      .expect(200);
    expect(listResponse.body).toHaveLength(1);

    const getResponse = await request(app.getHttpServer())
      .get(`/customers/${created.id}`)
      .expect(200);
    expect((getResponse.body as CustomerResponse).id).toBe(created.id);

    const patchResponse = await request(app.getHttpServer())
      .patch(`/customers/${created.id}`)
      .send({ name: 'Ana Souza', phone: undefined })
      .expect(200);
    expect((patchResponse.body as CustomerResponse).name).toBe('Ana Souza');

    await request(app.getHttpServer())
      .delete(`/customers/${created.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/customers/${created.id}`)
      .expect(404);
  });

  it('publishes customer.created after creating a customer', async () => {
    const created = await createCustomer();

    expect(publishCustomerCreated).toHaveBeenCalledTimes(1);

    const event = publishCustomerCreated.mock
      .calls[0]?.[0] as CustomerCreatedEvent;

    expect(event).toBeInstanceOf(CustomerCreatedEvent);
    expect(event.eventName).toBe('customer.created');
    expect(event.customer).toMatchObject({
      id: created.id,
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '+55 11 99999-0000',
    });
  });

  it('rejects an invalid payload with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/customers')
      .send({ name: '', email: 'not-an-email' })
      .expect(400);

    expect(response.body).toMatchObject({
      error: 'Bad Request',
      statusCode: 400,
    });
    expect(publishCustomerCreated).not.toHaveBeenCalled();
  });

  it('rejects unknown properties with 400', async () => {
    await request(app.getHttpServer())
      .post('/customers')
      .send({
        name: 'Ana Silva',
        email: 'ana@example.com',
        unknownField: true,
      })
      .expect(400);
  });

  it('rejects duplicated emails with 409 and does not publish', async () => {
    await createCustomer();

    const response = await request(app.getHttpServer())
      .post('/customers')
      .send({ name: 'Outra Pessoa', email: 'ANA@example.com' })
      .expect(409);

    expect(response.body).toMatchObject({
      error: 'Conflict',
      statusCode: 409,
    });
    expect(publishCustomerCreated).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed id with 400', async () => {
    await request(app.getHttpServer()).get('/customers/not-a-uuid').expect(400);
  });

  it('returns 404 for a missing customer', async () => {
    await request(app.getHttpServer())
      .get('/customers/00000000-0000-4000-8000-000000000000')
      .expect(404);
  });
});
