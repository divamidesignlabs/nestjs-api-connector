-- MASTER INITIALIZATION SCRIPT: Table Creation & Initial Seeds

DROP TABLE IF EXISTS connector_mappings_config;

-- 1. Configuration Mappings Table
CREATE TABLE IF NOT EXISTS connector_mappings_config (
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
INSERT INTO connector_mappings_config (id, name, source_system, target_system, mapping_config)
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

