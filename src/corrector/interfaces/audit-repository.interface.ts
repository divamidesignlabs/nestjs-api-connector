/**
 * Corrector Audit data structure
 */
export interface CorrectorAudit {
  id?: string;
  mappingId?: string;
  mappingName?: string;
  sourceSystem?: string;
  targetSystem?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  latencyMs?: number;
  requestPayload?: Record<string, any>;
  responsePayload?: Record<string, any>;
  error?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

/**
 * Repository interface for Audit Logs
 * Consumers must provide an implementation of this interface
 */
export interface IAuditRepository {
  create(audit: Partial<CorrectorAudit>): CorrectorAudit;
  save(audit: CorrectorAudit): Promise<CorrectorAudit>;
}

export const AUDIT_REPOSITORY = 'AUDIT_REPOSITORY';
