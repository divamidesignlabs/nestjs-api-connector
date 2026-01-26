-- MASTER INITIALIZATION SCRIPT: Table Creation & Initial Seeds

DROP TABLE IF EXISTS corrector_audit_logs;
DROP TABLE IF EXISTS integration_mappings_config;

-- 1. Audit Logs Table
CREATE TABLE IF NOT EXISTS corrector_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_id VARCHAR(255),
    mapping_name VARCHAR(255),
    source_system VARCHAR(255),
    target_system VARCHAR(255),
    method VARCHAR(50),
    url TEXT,
    status_code INTEGER,
    latency_ms INTEGER,
    request_payload JSONB,
    response_payload JSONB,
    error JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Configuration Mappings Table
CREATE TABLE IF NOT EXISTS integration_mappings_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    source_system VARCHAR(255) NOT NULL,
    target_system VARCHAR(255) NOT NULL,
    mapping_config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Initial Seeds

-- A. JSONPlaceholder Users (GET)
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'jsonplaceholder-users',
    'ExternalSource',
    'JSONPlaceholder',
    '{
        "id": "jsonplaceholder-users",
        "sourceSystem": "ExternalSource",
        "targetSystem": "JSONPlaceholder",
        "targetApi": {
            "url": "https://jsonplaceholder.typicode.com/users",
            "method": "GET"
        },
        "authConfig": { "authType": "NONE", "config": {} },
        "responseMapping": {
            "type": "CUSTOM",
            "logic": "var transformUser = function(u) { return { userId: u.id, username: u.username, fullName: u.name, email: u.email }; }; if (Array.isArray(value)) { return { users: value.map(transformUser), count: value.length }; } else { return { user: transformUser(value) }; }"
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;

-- B. Dog CEO Breeds (GET + JSONPath)
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    'f9a3d1c4-2e44-4b72-9c31-7ad09ce01234',
    'dog-ceo-breeds',
    'ExternalSource',
    'DogCEO',
    '{
        "id": "dog-ceo-breeds",
        "sourceSystem": "ExternalSource",
        "targetSystem": "DogCEO",
        "targetApi": {
            "url": "https://dog.ceo/api/breeds/list/all",
            "method": "GET"
        },
        "authConfig": { "authType": "NONE", "config": {} },
        "responseMapping": {
            "type": "OBJECT",
            "mappings": [
                { "source": "$.message", "target": "$.breedsMap" },
                { "source": "$.status", "target": "$.resultStatus" }
            ]
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;

-- C. DummyJSON Posts (GET + Auth)
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    'b1cfdc77-1c2a-4e7b-9d3e-88a1f0d9abcd',
    'dummyjson-posts',
    'ExternalSource',
    'DummyJSON',
    '{
        "id": "dummyjson-posts",
        "sourceSystem": "ExternalSource",
        "targetSystem": "DummyJSON",
        "targetApi": {
            "url": "https://dummyjson.com/posts",
            "method": "GET"
        },
        "authConfig": {
            "authType": "BEARER_TOKEN",
            "config": {
                "tokenUrl": "https://dummyjson.com/auth/login",
                "loginPayload": { "username": "emilys", "password": "emilyspass" }
            }
        },
        "responseMapping": {
            "type": "CUSTOM",
            "logic": "var transformPost = function(p) { return { postId: p.id, title: p.title }; }; if (Array.isArray(value.posts)) { return { posts: value.posts.map(transformPost) }; } return value;"
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;

-- D. JSONPlaceholder Create Post (POST + Validation)
-- Added requestSchema to enforce input validation
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    '55555555-6666-7777-8888-999999999999',
    'jsonplaceholder-create-post',
    'ExternalSource',
    'JSONPlaceholder',
    '{
        "id": "jsonplaceholder-create-post",
        "sourceSystem": "ExternalSource",
        "targetSystem": "JSONPlaceholder",
        "targetApi": {
            "url": "https://jsonplaceholder.typicode.com/posts",
            "method": "POST"
        },
        "requestSchema": {
            "type": "object",
            "properties": {
                "title": { "type": "string", "minLength": 3 },
                "body": { "type": "string" },
                "userId": { "type": "number" }
            },
            "required": ["title", "userId"]
        },
        "requestMapping": {
            "type": "OBJECT",
            "mappings": [
                { "source": "$.title", "target": "$.title" },
                { "source": "$.body", "target": "$.body" },
                { "source": "$.userId", "target": "$.userId" }
            ]
        },
        "authConfig": { "authType": "NONE", "config": {} },
        "responseMapping": {
            "type": "CUSTOM",
            "logic": "return { createdId: value.id, inputTitle: value.title, status: \"Created\" };"
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;

-- E. Auth Verifier
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    '11111111-2222-3333-4444-555555555555',
    'auth-verifier',
    'ExternalSource',
    'HttpBin',
    '{
        "id": "auth-verifier",
        "sourceSystem": "ExternalSource",
        "targetSystem": "HttpBin",
        "targetApi": {
            "url": "https://httpbin.org/bearer",
            "method": "GET"
        },
        "authConfig": {
            "authType": "BEARER_TOKEN",
            "config": {
                "token": "static-test-token-123"
            }
        },
        "responseMapping": {
            "type": "OBJECT",
            "mappings": [
                { "source": "$.authenticated", "target": "$.isAuthenticated" }
            ]
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;

-- F. IIRM Entity Fields (Dynamic Query Params)
-- Added queryParams allowing 'select' and 'limit' to be passed dynamically
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    'ee8899aa-77bb-66cc-55dd-4433221100ff',
    'iirm-entity-fields',
    'ExternalSource',
    'DummyJSON',
    '{
        "id": "iirm-entity-fields",
        "sourceSystem": "ExternalSource",
        "targetSystem": "DummyJSON",
        "targetApi": {
            "url": "http://localhost:3000/iirm/document-service/entity-field",
            "method": "GET",
            "queryParams": {
                "q": "$.query",
                "limit": "$.limit"
            }
        },
        "authConfig": { "authType": "NONE", "config": {} },
        "responseMapping": {
            "type": "CUSTOM",
            "logic": "return { products: value.products.map(p => ({ id: p.id, name: p.title, price: p.price })), found: value.total };"
        }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;

-- G. Broken API (For Error Testing)
INSERT INTO integration_mappings_config (id, name, source_system, target_system, mapping_config)
VALUES (
    '12345678-1234-1234-1234-1234567890ab',
    'broken-api',
    'ExternalSource',
    'BadHost',
    '{
        "id": "broken-api",
        "sourceSystem": "ExternalSource",
        "targetSystem": "BadHost",
        "targetApi": {
            "url": "https://this-domain-does-not-exist-xyz.com/api",
            "method": "GET"
        },
        "authConfig": { "authType": "NONE", "config": {} },
        "responseMapping": { "type": "DIRECT" }
    }'::jsonb
) ON CONFLICT (name) DO UPDATE SET mapping_config = EXCLUDED.mapping_config;
