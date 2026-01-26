import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IntegrationMapping } from '../entities/integration-mapping.entity';
import { MappingConfig } from '../interfaces/mapping-config.interface';
import {
  IMappingRepository,
  MAPPING_REPOSITORY,
} from '../interfaces/mapping-repository.interface';

@Injectable()
export class MappingRegistryService {
  constructor(
    @Inject(MAPPING_REPOSITORY)
    private readonly mappingRepo: IMappingRepository,
  ) {}

  async create(
    name: string,
    config: MappingConfig,
  ): Promise<IntegrationMapping> {
    return this.mappingRepo.create(name, config);
  }

  async findOne(id: string): Promise<IntegrationMapping> {
    const mapping = await this.mappingRepo.findOne(id);
    if (!mapping) {
      throw new NotFoundException(`Mapping with ID ${id} not found`);
    }
    return mapping;
  }

  async findByIdOrName(idOrName: string): Promise<IntegrationMapping> {
    const mapping = await this.mappingRepo.findByIdOrName(idOrName);
    if (!mapping) {
      throw new NotFoundException(
        `Mapping with ID or Name '${idOrName}' not found`,
      );
    }
    return mapping;
  }

  async findActive(
    sourceSystem: string,
    targetSystem: string,
  ): Promise<IntegrationMapping> {
    const mapping = await this.mappingRepo.findActive(
      sourceSystem,
      targetSystem,
    );
    if (!mapping) {
      throw new NotFoundException(
        `No mapping found for ${sourceSystem} -> ${targetSystem}`,
      );
    }
    return mapping;
  }
}
