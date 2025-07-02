-- PostgreSQL Project Manager Initialization Script
-- Bu script PostgreSQL container'ı ilk başladığında çalışır

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a function to create project databases with proper encoding
CREATE OR REPLACE FUNCTION create_project_database(db_name TEXT, username TEXT, password TEXT) 
RETURNS VOID AS $$
BEGIN
    -- Create database
    EXECUTE format('CREATE DATABASE %I WITH ENCODING ''UTF8'' LC_COLLATE ''en_US.utf8'' LC_CTYPE ''en_US.utf8''', db_name);
    
    -- Create user
    EXECUTE format('CREATE USER %I WITH PASSWORD %L', username, password);
    
    -- Grant privileges
    EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', db_name, username);
    
    -- Log the creation
    RAISE NOTICE 'Created database % with user %', db_name, username;
END;
$$ LANGUAGE plpgsql;

-- Create a sample database for testing
-- SELECT create_project_database('test_project', 'test_user', 'test_password');

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL Project Manager initialized successfully!';
    RAISE NOTICE 'Ready to create project databases via API';
END;
$$; 