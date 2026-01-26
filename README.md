# 🚀 NestJS API Corrector

**A configuration-driven API integration framework for NestJS.**

[![npm version](https://badge.fury.io/js/nestjs-api-corrector.svg)](https://badge.fury.io/js/nestjs-api-corrector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**nestjs-api-corrector** acts as an intelligent bridge between your application and external APIs. Instead of writing endless HTTP Services and DTOs, you define integrations in your database.

---

## ✨ Features

*   **Dynamic Configuration**: Define API endpoints, methods, and auth in your DB.
*   **Zero-Code Updates**: Change target URLs or field mappings without redeploying code.
*   **Authentication**: Built-in support for Bearer, Basic, and Custom Auth strategies.
*   **Transformation**: Transform requests and responses using JSONPath or Custom JS.
*   **Validation**: Validate inputs and outputs using JSON Schema.
*   **Resilience**: Centralized error handling and auditing.
*   **Database Agnostic**: Comes with TypeORM support out-of-the-box, but easy to adapt.

---

## 📦 Installation

```bash
npm install nestjs-api-corrector
```

---

## 🛠️ Usage

### 1. Database Setup

You need two tables: `integration_mappings_config` and `corrector_audit_logs`.
If you are using PostgreSQL, you can run the included initialization script:

```sql
-- See database_init.sql in the package or documentation
```

### 2. Import Module in `AppModule`

#### A. Using TypeORM (Recommended)
If you already use TypeORM, we provide ready-to-use repositories and entities.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { 
  CorrectorModule, 
  TypeOrmMappingRepository, 
  TypeOrmAuditRepository, 
  IntegrationMappingEntity, 
  CorrectorAuditEntity 
} from 'nestjs-api-corrector';

@Module({
  imports: [
    // 1. Configure your TypeORM connection
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'my_db',
      entities: [
         // Add Corrector entities here
         IntegrationMappingEntity,
         CorrectorAuditEntity, 
         // ... your other entities
      ],
      synchronize: true, // Auto-create tables (Dev only)
    }),

    // 2. Configure Corrector Module
    CorrectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        // Use the built-in TypeORM implementations
        mappingRepository: new TypeOrmMappingRepository(
          dataSource.getRepository(IntegrationMappingEntity)
        ),
        auditRepository: new TypeOrmAuditRepository(
          dataSource.getRepository(CorrectorAuditEntity)
        ),
      }),
    }),
  ],
})
export class AppModule {}
```

#### B. Without TypeORM (Custom Implementation)
If you use Prisma, Sequelize, or Mongoose, you can implement the interfaces yourself.

```typescript
import { CorrectorModule, IMappingRepository, IAuditRepository } from 'nestjs-api-corrector';

class MyCustomMappingRepo implements IMappingRepository {
  async findByIdOrName(key: string) {
    // Fetch from your DB (Prisma, Mongoose, etc.)
    return myDb.findConfig(key);
  }
}

class MyCustomAuditRepo implements IAuditRepository {
  async save(audit: any) {
    // Save to your DB/Logger
    console.log('Audit:', audit);
  }
}

@Module({
  imports: [
    CorrectorModule.forRoot({
      mappingRepository: new MyCustomMappingRepo(),
      auditRepository: new MyCustomAuditRepo(),
    }),
  ],
})
export class AppModule {}
```

---

### 3. Using the Service

Inject `CorrectorEngine` to execute integrations programmatically.

```typescript
import { Injectable } from '@nestjs/common';
import { CorrectorEngine } from 'nestjs-api-corrector';

@Injectable()
export class MyService {
  constructor(private readonly corrector: CorrectorEngine) {}

  async syncProductData() {
    // Call the "get-products" integration defined in your DB
    const result = await this.corrector.execute('get-products', {
      category: 'electronics', // Payload
    });

    return result;
  }
}
```

### 4. Using the API Controller

The library also exposes a controller automatically at `POST /connector/execute`.

**Request:**
```json
POST /connector/execute
{
  "connectorKey": "get-products",
  "payload": {
    "category": "electronics"
  }
}
```

---

## 📝 Configuration Object (The "Mapping")

In your database (`integration_mappings_config.mapping_config`), you store the rules.

### minimal Example
```json
{
  "id": "get-products",
  "sourceSystem": "MyApp",
  "targetSystem": "ExternalAPI",
  "targetApi": {
    "url": "https://api.example.com/products",
    "method": "GET"
  }
}
```

### Full Example (Auth + Transformation)
```json
{
  "id": "create-user",
  "targetApi": {
    "url": "https://api.example.com/users",
    "method": "POST"
  },
  "authConfig": {
    "authType": "BEARER_TOKEN",
    "config": {
       "tokenUrl": "https://api.example.com/login",
       "loginPayload": { "user": "admin", "pass": "secret" }
    }
  },
  "requestMapping": {
    "type": "OBJECT",
    "mappings": [
       { "source": "$.inputName", "target": "$.fullName" },
       { "source": "$.inputAge", "target": "$.meta.age" }
    ]
  }
}
```

---

## 🧪 Verified Scenarios

This library handles:
*   ✅ **GET/POST/PUT/DELETE**
*   ✅ **Dynamic Query Params** (e.g., `?q=$.query`)
*   ✅ **Path Params** (e.g., `/users/:id`)
*   ✅ **Authentication** (Bearer, Basic, API Key)
*   ✅ **Error Handling** (Circuit Breaker logic included)

---

## 📄 License

MIT
