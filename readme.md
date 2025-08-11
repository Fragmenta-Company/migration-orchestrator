# Fragmenta's Migration Orchestrator

This is a simple migration orchestrator used in Fragmenta to manage database migrations.

It's in early development and is not yet ready for production use (yet), at least not outside Fragmenta's own use...

# Usage
To use the migration orchestrator, you can run the following command:

```bash
pnpm run migrate from-dir ./my-migrations-dir
```

Or for a single migration file:

```bash
pnpm run migrate from-file ./my-migrations-dir/my-migration.sql
```

It will run the migrations in the specified directory or file, and apply them to the database.

# Features
For now, it only supports PostgreSQL, but it can be extended to support other databases in the future if needed internally.
- It supports running migrations in a specific order using dependencies defined in the migration files to ensure that migrations are applied in the correct sequence.
- It supports running migrations in parallel, which can speed up the migration process.
- It supports running migrations in groups, which can help to organize migrations and make them easier to manage.
- It supports dependencies between migrations, groups, and files, allowing for complex migration scenarios.
- It handles circular dependencies by detecting them and throwing an error if they are found.
- It provides a simple command-line interface for running migrations.

How to start using it:
1. Create a directory for your migrations, e.g., `migrations/`.
2. Create migration files in that directory, e.g., `migrations/create_users.sql`, `migrations/add_email_to_users.sql`, etc.
3. Define dependencies in your migration files using comments, e.g.:
   ```sql
    -- +migration: add_email_to_users
    -- +dependency: create_users
   ALTER TABLE users ADD COLUMN email TEXT;
   ```
   This will ensure that the `create_users` migration is run before this one.

   ```sql
    -- +migration: create_users
    CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
    -- +endmigration
   ```
4. Run the migration orchestrator using the command above.

# Features to be added
- Support for rollbacks in case of migration failures;
- Support for more complex migration scenarios, such as conditional migrations based on the current state of the database;
- Planning and previewing migrations before applying them;
- Conversion from traditional SQL migrations to Fragmenta's migration format;
- Support for other databases, such as MySQL, SQLite, etc.

# Contributing
Contributions are closed for now, but if you have any ideas or suggestions, feel free to open an issue or a discussion.

# License
This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for more details.

# Authors
- [Nicolas R. M. Dias](https://github.com/NickRMD) - Fragmenta's creator and maintainer.

# Acknowledgements
This project is inspired by other migration tools, but it is built from scratch to fit Fragmenta's needs. It is not intended to be a full-featured migration tool, but rather a simple and effective way to manage migrations in Fragmenta.

# Limitations
- It is not yet ready for production use outside Fragmenta's own use.
- It is in early development and may have bugs or missing features.
- It is not intended to be a full-featured migration tool, but rather a simple and effective way to manage migrations in Fragmenta.
- It is not yet tested with other databases, so it may not work with them.

# Disclaimer
This migration orchestrator is provided as-is, without any warranty or guarantee of its functionality or suitability for any particular purpose. It is still in early development and may have bugs or missing features.
It is intended for use within Fragmenta and may not be suitable for other projects without modifications.
Use it at your own risk, and please report any issues you find.
