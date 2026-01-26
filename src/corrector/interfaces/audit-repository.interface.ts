import { CorrectorAudit } from '../entities/corrector-audit.entity';

/**
 * Repository interface for Audit Logs
 * Consumers must provide an implementation of this interface
 */
export interface IAuditRepository {
  create(audit: Partial<CorrectorAudit>): CorrectorAudit;
  save(audit: CorrectorAudit): Promise<CorrectorAudit>;
}

export const AUDIT_REPOSITORY = 'AUDIT_REPOSITORY';
