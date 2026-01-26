import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrectorModule } from './corrector/corrector.module';
import { DynamicMasterService } from './dynamic-master.service';
import { IntegrationMappingEntity } from './corrector/entities/integration-mapping-typeorm.entity';
import { CorrectorAuditEntity } from './corrector/entities/corrector-audit-typeorm.entity';
import { TypeOrmMappingRepository } from './corrector/repositories/typeorm-mapping.repository';
import { TypeOrmAuditRepository } from './corrector/repositories/typeorm-audit.repository';

/**
 * This module is for standalone/microservice usage with TypeORM
 * For embedded library usage, consumers should configure their own repositories
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [IntegrationMappingEntity, CorrectorAuditEntity],
        synchronize: false, // Managed via database_init.sql
      }),
      inject: [ConfigService],
    }),
    // Register TypeORM entities for repository injection
    TypeOrmModule.forFeature([IntegrationMappingEntity, CorrectorAuditEntity]),
    // Configure CorrectorModule with TypeORM repository implementations using factories
    CorrectorModule.forRoot({
      mappingRepositoryFactory: {
        useFactory: (repo: TypeOrmMappingRepository) => repo,
        inject: [TypeOrmMappingRepository],
      },
      auditRepositoryFactory: {
        useFactory: (repo: TypeOrmAuditRepository) => repo,
        inject: [TypeOrmAuditRepository],
      },
    }),
  ],
  providers: [
    DynamicMasterService,
    TypeOrmMappingRepository,
    TypeOrmAuditRepository,
  ],
  exports: [DynamicMasterService],
})
export class DynamicMasterModule {}
