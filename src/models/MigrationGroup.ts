import type Migration from "./Migration.js";
import type MigrationGroupTags from "./MigrationGroupTags.js";

interface MigrationGroupIterator {
  migration: Migration;
  migrationName: string;
  currentGroup: string;
}

export default class MigrationGroup implements Iterable<MigrationGroupIterator> {
  private _migrations: Migration[] = [];
  private _migrationGroups: MigrationGroup[] = [];
  private _name: string;
  public readonly _serial: number;
  private _groupTags: Set<MigrationGroupTags> = new Set<MigrationGroupTags>();
  private _groupGroupDependencies: Set<string> = new Set<string>();
  private _groupMigrationDependencies: Set<string> = new Set<string>();
  private _description: string = '';
  public readonly startLine: number;
  public endLine?: number | null = null;

  constructor(name: string, serial: number, startLine: number) {
    this._name = name;
    this._serial = serial;
    this.startLine = startLine;
  }

  public *[Symbol.iterator](): IterableIterator<MigrationGroupIterator> {
    for (const migration of this._migrations) {
      yield { 
        migration,
        currentGroup: this._name,
        migrationName: migration.name 
      };
    }

    for (const group of this._migrationGroups) {
      yield* group; // Recursively yield migrations from nested groups
    }
  }

  public get name(): string {
    return this._name;
  }

  public addMigration(migration: Migration): void {
    if (!migration) {
      console.warn('Attempted to add a null migration to group:', this._name);
      return;
    }
    this._migrations.push(migration);
  }

  public addGroup(group: MigrationGroup): void {
    if (!group) {
      console.warn('Attempted to add a null group to group:', this._name);
      return;
    }
    this._migrationGroups.push(group);
  }

  public addTags(tags: MigrationGroupTags[]): void {
    if (!tags || tags.length === 0) {
      console.warn('Attempted to add an empty tag to migration group:', this._name);
      return;
    }

    for (const tag of tags) {
      if (this._groupTags.has(tag)) {
        console.warn(`Tag ${tag} already exists in migration group:`, this._name);
      }
    }

    for (const tag of tags) {
      this._groupTags.add(tag);
    }
  }

  public addGroupDependency(groupName: string): void {
    if (!groupName || groupName.trim().length === 0) {
      console.warn('Attempted to add an empty group dependency to group:', this._name);
      return;
    }
    this._groupGroupDependencies.add(groupName);
  }

  public addMigrationDependency(migrationName: string): void {
    if (!migrationName || migrationName.trim().length === 0) {
      console.warn('Attempted to add an empty migration dependency to group:', this._name);
      return;
    }
    this._groupMigrationDependencies.add(migrationName);
  }

  public addToDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      console.warn('Attempted to add empty description to migration group:', this._name);
      return;
    }
    if (this._description.length === 0) {
      this._description = description.trim();
    } else {
      this._description += `\n${description.trim()}`;
    }
  }

  public get migrations(): Readonly<Migration[]> {
    return this._migrations;
  }

  public get groups(): Readonly<MigrationGroup[]> {
    return this._migrationGroups;
  }

  public get groupDependencies(): Readonly<Set<string>> {
    return this._groupGroupDependencies;
  }

  public get migrationDependencies(): Readonly<Set<string>> {
    return this._groupMigrationDependencies;
  }
}
