import { Injectable } from '@nestjs/common';
import { Customer } from './entities/customer.entity.js';

@Injectable()
export class CustomersRepository {
  private readonly customers = new Map<string, Customer>();

  findAll(): Customer[] {
    return Array.from(this.customers.values());
  }

  findById(id: string): Customer | undefined {
    return this.customers.get(id);
  }

  findByEmail(email: string): Customer | undefined {
    for (const customer of this.customers.values()) {
      if (customer.email === email) {
        return customer;
      }
    }

    return undefined;
  }

  save(customer: Customer): Customer {
    this.customers.set(customer.id, customer);
    return customer;
  }

  delete(id: string): boolean {
    return this.customers.delete(id);
  }
}
