import type Migration from "../models/Migration.js";
import type MigrationGroup from "../models/MigrationGroup.js";

export type OrganizedMigration = {
  id: string;
  migration: Migration;
  group: string;
};

export type CircularDependencyError = {
  type: "circular";
  message: string;
  cycle: string[];
  line: number;
};

export type MissingDependencyError = {
  type: "missing";
  message: string;
  dependency: string;
  dependentId: string;
  line: number;
};

export type OrganizationResult =
  | {
      success: true;
      migrations: OrganizedMigration[];
    }
  | {
      success: false;
      errors: (CircularDependencyError | MissingDependencyError)[];
    };

export function organizeMigrations(
  dependencyGraph: {
    migrationDependencies: Map<
      string,
      {
        migrationDependencies: Set<string>;
        groupDependencies: Set<string>;
      }
    >;
    groupDependencies: Map<
      string,
      {
        migrationDependencies: Set<string>;
        groupDependencies: Set<string>;
      }
    >;
  },
  rootGroup: MigrationGroup,
): OrganizationResult {
  const errors: (CircularDependencyError | MissingDependencyError)[] = [];
  const organizedMigrations: OrganizedMigration[] = [];
  const visiting = new Set<string>();
  const processed = new Set<string>();

  // Create a map of all migrations for easy lookup
  const allMigrations = new Map<
    string,
    { migration: Migration; group: string }
  >();
  const allGroups = new Set<string>();

  function collectMigrations(group: MigrationGroup, parentPath: string = "") {
    // Build the group ID exactly like createDependencyGraph
    const groupId = parentPath ? `${parentPath}::${group.name}` : group.name;
    allGroups.add(groupId);

    // For each migration in this group, find its actual ID in the dependency graph
    // and determine its correct group assignment
    for (const migrationInfo of group) {
      // Try to find the migration in the dependency graph with different possible paths
      let actualMigrationId = "";
      let actualGroupId = groupId;

      // Check if migration exists with current group path
      const candidateId = `${groupId}::${migrationInfo.migrationName}`;
      if (dependencyGraph.migrationDependencies.has(candidateId)) {
        actualMigrationId = candidateId;
        actualGroupId = groupId;
      }

      if (actualMigrationId) {
        allMigrations.set(actualMigrationId, {
          migration: migrationInfo.migration,
          group: actualGroupId,
        });
      }
    }

    // Recursively process nested groups with proper parent path
    for (const nestedGroup of group.groups) {
      collectMigrations(nestedGroup, groupId);
    }
  }

  function checkCircularDependencies(
    migrationId: string,
    path: string[] = [],
  ): string[] | null {
    if (visiting.has(migrationId)) {
      const cycleStart = path.indexOf(migrationId);
      return path.slice(cycleStart).concat([migrationId]);
    }

    if (processed.has(migrationId)) {
      return null;
    }

    visiting.add(migrationId);
    const currentPath = [...path, migrationId];

    const dependencies = dependencyGraph.migrationDependencies.get(migrationId);
    if (dependencies) {
      // Check direct migration dependencies
      for (const dep of dependencies.migrationDependencies) {
        if (allMigrations.has(dep)) {
          const cycle = checkCircularDependencies(dep, currentPath);
          if (cycle) {
            return cycle;
          }
        }
      }

      // Check group dependencies - find all migrations in the dependent group
      for (const groupDep of dependencies.groupDependencies) {
        for (const [otherMigrationId] of allMigrations) {
          if (
            otherMigrationId.startsWith(`${groupDep}::`) &&
            otherMigrationId !== migrationId
          ) {
            const cycle = checkCircularDependencies(
              otherMigrationId,
              currentPath,
            );
            if (cycle) {
              return cycle;
            }
          }
        }
      }
    }

    visiting.delete(migrationId);
    processed.add(migrationId);
    return null;
  }

  function checkSelfAndGroupDependencies(migrationId: string): void {
    const dependencies = dependencyGraph.migrationDependencies.get(migrationId);
    if (!dependencies) return;

    const migrationInfo = allMigrations.get(migrationId);
    if (!migrationInfo) return;

    const currentGroupId = migrationInfo.group;

    // Check for self-dependency
    for (const dep of dependencies.migrationDependencies) {
      if (dep === migrationId) {
        errors.push({
          type: "circular",
          message: `Migration ${migrationId} depends on itself`,
          cycle: [migrationId, migrationId],
          line: migrationInfo.migration.startLine,
        });
      }
    }

    // Check for dependency on own group
    for (const groupDep of dependencies.groupDependencies) {
      if (groupDep === currentGroupId) {
        errors.push({
          type: "circular",
          message: `Migration ${migrationId} depends on its own group ${currentGroupId}`,
          cycle: [migrationId, currentGroupId],
          line: migrationInfo.migration.startLine,
        });
      }
    }
  }

  function validateDependencies(): void {
    for (const [migrationId, deps] of dependencyGraph.migrationDependencies) {
      if (!allMigrations.has(migrationId)) {
        continue;
      }

      // Check migration dependencies
      for (const dep of deps.migrationDependencies) {
        if (!allMigrations.has(dep)) {
          errors.push({
            type: "missing",
            message: `Migration ${migrationId} depends on missing migration ${dep}`,
            dependency: dep,
            dependentId: migrationId,
            line: allMigrations.get(migrationId)?.migration.startLine || 0,
          });
        }
      }

      // Check group dependencies
      for (const groupDep of deps.groupDependencies) {
        if (!allGroups.has(groupDep)) {
          errors.push({
            type: "missing",
            message: `Migration ${migrationId} depends on missing group ${groupDep}`,
            dependency: groupDep,
            dependentId: migrationId,
            line: allMigrations.get(migrationId)?.migration.startLine || 0,
          });
        }
      }
    }
  }

  function topologicalSort(): void {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, Set<string>>();

    // Initialize in-degree and adjacency list for all migrations
    for (const migrationId of allMigrations.keys()) {
      inDegree.set(migrationId, 0);
      adjList.set(migrationId, new Set());
    }

    // Build the dependency graph for migrations
    for (const [migrationId, deps] of dependencyGraph.migrationDependencies) {
      if (!allMigrations.has(migrationId)) {
        continue;
      }

      // Process direct migration dependencies
      for (const dep of deps.migrationDependencies) {
        if (allMigrations.has(dep)) {
          adjList.get(dep)?.add(migrationId);
          inDegree.set(migrationId, (inDegree.get(migrationId) || 0) + 1);
        }
      }

      // Process group dependencies - all migrations in the group must run before this migration
      for (const groupDep of deps.groupDependencies) {
        for (const [otherMigrationId] of allMigrations) {
          if (
            otherMigrationId.startsWith(`${groupDep}::`) &&
            otherMigrationId !== migrationId
          ) {
            adjList.get(otherMigrationId)?.add(migrationId);
            inDegree.set(migrationId, (inDegree.get(migrationId) || 0) + 1);
          }
        }
      }
    }

    // Process group-level dependencies
    for (const [groupId, deps] of dependencyGraph.groupDependencies) {
      if (!allGroups.has(groupId)) {
        continue;
      }

      // Find all migrations that belong to this group
      const groupMigrations = Array.from(allMigrations.keys()).filter((id) =>
        id.startsWith(`${groupId}::`),
      );

      // For each migration in this group, add dependencies from group-level deps
      for (const groupMigration of groupMigrations) {
        // Group depends on specific migrations
        for (const dep of deps.migrationDependencies) {
          if (allMigrations.has(dep)) {
            adjList.get(dep)?.add(groupMigration);
            inDegree.set(
              groupMigration,
              (inDegree.get(groupMigration) || 0) + 1,
            );
          }
        }

        // Group depends on other groups
        for (const groupDep of deps.groupDependencies) {
          for (const [otherMigrationId] of allMigrations) {
            if (
              otherMigrationId.startsWith(`${groupDep}::`) &&
              otherMigrationId !== groupMigration
            ) {
              adjList.get(otherMigrationId)?.add(groupMigration);
              inDegree.set(
                groupMigration,
                (inDegree.get(groupMigration) || 0) + 1,
              );
            }
          }
        }
      }
    }

    // Kahn's algorithm for topological sorting
    const queue: string[] = [];

    for (const [migrationId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(migrationId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift() ?? "";
      const migrationInfo = allMigrations.get(current);

      if (migrationInfo) {
        organizedMigrations.push({
          id: current,
          migration: migrationInfo.migration,
          group: migrationInfo.group,
        });
      }

      for (const neighbor of adjList.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check if all migrations were processed (no cycles)
    if (organizedMigrations.length !== allMigrations.size) {
      const unprocessed = Array.from(allMigrations.keys()).filter(
        (id) => !organizedMigrations.some((om) => om.id === id),
      );

      errors.push({
        type: "circular",
        message: `Circular dependency detected among migrations: ${unprocessed.join(", ")}`,
        cycle: unprocessed,
        line: 0,
      });
    }
  }

  // Collect all migrations and groups
  collectMigrations(rootGroup);

  // console.log('=== DEBUG: organizeMigrations Collection ===');
  // console.log('All migrations collected:');
  // Array.from(allMigrations.keys()).sort().forEach(id => console.log(`  ${id}`));
  // console.log('All groups collected:');
  // Array.from(allGroups).sort().forEach(id => console.log(`  ${id}`));
  // console.log('=== END DEBUG ===');

  // Validate that all dependencies exist
  validateDependencies();

  // Check for self-dependencies and group self-dependencies
  for (const migrationId of allMigrations.keys()) {
    checkSelfAndGroupDependencies(migrationId);

    // Check for circular dependencies
    const cycle = checkCircularDependencies(migrationId);
    if (cycle) {
      errors.push({
        type: "circular",
        message: `Circular dependency detected: ${cycle.join(" -> ")}`,
        cycle,
        line: allMigrations.get(migrationId)?.migration.startLine || 0,
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  // Perform topological sort
  topologicalSort();

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    migrations: organizedMigrations,
  };
}
