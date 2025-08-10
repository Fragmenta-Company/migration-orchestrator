import { match } from "ts-pattern";
import Migration from "./models/Migration.js";
import MigrationGroup from "./models/MigrationGroup.js";
import type MigrationTags from "./models/MigrationTags.js";
import type MigrationGroupTags from "./models/MigrationGroupTags.js";


export default class MigrationParser {
  
  private static readonly _migrationStartRegex = /^--\s*\+migration:\s*(\w[\w\-]*)/;
  private static readonly _migrationEndRegex = /^--\s*\+endmigration/;
  private static readonly _migrationRegexDescription = /^--\s*\+(.+)/;
  private static readonly _migrationRegexMigrationDependency = /^--\s*\+dependency:\s*([\w.\-:/]+)/;
  private static readonly _migrationRegexGroupDependency = /^--\s*\+groupdependency:\s*([\w.\-:/]+)/;
  private static readonly _migrationRegexTags = /^--\s*\+tags:\s*([\w\-\,\s]+)/;
  private static readonly _migrationGroupStartRegex = /^--\s*\+group:\s*(\w[\w\-]*)/;
  private static readonly _migrationGroupEndRegex = /^--\s*\+endgroup/;

  public async parseContent(content: string, filePath: string = 'in-memory'): Promise<MigrationGroup> {
    return await this.parseSingleFile({ filePath, content });
  }

  public async parseMultipleFiles(
    files: Map<string, string>
  ): Promise<MigrationGroup> {
    const fileOrder = Array.from(files.keys());

    const parsedResults = await Promise.all(
      fileOrder.map(async (filePath) => {
        const content = files.get(filePath)!;
        const parsed = await this.parseSingleFile({ filePath, content, serial: fileOrder.indexOf(filePath) + 1 });
        return parsed;
      })
    );

    const rootGroup = new MigrationGroup('root', 1, 0);

    for (const group of parsedResults) {
      rootGroup.addGroup(group);
    }

    return rootGroup;
  }

  public async parseSingleFile({
    filePath,
    content,
    serial
  }: {
    filePath: string;
    content: string;
    serial?: number;
  }): Promise<MigrationGroup> {
    const lines = content
      .split('\n')
      .map(line => line.trim());

    let rootGroup = new MigrationGroup(filePath, serial ?? 1, 1);
    rootGroup.endLine = lines.length;

    const migrations: Migration[] = []; 
    const lastGroups: MigrationGroup[] = [];

    let lastGroupIndexes: number[] = [];
    let currentMigration: Migration | null = null;
    let currentGroup: MigrationGroup | null = null;

    let insideMigration = false;

    for (const [i, line] of lines.entries()) {
      match(line)
        .when((l) => !!MigrationParser._migrationStartRegex.test(l), (l) => {
          const match = MigrationParser._migrationStartRegex.exec(l);
          if (match && match[1]) {
            if (currentMigration || insideMigration) {
              throw new Error(`Found migration start without end in file: ${filePath} at line ${i + 1}`);
            }
            currentMigration = new Migration(filePath, match[1], migrations.length + 1, i + 1);
          }
        })
        .when((l) => !!MigrationParser._migrationEndRegex.test(l), () => {
          if (currentGroup && currentMigration) {
            currentMigration.endLine = i + 1;
            currentGroup.addMigration(currentMigration);
            migrations.push(currentMigration);
            currentMigration = null;
          } else if (currentMigration) {
            currentMigration.endLine = i + 1;
            migrations.push(currentMigration);
            currentMigration = null;
          } else {
            throw new Error(`Found migration end without start in file: ${filePath} at line ${i + 1}`);
          }
        })
        .when((l) => !!MigrationParser._migrationGroupStartRegex.test(l), (l) => {
          const match = MigrationParser._migrationGroupStartRegex.exec(l);
          if (match && match[1]) {
            if (currentGroup) {
              const newGroup = new MigrationGroup(match[1], lastGroups.length + 1, i + 1);
              currentGroup.addGroup(newGroup);
              lastGroupIndexes.push(lastGroups.length);
              lastGroups.push(currentGroup);
              currentGroup = newGroup;
            } else {
              currentGroup = new MigrationGroup(match[1], lastGroups.length + 1, i + 1);
            }
          }
        })
        .when((l) => !!MigrationParser._migrationGroupEndRegex.test(l), () => {
          if (currentGroup) {
            if (lastGroupIndexes.length > 0) {
              const lastIndex = lastGroupIndexes.pop()!;
              if(!lastGroups[lastIndex]) {
                throw new Error(`Invalid last group index: ${lastIndex} in file: ${filePath} at line ${i + 1}`);
              }
              const lastGroup = lastGroups.splice(lastIndex, 1)[0]!;
              lastGroup.addGroup(currentGroup)
              currentGroup = lastGroup;
              lastGroupIndexes = lastGroupIndexes.map(index => {
                return index > lastIndex ? index - 1 : index;
              });
            } else {
              rootGroup.addGroup(currentGroup);
              currentGroup = null;
            }
          } else {
            throw new Error(`Found migration group end without start in file: ${filePath} at line ${i + 1}`);
          }
        })
        .when((l) => !!MigrationParser._migrationRegexTags.test(l), (l) => {
          const match = MigrationParser._migrationRegexTags.exec(l);
          if (match && match[1]) {
            const tags = match[1].split(',').map(tag => tag.trim());
            if (currentMigration) {
              currentMigration.addTags(tags as MigrationTags[]);
            } else if (currentGroup) {
              currentGroup.addTags(tags as MigrationGroupTags[]);
            } else {
              throw new Error(`Found migration tags without migration or group in file: ${filePath} at line ${i + 1}`);
            }
          }
        })
        .when((l) => !!MigrationParser._migrationRegexMigrationDependency.test(l), (l) => {
          const match = MigrationParser._migrationRegexMigrationDependency.exec(l);
          if (match && match[1]) {
            if (currentMigration) {
              currentMigration.addMigrationDependency(match[1]);
            } else if(currentGroup) {
              currentGroup.addMigrationDependency(match[1])
            } else {
              throw new Error(`Found migration dependency without migration in file: ${filePath} at line ${i + 1}`);
            }
          }
        })
        .when((l) => !!MigrationParser._migrationRegexGroupDependency.test(l), (l) => {
          const match = MigrationParser._migrationRegexGroupDependency.exec(l);
          if (match && match[1]) {
            if (currentMigration) {
              currentMigration.addGroupDependency(match[1]);
            } else if (currentGroup) {
              currentGroup.addGroupDependency(match[1]);
            } else {
              rootGroup.addGroupDependency(match[1]);
            }
          }
        })
        .when((l) => !!MigrationParser._migrationRegexDescription.test(l), () => {
          const match = MigrationParser._migrationRegexDescription.exec(line);
          if (match && match[1]) {
            const description = match[1].trim();
            if (currentMigration) {
              currentMigration.addToDescription(description);
            } else if (currentGroup) {
              currentGroup.addToDescription(description);
            } else {
              throw new Error(`Found description without migration or group in file: ${filePath} at line ${i + 1}`);
            }
          }
        })
        .otherwise(() => {
          if (currentMigration) {
            currentMigration.addToSql(line);
          }
        });

      if((currentGroup || currentMigration) && i === lines.length - 1) {
        throw new Error(`File ended unexpectedly with open migration or group in file: ${filePath} at line ${i + 1}`);
      }

      if(i === lines.length - 1 && !currentGroup && !currentMigration) {
        if(lastGroups.length > 0) {
          throw new Error(`File ended with open groups in file: ${filePath} at line ${i + 1}`);
        }

        while (migrations.length > 0) {
          if (!rootGroup) {
            throw new Error(`Root group is null when trying to add migrations in file: ${filePath}`);
          }

          rootGroup.addMigration(migrations.pop()!);
        }
      }
    }

    return rootGroup;
  }

}

