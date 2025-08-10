import fileExists from "../utils/file_exists.js";
import MigrationTags from "./MigrationTags.js";

export default class Migration {

  public readonly filePath: string;
  public readonly name: string;
  public readonly serial: number;
  public readonly startLine: number;
  public endLine?: number | null;
  private _migrationDependencies: string[] = [];
  private _groupDependencies: string[] = [];
  private _tags: Set<MigrationTags> = new Set<MigrationTags>();
  private _description: string = '';
  public sql: string = '';

  constructor(
    filePath: string,
    name: string,
    serial: number,
    startLine: number
  ) {
    this.filePath = filePath;
    this.name = name;
    this.serial = serial;
    this.startLine = startLine;
  }

  public get tags(): Readonly<Set<MigrationTags>> {
    return this._tags;
  }

  public get description(): string {
    return this._description;
  }

  public addTags(tags: MigrationTags[]): void {
    if(!tags || tags.length === 0) {
      console.warn('Attempted to add an empty tag to migration:', this.name);
      return;
    }

    for (const tag of tags) {
      if (this._tags.has(tag)) {
        console.warn(`Tag ${tag} already exists in migration:`, this.name);
      }
    }

    for (const tag of tags) {
      this._tags.add(tag);
    }
  }

  public addToDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      console.warn('Attempted to add empty description to migration:', this.name);
      return;
    }
    if (this._description.length === 0) {
      this._description = description.trim();
    } else {
      this._description += `\n${description.trim()}`;
    }
  }

  public addToSql(sql: string): void {
    if (!sql || sql.trim().length === 0) {
      console.warn('Attempted to add empty SQL content to migration:', this.name);
      return;
    }
    this.sql += `\n${sql}`;
  }

  public addMigrationDependency(dependency: string): void {
    if (!dependency || dependency.trim().length === 0) {
      console.warn('Attempted to add empty dependency to migration:', this.name);
      return;
    }
    this._migrationDependencies.push(dependency);
  }

  public addGroupDependency(dependency: string): void {
    if (!dependency || dependency.trim().length === 0) {
      console.warn('Attempted to add empty group dependency to migration:', this.name);
      return;
    }
    this._groupDependencies.push(dependency);
  }

  public static async create(
    filePath: string, 
    name: string, 
    serial: number,
    startLine: number,
    skipFileCheck: boolean = false
  ): Promise<Migration> {
    if (!filePath || !name || serial < 0 || startLine < 0) {
      console.group('Migration creation error');
      console.error('Invalid parameters for Migration creation:');
      console.error(`filePath: ${filePath}`);
      console.error(`name: ${name}`);
      console.error(`serial: ${serial}`);
      console.error(`startLine: ${startLine}`);
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
      startLine
    );
  }

  public equals(other: Migration): boolean {
    return this.filePath === other.filePath &&
           this.name === other.name &&
           this.serial === other.serial &&
           this.startLine === other.startLine &&
           this.endLine === other.endLine &&
           this._description === other._description &&
           this.sql === other.sql &&
           this._migrationDependencies.join(',') === other._migrationDependencies.join(',') &&
            this._groupDependencies.join(',') === other._groupDependencies.join(',');
  }

  public get migrationDependencies(): Readonly<string[]> {
    return this._migrationDependencies;
  }

  public get groupDependencies(): Readonly<string[]> {
    return this._groupDependencies;
  }
}
