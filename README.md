# Customer API

API REST de clientes construída com **NestJS 12** em uma aplicação **standalone** (não-monorepo), com persistência **em memória** e processamento assíncrono de eventos via **RabbitMQ**.

> 🎓 Projeto desenvolvido por **Davison** no curso **[Trilha Sênior](https://trilhasenior.com.br/?utm_source=davison&utm_medium=readme&utm_campaign=trilha-senior-ia-para-devs)**, na trilha **IA para Devs**.

## Sobre o projeto

Este projeto faz parte do curso [Trilha Sênior](https://trilhasenior.com.br/?utm_source=davison&utm_medium=readme&utm_campaign=trilha-senior-ia-para-devs), na trilha de **IA para Devs**. O link acima inclui parâmetros UTM (`utm_source=davison`) para que a Trilha Sênior saiba que o acesso veio do Davison.

## Stack

- NestJS 12 (ESM)
- Node.js 26 LTS ("Lithium") via nvm — veja `.nvmrc`
- pnpm 12
- TypeScript 6
- `class-validator` / `class-transformer` para validação
- `@nestjs/microservices` + `amqplib` / `amqp-connection-manager` com transporte RabbitMQ
- Vitest + Supertest para testes
- oxlint + Prettier para lint e formatação

## Requisitos

- nvm instalado
- pnpm 12 (`npm install -g pnpm@12` caso ainda não tenha; o Node 26 não inclui corepack)
- RabbitMQ 4.x acessível (local via Podman/Docker ou instância externa)

## Instalação

```bash
nvm install --lts
nvm use
pnpm install
```

## RabbitMQ local

O `compose.yaml` sobe o RabbitMQ com a interface de management:

```bash
podman compose up -d        # ou: docker compose up -d
```

- AMQP: `amqp://app:app@localhost:5672`
- Management UI: http://localhost:15672 (usuário `app`, senha `app`)

Para usar outro broker, defina `RABBITMQ_URL`.

## Execução

A aplicação roda em **dois processos separados**:

- **API** (`src/main.ts`): expõe o CRUD HTTP e publica eventos.
- **Worker** (`src/worker.ts`): consome os eventos e envia o e-mail de boas-vindas.

```bash
# terminal 1 — desenvolvimento da API (watch mode)
pnpm start:dev

# terminal 2 — desenvolvimento do worker (watch mode)
pnpm start:worker:dev
```

Em produção:

```bash
pnpm build
pnpm start:prod       # API
pnpm start:worker     # worker (outro terminal/processo)
```

A API sobe em `http://localhost:3000`. Para outra porta:

```bash
PORT=4000 pnpm start:dev
```

> A API funciona mesmo sem o worker no ar: os eventos ficam na fila até o worker consumir.

### Variáveis de ambiente

| Variável                      | Padrão                        | Descrição                                                        |
| ----------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| `PORT`                        | `3000`                        | Porta HTTP da API                                                |
| `RABBITMQ_URL`                | `amqp://app:app@localhost:5672` | URL de conexão com o RabbitMQ                                  |
| `WELCOME_EMAIL_MAX_RETRIES`   | `3`                           | Tentativas extras antes de enviar o evento para a DLQ             |
| `WELCOME_EMAIL_RETRY_DELAY_MS`| `30000`                       | TTL da fila de retry (30s). Alterar exige recriar a fila         |

## Endpoints

| Método | Rota             | Descrição                    | Sucesso | Erros                          |
| ------ | ---------------- | ---------------------------- | ------- | ------------------------------ |
| POST   | `/customers`     | Cria um cliente              | 201     | 400 validação, 409 e-mail duplicado |
| GET    | `/customers`     | Lista todos os clientes      | 200     | —                              |
| GET    | `/customers/:id` | Busca um cliente por id      | 200     | 400 id inválido, 404 não encontrado |
| PATCH  | `/customers/:id` | Atualiza campos do cliente   | 200     | 400, 404, 409                  |
| DELETE | `/customers/:id` | Remove um cliente            | 204     | 400, 404                       |
| GET    | `/`              | Health check                 | 200     | —                              |

### Modelo

```json
{
  "id": "b6209f72-fe03-45cc-8f7b-250f36ad87b2",
  "name": "Ana Silva",
  "email": "ana@example.com",
  "phone": "+55 11 99999-0000",
  "createdAt": "2026-11-02T19:42:27.331Z",
  "updatedAt": "2026-11-02T19:42:27.331Z"
}
```

### Validações e regras

- `name`: obrigatório, texto, no máximo 120 caracteres.
- `email`: obrigatório, e-mail válido, único (comparação sem diferenciar maiúsculas/minúsculas), no máximo 254 caracteres. É armazenado normalizado.
- `phone`: opcional, texto, no máximo 20 caracteres. Enviar `null` no `PATCH` remove o telefone.
- `id`: UUID gerado pela API; ids malformados retornam `400`.
- Propriedades desconhecidas no payload retornam `400` (`forbidNonWhitelisted`).

## Arquitetura de eventos

```
┌──────────────────────┐        publica         ┌──────────────────────────────────────┐
│  API (src/main.ts)   │  ────────────────────▶ │ RabbitMQ                             │
│  CustomersService    │   customer.created     │  notifications.welcome-email         │
└──────────────────────┘                        └───────────────┬──────────────────────┘
                                                                │ consome
                                                ┌───────────────▼──────────────────────┐
                                                │ Worker (src/worker.ts)               │
                                                │ WelcomeEmailConsumer                 │
                                                │ WelcomeEmailService (console.log)    │
                                                └──────────────────────────────────────┘
```

Ao criar um cliente com sucesso, o `CustomersService` salva o registro e publica o evento `customer.created` na fila principal. O evento carrega um snapshot imutável do cliente (`CustomerSnapshot`), com as datas já serializadas em ISO:

```json
{
  "eventId": "9a6c1f0e-...",
  "eventName": "customer.created",
  "version": 1,
  "occurredAt": "2026-11-02T23:07:37.226Z",
  "customer": {
    "id": "c0f9aa77-...",
    "name": "Ana Silva",
    "email": "ana@example.com",
    "phone": "+55 11 99999-0000",
    "createdAt": "2026-11-02T23:07:37.226Z",
    "updatedAt": "2026-11-02T23:07:37.226Z"
  }
}
```

O worker consome o evento e chama `WelcomeEmailService.sendWelcomeEmail()`, que por enquanto apenas registra os dados no console:

```
[welcome-email] {"id":"c0f9aa77-...","name":"Ana Silva","email":"ana@example.com","phone":"+55 11 99999-0000","createdAt":"2026-11-02T23:07:37.226Z"}
```

### Topologia do RabbitMQ

| Recurso                                  | Tipo     | Função                                                              |
| ---------------------------------------- | -------- | ------------------------------------------------------------------- |
| `notifications.welcome-email`            | queue    | Fila principal consumida pelo worker; DLX para a DLQ                |
| `notifications.welcome-email.retry`      | queue    | Retry com TTL de 30s; ao expirar, volta para a fila principal via DLX |
| `notifications.welcome-email.dlq`        | queue    | Dead-letter queue para falhas definitivas                           |
| `notifications.dlx`                      | exchange | Direct exchange usada para dead-letter (`welcome-email.retry` e `welcome-email.dlq`) |

A topologia é declarada pelo worker no início (`RabbitMqTopologyService`). O transporte oficial do Nest publica diretamente na fila, então não há exchange de entrada.

### Retry, DLQ e idempotência

- **Sucesso**: o e-mail é registrado e a mensagem recebe `ack`.
- **Falha**: a mensagem é republicada na fila de retry com o header `x-retry-count` incrementado, e a original recebe `ack`. Após o TTL, o RabbitMQ a devolve à fila principal.
- **Limite de tentativas**: após `WELCOME_EMAIL_MAX_RETRIES` (3) retries, a mensagem é rejeitada com `nack` (sem requeue) e roteada para a DLQ.
- **Payload inválido**: eventos sem `eventId`/`customer.id`/`customer.email` vão direto para a DLQ.
- **Idempotência**: o worker mantém em memória os últimos 1000 `eventId`s processados e ignora duplicatas (entrega é *at-least-once*). Esse cache é perdido ao reiniciar o worker e não é compartilhado entre réplicas.
- **Publicação best-effort**: se a publicação falhar (broker indisponível, por exemplo), o erro é logado e a API continua respondendo `201`. Nesse caso o evento é perdido; para garantia total seria necessário um outbox.

### Substituindo o e-mail

A tecnologia de e-mail (SMTP, SES etc.) será escolhida futuramente. Basta trocar a implementação de `WelcomeEmailService`; o fluxo de eventos, o consumer e o `CustomersService` não mudam.

## Exemplos com curl

```bash
# criar
curl -X POST http://localhost:3000/customers \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Silva","email":"ana@example.com","phone":"+55 11 99999-0000"}'

# listar
curl http://localhost:3000/customers

# buscar por id
curl http://localhost:3000/customers/<id>

# atualizar
curl -X PATCH http://localhost:3000/customers/<id> \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza"}'

# remover
curl -X DELETE http://localhost:3000/customers/<id>
```

## Testes

```bash
pnpm test       # testes unitários (service, publisher, consumer e e-mail)
pnpm test:e2e   # e2e do CRUD com Supertest (publisher mockado, sem broker)
pnpm lint
pnpm build
```

Os testes não exigem um RabbitMQ em execução: o e2e substitui o `CustomerEventsPublisher` por um mock e os testes do consumer usam um `RmqContext` simulado.

## Estrutura

```
src/
├── app.config.ts                     # ValidationPipe global (usado também nos testes e2e)
├── app.module.ts
├── main.ts                           # bootstrap da API HTTP
├── worker.ts                         # bootstrap do microservice (consumer RabbitMQ)
├── customers/
│   ├── customers.controller.ts
│   ├── customers.module.ts
│   ├── customers.repository.ts       # Map em memória
│   ├── customers.service.ts
│   ├── customers.service.spec.ts
│   ├── dto/
│   │   ├── create-customer.dto.ts
│   │   └── update-customer.dto.ts
│   ├── entities/
│   │   └── customer.entity.ts
│   └── events/
│       └── customer-created.event.ts # payload + CustomerSnapshot em ISO
├── messaging/
│   ├── customer-events.publisher.ts  # abstração do publisher
│   ├── messaging.constants.ts        # filas, DLX, TTL, retries e URL
│   ├── messaging.module.ts           # ClientProxy da fila principal
│   ├── rabbitmq-customer-events.publisher.ts
│   └── rabbitmq-customer-events.publisher.spec.ts
├── notifications/
│   ├── notifications.module.ts       # consumer + client de retry + topologia
│   ├── rabbitmq-topology.service.ts  # declara exchange, filas e bindings
│   ├── welcome-email.consumer.ts     # ack/nack, retry, DLQ e dedupe
│   ├── welcome-email.consumer.spec.ts
│   ├── welcome-email.service.ts      # console.log temporário
│   └── welcome-email.service.spec.ts
└── workers/
    └── worker.module.ts              # módulo do processo worker
test/
├── app.e2e-spec.ts
└── customers.e2e-spec.ts
```

## Persistência

Os dados ficam em um `Map` no processo da aplicação. Ao reiniciar o servidor, todos os clientes são perdidos. O `CustomersRepository` é o único ponto que conhece o armazenamento, então trocar por TypeORM/PostgreSQL ou outro banco não exige mudanças no controller ou no service.
