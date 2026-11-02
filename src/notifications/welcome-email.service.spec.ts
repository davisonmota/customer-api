import { CustomerSnapshot } from '../customers/events/customer-created.event.js';
import { WelcomeEmailService } from './welcome-email.service.js';

const customer: CustomerSnapshot = {
  id: 'b6209f72-fe03-45cc-8f7b-250f36ad87b2',
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '+55 11 99999-0000',
  createdAt: '2026-11-02T19:42:27.331Z',
  updatedAt: '2026-11-02T19:42:27.331Z',
};

describe('WelcomeEmailService', () => {
  let service: WelcomeEmailService;

  beforeEach(() => {
    service = new WelcomeEmailService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the welcome email payload with the customer data', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await service.sendWelcomeEmail(customer);

    expect(logSpy).toHaveBeenCalledTimes(1);

    const message = String(logSpy.mock.calls[0]?.[0]);
    expect(message.startsWith('[welcome-email] ')).toBe(true);

    expect(JSON.parse(message.slice('[welcome-email] '.length))).toEqual({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: '2026-11-02T19:42:27.331Z',
    });
  });

  it('logs null when the customer has no phone', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const customerWithoutPhone: CustomerSnapshot = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: undefined,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    await service.sendWelcomeEmail(customerWithoutPhone);

    const message = String(logSpy.mock.calls[0]?.[0]);
    expect(JSON.parse(message.slice('[welcome-email] '.length))).toMatchObject({
      phone: null,
    });
  });
});
