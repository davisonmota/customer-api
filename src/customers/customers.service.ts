import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { Customer } from './entities/customer.entity.js';
import { CustomersRepository } from './customers.repository.js';
import { CustomerCreatedEvent } from './events/customer-created.event.js';
import { CustomerEventsPublisher } from '../messaging/customer-events.publisher.js';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly customerEventsPublisher: CustomerEventsPublisher,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const email = createCustomerDto.email.trim().toLowerCase();

    if (this.customersRepository.findByEmail(email)) {
      throw new ConflictException(
        `Já existe um cliente com o e-mail "${email}".`,
      );
    }

    const now = new Date();

    const customer = this.customersRepository.save({
      id: randomUUID(),
      name: createCustomerDto.name.trim(),
      email,
      phone: createCustomerDto.phone ?? undefined,
      createdAt: now,
      updatedAt: now,
    });

    const event = new CustomerCreatedEvent(customer);

    try {
      await this.customerEventsPublisher.publishCustomerCreated(event);
    } catch (error) {
      this.logger.error(
        `Falha ao publicar o evento "${event.eventName}" do cliente "${customer.id}".`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return customer;
  }

  findAll(): Customer[] {
    return this.customersRepository.findAll();
  }

  findOne(id: string): Customer {
    const customer = this.customersRepository.findById(id);

    if (!customer) {
      throw new NotFoundException(`Cliente com id "${id}" não encontrado.`);
    }

    return customer;
  }

  update(id: string, updateCustomerDto: UpdateCustomerDto): Customer {
    const customer = this.findOne(id);

    if (updateCustomerDto.email !== undefined) {
      const email = updateCustomerDto.email.trim().toLowerCase();
      const customerWithEmail = this.customersRepository.findByEmail(email);

      if (customerWithEmail && customerWithEmail.id !== id) {
        throw new ConflictException(
          `Já existe um cliente com o e-mail "${email}".`,
        );
      }

      customer.email = email;
    }

    if (updateCustomerDto.name !== undefined) {
      customer.name = updateCustomerDto.name.trim();
    }

    if (updateCustomerDto.phone !== undefined) {
      customer.phone = updateCustomerDto.phone ?? undefined;
    }

    customer.updatedAt = new Date();

    return this.customersRepository.save(customer);
  }

  remove(id: string): void {
    if (!this.customersRepository.delete(id)) {
      throw new NotFoundException(`Cliente com id "${id}" não encontrado.`);
    }
  }
}
