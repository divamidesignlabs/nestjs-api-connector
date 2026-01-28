import {
  Controller,
  Body,
  Logger,
  Post,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { MESSAGES, ERROR_TYPES, AUTH_TYPES } from './constants';
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
    const { connectorKey, authConfig, headerData, queryParams, payload } = requestData;

    try {
      if (!connectorKey) throw new BadRequestException(MESSAGES.ERROR.CONNECTOR_KEY_REQUIRED);

      // 1. Fetch Mapping
      const mapping = await this.mappingRegistry.findByIdOrName(connectorKey);
      if (!mapping?.mappingConfig?.targetApi) {
        throw new BadRequestException(MESSAGES.ERROR.INVALID_MAPPING(connectorKey));
      }

      // 2. Resolve & Validate Auth
      const dbAuth = mapping.mappingConfig.authConfig;
      const requestAuth = authConfig;
      
      // Strict Check: DB Auth Type cannot be overridden by request if it's not NONE
      if (dbAuth && dbAuth.authType !== AUTH_TYPES.NONE && requestAuth && requestAuth.authType !== dbAuth.authType) {
        return {
          success: false,
          statusCode: 400,
          errorType: ERROR_TYPES.CLIENT,
          message: MESSAGES.ERROR.AUTH_MISMATCH(requestAuth.authType, dbAuth.authType),
        };
      }

      const effectiveAuth = this.resolveAuthConfig(dbAuth, requestAuth);
      this.validateAuth(effectiveAuth);

      // 3. Execution Context
      const apiConfig = mapping.mappingConfig.targetApi;
      const context = {
        method: apiConfig.method,
        queryParams: { ...apiConfig.queryParams, ...queryParams },
        headers: headerData || {},
      };

      // 4. Call Engine
      const result = await this.correctorEngine.execute(
        { ...mapping.mappingConfig, authConfig: effectiveAuth },
        payload,
        context,
      );

      return { success: true, statusCode: 200, data: result };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private resolveAuthConfig(dbAuth?: AuthConfig, requestAuth?: AuthConfig): AuthConfig {
    // Priority: DB Configuration > Request Override > Default NONE
    const authType = (dbAuth?.authType || requestAuth?.authType || AUTH_TYPES.NONE) as any;
    
    return {
      authType,
      config: { ...requestAuth?.config, ...dbAuth?.config }, // Merge configs, DB fields take precedence for security
    };
  }

  private validateAuth(auth: AuthConfig) {
    if (auth.authType !== AUTH_TYPES.NONE) {
      const provider = this.authFactory.getProvider(auth.authType);
      provider.validate(auth);
    }
  }

  private handleError(error: any) {
    this.logger.error(MESSAGES.LOG.ERROR(error.message), error.stack);

    // Case 1: Standard NestJS HttpExceptions (BadRequest, etc.)
    if (error instanceof HttpException) {
      const resp = error.getResponse();
      return {
        success: false,
        statusCode: error.getStatus(),
        errorType: ERROR_TYPES.CLIENT,
        message: typeof resp === 'object' ? (resp as any).message || error.message : resp,
      };
    }

    // Case 2: Target API Errors (Axios)
    if (error.response) {
      return {
        success: false,
        statusCode: error.response.status,
        errorType: ERROR_TYPES.TARGET_API,
        targetResponse: error.response.data,
      };
    }

    // Case 3: Internal Framework Errors
    return {
      success: false,
      statusCode: 500,
      errorType: ERROR_TYPES.INTERNAL,
      message: error.message || MESSAGES.ERROR.INTERNAL_ERROR,
    };
  }
}
