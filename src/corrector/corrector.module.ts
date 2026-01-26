import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CorrectorEngine } from './services/corrector-engine.service';
import { TransformerService } from './services/transformer.service';
import { TargetApiCaller } from './services/target-api-caller.service';
import { AuthStrategyFactory } from './strategies/auth.strategy';
import { MappingRegistryService } from './services/mapping-registry.service';
import { CorrectorController } from './corrector.controller';
import { CorrectorModuleOptions } from './interfaces/corrector-module-options.interface';
import { MAPPING_REPOSITORY } from './interfaces/mapping-repository.interface';
import { AUDIT_REPOSITORY } from './interfaces/audit-repository.interface';

@Global()
@Module({})
export class CorrectorModule {
  static forRoot(options: CorrectorModuleOptions): DynamicModule {
    const providers: Provider[] = [
      CorrectorEngine,
      TransformerService,
      TargetApiCaller,
      AuthStrategyFactory,
      MappingRegistryService,
      {
        provide: 'CORRECTOR_OPTIONS',
        useValue: options,
      },
    ];

    // Add repository providers based on what's provided in options
    if (options.mappingRepository) {
      providers.push({
        provide: MAPPING_REPOSITORY,
        useValue: options.mappingRepository,
      });
    } else if (options.mappingRepositoryFactory) {
      providers.push({
        provide: MAPPING_REPOSITORY,
        useFactory: options.mappingRepositoryFactory.useFactory,
        inject: options.mappingRepositoryFactory.inject || [],
      });
    }

    if (options.auditRepository) {
      providers.push({
        provide: AUDIT_REPOSITORY,
        useValue: options.auditRepository,
      });
    } else if (options.auditRepositoryFactory) {
      providers.push({
        provide: AUDIT_REPOSITORY,
        useFactory: options.auditRepositoryFactory.useFactory,
        inject: options.auditRepositoryFactory.inject || [],
      });
    }

    return {
      module: CorrectorModule,
      imports: [HttpModule],
      controllers: [CorrectorController],
      providers,
      exports: [CorrectorEngine, TransformerService, MappingRegistryService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: unknown[]
    ) => Promise<CorrectorModuleOptions> | CorrectorModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const providers: Provider[] = [
      CorrectorEngine,
      TransformerService,
      TargetApiCaller,
      AuthStrategyFactory,
      MappingRegistryService,
      {
        provide: 'CORRECTOR_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: MAPPING_REPOSITORY,
        useFactory: async (...args: unknown[]) => {
          const config = await options.useFactory(...args);
          if (config.mappingRepository) return config.mappingRepository;
          if (config.mappingRepositoryFactory) {
            return config.mappingRepositoryFactory.useFactory(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              ...(config.mappingRepositoryFactory.inject || []),
            );
          }
          throw new Error(
            'mappingRepository or mappingRepositoryFactory required',
          );
        },
        inject: options.inject || [],
      },
      {
        provide: AUDIT_REPOSITORY,
        useFactory: async (...args: unknown[]) => {
          const config = await options.useFactory(...args);
          if (config.auditRepository) return config.auditRepository;
          if (config.auditRepositoryFactory) {
            return config.auditRepositoryFactory.useFactory(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              ...(config.auditRepositoryFactory.inject || []),
            );
          }
          throw new Error('auditRepository or auditRepositoryFactory required');
        },
        inject: options.inject || [],
      },
    ];

    return {
      module: CorrectorModule,
      imports: [HttpModule],
      controllers: [CorrectorController],
      providers,
      exports: [CorrectorEngine, TransformerService, MappingRegistryService],
    };
  }
}
