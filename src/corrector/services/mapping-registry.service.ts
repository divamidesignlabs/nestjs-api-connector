import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IntegrationMapping } from '../entities/integration-mapping.entity';
import { MappingConfig } from '../interfaces/mapping-config.interface';
import {
  IMappingRepository,
  MAPPING_REPOSITORY,
} from '../interfaces/mapping-repository.interface';
import { MESSAGES } from '../constants';

@Injectable()
export class MappingRegistryService {
  constructor(
    @Inject(MAPPING_REPOSITORY)
    private readonly mappingRepo: IMappingRepository,
  ) {}

  async findByIdOrName(idOrName: string): Promise<IntegrationMapping> {
    const mapping = await this.mappingRepo.findByIdOrName(idOrName);
    if (!mapping) {
      throw new NotFoundException(
        MESSAGES.ERROR.MAPPING_NOT_FOUND_BY_NAME(idOrName),
      );
    }
    return mapping;
  }
}
