import { IntegrationMapping } from '../entities/integration-mapping.entity';
import { MappingConfig } from './mapping-config.interface';

/**
 * Repository interface for Integration Mappings
 * Consumers must provide an implementation of this interface
 */
export interface IMappingRepository {
  create(name: string, config: MappingConfig): Promise<IntegrationMapping>;
  findOne(id: string): Promise<IntegrationMapping | null>;
  findByIdOrName(idOrName: string): Promise<IntegrationMapping | null>;
  findActive(
    sourceSystem: string,
    targetSystem: string,
  ): Promise<IntegrationMapping | null>;
}

export const MAPPING_REPOSITORY = 'MAPPING_REPOSITORY';
