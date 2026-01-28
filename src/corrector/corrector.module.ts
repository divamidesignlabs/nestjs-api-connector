import { Module, Global, DynamicModule, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CorrectorEngine } from './services/corrector-engine.service';
import { TransformerService } from './services/transformer.service';
import { TargetApiCaller } from './services/target-api-caller.service';
import { AuthStrategyFactory } from './strategies/auth.strategy';
import { MappingRegistryService } from './services/mapping-registry.service';
import { CorrectorController } from './corrector.controller';
import { MAPPING_REPOSITORY } from './interfaces/mapping-repository.interface';
import { CorrectorModuleOptions } from './interfaces/corrector-module-options.interface';
import { CORRECTOR_OPTIONS, MESSAGES } from './constants';

@Global()
@Module({})
export class CorrectorModule {
  static forRoot(options: CorrectorModuleOptions): DynamicModule {
    const providers: Provider[] = [
      ...this.getCoreProviders(),
      { provide: CORRECTOR_OPTIONS, useValue: options },
      this.getRepositoryProvider(options),
    ];
    return this.assembleModule(providers);
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => Promise<CorrectorModuleOptions> | CorrectorModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const providers: Provider[] = [
      ...this.getCoreProviders(),
      {
        provide: CORRECTOR_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: MAPPING_REPOSITORY,
        useFactory: async (...args: any[]) => {
          const config = await options.useFactory(...args);
          if (config.mappingRepository) return config.mappingRepository;
          if (config.mappingRepositoryFactory) {
            return config.mappingRepositoryFactory.useFactory(
              ...(config.mappingRepositoryFactory.inject || []),
            );
          }
          throw new Error(MESSAGES.ERROR.REPOSITORY_REQUIRED);
        },
        inject: options.inject || [],
      },
    ];
    return this.assembleModule(providers);
  }

  private static getCoreProviders(): Provider[] {
    return [
      CorrectorEngine,
      TransformerService,
      TargetApiCaller,
      AuthStrategyFactory,
      MappingRegistryService,
    ];
  }

  private static getRepositoryProvider(options: CorrectorModuleOptions): Provider {
    if (options.mappingRepository) {
      return { provide: MAPPING_REPOSITORY, useValue: options.mappingRepository };
    }
    if (options.mappingRepositoryFactory) {
      return {
        provide: MAPPING_REPOSITORY,
        useFactory: options.mappingRepositoryFactory.useFactory,
        inject: options.mappingRepositoryFactory.inject || [],
      };
    }
    throw new Error(MESSAGES.ERROR.REPOSITORY_REQUIRED);
  }

  private static assembleModule(providers: Provider[]): DynamicModule {
    return {
      module: CorrectorModule,
      imports: [HttpModule],
      controllers: [CorrectorController],
      providers,
      exports: [CorrectorEngine, TransformerService, MappingRegistryService],
    };
  }
}
