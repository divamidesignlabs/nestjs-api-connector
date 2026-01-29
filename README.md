# 🚀 NestJS API Connector

**A configuration-driven API integration & transformation framework for NestJS.**

[![npm version](https://badge.fury.io/js/nestjs-api-connector.svg)](https://badge.fury.io/js/nestjs-api-connector)


**nestjs-api-connector** (formerly corrector) acts as an intelligent bridge between your application and external APIs. Instead of writing endless HTTP Services and DTOs, you define integrations in your database and manage transformations dynamically.

---

## ✨ Features

*   **Dynamic Configuration**: Define API endpoints, methods, and auth in your DB.
*   **Zero-Code Updates**: Change target URLs or field mappings without redeploying code.
*   **Robust Authentication**: Supported strategies (Bearer, Basic, ApiKey, OAuth2) with strict database priority.
*   **High Performance Transformation**: Transform requests and responses using JSONPath or Custom Javascript with optimized array processing.
*   **Standardized Responses**: Consistent error handling (CLIENT_ERROR, TARGET_API_ERROR, INTERNAL_ERROR).
*   **Database Agnostic**: Built-in TypeORM support, easily adaptable to any repository.

---

## 📦 Installation

```bash
npm install nestjs-api-connector
```

---

## 🛠️ Usage

### 1. Database Setup

You only need one table: `connector_mappings_config`.
Refer to `database_init.sql` for the PostgreSQL structure.

### 2. Import Module in `AppModule`

#### A. Using TypeORM (Recommended)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { 
  ConnectorModule, 
  TypeOrmMappingRepository, 
  IntegrationMappingEntity 
} from 'nestjs-api-connector';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      entities: [IntegrationMappingEntity],
      synchronize: false, 
    }),

    ConnectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        mappingRepository: new TypeOrmMappingRepository(
          dataSource.getRepository(IntegrationMappingEntity)
        ),
      }),
    }),
  ],
})
export class AppModule {}
```

#### B. Using Custom Table Name (Optional)

If you prefer a custom table name (e.g., `my_custom_connectors`):

```typescript
import { getMappingEntity, TypeOrmMappingRepository } from 'nestjs-api-connector';

// 1. Create the entity with your custom table name
const MyCustomEntity = getMappingEntity('my_custom_connectors');

@Module({
  imports: [
    TypeOrmModule.forFeature([MyCustomEntity]),
    ConnectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        tableName: 'my_custom_connectors',
        mappingRepository: new TypeOrmMappingRepository(dataSource.getRepository(MyCustomEntity)),
      }),
    }),
  ],
})
export class AppModule {}
```


---

#### C. Extending with Custom Fields (Optional)

You can add extra columns to your table while keeping the library functional. Just extend the entity:

```typescript
import { getMappingEntity } from 'nestjs-api-connector';
import { Entity, Column } from 'typeorm';

// 1. Get the base entity
const BaseEntity = getMappingEntity('my_extensible_table');

// 2. Extend it
@Entity('my_extensible_table')
export class ExtendedEntity extends BaseEntity {
  @Column({ nullable: true })
  description: string;

  @Column({ default: 'active' })
  status: string;
}

// 3. Use ExtendedEntity in TypeOrmModule and ConnectorModule (as shown above)
```



### 4. Direct API Access

The framework automatically exposes an endpoint: `POST /connector/execute`.

**Request Structure:**
```json
{
  "connectorKey": "get-products",
  "payload": { "category": "electronics" },
  "authConfig": {
    "authType": "BEARER_TOKEN",
    "config": { "token": "your-static-token" }
  }
}
```

---

## 🔐 Authentication Standards

| Auth Type | Required Config Fields | Injection Method |
| :--- | :--- | :--- |
| **`BEARER_TOKEN`** | `token` | `Authorization: Bearer <token>` |
| **`BASIC`** | `username`, `password` | `Authorization: Basic <base64>` |
| **`API_KEY`** | `keyName`, `keyValue` | `Header injection` |
| **`OAUTH2`** | `tokenUrl`, `clientId`, `clientSecret` | `Dynamic Token Injection` |
| **`NONE`** | - | No Auth |

**Note on Priority**: All authentication follows a **Database-First** policy. If your DB configuration specifies an auth type, the incoming request cannot override it for security reasons.

---

## 🏗️ Transformation Types

The framework supports three powerful transformation modes:

1.  **OBJECT**: Field-to-field mapping with support for:
    *   **JSONPath**: Pick data from any depth (e.g., `$.user.profile.name`).
    *   **Conditionals**: If-Then-Else logic based on source values.
    *   **Transforms**: Built-in functions like `uppercase`, `roundTo2`, etc.
2.  **ARRAY**: Optimized loop processing for lists, including root-path resolution and output wrapping.
3.  **CUSTOM**: Direct Javascript execution for complex business logic.

---

## 🧪 Verification Scenarios

| Case | Expected Outcome |
| :--- | :--- |
| **Auth Fail** | Returns `401 Unauthorized` with clear missing-field messages. |
| **Mapping Error** | Recovers gracefully, logs a warning, and continues with defaults. |
| **Target API Error** | Forwards the status code and raw response from the external system. |

---

