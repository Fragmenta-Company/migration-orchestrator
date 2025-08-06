import getSqlFilePaths from "./get_sql_filepaths.js";
import { fileURLToPath } from 'url';
import path from 'path';
import SqlLoader from "./sql_loader.js";
import MigrationParser from "./migration_parser.js";
import MigrationRunner from "./migration_runner.js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = await getSqlFilePaths(path.join(__dirname + "/../src-sql"));
const loader = await SqlLoader.create(files.map(f => path.join(f.parentPath, f.name)));

const migrations = await MigrationParser.parseMultiple(loader.sqlFiles);

const migration_runner = new MigrationRunner(process.env.DATABASE_URL!);

const success = await migration_runner.runMigrations(migrations);

if (success) {
  console.log("All migrations ran successfully.");
} else {
  console.error("Some migrations failed. Please check the logs for details.");
}

await migration_runner.close();
