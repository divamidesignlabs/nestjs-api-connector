export interface MappingItem {
  source: string;
  target: string;
  transform?: string; // e.g., 'roundTo2', 'uppercase'
  condition?: string; // JSONPath request-based condition e.g. "$.order.type == 'EXPRESS'"
  valueIfTrue?: any;
  valueIfFalse?: any;
  default?: any;
  required?: boolean; // If true, throws error if source path missing
}

export interface TransformDefinition {
  type: 'FUNCTION';
  logic: string;
}

export interface RequestMapping {
  type?: 'STATIC' | 'OBJECT'; // Default OBJECT
  description?: string;
  mappings?: MappingItem[];
  defaults?: Record<string, any>;
}

export interface ResponseMapping {
  type?: 'OBJECT' | 'ARRAY' | 'CUSTOM' | 'DIRECT'; // Default OBJECT
  root?: string; // e.g. "$[*]" for arrays
  outputWrapper?: string; // e.g. "$.countries"
  mappings?: MappingItem[];
  defaults?: Record<string, any>;
  logic?: string; // For CUSTOM type (Javascript code body)
}

export interface ResilienceConfig {
  retryCount?: number;
  retryDelayMs?: number;
  circuitBreakerThreshold?: number;
}

export interface TargetApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | (string & {});
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  pathParams?: Record<string, string>;
  resilience?: ResilienceConfig;
}

export interface ErrorAction {
  action?: 'SKIP_RECORD' | 'THROW';
  mapTo?: Record<string, string>;
}

export interface ErrorHandlingConfig {
  onHttpError?: ErrorAction;
  onTransformError?: ErrorAction;
}

// --- Specific Auth Configuration Contracts ---

export interface BasicAuthConfig {
  username: string;
  password: string;
  [key: string]: any;
}

export interface ApiKeyAuthConfig {
  keyName: string;
  keyValue: string;
  location?: 'HEADER' | 'QUERY'; // Default HEADER
  [key: string]: any;
}

export interface BearerAuthConfig {
  // Static Token
  token?: string;

  // OR Dynamic Token Generation
  tokenUrl?: string;
  loginPayload?: Record<string, any>;
  headerName?: string; // Default Authorization
  tokenPrefix?: string; // Default Bearer

  [key: string]: any;
}

export interface OAuth2AuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  grantType?: string; // Default client_credentials
  [key: string]: any;
}

export interface JwtAuthConfig {
  issuer: string;
  audience: string;
  privateKeyRef: string;
  [key: string]: any;
}

// --- Main Auth Union Type ---

export interface AuthConfig {
  authType:
    | 'NONE'
    | 'API_KEY'
    | 'BASIC'
    | 'BEARER_TOKEN'
    | 'OAUTH2_CLIENT_CREDENTIALS'
    | 'JWT';
  config:
    | BasicAuthConfig
    | ApiKeyAuthConfig
    | BearerAuthConfig
    | OAuth2AuthConfig
    | JwtAuthConfig
    | Record<string, any>;
}

export interface ConnectorRequest {
  connectorKey: string;
  operation?: string;
  authType?: string; // Optional override from source
  authConfig?: Record<string, any>; // Optional override from source
  headerData?: Record<string, string>; // Headers to be sent to target
  queryParams?: Record<string, any>; // Query params to be sent to target
  payload: unknown; // Data to be transformed/sent as body - explicitly unknown to encourage checking
}

export interface MappingConfig {
  id: string; // Integration ID / mappingKey
  sourceSystem: string;
  targetSystem: string;

  requestMapping?: RequestMapping;
  authConfig?: AuthConfig; // Target auth config from DB
  targetApi: TargetApiConfig;
  responseMapping?: ResponseMapping;
  responseSchema?: Record<string, any>; // Updated type from 'any'

  transforms?: Record<string, TransformDefinition>;
  errorHandling?: ErrorHandlingConfig;

  requestSchema?: Record<string, any>; // Added field

  metadata?: Record<string, any>;

  steps?: {
    id: string;
    targetApi: TargetApiConfig;
    requestMapping?: RequestMapping;
    responseMapping?: ResponseMapping;
    saveResultToContextAs?: string;
  }[];

  errorMapping?: any;
}
