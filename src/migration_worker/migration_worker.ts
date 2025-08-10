import process from "node:process";
import { parentPort, workerData } from "node:worker_threads";
import PG from "pg";
import MessageKind from "./MessageKind.js";
import type { MessageData } from "./MessageKind.js";
import { match } from "ts-pattern";
import ExitCodes from "./ExitCodes.js";
import type { OrganizedMigration } from "../utils/organizeMigrations.js";
import chalk from "chalk";

parentPort?.on('message', async ([kind, data]: [MessageKind, MessageData]) => {
  await match(kind)
    .returnType<Promise<void>>()
    .with(MessageKind.START, async () => {
      console.log(chalk.greenBright(`Migration worker started, running migration: ${(workerData as OrganizedMigration).id}`));
      await runMigration([workerData] as OrganizedMigration[]);
    })
    .with(MessageKind.RESTART, async () => {
      console.log(chalk.greenBright(`Migration worker restarted, running migration: ${(workerData as OrganizedMigration).id}`));
      console.log(`Reason: ${data.reason}`);
      await runMigration([workerData] as OrganizedMigration[]);
    })
    .with(MessageKind.STOP, async () => {
      console.log(chalk.redBright(`Migration worker stopped, reason: ${data.reason}`));
      parentPort?.postMessage({
        error: new Error(`Migration worker stopped: ${data.reason}`),
        migration_id: (workerData as OrganizedMigration).id
      });
      process.exit(ExitCodes.STOPPED);
    })
    .with(MessageKind.PAUSE, async () => {
      console.log(chalk.yellowBright(`Migration worker paused, reason: ${data.reason}`));
      
    })
    .exhaustive();
});

async function runMigration(migrationGroup: OrganizedMigration[]) {
  const cliente = new PG.Client({
    connectionString: process.env.DATABASE_URL,
  });

  for (const migration of migrationGroup) {
    try {
      await cliente.connect();
      const result = await cliente.query(migration.migration.sql);
      console.log(chalk.green(`Migration ${migration.migration.name} executed successfully.`));
      if (process.env.showResults === 'true' && result.rows.length > 0) {
        console.dir(result.rows, { depth: null });
      }

      parentPort?.postMessage({
        migration_id: migration.id
      });
      process.exit(ExitCodes.SUCCESS);
    } catch (e) {
      parentPort?.postMessage({
        error: e,
        migration_id: migration.id
      });
      process.exit(ExitCodes.ERROR);
    } finally {
      await cliente.end();
    }
  }
}
