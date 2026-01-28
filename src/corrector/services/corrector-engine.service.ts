import { Injectable, Logger, Inject } from '@nestjs/common';
import { TransformerService } from './transformer.service';
import { TargetApiCaller } from './target-api-caller.service';
import { AuthStrategyFactory, AuthContext, RequestConfig } from '../strategies/auth.strategy';
import {
  MappingConfig,
  RequestMapping,
  ResponseMapping,
  TargetApiConfig,
} from '../interfaces/mapping-config.interface';
import * as jsonpath from 'jsonpath';
import { MESSAGES } from '../constants';

@Injectable()
export class CorrectorEngine {
  private readonly logger = new Logger(CorrectorEngine.name);

  constructor(
    private readonly transformer: TransformerService,
    private readonly apiCaller: TargetApiCaller,
    private readonly authFactory: AuthStrategyFactory,
  ) {}

  /**
   * Main entry point: Executes the full correction flow.
   * This is the orchestrator that manages the lifecycle of a request.
   */
  async execute(
    mapping: MappingConfig,
    sourcePayload: any,
    context?: ExecuteContext,
  ): Promise<unknown> {
    try {
      this.logger.log(MESSAGES.LOG.STARTING_EXECUTION(mapping.id));

      // Orchestrate the API cycle: Transform -> Call -> Transform
      const { result } = await this.performApiCycle(mapping, sourcePayload, context);

      return result;
    } catch (error: any) {
      return this.handleExecutionError(mapping, error);
    }
  }

  /**
   * Step-by-step logic for the integration cycle.
   * Perfect for explaining the "How it works" to others.
   */
  private async performApiCycle(
    mapping: MappingConfig,
    payload: any,
    context?: ExecuteContext,
  ) {
    // 1. Prepare: Resolve the Final URL and Request Body
    const targetPayload = this.prepareTargetPayload(mapping, payload);
    const effectiveUrl = this.resolveUrl(mapping.targetApi.url, mapping.targetApi?.pathParams, payload);

    // 2. Resolve Dynamic Query Parameters (JSONPath resolution)
    const resolvedQueryParams = this.resolveQueryParams(context?.queryParams || {}, payload);

    // 3. Authenticate: Inject API Keys, Bearer Tokens, or Basic Auth
    const requestConfig = await this.prepareRequestConfig(mapping, {
      ...context,
      queryParams: resolvedQueryParams,
    } as ExecuteContext);

    // 3. Execute: Call the target system with built-in retries
    const rawResponse = await this.executeWithResilience(
      mapping,
      effectiveUrl,
      targetPayload,
      requestConfig,
    );

    // 4. Finalize: Transform the target response back to source format
    const finalResult = this.transformResponse(mapping, rawResponse);

    return { result: finalResult, url: effectiveUrl };
  }

  private prepareTargetPayload(mapping: MappingConfig, sourcePayload: any) {
    // If no mapping is defined, we send the original payload as is
    if (!mapping.requestMapping?.mappings?.length) {
      return sourcePayload;
    }
    return this.transformer.transform(sourcePayload, mapping.requestMapping, mapping.transforms);
  }

  private resolveUrl(url: string, pathParams?: Record<string, string>, payload?: any) {
    let resolvedUrl = url;
    if (pathParams) {
      for (const [key, path] of Object.entries(pathParams)) {
        const value = jsonpath.value(payload, path);
        // Replace placeholders like :id with actual values from the payload
        resolvedUrl = resolvedUrl.replace(`:${key}`, String(value ?? ''));
      }
    }
    return resolvedUrl;
  }

  private resolveQueryParams(params: Record<string, any>, payload: any): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$.')) {
        const extracted = jsonpath.value(payload, value);
        if (extracted !== undefined) {
          resolved[key] = extracted;
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private async prepareRequestConfig(mapping: MappingConfig, context?: ExecuteContext) {
    // Start with background headers and query params from the request context
    let config: RequestConfig = {
      headers: { ...context?.headers } as Record<string, string>,
      params: { ...context?.queryParams } as Record<string, any>,
    };

    // If the mapping requires authentication, let the Auth Strategy inject the credentials
    if (mapping.authConfig) {
      const provider = this.authFactory.getProvider(mapping.authConfig.authType);
      config = await provider.inject(config, mapping.authConfig, context as any);
    }
    return config;
  }

  private async executeWithResilience(mapping: MappingConfig, url: string, payload: any, config: RequestConfig) {
    const { retryCount = 0, retryDelayMs = 1000 } = mapping.targetApi.resilience || {};
    let lastError: any;

    // Retry loop: ensures high availability if the target API is temporarily unstable
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const apiConfig: TargetApiConfig = {
          ...mapping.targetApi,
          url,
          queryParams: config.params,
        };

        return await this.apiCaller.call(apiConfig, payload, config.headers);
      } catch (error) {
        lastError = error;
        if (attempt < retryCount) {
          this.logger.warn(MESSAGES.LOG.RETRY_ATTEMPT(attempt + 1, retryDelayMs));
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }
    throw lastError;
  }

  private transformResponse(mapping: MappingConfig, rawResponse: any) {
    if (!mapping.responseMapping) return rawResponse;
    return this.transformer.transform(rawResponse, mapping.responseMapping, mapping.transforms);
  }

  private handleExecutionError(mapping: MappingConfig, error: any) {
    this.logger.warn(MESSAGES.ERROR.API_EXECUTION_FAILED(error.message));

    // If an errorMapping is defined, we return a user-friendly error structure instead of throwing
    if (mapping.errorMapping) {
      const errorData = error.response?.data || { message: error.message };
      return this.transformer.transform(errorData, mapping.errorMapping, mapping.transforms);
    }
    throw error;
  }
}

interface ExecuteContext {
  method: string;
  queryParams: Record<string, any>;
  headers?: Record<string, any>;
  incomingToken?: string;
}
