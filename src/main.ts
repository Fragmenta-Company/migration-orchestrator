import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import fs from "node:fs";
import { program } from "commander";
import runSingleSqlFile from "./commands/run_single_sql_file.js";
import runSqlFromDirectory from "./commands/run_sql_from_directory.js";
import ExitCodes from "./migration_worker/ExitCodes.js";
import fileExists from "./utils/file_exists.js";
import timedAsync from "./utils/timedAsync.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(path.dirname(__filename), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
);
const programName = "Migration Orchestrator";

program
  .name(programName)
  .description(packageJson.description)
  .version(`${programName} v${packageJson.version}`);

program
  .command("from-dir <directory>")
  .description("Run SQL migrations from a specified directory")
  .option("-s, --show-results", "Show results of each migration", false)
  .action(async (directory: string, options) => {
    const fullPath = path.isAbsolute(directory)
      ? directory
      : path.join(process.cwd(), directory);
    await timedAsync(
      runSqlFromDirectory,
      fullPath,
      options?.showResults || false,
    );
  });

program
  .command("from-file <filePath>")
  .description("Run a single SQL file")
  .option("-s, --show-results", "Show results of the migration", false)
  .action(async (filePath: string, options) => {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    if (!(await fileExists(fullPath))) {
      console.error(`File not found: ${fullPath}`);
      process.exit(ExitCodes.ERROR);
    }
    await timedAsync(runSingleSqlFile, fullPath, options?.showResults || false);
  });

await program.parseAsync();
