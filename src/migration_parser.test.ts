import { describe, expect, test } from "vitest";
import MigrationParser from "./migration_parser.js";
import Migration from "./models/Migration.js";

describe("Migration Parser", () => {
  test("Should parse migrations correctly", async () => {
    const content = `
      -- +migration: test_migration
      --+ This is a test migration
      --+ This migration does something important
      CREATE TABLE test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      );
      -- +endmigration
    `;

    const migrations = await MigrationParser.parseContent(content);
    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.equals(
      new Migration(
        'in-memory',
        'test_migration',
        1,
        '\n' +
        'CREATE TABLE test_table (\n' +
        'id SERIAL PRIMARY KEY,\n' +
        'name VARCHAR(100) NOT NULL\n' +
        ');',
        2, 9,
        '\nThis is a test migration\nThis migration does something important'
      )
    )).toBe(true);
  });

  test("Should handle multiple migrations in a single file", async () => {
    const content = `
      -- +migration: first_migration
      CREATE TABLE first_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
      -- +migration: second_migration
      CREATE TABLE second_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
    `;

    const migrations = await MigrationParser.parseContent(content);
    expect(migrations).toHaveLength(2);
  })

  test("Should throw an error for nested migrations", async () => {
    const content = `
      -- +migration: outer_migration
      -- +migration: inner_migration
      CREATE TABLE nested_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
      -- +endmigration
    `;

    await expect(MigrationParser.parseContent(content)).rejects.toThrow(
      "Nested migration found: inner_migration"
    );
  });

  test("Should handle migrations with no description", async () => {
    const content = `
      -- +migration: no_description_migration
      CREATE TABLE no_description_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
    `;

    const migrations = await MigrationParser.parseContent(content);
    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.description).toBe('');
  });

  test("Should throw an error for unexpected endmigration", async () => {
    const content = `
      -- +migration: incomplete_migration
      CREATE TABLE incomplete_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
      -- +endmigration
    `;

    await expect(MigrationParser.parseContent(content)).rejects.toThrow(
      "Unexpected endmigration found"
    );
  });

  test("Should throw if file end is reached without endmigration", async () => {
    const content = `
      -- +migration: unclosed_migration
      CREATE TABLE unclosed_table (
        id SERIAL PRIMARY KEY
      );
    `;

    await expect(MigrationParser.parseContent(content)).rejects.toThrow(
      "File ended while inside migration: 'unclosed_migration' in in-memory"
    );
  });

  test("Parse multiple migration files", async () => {
    const content1 = `
      -- +migration: first_migration
      CREATE TABLE first_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
    `;
    const content2 = `
      -- +migration: second_migration
      CREATE TABLE second_table (
        id SERIAL PRIMARY KEY
      );
      -- +endmigration
    `;

    const migrations = await MigrationParser.parseMultiple(new Map([
      [ 'file1.sql', content1 ],
      [ 'file2.sql', content2 ]
    ]));

    expect(migrations).toHaveLength(2);
  });

})
