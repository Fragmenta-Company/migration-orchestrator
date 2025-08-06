import { describe, expect, test } from "vitest";
import Migration from "./Migration.js";


describe("Migration Runner", () => {
  test("Should create single migration successfully", async () => {
    const migration = await Migration.create(
      'in-memory',
      'test_migration',
      1,
      `SELECT (1+2) AS result;`,
      1,
      2,
      'Test migration description',
      [],
      true
    );

    expect(migration).toBeInstanceOf(Migration);
    expect(migration.filePath).toBe('in-memory');
    expect(migration.name).toBe('test_migration');
    expect(migration.serial).toBe(1);
    expect(migration.sqlContent).toBe(`SELECT (1+2) AS result;`);
    expect(migration.startLine).toBe(1);
    expect(migration.endLine).toBe(2);
    expect(migration.description).toBe('Test migration description');
  });

  test("Should handle empty migration description", async () => {
    const migration = await Migration.create(
      'in-memory',
      'empty_description_migration',
      2,
      `SELECT (3+4) AS another_result;`,
      3,
      4,
      '',
      [],
      true
    );

    expect(migration.description).toBe('');
  });

  test("Should handle null migration description", async () => {
    const migration = await Migration.create(
      'in-memory',
      'null_description_migration',
      3,
      `SELECT (5+6) AS yet_another_result;`,
      5,
      6,
      null,
      [],
      true
    );

    expect(migration.description).toBe('');
  });

  test("Should handle adding empty description", async () => {
    const migration = await Migration.create(
      'in-memory',
      'add_empty_description_migration',
      4,
      `SELECT (7+8) AS final_result;`,
      7,
      8,
      'Initial description',
      [],
      true
    );

    migration.addToDescription('');
    expect(migration.description).toBe('Initial description');

    migration.addToDescription('   ');
    expect(migration.description).toBe('Initial description');
  });

  test("Should handle adding empty SQL content", async () => {
    const migration = await Migration.create(
      'in-memory',
      'add_empty_sql_migration',
      5,
      `SELECT (9+10) AS another_final_result;`,
      9,
      10,
      'Migration with empty SQL content',
      [],
      true
    );

    migration.addToSql('');
    expect(migration.sqlContent).toBe(`SELECT (9+10) AS another_final_result;`);

    migration.addToSql('   ');
    expect(migration.sqlContent).toBe(`SELECT (9+10) AS another_final_result;`);
  });

  test("Should handle migration with no SQL content", async () => {
    expect(async () => await Migration.create(
      'in-memory',
      'no_sql_content_migration',
      6,
      '',
      11,
      12,
      'Migration with no SQL content',
      [],
      true
    )).rejects.toThrowError("Invalid parameters for Migration creation");
  });
});
