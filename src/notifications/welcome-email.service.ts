import { Injectable } from '@nestjs/common';
import { CustomerSnapshot } from '../customers/events/customer-created.event.js';

@Injectable()
export class WelcomeEmailService {
  // TODO: trocar o console.log pela tecnologia de e-mail escolhida no futuro.
  async sendWelcomeEmail(customer: Readonly<CustomerSnapshot>): Promise<void> {
    const payload = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? null,
      createdAt: customer.createdAt,
    };

    console.log(`[welcome-email] ${JSON.stringify(payload)}`);
  }
}
