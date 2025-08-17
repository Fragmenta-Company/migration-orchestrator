-- +migration: modify_user_table
-- +depends: ::create_user_table.sql::user_management::Migration(create_user_table)
-- + This migration modifies the user table to add a new field for last login timestamp.
ALTER TABLE users
ADD COLUMN last_login TIMESTAMP DEFAULT NULL;
-- +endmigration
