
# Fragmenta's SQL Migration Format (SQL Extended or SQLX)

This document describes the SQL migration format used for managing database schema changes. The format allows for easy tracking, versioning, and execution of migrations in a structured manner.

## How to start using the SQLX format?
First you need to create a new directory for your migrations, and then create files with the `.sql` extension inside that directory. Each file can contain multiple migrations, groups, functions, and macros.
The migration tool will automatically detect the files and execute the migrations in the correct order based on their dependencies and the order they are defined in the file.

After creating the first file you have the option to define the version of sqlx to use at the top of the file, this is optional and will default to the latest version if not specified.
```sql
-- +sqlx:version: 0.1
```

Multiple files can have multiple versions, but it is recommended to keep the version consistent across all files to avoid confusion. The version can be used to ensure that the migration tool is using the correct syntax and features for the migrations defined in the file.
The migration tool will automatically detect the version and apply the correct syntax and features based on the version specified at the top of the file.

## What SQLX will do to my database?
The SQLX format is designed to be a kind of superset of SQL that allows for more advanced features and better organization of migrations. It will not change the underlying SQL syntax (if not necessary), but it will add additional directives and features to make migrations more manageable and easier to read.
The SQLX format will:
- Allow for grouping migrations together for better organization.
- Support dependencies between migrations and groups to ensure correct execution order.
- Enable the definition of macros and functions to encapsulate reusable SQL logic.
- Provide a way to define rollback statements for migrations to revert changes if needed.
- Allow for tagging migrations and groups for special processing or categorization.

SQLX files are still valid SQL files, note that if you try to run a SQL file containing SQLX directives in a standard SQL environment, it will likely result in syntax errors. The SQLX format is intended to be used with a migration tool that understands and processes these directives.
Even if the syntax doesn't derive much in the file you created, you have to remember that the migration tool will organize the migrations before executing them, so the order of the migrations will be preserved and executed in the correct order based on their dependencies and the order they are defined in the file.

Also note that the SQLX format is designed to be compatible with PostgreSQL mainly.

While running the migration tool, it will create a new table in your database called `migrations` to keep track of the migrations that have been executed. This table will contain the following columns:
- `id`: The unique identifier for the migration.
- `full_path`: The full path to the specific migration, example: `path/to/file.sql::Migration(migration_name)`.
- `name`: The name of the migration, example: `migration_name`.
- `hash`: A hash of the migration content to ensure that the migration has not been modified since it was executed.
- `rollback`: A boolean indicating whether the migration has a rollback defined or not.
- `locked`: A boolean indicating whether the migration is locked for changes or not. Useful to prevent modifications to the migration.
- `status`: The status of the migration, which can be `pending`, `executed`, or `rolled_back`.
- `description`: An optional description of the migration for clarity.
- `created_at`: The timestamp when the migration was executed.
- `updated_at`: The timestamp when the migration was last updated.
- `rolled_back_at`: The timestamp when the migration was rolled back, if applicable.
- `tags`: A JSON array of tags associated with the migration, which can be used for special processing or categorization.
- `dependencies`: A JSON array of dependencies for the migration, it will contain the full path to the dependency, example: `path/to/file.sql::Group(group_name)` or `path/to/file.sql::Migration(migration_name)`.


## SQL Migration Format
Migrations can be defined using:
```sql
-- +migration: <migration_name>
-- +depends: <optional_dependency>
--+ <optional_description>
<SQL statements>
-- +rollback
<optional_rollback_statements>
-- +endmigration
```

### Components
- `-- +migration: <migration_name>`: Defines the start of a migration with a unique name.
- `-- +depends: <dependency>`: Specifies dependencies on other migrations or groups. This can be a specific migration or a group of migrations.
- `--+ <description>`: An optional description of the migration for clarity.
- `<SQL statements>`: The SQL commands that make up the migration. This can include `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, etc.
- `-- +endmigration`: Marks the end of the migration block.
- `-- +rollback`: Optional section to define rollback statements that can be executed to revert the migration.

## Grouping Migrations
Migrations can be grouped together to organize related migrations. This is useful for managing complex migrations that involve multiple steps or dependencies. The grouping format is as follows:
```sql
-- +group: <group_name>
-- +depends: <optional_dependency>
--+ <optional_description>
    -- +migration: <migration_name>
    --+ <optional_description>
    <SQL statements>
    -- +endmigration
-- +endgroup
```

### Components of a Group
- `-- +group: <group_name>`: Defines the start of a migration group with a unique name.
- `-- +depends: <dependency>`: Specifies dependencies on other groups or migrations.
- `--+ <description>`: An optional description of the group for clarity.
- `-- +migration: <migration_name>`: Defines a migration within the group.
- `-- +endmigration`: Marks the end of a migration within the group.
- `-- +endgroup`: Marks the end of the migration group.

## Dependencies
Dependencies allow migrations to specify that they rely on other migrations or groups. This ensures that migrations are executed in the correct order and that all necessary prerequisites are met before a migration is applied.
Dependencies can be specified using the `-- +depends` directive. This directive can be used to indicate that a migration or group depends on another migration or group, ensuring that the dependent migrations are executed before the current migration.

### Dependencies can be specified in various formats:
- `-- +depends: Migration(<migration_name>)`: Refers to a specific migration by name, which need to be in the same file.
- `-- +depends: Group(<group_name>)`: Refers to a group of migrations by name, which need to be in the same file.
- `-- +depends: ::path/to/file.sql::<dependency_kind>(<group_name>)`: Refers to a group of migrations in another file.
- `-- +depends: some_group::Migration(<migration_name>)`: Refers to a specific migration in another group.

Each `-- +depends` statement can only have one dependency, but multiple dependencies can be specified by repeating the `-- +depends` line.

## Tags
Another useful feature is the ability to add function tags to migrations, which can be used to do some special processing on the migration.
For example, you can add `-- +tags: concurrent` to a migration to indicate that it should be executed concurrently with other migrations.
Tags are defined as follows:

```sql
-- +tags: <tag1>, <tag2>, ...
```

Tags can be used for either migrations or groups.

## Rollback
Migrations can include rollback statements to revert changes made by the migration. This is useful for undoing changes in case of errors or when a migration needs to be reversed. The rollback section is defined using the `-- +rollback` directive, followed by the SQL statements that should be executed to revert the migration.
Example as follows:
```sql
-- +migration: <migration_name>
--+ <optional_description>
<SQL statements>
-- +rollback
<rollback_statements>
-- +endmigration
```

## Defining macros
Macros can be defined within migrations to encapsulate reusable SQL code or logic. This allows for cleaner and more maintainable migrations by avoiding code duplication. Macros are defined using the `-- +macro` directive, followed by the macro name and its definition.
Example:
```sql
-- +macro: <macro_name>
-- +parameters: <first_parameter>, <second_parameter>, ...
<macro_definition>
-- +endmacro
```

Macros can be called within migrations using the `-- +call` directive, which allows for the execution of the macro's SQL code at the point where it is called.
Example:
```sql
-- +migration: <migration_name>
--+ <optional_description>
<SQL statements>
-- +call: <macro_name>(<first_parameter>,
-- | <second_parameter>, ...)
-- +endmigration
```

Inside macro definitions there some special syntax that can be used to define the macro's behavior:
- `{{param}}`: This syntax is used to reference parameters passed to the macro. It allows for dynamic behavior based on the parameters provided when calling the macro.
- `{{macro_name(<params>)}}`: This syntax is used to reference other macros within the macro definition. It allows for nesting and reusability of macros, enabling complex SQL logic to be broken down into smaller, manageable pieces.
- `{{...param}}`: This syntax is used to reference parameters passed to the macro. It's used to spread parameters at the end of the macro definition.
- `{{...param, '<separator>'}}`: This syntax is used to reference parameters passed to the macro, allowing for a separator to be specified between the parameters. This is useful for generating lists or concatenated strings from multiple parameters.
Example:
```sql
-- +macro: create_table_with_timestamp
-- +parameters: table_name, column_definitions
CREATE TABLE {{table_name}} (
    id SERIAL PRIMARY KEY,
    {{...column_definitions, ',\n    '}},
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- +endmacro
```

## Defining functions
Functions can be defined within migrations to encapsulate reusable SQL logic. This allows for cleaner and moremaintainable migrations by avoiding code duplication. Functions are defined using the `-- +function` directive, followed by the function name, parameters, and the function body.
Example showing the boilerplate that will be used to define a function:
```sql
-- +function: <function_name>
-- +depends: <optional_dependency>
-- +parameters: <first_parameter> <data_type>, <second_parameter> <data_type>, ...
-- +returns: <return_type>
-- +language: <optional_language>
--+ <optional_description>
CREATE OR REPLACE FUNCTION <function_name>(<first_parameter> <data_type>, <second_parameter> <data_type>, ...)
RETURNS <return_type> AS $$
BEGIN
    <function_body>
END;
$$ LANGUAGE plpgsql; -- or <optional_language>
-- +endfunction
```

Language by default is `plpgsql`, but it can be changed to any other language supported by the database, such as `sql`, `python`, etc.

Everything shown above in the example is created automagically by the migration tool, so you only need to provide the function name, parameters, return type, and function body.
Which can be very useful for defining complex logic that can be reused across multiple migrations or applications.

So in the end you will have a function that looks like this:
```sql
-- +function: example_function
-- +depends: example_group::Migration(example_migration)
-- +parameters: param1 VARCHAR, param2 INT
-- +returns: VOID
--+ This is an example function that demonstrates the use of all features.
INSERT INTO example_table (name) VALUES (param1);
UPDATE example_table SET created_at = CURRENT_TIMESTAMP WHERE id = param2;
-- +endfunction
```

If you want your editor to show your function in a more readable way, you should use the boilerplate and add `-- +tags: no_boilerplate` to the function definition. This will prevent the migration tool from generating the boilerplate code, and you can write the function body directly.
Like this:
```sql
-- +function: example_function
-- +depends: example_group::Migration(example_migration)
-- +parameters: param1 VARCHAR, param2 INT
-- +returns: VOID
-- +tags: no_boilerplate
CREATE OR REPLACE FUNCTION {N}({P})
RETURNS {R} AS $$
BEGIN
    INSERT INTO example_table (name) VALUES (param1);
    UPDATE example_table SET created_at = CURRENT_TIMESTAMP WHERE id = param2;
END;
$$ LANGUAGE plpgsql;
-- +endfunction
```

You can see that the boilerplate is not generated, and you can write the function body directly. This is useful for complex functions that require more than just a simple SQL statement. Also see that things like the paremeters and return type are still defined by the migration tool, you just need to place the boilerplate in the right place.

Why this still needs boilerplate? Because the migration tool needs to know the function name, parameters, return type, and dependencies to handle the function correctly. The boilerplate is used to ensure that the function is defined in a way that the migration tool can understand and execute it properly.

This will also be useful when the migration tool will support more complex features like function overloading, where you can define multiple functions with the same name but different parameters, or simple static analysis of the function body and the function calls within migrations, so that the migration tool can ensure that the function is called correctly and that the parameters are of the correct type.

Functions can be used like this:
```sql
-- +migration: <migration_name>
--+ <optional_description>
-- +call-func: <function_name> or ::path/to/file.sql::<function_name> or some_group::<function_name>
SELECT <function_name>(<first_parameter>, <second_parameter>, ...);
-- +endmigration
```

The `-- +call-func` directive is used to call the function within a migration. Why is it used? Because the migration tool needs to know that the function is being called, so it can handle the execution correctly and ensure that the function is defined before it is called.

## Retry on failure
Migrations can specify a number of retries in case of failure. This is useful for handling transient errors that may occur during the execution of a migration, such as network issues or temporary database unavailability. The retry count is defined using the `-- +retries` directive, followed by the number of retries.
Example:
```sql
-- +migration: <migration_name>
-- +retries: <number_of_retries>
--+ <optional_description>
<SQL statements>
-- +endmigration
```

## Groups as transactions
Groups can be executed as transactions, which means that all migrations within the group will be executed in a single transaction. This ensures that either all migrations in the group are applied successfully, or none of them are applied at all. This is useful for maintaining data integrity and consistency when applying multiple related migrations. To enable transaction behavior for a group, the `-- +transaction` directive is used.
Example:
```sql
-- +group: <group_name>
-- +transaction
-- +depends: <optional_dependency>
--+ <optional_description>

    -- +migration: <migration_name>
    --+ <optional_description>
    <SQL statements>
    -- +endmigration

-- +endgroup
```

## Go nuclear
In some cases, you may want to execute a migration that is not dependent on any other migrations or groups, and you want to ensure that it is executed immediately without waiting for other migrations to complete. This can be achieved using the `-- +nuclear` directive, which indicates that the migration should be executed immediately and independently of any other migrations or groups. This is useful for emergency fixes or critical updates that need to be applied without delay.
Example:
```sql
-- +migration: <migration_name>
-- +nuclear
--+ <optional_description>
<SQL statements>
-- +endmigration
```

# Example using all features
This example will contain at least one use for each feature described above.
```sql
-- +group: example_group
--+ This is an example group that contains multiple migrations and demonstrates the use of all features.
    -- +migration: example_migration
    --+ This is an example migration that demonstrates the use of all features.
    -- +tags: concurrent
    CREATE TABLE example_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    -- +rollback
    DROP TABLE example_table;
    -- +endmigration

    -- +migration: other_migration
        -- +depends: Migration(example_migration)
    --+ This is another example migration that demonstrates the use of all features.
    CREATE INDEX idx_example_table_name ON example_table(name);
    -- +rollback
    DROP INDEX idx_example_table_name;
    -- +endmigration
-- +endgroup

-- +macro: create_example_table
-- +parameters: table_name, column_definitions
CREATE TABLE {{table_name}} (
    id SERIAL PRIMARY KEY,
    {{...column_definitions, ',\n    '}},
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- +endmacro

-- +function: example_function
-- +depends: example_group::Migration(example_migration)
-- +parameters: param1 VARCHAR, param2 INT
-- +returns: VOID
--+ This is an example function that demonstrates the use of all features.
INSERT INTO example_table (name) VALUES (param1);
UPDATE example_table SET created_at = CURRENT_TIMESTAMP WHERE id = param2;
-- +endfunction

-- +function: example_function_that_returns_value
-- +depends: example_group::Migration(example_migration)
-- +parameters: param1 VARCHAR, param2 INT
-- +returns: VARCHAR
--+ This is an example function that returns a value.
RETURN 'Hello, ' || param1 || '! You passed the number ' || param2 || '.';
-- +endfunction

-- +migration: example_migration_with_function
--+ This migration demonstrates the use of a function.
-- +call-func: example_function
SELECT example_function('example_name', 1);
-- +endmigration

-- +migration: example_migration_with_macro
--+ This migration demonstrates the use of a macro.
-- +call: create_example_table('another_example_table', 'name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
-- +rollback
DROP TABLE another_example_table;
-- +endmigration

```
