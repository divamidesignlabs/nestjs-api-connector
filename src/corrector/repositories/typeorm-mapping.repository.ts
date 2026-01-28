import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationMapping } from '../entities/integration-mapping.entity';
import { IntegrationMappingEntity } from '../entities/integration-mapping-typeorm.entity';
import { IMappingRepository } from '../interfaces/mapping-repository.interface';

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
}
