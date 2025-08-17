-- +macro: table_with_created_updated
-- +parameters: table_name, id_type, ...columns
--+ This is a sample macro that creates a table with dynamic name and columns.
CREATE TABLE IF NOT EXISTS {{table_name}} (
    id {{id_type}} PRIMARY KEY,
    {{...columns}},
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- +endmacro
