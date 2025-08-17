-- +sqlx:version: 0.1
-- +depends: ::Group(some_file.sql)
--+ This file contains SQL migrations for the application.

-- +migration: example_migration
-- +depends: Group(user_management)
--+ This migration is an example of how to create a table in SQL.
CREATE TABLE IF NOT EXISTS example_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- +endmigration

-- +group: user_management
-- +description: This migration creates a user table to manage user accounts in the application.
--+ This group contains migrations related to user management.

  -- +migration: create_user_table
  --+ This migration creates a user table with basic fields.
  CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  -- +endmigration

-- +endgroup
