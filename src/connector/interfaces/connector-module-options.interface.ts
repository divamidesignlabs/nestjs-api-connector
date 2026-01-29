import { IMappingRepository } from './mapping-repository.interface';

export interface ConnectorModuleOptions {
  /**
   * Direct instance of IMappingRepository (use this for simple cases)
   */
  mappingRepository?: IMappingRepository;

  /**
   * Factory for creating IMappingRepository (use this for dependency injection)
   */
  mappingRepositoryFactory?: {
    useFactory: (
      ...args: any[]
    ) => IMappingRepository | Promise<IMappingRepository>;
    inject?: any[];
  };


  /**
   * Optional: Global timeout in milliseconds
   */
  globalTimeoutMs?: number;
  tableName?: string;
}
