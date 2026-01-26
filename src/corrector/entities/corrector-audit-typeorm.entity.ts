import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * TypeORM Entity for Corrector Audit
 * Use this if you're using TypeORM in your consumer app
 */
@Entity('corrector_audit_logs')
export class CorrectorAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mapping_id', nullable: true })
  mappingId?: string;

  @Column({ name: 'mapping_name', nullable: true })
  mappingName?: string;

  @Column({ name: 'source_system', nullable: true })
  sourceSystem?: string;

  @Column({ name: 'target_system', nullable: true })
  targetSystem?: string;

  @Column({ nullable: true })
  method?: string;

  @Column({ type: 'text', nullable: true })
  url?: string;

  @Column({ name: 'status_code', nullable: true })
  statusCode?: number;

  @Column({ name: 'latency_ms', nullable: true })
  latencyMs?: number;

  @Column('jsonb', { name: 'request_payload', nullable: true })
  requestPayload?: Record<string, any>;

  @Column('jsonb', { name: 'response_payload', nullable: true })
  responsePayload?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  error?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
