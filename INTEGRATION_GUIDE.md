# 🔌 Connector Framework - Integration Guide

This guide is for third-party developers or internal teams integrating with the Connector Framework. It details how to install, configure, and consume the API.

---

## 1. Installation & Setup

If you are running this service locally or deploying it:

1.  **Requriements**: Node.js v18+, PostgreSQL (or compatible DB).
2.  **Steps**:
    ```bash
    git clone <repo-url>
    npm install
    npm run build
    npm run start:prod
    ```
3.  **Base URL**: `http://localhost:3001` (Default)

---

## 2. API Contract

**Endpoint**: `POST /connector/execute`
**Content-Type**: `application/json`

### **Request Structure**

```typescript
interface ConnectorRequest {
  connectorKey: string;         // Required: The unique ID/Name of the integration in DB
  operation?: string;           // Optional: Descriptive tag
  
  // --- Auth Overrides (Optional) ---
  authType?: 'BASIC' | 'API_KEY' | 'BEARER_TOKEN' | 'NONE';
  authConfig?: Record<string, any>; // Specifics for the chosen type (see below)
  
  // --- Request Modification (Optional) ---
  headerData?: Record<string, string>; // Headers merged into target request
  queryParams?: Record<string, any>;   // Query params appended to target URL
  
  // --- Payload (Required) ---
  payload: any; // Body sent to target (or used in transformation)
}
```

---

## 3. Authentication Configurations

If overriding the default database authentication, you must provide valid `authConfig`.

| Auth Type | Required Config Fields | Example |
| :--- | :--- | :--- |
| `BASIC` | `username`, `password` | `{ "username": "admin", "password": "123" }` |
| `API_KEY` | `keyName`, `keyValue` | `{ "keyName": "x-api-key", "keyValue": "abc" }` |
| `BEARER_TOKEN` | `token` (Static) OR `tokenUrl` (Dynamic) | `{ "token": "ey..." }` |

---

## 4. Integration Dictionary (Verified Connectors)

You can call these connectors immediately if the database is seeded.

### **A. JSONPlaceholder Users**
*   **Key**: `jsonplaceholder-users`
*   **Method**: `GET`
*   **Default Auth**: `NONE`
*   **Result**: Returns a list of users.
*   **Test Payload**:
    ```json
    {
      "connectorKey": "jsonplaceholder-users",
      "queryParams": { "id": "1" },
      "payload": {}
    }
    ```

### **B. DummyJSON Posts**
*   **Key**: `dummyjson-posts`
*   **Method**: `GET`
*   **Default Auth**: `BEARER_TOKEN` (Dynamic Auto-Login)
*   **Result**: Returns a list of posts.
*   **Test Payload**:
    ```json
    {
      "connectorKey": "dummyjson-posts",
      "payload": {}
    }
    ```

### **C. Dog CEO Breeds**
*   **Key**: `dog-ceo-breeds`
*   **Method**: `GET`
*   **Default Auth**: `NONE`
*   **Result**: Returns a transformed map of dog breeds (using JSONPath).
*   **Test Payload**:
    ```json
    {
      "connectorKey": "dog-ceo-breeds",
      "payload": {}
    }
    ```

---

## 5. Error Codes

| Status Code | Error Type | Meaning |
| :--- | :--- | :--- |
| **201** | `Success` | Request executed successfully. |
| **400** | `Bad Request` | Validation failed (missing auth fields) OR Payload error. |
| **404** | `Not Found` | Invalid `connectorKey`. |
| **500** | `Internal Error` | The target API failed (500) OR unexpected system error. |

---

## 6. How to Test (Quick Start)

Run the included test scenario script to verify connectivity:

```bash
npx ts-node test_scenarios.ts
```
