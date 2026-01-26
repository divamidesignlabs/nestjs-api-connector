import { Injectable, Logger, Inject } from '@nestjs/common';
import { TransformerService } from './transformer.service';
import { TargetApiCaller } from './target-api-caller.service';
import { AuthStrategyFactory, AuthContext } from '../strategies/auth.strategy';
import {
  MappingConfig,
  RequestMapping,
  ResponseMapping,
  TargetApiConfig,
} from '../interfaces/mapping-config.interface';
// CorrectorAudit import removed
import {
  IAuditRepository,
  AUDIT_REPOSITORY,
} from '../interfaces/audit-repository.interface';
import * as jsonpath from 'jsonpath';
import Ajv from 'ajv';

@Injectable()
export class CorrectorEngine {
  private readonly logger = new Logger(CorrectorEngine.name);
  private readonly ajv = new Ajv();

  constructor(
    private readonly transformer: TransformerService,
    private readonly apiCaller: TargetApiCaller,
    private readonly authFactory: AuthStrategyFactory,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepo: IAuditRepository,
  ) {}

  async execute(
    mapping: MappingConfig,
    sourcePayload: any,
    context?: {
      method: string;
      queryParams: Record<string, any>;
      incomingToken?: string;
      headers?: Record<string, any>;
    },
  ): Promise<unknown> {
    const startTime = Date.now();
    const payload = sourcePayload as Record<string, unknown>;
    const audit = this.auditRepo.create({
      mappingId: mapping.id,
      mappingName: mapping.id,
      sourceSystem: mapping.sourceSystem,
      targetSystem: mapping.targetSystem,
      method: (context?.method as string) || mapping.targetApi.method,
      requestPayload: payload,
    });

    try {
      this.logger.log(`Executing correction for mapping: ${mapping.id}`);

      // 0. Request Contract Validation (Feature)
      if (mapping.requestSchema) {
        this.logger.debug('Validating request payload against schema...');
        const validate = this.ajv.compile(mapping.requestSchema);
        const valid = validate(sourcePayload);
        if (!valid) {
          const errorDetails = this.ajv.errorsText(validate.errors);
          this.logger.warn(`Request validation failed: ${errorDetails}`);
          audit.metadata = {
            requestValidationFailed: true,
            schemaErrors: validate.errors,
          };
          throw new Error(
            `Request Contract Validation Failed: ${errorDetails}`,
          );
        }
      } else {
        this.logger.debug('No requestSchema found in mapping config.');
      }

      let finalResponse: unknown;
      const sharedContext: Record<string, any> = {
        ...payload,
      };

      if (mapping.steps && mapping.steps.length > 0) {
        this.logger.debug(
          `Found ${mapping.steps.length} workflow steps. Executing chaining...`,
        );
        for (const step of mapping.steps) {
          this.logger.debug(`Step: ${step.id}`);
          const callResult = (await this.executeSingleCall(
            {
              ...mapping,
              targetApi: step.targetApi,
              requestMapping: step.requestMapping,
              responseMapping: step.responseMapping,
            },
            sharedContext,
            context,
          )) as { result: unknown; url: string };

          const { result: stepResult, url: stepUrl } = callResult;

          audit.url = stepUrl; // Audit last step's URL or merge them
          if (step.saveResultToContextAs) {
            sharedContext[step.saveResultToContextAs] = stepResult;
          }
          finalResponse = stepResult;
        }
      } else {
        const callResult = (await this.executeSingleCall(
          mapping,
          payload,
          context,
        )) as { result: unknown; url: string };
        const { result, url } = callResult;
        finalResponse = result;
        audit.url = url;
      }

      // 6. Schema Validation (Feature 3)
      if (mapping.responseSchema) {
        this.logger.debug('Validating response against schema...');
        const validate = this.ajv.compile(mapping.responseSchema);
        const valid = validate(finalResponse);
        if (!valid) {
          const errorDetails = this.ajv.errorsText(validate.errors);
          this.logger.warn(`Schema validation failed: ${errorDetails}`);
          audit.metadata = {
            schemaValidated: false,
            schemaErrors: validate.errors,
          };
          throw new Error(`Schema validation failed: ${errorDetails}`);
        }
        audit.metadata = { schemaValidated: true };
      }

      audit.statusCode = 200;
      audit.latencyMs = Date.now() - startTime;
      audit.responsePayload = finalResponse as Record<string, any>;
      await this.auditRepo.save(audit);

      return finalResponse;
    } catch (error: any) {
      const axiosError = error as {
        response?: { status: number; data: any };
        message?: string;
        stack?: string;
      };
      this.logger.warn(
        `Execution failed: ${axiosError.message || 'Unknown error'}`,
      );

      audit.statusCode = axiosError.response?.status || 500;
      audit.latencyMs = Date.now() - startTime;
      audit.error = {
        message: axiosError.message || 'Unknown Error',
        stack: axiosError.stack || '',
      };
      await this.auditRepo.save(audit);

      if (mapping.errorMapping) {
        this.logger.debug('Applying error mapping...');
        const errorSource =
          (axiosError.response?.data as Record<string, any>) || {};
        if (Object.keys(errorSource).length === 0) {
          errorSource.message = axiosError.message || 'Unknown Error';
          errorSource.status = axiosError.response?.status || 'UNKNOWN';
        }

        const transformedError = this.transformer.transform(
          errorSource,
          mapping.errorMapping as RequestMapping | ResponseMapping,
        ) as unknown;
        return transformedError;
      }

      throw error;
    }
  }

  private async executeSingleCall(
    mapping: MappingConfig,
    payload: any,
    context?: {
      method?: string;
      queryParams?: Record<string, any>;
      incomingToken?: string;
      headers?: Record<string, any>;
    },
  ): Promise<{ result: unknown; url: string }> {
    // DYNAMIC OVERRIDES
    const effectiveMethod =
      (context?.method as string) || mapping.targetApi.method;
    // 0. Base Query Params
    const rawQueryParams = {
      ...mapping.targetApi.queryParams,
      ...(context?.queryParams as Record<string, any>),
    } as Record<string, any>;

    // 0.1 Resolve Query Param values
    const effectiveQueryParams: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(rawQueryParams)) {
      if (typeof value === 'string' && value.startsWith('$.')) {
        // Resolve JSONPath from payload
        const resolved = jsonpath.value(payload, value) as
          | string
          | number
          | boolean
          | undefined;
        if (resolved !== undefined) {
          effectiveQueryParams[key] = resolved;
        }
      } else {
        effectiveQueryParams[key] = value as string | number | boolean;
      }
    }

    // 1. Process Path Parameters
    let effectiveUrl = mapping.targetApi.url;
    if (mapping.targetApi.pathParams) {
      for (const [placeholder, path] of Object.entries(
        mapping.targetApi.pathParams,
      )) {
        const value = jsonpath.value(payload, path) as string | undefined;
        if (value !== undefined) {
          effectiveUrl = effectiveUrl.replace(`:${placeholder}`, String(value));
        }
      }
    }

    // 2. Transform Request
    let targetPayload: unknown;
    const requestPayload = payload as unknown as Record<string, unknown>;
    if (
      !mapping.requestMapping ||
      !mapping.requestMapping.mappings ||
      mapping.requestMapping.mappings.length === 0
    ) {
      targetPayload = requestPayload;
    } else {
      targetPayload = this.transformer.transform(
        requestPayload,
        mapping.requestMapping,
        mapping.transforms,
      ) as unknown;
    }

    if (
      targetPayload === undefined &&
      ['POST', 'PUT', 'PATCH'].includes(effectiveMethod)
    ) {
      targetPayload = {};
    }

    // 3. Prepare Auth
    let requestConfig = {
      headers: {
        ...(context?.headers as Record<string, string>),
      } as Record<string, string>,
    };
    if (mapping.authConfig) {
      const authProvider = this.authFactory.getProvider(
        mapping.authConfig.authType,
      );
      requestConfig = (await authProvider.inject(
        requestConfig,
        mapping.authConfig,
        context as AuthContext,
      )) as { headers: Record<string, string> };
    }

    // 4. Call Target API with Resilience
    const effectiveTargetApi: TargetApiConfig = {
      ...mapping.targetApi,
      url: effectiveUrl,
      method: effectiveMethod,
      queryParams: effectiveQueryParams as Record<string, string>,
    };

    let targetResponse: unknown;
    let attempts = 0;
    const resilience = mapping.targetApi.resilience;
    const maxAttempts = resilience?.retryCount || 0;
    const retryDelay = resilience?.retryDelayMs || 1000;

    const apiPayload = targetPayload as Record<string, any>;

    while (attempts <= maxAttempts) {
      try {
        targetResponse = (await this.apiCaller.call(
          effectiveTargetApi,
          apiPayload,
          requestConfig.headers,
        )) as unknown;
        break;
      } catch (error) {
        attempts++;
        if (attempts > maxAttempts) throw error;
        this.logger.warn(`Attempt ${attempts} failed. Retrying...`);
        await new Promise((res) => setTimeout(res, retryDelay));
      }
    }

    // 5. Transform Response
    const result = (
      mapping.responseMapping
        ? this.transformer.transform(
            targetResponse,
            mapping.responseMapping,
            mapping.transforms,
          )
        : targetResponse
    ) as unknown;

    return { result, url: effectiveUrl };
  }
}
