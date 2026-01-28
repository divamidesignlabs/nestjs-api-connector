# NestJS Corrector Framework: Deep Technical Execution Flow

This document provides a line-by-line technical breakdown of the framework's internal execution cycle.

---

## **Phase 1: Entry & Configuration Guard**
**File:** `src/corrector/corrector.controller.ts`

### **1. Configuration Lookup**
- **Action**: Fetches mapping from DB via `mappingRegistry.findByIdOrName(connectorKey)`.
- **Logic**: Supports both UUIDs and human-readable names.
- **Validation**: Throws `BadRequestException` if `targetApi` config is missing.

### **2. Authentication Security Policy (Strict DB Priority)**
- **Logic**: the Framework prioritizes the **Database AuthType** over the Request.
- **Validation Check**: 
    - If DB says `NONE`, the request cannot force authentication.
    - If DB says `BEARER_TOKEN`, the request MUST send a token or the DB must have one.
- **Enforcement**: If the request tries to override a secure DB authType with a different one, it returns a `400 AUTH_MISMATCH`.

### **3. Provider-Specific Validation**
- **Action**: Calls `provider.validate(effectiveAuth)`.
- **Check**: Strategies throw `BadRequestException` if required fields (like `token` for Bearer or `username` for Basic) are missing in the configuration merge.

---

## **Phase 2: The Orchestrator (The Engine)**
**File:** `src/corrector/services/corrector-engine.service.ts`

### **4. Finalising the HTTP Method**
- **Enforcement**: The framework strictly uses the method defined in the database (`GET`, `POST`, etc.). It ignores the method of the incoming request to the controller.

### **5. Dynamic Parameter Resolution**
- **Logic**: Resolves `queryParams` and `pathParams` using JSONPath against the incoming payload.
- **Example**: `url: "api/users/:id"` with `pathParams: { "id": "$.user_id" }` results in a clean outgoing URL.

---

## **Phase 3: Data Transformation (The Brain)**
**File:** `src/corrector/services/transformer.service.ts`

### **6. Object Reshaping Logic (`transformObject`)**
- **Field-Level Loop**: Iterates through every mapping rule.
- **Conditionals**: Evaluates "If-Then-Else" logic (e.g., `$.status == 'A'`).
- **Standardization**: Applies built-in transforms (`roundTo2`, `uppercase`, `toNumber`).
- **JS Logic**: Executes `CUSTOM` logic blocks using a secure sandboxed function context.

### **7. Bulk Data Optimization (`transformArray`)**
- **Performance**: Pre-calculates mapping configurations once outside the loop to handle thousands of records with minimal CPU overhead.
- **Wrapping**: Automatically nests results in an `outputWrapper` if defined.

---

## **Phase 4: Network & Execution**
**File:** `src/corrector/services/target-api-caller.service.ts`

### **8. Auth Header Injection**
- **Action**: The strategy (e.g., `BearerAuthProvider`) injects the final credentials.
- **Standard**: Follows the `Authorization: <Prefix> <Value>` standard.
- **Simplicity**: No longer calls external URLs for tokens; strictly uses static configuration and payload overrides.

### **9. Resilience (Retry Loop)**
- **Logic**: If the target API is unstable, the engine retries the call `N` times with a specified `retryDelayMs`.

---

## **Phase 5: Standardized Error Response**
**File:** `src/corrector/corrector.controller.ts` (`handleError`)

### **10. Structured Feedback**
- **CLIENT_ERROR (400/401)**: For missing keys, auth failures, or validation errors.
- **TARGET_API_ERROR**: Forwards the exact response from the third-party system when it fails.
- **INTERNAL_ERROR (500)**: Reserved only for unexpected framework crashes.

---

## **Reviewer Summary**
- **Speed**: Optimized array loops and $O(1)$ provider lookups.
- **Stability**: Standardized NestJS exceptions ensure predictable client responses.
- **Logic**: Deep path resolution via `jsonpath` ensures we can map any complex JSON tree.
