/**
 * Corrector Audit Entity (Plain TypeScript class - no ORM decorators)
 * This is a DTO that can be used with any database implementation
 */
export class CorrectorAudit {
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
