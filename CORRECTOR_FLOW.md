# NestJS Corrector Framework: Deep Technical Execution Flow

This document provides a line-by-line technical breakdown for reviewers, explaining which specific code blocks are executed and what validations are performed at every stage of the request lifecycle.

---

## **Phase 1: Entry & Configuration Guard**
**File:** `src/corrector/corrector.controller.ts`

### **1. Configuration Lookup**
- **Action**: Fetches the mapping from the database using `mappingRegistry.findByIdOrName(connectorKey)`.
- **Validation**: If no mapping is found or if `targetApi` config is missing, it returns a `400 Bad Request`.

### **2. Authentication Security Policy (Strict DB Priority)**
- **Code**: `if(mappingConfig.authConfig?.authType !== 'NONE' && effectiveAuth?.authType !== incomingAuthType)`
- **Validation Check**: 
    - The controller compares the `authType` stored in the DB with the one sent in the request.
    - **Logic**: If the DB requires authentication, the user MUST send credentials that match that type. Any mismatch (e.g., trying to use API_KEY when the DB requires BEARER) is blocked immediately.
- **Result**: Returns `400 AUTH_MISMATCH`.

### **3. Provider-Specific Validation**
- **Action**: Calls `provider.validate(effectiveAuth)`.
- **Validation Check**: 
    - Each Strategy (Bearer, Basic, etc.) checks if its required fields are present (e.g., `Basic` checks for `username` and `password`).
- **Result**: Returns `400 AUTH_VALIDATION_FAILED` with the specific missing field message.

---

## **Phase 2: The Orchestrator (The Engine)**
**File:** `src/corrector/services/corrector-engine.service.ts`

### **4. Finalising the HTTP Method**
- **Logic**: `const effectiveMethod = mapping.targetApi.method;`
- **Enforcement**: The framework **ignores** any method sent by the client. It strictly uses the method defined in the database configuration.

### **5. Dynamic Parameter Resolution**
- **Action**: Loops through `rawQueryParams` and `pathParams`.
- **Logic**: If a value starts with `$.` (JSONPath), the engine uses `jsonpath.value(payload, path)` to extract data from the incoming request body.
- **Validation**: If a required dynamic parameter cannot be resolved, it is skipped or logged as a warning, ensuring the URL remains valid.

---

## **Phase 3: Data Transformation (The Brain)**
**File:** `src/corrector/services/transformer.service.ts`

### **6. Object Reshaping Logic**
The `transformObject` method runs the following validations for every mapped field:
- **Conditionals**: `if (mapItem.condition)` -> Evaluates logic (e.g., `$.status == 'ACTIVE'`). If false, the field is skipped.
- **Required Check**: `if (mapItem.required && value === undefined)` -> Logs a warning and ensures data integrity.
- **Default Application**: `value = mapItem.default ?? value` -> ensures the target system always receives a valid value.
- **Transformation Functions**: `this.executeCustomLogic(mapItem.transform, value)` -> Runs specific logic like `rounding`, `string conversion`, or `masking`.

---

## **Phase 4: Network & Resilience**
**File:** `src/corrector/services/target-api-caller.service.ts`

### **7. Auth Header Injection**
- **Action**: The `AuthStrategy` (e.g., `BearerAuthProvider`) injects the final `Authorization` header.
- **Priority**: System checks `Header > DB Static Token > Token URL`.

### **8. Retry Mechanism**
- **Code**: `while (attempts <= maxAttempts)`
- **Logic**: If the `TargetApiCaller` throws a network error, the engine checks the `resilience` config in the DB. It will automatically retry the call `N` times with a delay (in ms) before giving up.

---

## **Phase 5: Seamless Error Handling**
**File:** `src/corrector/corrector.controller.ts` (Catch Block)

### **9. Mapped Error Responses**
- **Logic**: Instead of letting the application crash or throw a generic NestJS error, the controller catches all exceptions in a `try/catch` block.
- **Conversion**:
    - **HttpExceptions**: Converted to `FRAMEWORK_ERROR`.
    - **Axios Errors**: Converted to `TARGET_API_ERROR` (returning the actual status and message from the third-party system).
- **Benefit**: The consumer always receives a standard JSON object, never a raw HTML error or a cryptic 500 status.

---

## **Reviewer Summary**
- **Performance**: No audit logging = 0 extra DB writes.
- **Security**: No `eval()` used. No `ajv` overhead. Strict Auth enforcement in Controller.
- **Reliability**: Automatic retries and robust parameter resolution ensure high success rates for outbound calls.
