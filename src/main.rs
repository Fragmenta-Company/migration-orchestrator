pub mod migration_parser;
pub mod models;
pub mod parse_errors;

#[tokio::main]
async fn main() {
    if let Err(e) = dotenvy::dotenv() {
        eprintln!("Failed to load .env file: {e}");
        return;
    }

    let mut file = models::file::MigrationFile::new(
        "path/to/file.sql",
        "file.sql",
        r#"
            -- +fsql:version: 0.5

            -- +migration: smth
            -- +version: 1.0.0
            --+ This is a migration description
            -- +depends: ::path/to/something.sql::Migration(my_migration)
            -- +tags: concurrent
            -- +nuclear
                CREATE TABLE IF NOT EXISTS my_table (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                );
            -- +rollback
                DROP TABLE IF EXISTS my_table;
            -- +endmigration
            
            -- +macro: my_macro
            -- +parameters: table_name, type_of_id, ...columns
            -- +depends: ::path/to/something.sql::Migration(my_migration)
                CREATE TABLE IF NOT EXISTS {{table_name}} (
                    id {{type_of_id}} PRIMARY KEY,
                    {{...columns}},
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                );
            -- +endmacro

            -- +migration: another_migration
            -- +depends: ::path/to/something.sql::Migration(my_migration)
                -- +call: ::/path/to/::my_macro('another_table', 'UUID', 'name VARCHAR(255) NOT NULL', 'age INT')
            -- +endmigration
        "#,
    );

    file.parse_file().unwrap();

    println!("Parsed migrations:\n{:#?}", file);
}
