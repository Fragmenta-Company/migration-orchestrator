import path from "node:path";
import chalk from "chalk";
import MigrationParser from "../migration_parser.js";
import MigrationRunner from "../migration_runner.js";
import SqlLoader from "../sql_loader.js";
import createDependencyGraph from "../utils/create_dependency_graph.js";
import getSqlFilePaths from "../utils/get_sql_filepaths.js";
import { organizeMigrations } from "../utils/organize_migrations.js";

export default async function runSqlFromDirectory(
  directory: string,
  showResults: boolean,
): Promise<void> {
  try {
    const files = await getSqlFilePaths(directory);
    const loader = await SqlLoader.create(
      files.map((f) => path.join(f.parentPath, f.name)),
    );

    const migrations = await new MigrationParser().parseMultipleFiles(
      loader.sqlFiles,
    );

    const dependencyGraph = createDependencyGraph(migrations);

    const organizedMigrations = organizeMigrations(dependencyGraph, migrations);

    // console.dir(migrations, { depth: null });
    //
    // console.dir(dependencyGraph, { depth: null });
    //
    // console.dir(organizedMigrations, { depth: 2 });

    const migration_runner = new MigrationRunner(showResults);

    if (organizedMigrations.success) {
      const success = await migration_runner.runMigrations(
        organizedMigrations.migrations,
      );

      if (success) {
        console.log(
          chalk.bgGreen(chalk.black("All migrations ran successfully.")),
        );
      } else {
        console.error(
          chalk.bgRed(
            chalk.black(
              "Some migrations failed. Please check the logs for details.",
            ),
          ),
        );
      }

      await migration_runner.close();
    } else {
      organizedMigrations.errors.forEach((error) => {
        console.error(
          chalk.red(`Error organizing migrations: `),
          `\n${error.message} at line ${error.line}`,
        );
      });
    }
  } catch (e) {
    console.error(e);
    return;
  }
}
