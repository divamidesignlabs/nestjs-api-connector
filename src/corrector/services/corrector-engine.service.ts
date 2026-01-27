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
import * as jsonpath from 'jsonpath';

@Injectable()
export class CorrectorEngine {
  private readonly logger = new Logger(CorrectorEngine.name);

  constructor(
    private readonly transformer: TransformerService,
    private readonly apiCaller: TargetApiCaller,
    private readonly authFactory: AuthStrategyFactory,
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

    try {
      this.logger.log(`Executing correction for mapping: ${mapping.id}`);


      const callResult = (await this.executeSingleCall(
        mapping,
        payload,
        context,
      )) as { result: unknown; url: string };

      const finalResponse = callResult.result;



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
    const effectiveMethod = mapping.targetApi.method;
    // 0. Base Query Params
    const rawQueryParams = (context?.queryParams as Record<string, any>) || {};

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
    const requestPayload = payload;
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
    let requestConfig: any = {
      headers: {
        ...(context?.headers as Record<string, string>),
      } as Record<string, string>,
      params: {},
    };

    if (mapping.authConfig) {
      this.logger.debug(`Auth Configuration Found: ${mapping.authConfig.authType}`);
      const authProvider = this.authFactory.getProvider(
        mapping.authConfig.authType,
      );
      requestConfig = await authProvider.inject(
        requestConfig,
        mapping.authConfig,
        context as AuthContext,
      );
    }

    // 4. Call Target API with Resilience
    const effectiveTargetApi: TargetApiConfig = {
      ...mapping.targetApi,
      url: effectiveUrl,
      method: effectiveMethod,
      queryParams: {
        ...effectiveQueryParams,
        ...(requestConfig.params || {}), // Merge params from Auth Provider
      } as Record<string, string>,
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
