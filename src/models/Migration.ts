import fileExists from "../utils/file_exists.js";
import MigrationTags from "./MigrationTags.js";

export default class Migration {

  public readonly filePath: string;
  public readonly name: string;
  public readonly serial: number;
  public readonly startLine: number;
  public endLine?: number | null;
  private dependencies: string[];
  private tags: MigrationTags[] = [];
  private _description: string;
  private sql: string;

  constructor(
    filePath: string,
    name: string,
    serial: number,
    sql: string,
    startLine: number,
    endLine?: number,
    description?: string | null,
    depedencies: string[] = []
  ) {
    this.filePath = filePath;
    this.name = name;
    this.serial = serial;
    this.sql = sql;
    this.startLine = startLine;
    this.endLine = endLine ?? null;
    this._description = description ?? '';
    this.dependencies = depedencies;
  }

  public get description(): string {
    return this._description;
  }

  public addToDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      console.warn('Attempted to add empty description to migration:', this.name);
      return;
    }
    this._description += `\n${description.trim()}`;
  }

  public get sqlContent(): Readonly<string> {
    return this.sql;
  }

  public addToSql(sql: string): void {
    if (!sql || sql.trim().length === 0) {
      console.warn('Attempted to add empty SQL content to migration:', this.name);
      return;
    }
    this.sql += `\n${sql}`;
  }

  public addDependency(dependency: string): void {
    if (!dependency || dependency.trim().length === 0) {
      console.warn('Attempted to add empty dependency to migration:', this.name);
      return;
    }
    this.dependencies.push(dependency);
  }

  public static async create(
    filePath: string, 
    name: string, 
    serial: number, 
    sql: string,
    startLine: number,
    endLine?: number,
    description?: string | null,
    dependencies: string[] = [],
    skipFileCheck: boolean = false
  ): Promise<Migration> {
    if (!filePath || !name || serial < 0 || !sql || startLine < 0) {
      console.group('Migration creation error');
      console.error('Invalid parameters for Migration creation:');
      console.error(`filePath: ${filePath}`);
      console.error(`name: ${name}`);
      console.error(`serial: ${serial}`);
      console.error(`sql: ${sql}`);
      console.error(`startLine: ${startLine}`);
      console.error(`endLine: ${endLine}`);
      console.groupEnd();
      throw new Error('Invalid parameters for Migration creation');
    }

    if (!skipFileCheck) {
      const exist = await fileExists(filePath);
      if (!exist) throw new Error(`Migration file does not exist: ${filePath}`);
    }

    return new Migration(
      filePath, 
      name, 
      serial, 
      sql, 
      startLine, 
      endLine, 
      description,
      dependencies
    );
  }

  public equals(other: Migration): boolean {
    return this.filePath === other.filePath &&
           this.name === other.name &&
           this.serial === other.serial &&
           this.startLine === other.startLine &&
           this.endLine === other.endLine &&
           this._description === other._description &&
           this.sql === other.sql;
  }
}
