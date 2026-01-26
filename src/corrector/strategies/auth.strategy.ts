import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  AuthConfig,
  BasicAuthConfig,
  ApiKeyAuthConfig,
  BearerAuthConfig,
  OAuth2AuthConfig,
  CustomAuthConfig,
  JwtAuthConfig,
} from '../interfaces/mapping-config.interface';

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
  getProvider(type: string): AuthProvider {
    switch (type.toUpperCase()) {
      case 'BASIC':
        return new BasicAuthProvider();
      case 'API_KEY':
        return new ApiKeyAuthProvider();
      case 'BEARER_TOKEN':
        return new BearerAuthProvider();
      case 'OAUTH2_CLIENT_CREDENTIALS':
        return new OAuth2Provider();
      case 'JWT':
        return new JwtAuthProvider();
      case 'CUSTOM':
        return new CustomAuthProvider();
      case 'NONE':
      default:
        return new NoAuthProvider();
    }
  }
}

export class BearerAuthProvider implements AuthProvider {
  private static tokenCache: Map<string, { token: string; expiresAt: number }> =
    new Map();

  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as BearerAuthConfig;
    if (!config.token && !config.tokenUrl) {
      throw new Error(
        'AuthType BEARER_TOKEN requires either "token" or "tokenUrl" in config',
      );
    }
  }

  async inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as BearerAuthConfig;
    let token = config.token;

    if (!token && config.tokenUrl) {
      token = await this.getDynamicToken(config);
    }

    if (!token) {
      throw new Error(
        'Bearer token missing and no fallback/generation configured',
      );
    }

    const headerName = config.headerName || 'Authorization';
    const tokenPrefix = config.tokenPrefix || 'Bearer ';

    requestConfig.headers = {
      ...requestConfig.headers,
      [headerName]: `${tokenPrefix}${token}`,
    };
    return requestConfig;
  }

  private async getDynamicToken(config: BearerAuthConfig): Promise<string> {
    const tokenUrl = config.tokenUrl as string;
    const cacheKey = tokenUrl + (config.clientId || ''); // Assuming clientId might be mixed in
    const cached = BearerAuthProvider.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    try {
      const response = await axios.post<{
        accessToken?: { accessToken?: string } | string;
        access_token?: string;
        token?: string;
        data?: { token?: string; accessToken?: { accessToken?: string } };
        expires_in?: number;
      }>(tokenUrl, config.loginPayload || config.credentials || {});

      // Safe access specific to the typed response
      const data = response.data;

      // Handle the case where accessToken might be nested or direct string
      let rawToken: string | undefined;

      if (typeof data.accessToken === 'string') {
        rawToken = data.accessToken;
      } else if (data.accessToken?.accessToken) {
        rawToken = data.accessToken.accessToken;
      } else {
        rawToken =
          data.access_token ||
          data.token ||
          data.data?.token ||
          data.data?.accessToken?.accessToken;
      }

      const token = rawToken;

      if (!token) {
        throw new Error(`Token not found in response from ${tokenUrl}`);
      }

      const expiresIn = data.expires_in || 3600;
      BearerAuthProvider.tokenCache.set(cacheKey, {
        token,
        expiresAt: Date.now() + expiresIn * 1000 - 60000,
      });

      return token;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate bearer token: ${message}`);
    }
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
      throw new Error(
        'AuthType BASIC requires "username" and "password" in config',
      );
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
      throw new Error(
        'AuthType API_KEY requires "keyName" and "keyValue" in config',
      );
    }
  }
  inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as ApiKeyAuthConfig;
    const location = config.location || 'HEADER';
    const keyName = config.keyName || 'X-API-KEY';
    const keyValue = config.keyValue || '';

    if (location === 'HEADER') {
      requestConfig.headers = {
        ...requestConfig.headers,
        [keyName]: keyValue,
      };
    } else {
      // Query param support could be added here if needed
    }
    return Promise.resolve(requestConfig);
  }
}

export class CustomAuthProvider implements AuthProvider {
  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as CustomAuthConfig;
    if (!config.headers) {
      throw new Error('AuthType CUSTOM requires "headers" object in config');
    }
  }
  inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as CustomAuthConfig;
    if (config.headers) {
      requestConfig.headers = {
        ...requestConfig.headers,
        ...config.headers,
      };
    }
    return Promise.resolve(requestConfig);
  }
}

export class JwtAuthProvider implements AuthProvider {
  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as JwtAuthConfig;
    const required = ['issuer', 'audience', 'privateKeyRef'];
    for (const field of required) {
      if (!(config as unknown as Record<string, any>)[field]) {
        throw new Error(`AuthType JWT requires "${field}" in config`);
      }
    }
  }
  inject(requestConfig: RequestConfig): Promise<RequestConfig> {
    // JWT implementation placeholder
    return Promise.resolve(requestConfig);
  }
}

export class OAuth2Provider implements AuthProvider {
  private tokenCache: { [key: string]: { token: string; expiresAt: number } } =
    {};

  validate(authConfig: AuthConfig): void {
    const config = (authConfig.config || {}) as OAuth2AuthConfig;
    const required = ['tokenUrl', 'clientId', 'clientSecret'];
    for (const field of required) {
      if (!(config as unknown as Record<string, any>)[field]) {
        throw new Error(
          `AuthType OAUTH2_CLIENT_CREDENTIALS requires "${field}" in config`,
        );
      }
    }
  }

  async inject(
    requestConfig: RequestConfig,
    authConfig: AuthConfig,
  ): Promise<RequestConfig> {
    const config = (authConfig.config || {}) as OAuth2AuthConfig;
    const tokenUrl = config.tokenUrl;
    const clientId = config.clientId;
    const cacheKey = `${tokenUrl}-${clientId}`;
    const cached = this.tokenCache[cacheKey];
    const now = Date.now();

    let token = cached?.token;

    if (!token || cached.expiresAt <= now) {
      try {
        if (!tokenUrl) throw new Error('tokenUrl is required');
        const response = await axios.post<{
          access_token: string;
          expires_in?: number;
        }>(
          tokenUrl,
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.clientId || '',
            client_secret: config.clientSecret || '',
            scope: config.scope || '',
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        );

        token = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        this.tokenCache[cacheKey] = {
          token,
          expiresAt: now + expiresIn * 1000 - 60000,
        };
      } catch (error: any) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to obtain OAuth2 token: ${message}`);
      }
    }

    requestConfig.headers = {
      ...requestConfig.headers,
      Authorization: `Bearer ${token}`,
    };
    return requestConfig;
  }
}
