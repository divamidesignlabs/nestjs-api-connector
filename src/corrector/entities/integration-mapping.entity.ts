import { MappingConfig } from '../interfaces/mapping-config.interface';

/**
 * Integration Mapping Entity (Plain TypeScript class - no ORM decorators)
 * This is a DTO that can be used with any database implementation
 */
export class IntegrationMapping {
  id: string;
  name: string;
  sourceSystem: string;
  targetSystem: string;
  mappingConfig: MappingConfig;
  createdAt?: Date;
  updatedAt?: Date;
}
