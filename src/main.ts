import getSqlFilePaths from "./get_sql_filepaths.js";
import { fileURLToPath } from 'url';
import path from 'path';
import SqlLoader from "./sql_loader.js";
import MigrationParser from "./migration_parser.js";
import MigrationRunner from "./migration_runner.js";
import "dotenv/config";
import createDependencyGraph from "./utils/createDependencyGraph.js";
import { organizeMigrations } from "./utils/organizeMigrations.js";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = await getSqlFilePaths(path.join(__dirname + "/../src-sql"));
const loader = await SqlLoader.create(files.map(f => path.join(f.parentPath, f.name)));

const migrations = await (new MigrationParser).parseMultipleFiles(loader.sqlFiles);

const dependencyGraph = createDependencyGraph(migrations);

const organizedMigrations = organizeMigrations(dependencyGraph, migrations);

// console.dir(migrations, { depth: null });
//
// console.dir(dependencyGraph, { depth: null });
//
// console.dir(organizedMigrations, { depth: 2 });

const migration_runner = new MigrationRunner(true);

if (organizedMigrations.success) {
  const success = await migration_runner.runMigrations(organizedMigrations.migrations);

  if (success) {
    console.log("All migrations ran successfully.");
  } else {
    console.error("Some migrations failed. Please check the logs for details.");
  }

  await migration_runner.close();
} else {
  organizedMigrations.errors.forEach(error => {
    console.error(chalk.red(`Error organizing migrations: `), `\n${error.message} at line ${error.line}`);
  });
}
