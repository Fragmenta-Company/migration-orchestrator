-- +migration: add_email_to_users
-- +dependency: ::create_users.sql::create_users
--+ This migration adds an email column to the users table.
ALTER TABLE users ADD COLUMN email TEXT;
-- +endmigration
