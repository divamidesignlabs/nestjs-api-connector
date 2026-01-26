import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationMapping } from '../entities/integration-mapping.entity';
import { IntegrationMappingEntity } from '../entities/integration-mapping-typeorm.entity';
import { IMappingRepository } from '../interfaces/mapping-repository.interface';
import { MappingConfig } from '../interfaces/mapping-config.interface';

/**
 * TypeORM implementation of IMappingRepository
 * This is provided as a convenience for consumers using TypeORM
 */
@Injectable()
export class TypeOrmMappingRepository implements IMappingRepository {
  constructor(
    @InjectRepository(IntegrationMappingEntity)
    private readonly repository: Repository<IntegrationMappingEntity>,
  ) {}

  async create(
    name: string,
    config: MappingConfig,
  ): Promise<IntegrationMapping> {
    const mapping = this.repository.create({
      name,
      sourceSystem: config.sourceSystem,
      targetSystem: config.targetSystem,
      mappingConfig: config,
    });
    return this.repository.save(mapping);
  }

  async findOne(id: string): Promise<IntegrationMapping | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIdOrName(idOrName: string): Promise<IntegrationMapping | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrName,
      );

    let mapping: IntegrationMapping | null = null;

    if (isUuid) {
      mapping = await this.repository.findOne({ where: { id: idOrName } });
    }

    if (!mapping) {
      mapping = await this.repository.findOne({ where: { name: idOrName } });
    }

    return mapping;
  }

  async findActive(
    sourceSystem: string,
    targetSystem: string,
  ): Promise<IntegrationMapping | null> {
    return this.repository.findOne({
      where: {
        sourceSystem,
        targetSystem,
      },
    });
  }
}
