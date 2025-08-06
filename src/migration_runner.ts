import PG from "pg";
import type Migration from "./models/Migration.js";


export default class MigrationRunner {
  private connection: PG.Pool;

  constructor(connection_url: string) {
    this.connection = new PG.Pool({
      connectionString: connection_url,
    });
  }

  // This method runs a single migration against the database
  // Must return a boolean indicating success or failure
  public async runMigration(migration: Migration): Promise<boolean> {
    if (!migration || !migration.sqlContent) {
      console.error('Invalid migration provided:', migration);
      return false;
    }

    try {
      const client = await this.connection.connect();
      try {
        console.log(`Executing migration: ${migration.name}`);
        await client.query(migration.sqlContent);
        console.log(`Migration ${migration.name} executed successfully.`);
        return true;
      } catch (error) {
        console.group('Migration execution error');
        console.error(`Error executing migration ${migration.name}:`, error);
        console.error(`Starting at line: ${migration.startLine}`);
        if (migration.endLine) {
          console.error(`Ending at line: ${migration.endLine}`);
        }
        console.error(`SQL content:\n${migration.sqlContent}`);
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

  public async runMigrations(migrations: Migration[]): Promise<boolean> {
    if (!migrations || migrations.length === 0) {
      console.warn('No migrations provided to run.');
      return false;
    }

    let allSuccess = true;

    for (const migration of migrations) {
      const success = await this.runMigration(migration);
      if (!success && allSuccess) {
        allSuccess = false;
      }
    }

    return allSuccess;
  }

  public async close(): Promise<void> {
    await this.connection.end();
  }

}
