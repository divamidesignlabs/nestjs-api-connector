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

You only need one table: `integration_mappings_config`.
If you are using PostgreSQL, you can use the structure defined in `database_init.sql`.

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
  IntegrationMappingEntity 
} from 'nestjs-api-corrector';

@Module({
  imports: [
    // 1. Configure your TypeORM connection
    // IMPORTANT: You MUST add IntegrationMappingEntity to the 'entities' array!
    TypeOrmModule.forRoot({
      type: 'postgres',
      // ... db config ...
      entities: [
         IntegrationMappingEntity, // <--- Required for 'integration_mappings_config' table
         // ... your other application entities
      ],
      synchronize: false, 
    }),

    // 2. Configure Corrector Module
    CorrectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        // Use the built-in TypeORM mapping repository
        mappingRepository: new TypeOrmMappingRepository(
          dataSource.getRepository(IntegrationMappingEntity)
        ),
        // auditRepository: Defaults to Console Logger.
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

## 🔐 Authentication & Payload Standards

To ensure consistency and avoid validation errors, follow these standard structures when sending requests to the `/connector/execute` endpoint.

### 1. Standard Request Payload (Postman/API)

The standard request body expects these primary fields:

```json
{
  "connectorKey": "string (unique mapping name or UUID)",
  "payload": { "key": "value" },      // Target API data
  "authConfig": {                    // Runtime Auth Overrides (Recommended)
    "authType": "BEARER_TOKEN | BASIC | API_KEY | OAUTH2_CLIENT_CREDENTIALS",
    "config": { ... }                // Configuration specific to authType
  },
  "headerData": { "key": "value" },  // Extra Headers (Metadata/Context)
  "queryParams": { "key": "value" }  // Extra Query Parameters
}
```

### 2. Authentication Configuration Reference

| Auth Type | Config Field Requirements | Target Injection |
| :--- | :--- | :--- |
| **`BEARER_TOKEN`** | `token` (Direct string) | `Authorization: Bearer <token>` |
| **`BASIC`** | `username`, `password` | `Authorization: Basic <base64>` |
| **`API_KEY`** | `keyName`, `keyValue`, `location` (HEADER/QUERY) | `keyName: keyValue` |
| **`OAUTH2_CLIENT_CREDENTIALS`** | `tokenUrl`, `clientId`, `clientSecret` | `Authorization: Bearer <Dynamic>` |
| **`NONE`** | (Empty Object) | No Auth injected |

### 3. Standard Database Configuration (`mapping_config`)

The configuration stored in the database governs how the library behaves.

#### **Transparent Proxy (No Transformation)**
Use this if you want to forward everything as-is.
```json
{
  "targetApi": {
    "url": "https://api.example.com/data",
    "method": "POST"
  },
  "responseMapping": { "type": "DIRECT" }
}
```

#### **Standard Mapping (Filtering & Transformation)**
Use this to pick specific fields and transform them.
```json
{
  "requestMapping": {
    "type": "OBJECT",
    "mappings": [
      { "source": "$.inputName", "target": "$.fullName", "transform": "uppercase" },
      { "source": "$.inputAge", "target": "$.meta.age" }
    ]
  },
  "responseMapping": {
    "type": "ARRAY", // For list transformations
    "root": "$.data", // Path to array in target response
    "mappings": [
      { "source": "$.id", "target": "$.value" },
      { "source": "$.name", "target": "$.label" }
    ]
  }
}
```

---

## ✅ Feature Verification Scenarios

| ID | Case | Input Sample | Logic |
| :--- | :--- | :--- | :--- |
| **TC-01** | **Bearer Pass-through** | `{"authConfig": {"authType": "BEARER_TOKEN", "config": {"token": "..."}}}` | Library injects Bearer header. |
| **TC-02** | **Basic Auth Login** | `{"authConfig": {"authType": "BASIC", "config": {"username": "admin", "password": "..."}}}` | Library encodes & injects Basic header. |
| **TC-03** | **Extra Metadata** | `{"headerData": {"X-App-ID": "test"}}` | Extra header is forwarded to target. |
| **TC-04** | **Data Filtering** | `Mapping defined for $.name` | Extra fields in source payload are stripped. |
| **TC-05** | **Direct Reply** | `responseMapping.type = "DIRECT"` | Library returns target JSON exactly as received. |

---

## 🏗️ Technical Knowledge Transfer (KT)

### Architecture Overview
1. **Controller**: Merges incoming JSON overrides with Database configurations.
2. **Strategies**: Implements the `AuthProvider` interface to validate and inject security headers.
3. **Transformer**: Uses `jsonpath` to recursively map source trees to target trees.
4. **Resilience**: Optional retry logic for flakey target APIs.

### Extensibility
* **Custom Transforms**: Add new logic to `TransformerService.applyTransform`.
* **New Auth Types**: Implement the `AuthProvider` interface and register in `AuthStrategyFactory`.

---

## 🧪 Verified Scenarios

The `database_init.sql` script seeds the following example:

| Connector Key | Feature Validated | Auth Strategy |
| :--- | :--- | :--- |
| `jsonplaceholder-users` | **Standard Proxy** | None |


---

## 📄 Appendix: Entity Definitions

If you need to define these entities manually (e.g., for non-TypeORM setups), they must match these structures:

### 1. IntegrationMappingEntity
Table: `integration_mappings_config`

```typescript
export class IntegrationMappingEntity {
    id: string;          // UUID
    name: string;        // Unique Key
    sourceSystem: string;
    targetSystem: string;
    mappingConfig: MappingConfig; // JSONB
    createdAt: Date;
    updatedAt: Date;
}
```

---

## 📄 License

MIT
