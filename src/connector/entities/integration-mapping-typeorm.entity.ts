import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MappingConfig } from '../interfaces/mapping-config.interface';

/**
 * TypeORM Entity for Integration Mapping
 * Use this if you're using TypeORM in your consumer app
 */
@Entity('connector_mappings_config')
export class IntegrationMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'source_system' })
  sourceSystem: string;

  @Column({ name: 'target_system' })
  targetSystem: string;

  @Column('jsonb', { name: 'mapping_config' })
  mappingConfig: MappingConfig;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Factory to create an entity with a custom table name
 */
export function getMappingEntity(tableName: string = 'connector_mappings_config') {
  @Entity(tableName)
  class CustomMappingEntity extends IntegrationMappingEntity {}
  // Ensure we don't return the same class reference if tableName changes (though unlikely in one app)
  return CustomMappingEntity;
}
