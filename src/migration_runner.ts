import { EventEmitter } from "node:events";
import { Worker } from "node:worker_threads";
import chalk from "chalk";
import PG from "pg";
import MessageKind from "./migration_worker/MessageKind.js";
import MigrationTags from "./models/MigrationTags.js";
import type { OrganizedMigration } from "./utils/organize_migrations.js";

export default class MigrationRunner {
  private connection: PG.Pool;
  private readonly _workerPoolSize = 8;
  private _workerPool: Worker[] = [];
  private _exitedWorkers: number = 0;
  private _workerEventEmitter: EventEmitter = new EventEmitter();
  private _showResults: boolean;
  private _aborted: boolean = false;
  private _allSuccess: boolean = true;

  constructor(showResults: boolean = false) {
    this.connection = new PG.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this._showResults = showResults;
    this._workerEventEmitter.on("workerExited", () => {
      this._exitedWorkers++;
      if (this._exitedWorkers === this._workerPool.length) {
        this._workerEventEmitter.emit("allWorkersExited");
      }
    });
  }

  private async executeInWorker(migration: OrganizedMigration) {
    const index = this._workerPool.length;

    try {
      if (
        this._workerPool.length - this._exitedWorkers >=
        this._workerPoolSize
      ) {
        console.warn(
          chalk.yellow(
            "Worker pool is full, waiting for an available worker...",
          ),
        );
        // Wait for a worker to finish
        await new Promise<void>((resolve) => {
          this._workerEventEmitter.once("workerExited", () => {
            resolve();
          });
        });
      }

      const newWorker = new Worker(
        new URL("./migration_worker/migration_worker.js", import.meta.url),
        {
          workerData: migration,
          resourceLimits: {
            maxOldGenerationSizeMb: 2048,
            maxYoungGenerationSizeMb: 512,
          },
          env: {
            ...process.env,
            showResults: this._showResults ? "true" : "false",
          },
        },
      );
      this._workerPool.push(newWorker);

      newWorker.once(
        "message",
        ({ error, migration_id }: { error?: Error; migration_id: string }) => {
          if (error) {
            console.error(
              chalk.red(`Worker error in migration ${migration_id}:`),
              error,
            );
            this._allSuccess = false;
            this._aborted = true;
          } else {
            console.log(
              chalk.green(
                `Worker completed migration ${migration.migration.name} successfully.`,
              ),
            );
          }
        },
      );

      newWorker.once("exit", (c) => {
        console.log(
          chalk.blue(
            `Worker for migration ${migration.migration.name} has exited. Exit code: ${c}`,
          ),
        );
        this._workerEventEmitter.emit("workerExited");
      });

      newWorker.postMessage([MessageKind.START, "No reason provided"]);
    } catch (e) {
      this._workerPool[index]?.removeAllListeners("message");
      this._workerPool[index]?.removeAllListeners("exit");
      console.error(
        chalk.red(`Error executing migration ${migration.id} in worker:`),
        e,
      );
    }
  }

  // This method runs a single migration against the database
  // Must return a boolean indicating success or failure
  public async runMigration(migration: OrganizedMigration): Promise<boolean> {
    if (!migration || !migration.migration?.sql) {
      console.error(chalk.redBright("Invalid migration provided:"), migration);
      return false;
    }

    try {
      if (migration.migration.tags.has(MigrationTags.CONCURRENT)) {
        console.log(
          chalk.cyan(
            `Running migration ${migration.migration.name} in a worker thread.`,
          ),
        );
        if (migration.migration.description?.length > 0)
          console.log(`Description: ${migration.migration.description}`);
        await this.executeInWorker(migration);
        return true;
      }

      const client = await this.connection.connect();

      try {
        console.group(
          chalk.bgBlue(
            chalk.black(`Executing migration: ${migration.migration.name}`),
          ),
        );
        if (migration.migration.description?.length > 0)
          console.log(`Description: ${migration.migration.description}`);
        const result = await client.query(migration.migration.sql);
        if (this._showResults && result.rows?.length > 0) {
          console.dir(result.rows, { depth: null });
        }
        console.log(
          chalk.green(
            `Migration ${migration.migration.name} executed successfully.`,
          ),
        );
        console.groupEnd();
        return true;
      } catch (error) {
        console.error(chalk.redBright("Migration execution error"));
        console.error(`Error executing migration ${migration.id}:`, error);
        console.error(`Starting at line: ${migration.migration.startLine}`);
        if (migration.migration.endLine) {
          console.error(`Ending at line: ${migration.migration.endLine}`);
        }
        console.error(`SQL content:\n${migration.migration.sql}`);
        console.groupEnd();
        return false;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Failed to connect to the database:", error);
      return false;
    }
  }

  public async awaitForWorkers(): Promise<void> {
    if (this._workerPool.length === 0) {
      console.log(chalk.yellowBright("No workers to await."));
      return;
    }

    if (this._exitedWorkers < this._workerPool.length) {
      console.log(
        chalk.blueBright(
          `Awaiting for ${this._workerPool.length - this._exitedWorkers} workers to complete...`,
        ),
      );
      await new Promise<void>((resolve) => {
        this._workerEventEmitter.once("allWorkersExited", () => {
          this._workerEventEmitter.removeAllListeners("workerExited");
          resolve();
        });
      });
    }

    this._workerPool = [];
    console.log(chalk.bgGreen(chalk.black("All workers have completed.")));
  }

  public async runMigrations(
    migrations: OrganizedMigration[],
  ): Promise<boolean> {
    if (!migrations || migrations.length === 0) {
      console.warn(chalk.yellowBright("No migrations provided to run."));
      return false;
    }

    for (const migration of migrations) {
      console.log(
        chalk.blueBright(
          `Running migration ${migration.migration.name} from group: ${migration.group}`,
        ),
      );
      const success = await this.runMigration(migration);
      if (!success && this._allSuccess) {
        this._allSuccess = false;
        this._aborted = true;
      }
      if (this._aborted) {
        console.warn(
          chalk.redBright("Migration process aborted due to a failure."),
        );
        break;
      }
    }

    if (!this._allSuccess) this._aborted = true;

    await this.awaitForWorkers();

    return this._allSuccess;
  }

  public async close(): Promise<void> {
    await this.connection.end();
  }
}
