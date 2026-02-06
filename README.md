# 🚀 NestJS API Connector

**A configuration-driven API integration & transformation framework for NestJS.**

[![npm version](https://badge.fury.io/js/@divami-labs/nestjs-api-connector.svg)](https://badge.fury.io/js/@divami-labs/nestjs-api-connector)


**nestjs-api-connector** (formerly corrector) acts as an intelligent bridge between your application and external APIs. Instead of writing endless HTTP Services and DTOs, you define integrations in your database and manage transformations dynamically.

---

## ✨ Features

*   **Dynamic Configuration**: Define API endpoints, methods, and auth type in your DB.
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

The library includes a `database_init.sql` file in the root directory. You can use this to initialize your PostgreSQL database.

*   **Tables Created**: `connector_mappings_config`
*   **Columns**: `id`, `name`, `source_system`, `target_system`, `mapping_config`, `created_at`, `updated_at`.

You can also create a **Custom Table Name** (see below).

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

If you prefer a custom table name (e.g., `my_custom_connectors`), use the `getMappingEntity` utility:

```typescript
import { getMappingEntity, TypeOrmMappingRepository } from 'nestjs-api-connector';

// 1. Create the entity class with your custom table name
const MyCustomEntity = getMappingEntity('my_custom_connectors');

@Module({
  imports: [
    // Register the custom entity in TypeORM
    TypeOrmModule.forFeature([MyCustomEntity]),
    
    ConnectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        tableName: 'my_custom_connectors',
        mappingRepository: new TypeOrmMappingRepository(
          dataSource.getRepository(MyCustomEntity)
        ),
      }),
    }),
  ],
})
export class AppModule {}
```

#### C. Extending with Custom Fields (Extra Entity)

You can add extra business logic or auditing columns to your table while keeping the library functional. Just extend the base entity provided by the factory:

```typescript
import { getMappingEntity } from 'nestjs-api-connector';
import { Entity, Column } from 'typeorm';

// 1. Get the base connector entity class
const BaseConnectorEntity = getMappingEntity('enterprise_connectors');

// 2. Extend it to add custom fields
@Entity('enterprise_connectors')
export class ExtendedConnectorEntity extends BaseConnectorEntity {
  @Column({ nullable: true })
  clientOwner: string;

  @Column({ default: 'PROD' })
  environment: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}

// 3. Register as normal
@Module({
  imports: [
    TypeOrmModule.forFeature([ExtendedConnectorEntity]),
    ConnectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        mappingRepository: new TypeOrmMappingRepository(
          dataSource.getRepository(ExtendedConnectorEntity)
        ),
      }),
    }),
  ],
})
export class AppModule {}
```



### 4. Built-in API Proxy

The framework automatically exposes a standardized endpoint: `POST /connector/execute`.

**Sample Request Payload:**
```json
{
  "connectorKey": "get-products",
  "payload": { "id": 101 },
  "authConfig": {
    "authType": "BEARER_TOKEN",
    "config": { "token": "abc-123-token" }
  },
  "headerData": { "X-Custom-Source": "Mobile-App" },
  "queryParams": { "version": "v2" }
}
```

---

## 🔐 Authentication Standards

The framework ensures security by prioritizing **Database Configuration** over incoming request data.

| Auth Type | Config Fields required in DB/Request | Injection Method |
| :--- | :--- | :--- |
| **`BEARER_TOKEN`** | `token` | `Authorization: Bearer <token>` |
| **`BASIC`** | `username`, `password` | `Authorization: Basic <base64>` |
| **`API_KEY`** | `keyName`, `keyValue` | Custom header (e.g., `x-api-key: val`) |
| **`OAUTH2_CLIENT_CREDENTIALS`** | `tokenUrl`, `clientId`, `clientSecret` | Automatic Token generation & caching |
| **`NONE`** | - | No Auth |

**Strict Validation**: If a connector is configured as `BEARER_TOKEN` in the DB, any incoming request trying to pass `BASIC` auth will be rejected with a `400 AUTH_MISMATCH`.

---

## 📝 Database Mapping Guide

The `mapping_config` column in your database governs how data flows. Here is the standard format for various integration scenarios.

### 1. Basic Object Mapping (`type: "OBJECT"`)
Use this for standard JSON-to-JSON transformations.

```json
{
  "id": "user-connector",
  "targetApi": {
    "url": "https://api.external.com/users",
    "method": "POST"
  },
  "requestMapping": {
    "type": "OBJECT",
    "mappings": [
      { "source": "$.firstName", "target": "$.full_name" },
      { "source": "$.meta.age", "target": "$.age", "default": 18, "required": true }
    ]
  }
}
```

### 2. Array List Mapping (`type: "ARRAY"`)
Use this when the target API returns a list of items and you need to transform each item.

```json
{
  "responseMapping": {
    "type": "ARRAY",
    "root": "$.items",         // JSONPath to the array in the source
    "outputWrapper": "$.data", // (Optional) Wraps result in a specific key
    "mappings": [
      { "source": "$.id", "target": "$.userId" },
      { "source": "$.title", "target": "$.name", "transform": "uppercase" }
    ]
  }
}
```


### 3. Transforms
Apply built-in functions during mapping.

```json
{
  "mappings": [
    { 
      "source": "$.price", 
      "target": "$.formattedPrice", 
      "transform": "roundTo2" 
    }
  ]
}
```

**Built-in Transforms:** `uppercase`, `lowercase`, `roundTo2`, `toNumber`, `toString`.

---

## 🛑 Error Response Examples

The framework provides standardized error responses for different failure scenarios.

### 1. Mapping Not Found (404)
Triggered when the requested `connectorKey` does not exist in the database.

```json
{
    "success": false,
    "statusCode": 404,
    "errorType": "CLIENT_ERROR",
    "message": "Mapping with ID or Name 'jsonplaceholder-users' not found"
}
```

### 2. Target API Error (401/500/etc.)
Triggered when the external service returns an error. The `targetResponse` field contains the raw response from the external API.

```json
{
    "success": false,
    "statusCode": 401,
    "errorType": "TARGET_API_ERROR",
    "targetResponse": {
        "message": "Invalid or expired token",
        "error": "Unauthorized",
        "statusCode": 401
    }
}
```

### 3. Authentication Mismatch (400)
Triggered when the authentication type passed in the request does not match the mandatory authentication type configured in the database for that connector.

```json
{
    "success": false,
    "statusCode": 400,
    "errorType": "CLIENT_ERROR",
    "message": "Auth type BEARER_TOKE does not match required BEARER_TOKEN"
}
```



