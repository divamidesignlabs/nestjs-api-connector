import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntegrationMapping } from '../entities/integration-mapping.entity';
import { IMappingRepository } from '../interfaces/mapping-repository.interface';

/**
 * TypeORM implementation of IMappingRepository
 * This is provided as a convenience for consumers using TypeORM.
 * It is generic to allow using custom entities or table names.
 */
@Injectable()
export class TypeOrmMappingRepository<T extends IntegrationMapping = IntegrationMapping> implements IMappingRepository {
  constructor(
    private readonly repository: Repository<T>,
  ) {}

  async findByIdOrName(idOrName: string): Promise<IntegrationMapping | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrName,
      );

    let mapping: IntegrationMapping | null = null;

    if (isUuid) {
      mapping = (await this.repository.findOne({
        where: { id: idOrName } as any,
      })) as IntegrationMapping;
    }

    if (!mapping) {
      mapping = (await this.repository.findOne({
        where: { name: idOrName } as any,
      })) as IntegrationMapping;
    }

    return mapping;
  }
}
