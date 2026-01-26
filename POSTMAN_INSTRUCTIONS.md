# 📮 Postman Collection Instructions

Below are the details for testing the **Corrector Consumer API** using Postman.

## 🌍 Base Configuration
*   **Base URL**: `http://localhost:4000/connector/execute`
*   **Method**: `POST`
*   **Headers**: 
    *   `Content-Type`: `application/json`

---

## 🧪 Scenarios

### 1. JSONPlaceholder: Create Post (Validation & POST)
Tests input validation and successful data creation via POST.

*   **Connector Key**: `jsonplaceholder-create-post`
*   **Scenario A: Success**
    *   **Payload**:
        ```json
        {
          "connectorKey": "jsonplaceholder-create-post",
          "payload": {
            "title": "My New Post",
            "body": "This is the content",
            "userId": 1
          }
        }
        ```
    *   **Expected Status**: `200 OK`
    *   **Expected Response**: `{ "success": true, "data": { "createdId": 101, ... } }`

*   **Scenario B: Validation Error (Missing Title)**
    *   **Payload**:
        ```json
        {
          "connectorKey": "jsonplaceholder-create-post",
          "payload": {
            "body": "Missing title",
            "userId": 1
          }
        }
        ```
    *   **Expected Status**: `500 Server Error` (or 400 if mapped)
    *   **Expected Response**: Contains `"Request Contract Validation Failed"`

---

### 2. IIRM Entity Fields (Dynamic Query Params)
Tests dynamic query parameter interpolation from payload.

*   **Connector Key**: `iirm-entity-fields`
*   **Scenario A: Search by Query**
    *   **Payload**:
        ```json
        {
          "connectorKey": "iirm-entity-fields",
          "payload": {
            "query": "phone"
          }
        }
        ```
    *   **Expected Response**: List of phones found.

*   **Scenario B: Search with Limit**
    *   **Payload**:
        ```json
        {
          "connectorKey": "iirm-entity-fields",
          "payload": {
            "query": "laptop",
            "limit": 2
          }
        }
        ```
    *   **Expected Response**: List of max 2 laptops.

---

### 3. Auth Verifier (Authentication)
Tests if the Bearer token configured in the DB is correctly injected.

*   **Connector Key**: `auth-verifier`
*   **Payload**:
    ```json
    {
      "connectorKey": "auth-verifier",
      "payload": {}
    }
    ```
*   **Expected Response**: `{ "success": true, "data": { "isAuthenticated": true } }`

---

### 4. Dog CEO (JSONPath Transformation)
Tests complex response mapping using JSONPath.

*   **Connector Key**: `dog-ceo-breeds`
*   **Payload**:
    ```json
    {
      "connectorKey": "dog-ceo-breeds",
      "payload": {}
    }
    ```
*   **Expected Response**: A flat object with keys `breedsMap` and `resultStatus`.

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

### Broken Downstream API
*   **Connector Key**: `broken-api` (Configured in DB to hit a non-existent domain)
*   **Payload**:
    ```json
    {
        "connectorKey": "broken-api",
        "payload": {}
    }
    ```
*   **Expected Status**: `500 Server Error`
*   **Expected Response**: Contains `ENOTFOUND` or similar DNS error.
