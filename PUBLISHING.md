# 🚀 Publishing & Usage Guide: NestJS API Corrector

Your library `nestjs-api-corrector` is now production-ready! It features a database-agnostic architecture using the Repository Pattern, making it compatible with any NestJS application.

## 📦 1. Publishing to NPM

### Preparation
1. **Navigate to the library directory:**
   ```bash
   cd nestjs-dynamic-master
   ```

2. **Login to NPM** (if not already logged in):
   ```bash
   npm login
   ```

3. **Update Version** (optional):
   ```bash
   npm version patch  # 0.0.3 -> 0.0.4
   # OR
   npm version minor  # 0.0.3 -> 0.1.0
   ```

### Publish
```bash
npm publish --access public
```

---

## 🛠️ 2. Installing in a Consumer App

```bash
npm install nestjs-api-corrector
```

*Note: Until you publish, you can install from the tarball:*
```bash
npm pack ../path/to/nestjs-dynamic-master
npm install ./nestjs-api-corrector-0.0.3.tgz
```

---

## 💻 3. Usage Example

### `app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { 
  CorrectorModule, 
  IntegrationMappingEntity, 
  CorrectorAuditEntity, 
  TypeOrmMappingRepository, 
  TypeOrmAuditRepository 
} from 'nestjs-api-corrector';

@Module({
  imports: [
    // 1. Configure Your Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'your_db',
      entities: [IntegrationMappingEntity, CorrectorAuditEntity], // Register Library Entities
      synchronize: true, // Use with caution in production
    }),

    // 2. Register Entities in Current Scope
    TypeOrmModule.forFeature([IntegrationMappingEntity, CorrectorAuditEntity]),

    // 3. Configure Corrector Module
    CorrectorModule.forRootAsync({
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => ({
        // Provide the repository implementations
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

### `some.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { CorrectorEngine } from 'nestjs-api-corrector';

@Injectable()
export class IntegrationService {
  constructor(private readonly corrector: CorrectorEngine) {}

  async syncUser(userId: string) {
    const result = await this.corrector.execute(
      { /* mapping config object or ID */ }, 
      { id: userId }
    );
    return result;
  }
}
```

---

## 🧩 4. Architecture

### Database Agnostic
The library does **not** depend on TypeORM internally. Instead, it relies on interfaces:
- `IMappingRepository`
- `IAuditRepository`

This means you can easily swap TypeORM for Prisma, Mongoose, or raw SQL by implementing these interfaces yourself!

### Built-in TypeORM Support
For convenience, we ship with `TypeOrmMappingRepository` and `TypeOrmAuditRepository` so you don't have to write them yourself if you are using TypeORM.

---

## ✅ Checklist for Success

- [x] Library builds successfully (`npm run build`)
- [x] TypeORM entities are exported
- [x] Repositories are exported
- [x] `forRootAsync` supports dependency injection
- [x] Consumer app connects to DB successfully
- [x] API calls work end-to-end
