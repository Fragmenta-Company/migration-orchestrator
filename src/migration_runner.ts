import PG from "pg";
import type Migration from "./models/Migration.js";
import { Worker } from "node:worker_threads";
import MigrationTags from "./models/MigrationTags.js";
import type MigrationGroup from "./models/MigrationGroup.js";
import type { OrganizedMigration } from "./utils/organizeMigrations.js";
import MessageKind from "./migration_worker/MessageKind.js";
import chalk from "chalk";


export default class MigrationRunner {
  private connection: PG.Pool;
  private readonly _workerPoolSize = 8;
  private _workerPool: Worker[] = [];
  private _exitedWorkerPool: Worker[] = [];
  private _showResults: boolean;
  private _aborted: boolean = false;

  constructor(showResults: boolean = false) {
    this.connection = new PG.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this._showResults = showResults;
  }

  private async executeInWorker(
    migration: OrganizedMigration
  ) {
    const index = this._workerPool.length;

    try {
      if (this._workerPool.length >= this._workerPoolSize) {
        console.warn(chalk.yellow('Worker pool is full, waiting for an available worker...'));
        // Wait for a worker to finish
        const worker = this._workerPool[0];
        if (worker) {
          await new Promise<void>((resolve) => {
            worker.once('exit', () => resolve());
          });
        }
      }

      const newWorker = 
        new Worker(new URL('./migration_worker/migration_worker.js', import.meta.url), {
          workerData: migration,
          resourceLimits: {
            maxOldGenerationSizeMb: 2048,
            maxYoungGenerationSizeMb: 512,
          },
          env: {
            ...process.env,
            showResults: this._showResults ? 'true' : 'false',
          },
        });
      this._workerPool.push(newWorker);

      newWorker.once('message', ({
        error,
        migration_id
      }: {
        error?: Error,
        migration_id: string
      }) => { 
        if (error) {
          console.error(chalk.red(`Worker error in migration ${migration_id}:`), error);
        } else {
          console.log(chalk.green(`Worker completed migration ${migration.migration.name} successfully.`));
        }
      });

      newWorker.once('exit', (c) => {
        console.log(chalk.blue(`Worker for migration ${migration.migration.name} has exited. Exit code: ${c}`));
        this._exitedWorkerPool.push(this._workerPool.splice(index, 1)[0]!);
      });

      newWorker.postMessage([MessageKind.START, 'No reason provided']);

    } catch (e) {
      this._workerPool[index]?.removeAllListeners('message');
      this._workerPool[index]?.removeAllListeners('exit');
      console.error(chalk.red(`Error executing migration ${migration.id} in worker:`), e);
    }
  }

  // This method runs a single migration against the database
  // Must return a boolean indicating success or failure
  public async runMigration(migration: OrganizedMigration): Promise<boolean> {
    if (!migration || !migration.migration?.sql) {
      console.error(chalk.redBright('Invalid migration provided:'), migration);
      return false;
    }

    try {

      if(migration.migration.tags.has(MigrationTags.CONCURRENT)) {
        console.log(chalk.cyan(`Running migration ${migration.migration.name} in a worker thread.`));
        if(migration.migration.description.length > 0)
          console.log(`Description: ${migration.migration.description}`);
        this.executeInWorker(migration);
        return true;
      }

      const client = await this.connection.connect();

      try {
        console.group(chalk.bgBlue(chalk.black(`Executing migration: ${migration.migration.name}`)));
        if(migration.migration.description.length > 0)
          console.log(`Description: ${migration.migration.description}`);
        const result = await client.query(migration.migration.sql);
        if (this._showResults && result.rows.length > 0) {
          console.dir(result.rows, { depth: null });
        }
        console.log(chalk.green(`Migration ${migration.migration.name} executed successfully.`));
        console.groupEnd();
        return true;
      } catch (error) {
        console.error(chalk.redBright('Migration execution error'));
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
      console.error('Failed to connect to the database:', error);
      return false;
    }
  }

  public async awaitForWorkers(): Promise<void> {
    if (this._workerPool.length === 0) {
      console.log(chalk.yellowBright('No workers to await.'));
      return;
    }

    console.log(chalk.yellowBright(`Waiting for ${this._workerPool.length} workers to complete...`));
    await new Promise<void>((resolve) => {
      const checkWorkers = () => {
        if (this._aborted) {
          this._workerPool.forEach(worker => {
            worker.postMessage([MessageKind.STOP, { reason: 'Migration aborted' }]);
          });
          resolve();
        }
        if (this._workerPool.length === 0) {
          resolve();
        } else {
          setTimeout(checkWorkers, 1000);
        }
      };
      checkWorkers();
    });

    this._workerPool = [];
    console.log('All workers have completed.');
  }

  public async runMigrations(migrations: OrganizedMigration[]): Promise<boolean> {
    if (!migrations || (migrations.length === 0)) {
      console.warn(chalk.yellowBright('No migrations provided to run.'));
      return false;
    }

    let allSuccess = true;

    for (const migration of migrations) {
      console.log(chalk.blueBright(`Running migration: ${migration.migration.name} from group: ${migration.group}`));
      const success = await this.runMigration(migration);
      if (!success && allSuccess) {
        allSuccess = false;
      }
    }

    if(!allSuccess)
      this._aborted = true;

    await this.awaitForWorkers();

    return allSuccess;
  }

  public async close(): Promise<void> {
    await this.connection.end();
  }

}
