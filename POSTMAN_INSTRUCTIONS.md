# 📮 Postman Collection Instructions

Below are the details for testing the **Corrector Consumer API** using Postman.

## 🌍 Base Configuration
*   **Base URL**: `http://localhost:4000/connector/execute`
*   **Method**: `POST`
*   **Headers**: 
    *   `Content-Type`: `application/json`

---

## 🧪 Scenarios

### 1. JSONPlaceholder: Get Users (GET)
Tests retrieving a list and transforming it.

*   **Connector Key**: `jsonplaceholder-users`
*   **Scenario A: Success**
    *   **Payload**:
        ```json
        {
          "connectorKey": "jsonplaceholder-users",
          "payload": {}
        }
        ```
    *   **Expected Status**: `200 OK`
    *   **Expected Response**: `{ "success": true, "data": { "users": [...], "count": 10 } }`

---

## ❌ Negative Tests

### Invalid Connector ID
*   **Payload**:
    ```json
    {
        "connectorKey": "invalid-id",
        "payload": {}
    }
    ```
*   **Expected Status**: `404 Not Found`
