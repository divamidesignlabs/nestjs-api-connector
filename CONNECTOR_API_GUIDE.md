# Connector Framework - API Execution Guide

This document outlines the standard payload structures and flow for calling the Connector API.

## 🚀 Base Endpoint
*   **URL**: `POST http://localhost:3001/connector/execute`
*   **Content-Type**: `application/json`

---

## 📦 Core Request Structure
Every request must follow this unified structure.

```json
{
  "connectorKey": "string (Required: Mapping name in DB)",
  "operation": "string (Optional: Descriptive operation name)",
  "authType": "string (Optional: Override DB auth type)",
  "authConfig": "object (Optional: Required if authType is provided)",
  "headerData": "object (Optional: Raw headers to send to target)",
  "queryParams": "object (Optional: Query params to send to target)",
  "payload": "any (Required: Data to be transformed/sent as target body)"
}
```

---

## 🔑 Authentication Cases & Payloads

The framework validates the `authConfig` based on the `authType`. If required fields are missing, it returns a **400 Bad Request**.

### 1. NONE
No authentication is applied to the target API.
*   **authType**: `NONE`
*   **authConfig**: `{}` (or omit)

### 2. BASIC auth
Standard username/password authentication.
*   **authType**: `BASIC`
*   **authConfig** (Required fields):
    ```json
    {
      "username": "api_user",
      "password": "secret_password"
    }
    ```

### 3. API_KEY
Supports header-based API keys.
*   **authType**: `API_KEY`
*   **authConfig** (Required fields):
    ```json
    {
      "keyName": "x-api-key",
      "keyValue": "your-token-here",
      "location": "HEADER" (Default: "HEADER")
    }
    ```

### 4. BEARER_TOKEN
Supports static tokens or dynamic auto-login.
*   **authType**: `BEARER_TOKEN`
*   **authConfig** (Required fields: one of `token` or `tokenUrl`):
    ```json
    // Static
    { "token": "eyJhbGciOi..." }

    // Dynamic (Auto-Login)
    {
      "tokenUrl": "http://target.com/login",
      "loginPayload": { "username": "...", "password": "..." },
      "headerName": "Authorization", (Optional, Default: Authorization)
      "tokenPrefix": "Bearer " (Optional, Default: "Bearer ")
    }
    ```

### 5. OAUTH2_CLIENT_CREDENTIALS
Server-to-server OAuth2 flow.
*   **authType**: `OAUTH2_CLIENT_CREDENTIALS`
*   **authConfig** (Required fields):
    ```json
    {
      "tokenUrl": "https://auth.provider.com/token",
      "clientId": "client_id_here",
      "clientSecret": "client_secret_here",
      "scope": "read write" (Optional)
    }
    ```

### 6. CUSTOM
For APIs requiring multiple special headers.
*   **authType**: `CUSTOM`
*   **authConfig** (Required fields):
    ```json
    {
      "headers": {
        "x-client-id": "abc",
        "x-client-secret": "xyz"
      }
    }
    ```

### 7. JWT
Placeholder for signed JWT interactions.
*   **authType**: `JWT`
*   **authConfig** (Required fields):
    ```json
    {
      "issuer": "my-service",
      "audience": "target-api",
      "privateKeyRef": "vault-key-reference"
    }
    ```

---

## 🔄 Execution Flow

1.  **Request Ingestion**: The Source (Postman/UI) sends the payload to `/connector/execute`.
2.  **Configuration Lookup**: The framework uses `connectorKey` to find the target URL and base mapping in the database.
3.  **Auth Validation**: 
    *   If `authType` is sent from Source, the framework validates the `authConfig` content.
    *   If any required field for that type is missing, execution stops and returns a **400 error**.
4.  **Priority Merging**:
    *   **Auth**: Source-provided auth overrides DB auth.
    *   **Headers**: Source `headerData` is merged into the request.
    *   **Query Params**: Source `queryParams` are appended to the Target URL.
5.  **Target Invocation**: The framework calls the Target API using the fixed `method` stored in DB.
6.  **Standard Response**: The result is transformed and returned in this format:
    ```json
    {
      "success": true,
      "statusCode": 200,
      "data": { ... }
    }
    ```

---

## 🛠️ Internal Error Handling
If the Target API returns an error (e.g., 401 Unauthorized), the framework returns:
```json
{
  "success": false,
  "statusCode": 401,
  "errorType": "TARGET_API_ERROR",
  "targetResponse": { ... }
}
```
