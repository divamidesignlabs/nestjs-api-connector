import { Injectable, Logger } from '@nestjs/common';
import { IAuditRepository } from '../interfaces/audit-repository.interface';
import { CorrectorAudit } from '../entities/corrector-audit.entity';

@Injectable()
export class LoggerAuditRepository implements IAuditRepository {
  private readonly logger = new Logger('AuditLog');

  create(data: Partial<CorrectorAudit>): CorrectorAudit {
    // Return a dummy entity object, or just the plain data casted
    return data as CorrectorAudit;
  }

  async save(audit: CorrectorAudit): Promise<CorrectorAudit> {
    // Instead of DB, we just log useful info
    if (audit.error) {
        this.logger.error(`[AUDIT FAIL] ${audit.method} ${audit.mappingName} - ${audit.latencyMs}ms - Error: ${audit.error.message}`);
    } else {
        this.logger.log(`[AUDIT SUCCESS] ${audit.method} ${audit.mappingName} - ${audit.latencyMs}ms - Status: ${audit.statusCode}`);
    }
    return audit;
  }
}
