-- +migration: create_user_roles_table
-- +dependency: create_roles_table
-- +dependency: create_user_table
--+ Tabela utilizada para armazenar a relação entre usuários e papéis (roles)
CREATE TABLE IF NOT EXISTS backend.user_roles (
  user_id UUID NOT NULL REFERENCES backend.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES backend.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
-- +endmigration

-- +migration: create_user_table
--+ Tabela utilizada para armazenar os usuários do sistema
CREATE TABLE IF NOT EXISTS backend.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(512) NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  last_login TIMESTAMP NULL DEFAULT NULL
);
-- +endmigration

-- +migration: create_roles_table
-- +dependency: create_user_table
--+ Tabela utilizada para armazenar os papéis (roles) dos usuários
CREATE TABLE IF NOT EXISTS backend.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description VARCHAR(1024) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- +endmigration

-- +migration: create_permissions_table
--+ Tabela utilizada para armazenar as permissões do sistema
CREATE TABLE IF NOT EXISTS backend.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description VARCHAR(1024) NOT NULL,
  entity VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- +endmigration

-- +migration: create_roles_permissions_table
-- +dependency: create_permissions_table
-- +dependency: create_roles_table
--+ Tabela utilizada para armazenar a relação entre papéis (roles) e permissões
CREATE TABLE IF NOT EXISTS backend.roles_permissions (
  role_id UUID NOT NULL REFERENCES backend.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES backend.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
-- +endmigration
