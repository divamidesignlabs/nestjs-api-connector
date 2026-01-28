import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import {
  AuthConfig,
  BasicAuthConfig,
  ApiKeyAuthConfig,
  BearerAuthConfig,
  OAuth2AuthConfig,
  JwtAuthConfig,
} from '../interfaces/mapping-config.interface';
import { MESSAGES, AUTH_TYPES } from '../constants';

export interface AuthContext {
  method?: string;
  queryParams?: Record<string, any>;
  incomingToken?: string;
  headers?: Record<string, any>;
}

export interface RequestConfig {
  headers: Record<string, string>;
  [key: string]: any;
}

export interface AuthProvider {
  validate(authConfig: AuthConfig): void;
  inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
    context?: AuthContext,
  ): Promise<RequestConfig>;
}

@Injectable()
export class AuthStrategyFactory {
  private readonly providers: Record<string, new () => AuthProvider> = {
    [AUTH_TYPES.BASIC]: BasicAuthProvider,
    [AUTH_TYPES.API_KEY]: ApiKeyAuthProvider,
    [AUTH_TYPES.BEARER_TOKEN]: BearerAuthProvider,
    [AUTH_TYPES.OAUTH2]: OAuth2Provider,
    [AUTH_TYPES.JWT]: JwtAuthProvider,
    [AUTH_TYPES.NONE]: NoAuthProvider,
  };

  getProvider(type: string): AuthProvider {
    const ProviderClass = this.providers[type.toUpperCase()] || NoAuthProvider;
    return new ProviderClass();
  }
}

export class BearerAuthProvider implements AuthProvider {
  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as BearerAuthConfig;
    if (!config.token) {
      throw new BadRequestException(MESSAGES.ERROR.AUTH_REQUIRED_FIELDS('BEARER_TOKEN', '"token"'));
    }
  }

  async inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as BearerAuthConfig;
    const token = config.token;

    if (!token) {
      throw new UnauthorizedException(MESSAGES.ERROR.AUTH_VALIDATION_FAILED('Bearer token is missing from configuration'));
    }

    const headerName = config.headerName || 'Authorization';
    const tokenPrefix = config.tokenPrefix || 'Bearer ';

    requestConfig.headers = {
      ...requestConfig.headers,
      [headerName]: `${tokenPrefix}${token}`,
    };
    return requestConfig;
  }
}

export class NoAuthProvider implements AuthProvider {
  validate(): void {
    // No config required for NONE
  }
  inject(requestConfig: RequestConfig): Promise<RequestConfig> {
    return Promise.resolve(requestConfig);
  }
}

export class BasicAuthProvider implements AuthProvider {
  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as BasicAuthConfig;
    if (!config.username || !config.password) {
      throw new BadRequestException(MESSAGES.ERROR.AUTH_REQUIRED_FIELDS('BASIC', '"username" and "password"'));
    }
  }
  inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as BasicAuthConfig;
    const token = Buffer.from(`${config.username}:${config.password}`).toString(
      'base64',
    );
    requestConfig.headers = {
      ...requestConfig.headers,
      Authorization: `Basic ${token}`,
    };
    return Promise.resolve(requestConfig);
  }
}

export class ApiKeyAuthProvider implements AuthProvider {
  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as ApiKeyAuthConfig;
    if (!config.keyName || !config.keyValue) {
      throw new BadRequestException(MESSAGES.ERROR.AUTH_REQUIRED_FIELDS('API_KEY', '"keyName" and "keyValue"'));
    }
  }

  inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as ApiKeyAuthConfig;
    const keyName = config.keyName || 'X-API-KEY';
    const keyValue = config.keyValue || '';
    
    requestConfig.headers = {
      ...requestConfig.headers,
      [keyName]: keyValue,
    };

    return Promise.resolve(requestConfig);
  }
}

export class JwtAuthProvider implements AuthProvider {
  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as JwtAuthConfig;
    const required = ['issuer', 'audience', 'privateKeyRef'];
    for (const field of required) {
      if (!(config as unknown as Record<string, any>)[field]) {
        throw new BadRequestException(MESSAGES.ERROR.AUTH_REQUIRED_FIELDS('JWT', `"${field}"`));
      }
    }
  }
  inject(requestConfig: RequestConfig): Promise<RequestConfig> {
    // JWT implementation placeholder
    return Promise.resolve(requestConfig);
  }
}

export class OAuth2Provider implements AuthProvider {
  private static tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as OAuth2AuthConfig;
    const required = ['tokenUrl', 'clientId', 'clientSecret'];
    for (const field of required) {
      if (!(config as any)[field]) {
        throw new BadRequestException(MESSAGES.ERROR.AUTH_REQUIRED_FIELDS('OAUTH2_CLIENT_CREDENTIALS', `"${field}"`));
      }
    }
  }

  async inject(requestConfig: RequestConfig, authConfig: AuthConfig): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as OAuth2AuthConfig;
    const token = await this.getAccessToken(config);

    requestConfig.headers = {
      ...requestConfig.headers,
      Authorization: `Bearer ${token}`,
    };
    return requestConfig;
  }

  private async getAccessToken(config: OAuth2AuthConfig): Promise<string> {
    const { tokenUrl, clientId, clientSecret, scope } = config;
    const cacheKey = `${tokenUrl}:${clientId}`;
    const cached = OAuth2Provider.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    try {
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: scope || '',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      OAuth2Provider.tokenCache.set(cacheKey, {
        token,
        expiresAt: Date.now() + expiresIn * 1000 - 60000,
      });

      return token;
    } catch (error: any) {
      throw new UnauthorizedException(MESSAGES.ERROR.AUTH_TOKEN_GENERATION_FAILED(error.message));
    }
  }
}
