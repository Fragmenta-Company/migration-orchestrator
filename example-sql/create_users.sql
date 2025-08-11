 -- +migration: create_users
 --+ This migration creates the users table.
 CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
 -- +endmigration
