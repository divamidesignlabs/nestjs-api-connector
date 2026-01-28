export const CORRECTOR_OPTIONS = 'CORRECTOR_OPTIONS';

export const MESSAGES = {
  ERROR: {
    CONNECTOR_KEY_REQUIRED: 'connectorKey is required',
    INVALID_MAPPING: (key: string) => `Invalid mapping configuration for: ${key}`,
    MAPPING_NOT_FOUND: (id: string) => `Mapping with ID ${id} not found`,
    MAPPING_NOT_FOUND_BY_NAME: (val: string) => `Mapping with ID or Name '${val}' not found`,
    ACTIVE_MAPPING_NOT_FOUND: (src: string, target: string) => `No mapping found for ${src} -> ${target}`,
    AUTH_VALIDATION_FAILED: (msg: string) => `Authentication Validation Failed: ${msg}`,
    AUTH_MISMATCH: (incoming: string, required: string) => 
      `Auth type ${incoming} does not match required ${required}`,
    AUTH_REQUIRED_FIELDS: (type: string, fields: string) => `AuthType ${type} requires ${fields} in config`,
    AUTH_TOKEN_NOT_FOUND: (url: string) => `Token not found in response from ${url}`,
    AUTH_TOKEN_GENERATION_FAILED: (msg: string) => `Failed to generate token: ${msg}`,
    TRANSFORM_FAILED: (src: string, msg: string) => `Mapping failed for ${src}: ${msg}`,
    REQUIRED_FIELD_MISSING: (field: string) => `Missing required field: ${field}`,
    ROOT_ARRAY_NOT_FOUND: (path: string) => `Root path ${path} did not resolve to an array`,
    CUSTOM_TRANSFORM_ERROR: (msg: string) => `Custom transform error: ${msg}`,
    REPOSITORY_REQUIRED: 'mappingRepository or mappingRepositoryFactory required',
    INTERNAL_ERROR: 'An unexpected internal error occurred',
    API_EXECUTION_FAILED: (msg: string) => `API Execution failed: ${msg}`,
  },
  LOG: {
    STARTING_EXECUTION: (id: string) => `Starting execution for mapping: ${id}`,
    CALLING_API: (method: string, url: string) => `Calling Target API: ${method} ${url}`,
    RETRY_ATTEMPT: (attempt: number, delay: number) => 
      `Attempt ${attempt} failed. Retrying in ${delay}ms...`,
    ERROR: (msg: string) => `Error: ${msg}`,
  }
};

export const AUTH_TYPES = {
  NONE: 'NONE',
  BASIC: 'BASIC',
  API_KEY: 'API_KEY',
  BEARER_TOKEN: 'BEARER_TOKEN',
  OAUTH2: 'OAUTH2_CLIENT_CREDENTIALS',
  JWT: 'JWT',
};

export const ERROR_TYPES = {
  CLIENT: 'CLIENT_ERROR',
  TARGET_API: 'TARGET_API_ERROR',
  INTERNAL: 'INTERNAL_ERROR',
};
