import { IMappingRepository } from './mapping-repository.interface';
import { IAuditRepository } from './audit-repository.interface';

export interface CorrectorModuleOptions {
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
   * Direct instance of IAuditRepository (use this for simple cases)
   */
  auditRepository?: IAuditRepository;

  /**
   * Factory for creating IAuditRepository (use this for dependency injection)
   */
  auditRepositoryFactory?: {
    useFactory: (
      ...args: any[]
    ) => IAuditRepository | Promise<IAuditRepository>;
    inject?: any[];
  };

  /**
   * Optional: Global timeout in milliseconds
   */
  globalTimeoutMs?: number;
}
