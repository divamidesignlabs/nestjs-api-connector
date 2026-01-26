import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorrectorAudit } from '../entities/corrector-audit.entity';
import { CorrectorAuditEntity } from '../entities/corrector-audit-typeorm.entity';
import { IAuditRepository } from '../interfaces/audit-repository.interface';

/**
 * TypeORM implementation of IAuditRepository
 * This is provided as a convenience for consumers using TypeORM
 */
@Injectable()
export class TypeOrmAuditRepository implements IAuditRepository {
  constructor(
    @InjectRepository(CorrectorAuditEntity)
    private readonly repository: Repository<CorrectorAuditEntity>,
  ) {}

  create(audit: Partial<CorrectorAudit>): CorrectorAudit {
    return this.repository.create(audit);
  }

  async save(audit: CorrectorAudit): Promise<CorrectorAudit> {
    return this.repository.save(audit);
  }
}
