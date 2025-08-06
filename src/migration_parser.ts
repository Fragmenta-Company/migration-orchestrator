import Migration from "./models/Migration.js";


export default class MigrationParser {
  
  private static readonly _migrationRegex = /^--\s*\+migration:\s*(\w[\w\-]*)/;
  private static readonly _migrationRegexDescription = /^--\s*\+(.+)/;
  private static readonly _migrationEndRegex = /^--\s*\+endmigration/;
  private static readonly _migrationRegexDependency = /^--\s*\+dependency:\s*(\w[\w\-]*)/;

  public static async parseContent(content: string, filePath: string = 'in-memory'): Promise<Migration[]> {
    return await this.parseSingle({ filePath, content });
  }

  public static async parseMultiple(
    files: Map<string, string>
  ): Promise<Migration[]> {
    const fileOrder = Array.from(files.keys());

    const parsedResults = await Promise.all(
      fileOrder.map(async (filePath) => {
        const content = files.get(filePath)!;
        const parsed = await this.parseSingle({ filePath, content });
        return { filePath, migrations: parsed };
      })
    );

    // Now flatten in the correct order
    const migrations = parsedResults.flatMap(result => result.migrations);

    return migrations;
  }

  public static async parseSingle(
    { filePath, content }: { filePath: string; content: string }
  ): Promise<Migration[]> {
    const migrations: Migration[] = [];
    const lines = content
      .split('\n')
      .map(line => line.trim())

    let currentMigration: Migration | null = null;
    let insideMigration = false;
    let afterStart = false;

    for (const [i, line] of lines.entries()) {

      if (!line || line.length === 0) continue;

      const startMatch = line.match(this._migrationRegex);
      const endMatch = line.match(this._migrationEndRegex);
      const descriptionMatch = line.match(this._migrationRegexDescription);
      const dependencyMatch = line.match(this._migrationRegexDependency);

      if (startMatch) {
        if (insideMigration) {
          throw new Error(`Nested migration found: ${startMatch[1]}`);
        }
        currentMigration = new Migration(
          filePath,
          startMatch?.[1] ?? '',
          migrations.length + 1,
          '',
          i + 1
        );
        afterStart = true;
        insideMigration = true;
      } else if(dependencyMatch && afterStart) {
        currentMigration?.addDependency(dependencyMatch[1] ?? '');
      } else if(descriptionMatch && afterStart) {
        currentMigration?.addToDescription(descriptionMatch[1] ?? '');
      } else if (endMatch) {
        if (!insideMigration || !currentMigration) {
          throw new Error(`Unexpected endmigration found`);
        }
        currentMigration.endLine = i + 1;
        migrations.push(currentMigration);
        currentMigration = null;
        insideMigration = false;
      } else if (insideMigration && currentMigration) {
        if (afterStart) afterStart = false;
        currentMigration.addToSql(line);
      }
    }

    if (insideMigration && currentMigration) {
      throw new Error(`File ended while inside migration: '${currentMigration.name}' in ${filePath}`);
    }

    return migrations;
  }

}
