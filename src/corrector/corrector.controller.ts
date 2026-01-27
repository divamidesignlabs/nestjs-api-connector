import {
  Controller,
  Body,
  Logger,
  Post,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { CorrectorEngine } from './services/corrector-engine.service';
import { MappingRegistryService } from './services/mapping-registry.service';
import {
  ConnectorRequest,
  AuthConfig,
} from './interfaces/mapping-config.interface';
import { AuthStrategyFactory } from './strategies/auth.strategy';

@Controller('connector')
export class CorrectorController {
  private readonly logger = new Logger(CorrectorController.name);

  constructor(
    private readonly correctorEngine: CorrectorEngine,
    private readonly mappingRegistry: MappingRegistryService,
    private readonly authFactory: AuthStrategyFactory,
  ) {}

  @Post('execute')
  async executeCorrection(@Body() requestData: ConnectorRequest) {
    const connectorKey = requestData.connectorKey;
    const operation = requestData.operation;
    const authType = requestData.authType;
    const authConfig = requestData.authConfig;
    const headerData = requestData.headerData;
    const queryParams = requestData.queryParams as Record<string, any>; // Assert safe usage
    const payload = requestData.payload; // Assert intended usage of any payload

    try {
      if (!connectorKey) {
        throw new BadRequestException('connectorKey is required');
      }

      // 1. Fetch Mapping Configuration
      const mapping = await this.mappingRegistry.findByIdOrName(connectorKey);

      if (
        !mapping ||
        !mapping.mappingConfig ||
        !mapping.mappingConfig.targetApi
      ) {
        throw new BadRequestException(
          `Invalid mapping configuration for: ${connectorKey}`,
        );
      }

      // 2. Resolve Auth Config (DB config + Request overrides)
      let effectiveAuth: AuthConfig | undefined = mapping.mappingConfig.authConfig;

      if (authType || authConfig) {
        // Resolve final authType
        const resolvedAuthType = (authType || authConfig?.authType || effectiveAuth?.authType || 'NONE') as any;
        
        effectiveAuth = {
          authType: resolvedAuthType,
          config: {
            ...(effectiveAuth?.config || {}),
            ...(authConfig?.config || authConfig || {}),
          },
        } as AuthConfig;

        // Clean up config if it contains authType after merge
        if (effectiveAuth.config && (effectiveAuth.config as any).authType) {
            delete (effectiveAuth.config as any).authType;
        }
      }

      // Validate the effective config (with overrides)
      if (effectiveAuth) {
        try {
          const provider = this.authFactory.getProvider(effectiveAuth.authType);
          provider.validate(effectiveAuth);
        } catch (authError) {
          const message =
            authError instanceof Error ? authError.message : 'Unknown error';
          throw new BadRequestException(
            `Authentication Validation Failed: ${message}`,
          );
        }
      }

      const mergedConfig = {
        ...mapping.mappingConfig,
        authConfig: effectiveAuth,
      };

      // 3. Prepare execution context
      const context = {
        method: mergedConfig.targetApi.method,
        queryParams: {
          ...mergedConfig.targetApi.queryParams,
          ...queryParams,
        },
        headers: headerData || {},
        operation: operation,
      };

      // 4. Execute
      const result = await this.correctorEngine.execute(
        mergedConfig,
        payload,
        context,
      );

      return {
        success: true,
        statusCode: 200,
        data: result,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const axiosError = error as {
        response?: { status: number; data: unknown };
        message?: string;
        stack?: string;
      };

      if (axiosError.response) {
        const status = axiosError.response.status || 500;
        const targetErrorData = axiosError.response.data;
        this.logger.error(
          `Target API Error [${status}]: ${JSON.stringify(targetErrorData)}`,
        );

        return {
          success: false,
          statusCode: status,
          errorType: 'TARGET_API_ERROR',
          targetResponse: targetErrorData,
        };
      }

      const errorMessage =
        (axiosError.message as string) || 'Unknown internal error';
      this.logger.error(
        `Internal Framework Error: ${errorMessage}`,
        axiosError.stack,
      );
      throw new HttpException(
        {
          success: false,
          statusCode: 500,
          errorType: 'INTERNAL_CORRECTOR_ERROR',
          message: errorMessage,
        },
        500,
      );
    }
  }
}
