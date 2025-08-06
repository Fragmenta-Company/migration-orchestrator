import { describe, expect, test } from "vitest";
import 'dotenv/config'
import MigrationRunner from "./migration_runner.js";
import Migration from "./models/Migration.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

describe("Migration Runner", () => {
  
  test("Should run migrations correctly", async () => {
    const migrationRunner = new MigrationRunner(databaseUrl);

    const success = await migrationRunner.runMigrations([
      new Migration('in-memory', 'test_migration', 1, `
        SELECT (1+2) AS result;
      `, 1, 2, 'Test migration description'),
      new Migration('in-memory', 'another_migration', 2, `
        SELECT (3+4) AS another_result;
      `, 3, 4, 'Another migration description')
    ]);

    migrationRunner.close();

    expect(success).toBe(true);
  });

  test("Should handle migration errors gracefully", async () => {
    const migrationRunner = new MigrationRunner(databaseUrl);

    const success = await migrationRunner.runMigration(
      new Migration('in-memory', 'failing_migration', 1, `
        SELECT (1/0) AS result; -- This will fail
      `, 1, 2, 'This migration will fail intentionally')
    );

    migrationRunner.close();

    expect(success).toBe(false);
  });

  test("Should handle invalid migration gracefully", async () => {
    const migrationRunner = new MigrationRunner(databaseUrl);

    const success = await migrationRunner.runMigration(
      new Migration('in-memory', 'invalid_migration', 1, '', 1, 2, 'This migration has no SQL content')
    );

    migrationRunner.close();

    expect(success).toBe(false);
  });

  test("Should handle empty migrations array", async () => {
    const migrationRunner = new MigrationRunner(databaseUrl);

    const success = await migrationRunner.runMigrations([]);

    migrationRunner.close();

    expect(success).toBe(false);
  });

  test("Should handle multiple migrations with some failures", async () => {
    const migrationRunner = new MigrationRunner(databaseUrl);

    const success = await migrationRunner.runMigrations([
      new Migration('in-memory', 'first_migration', 1, `
        SELECT (1+2) AS result;
      `, 1, 2, 'First migration'),
      new Migration('in-memory', 'failing_migration', 2, `
        SELECT (1/0) AS result; -- This will fail
      `, 3, 4, 'This migration will fail intentionally'),
      new Migration('in-memory', 'second_migration', 3, `
        SELECT (3+4) AS another_result;
      `, 5, 6, 'Second migration')
    ]);

    migrationRunner.close();

    expect(success).toBe(false);
  })
})
