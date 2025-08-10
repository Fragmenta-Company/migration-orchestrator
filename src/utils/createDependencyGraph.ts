import type MigrationGroup from "../models/MigrationGroup.js";

export default function createDependencyGraph(
  rootGroup: MigrationGroup
): {
  migrationDependencies: Map<string, {
    migrationDependencies: Set<string>;
    groupDependencies: Set<string>;
  }>;
  groupDependencies: Map<string, {
    migrationDependencies: Set<string>;
    groupDependencies: Set<string>;
  }>;
} {
  const migrationDependencies = new Map<string, {
    migrationDependencies: Set<string>;
    groupDependencies: Set<string>;
  }>();
  const groupDependencies = new Map<string, {
    migrationDependencies: Set<string>;
    groupDependencies: Set<string>;
  }>();
  
  // Collect all migrations and groups with their unique IDs
  const migrationNameToId = new Map<string, string>();
  const groupNameToId = new Map<string, string>();
  
  // Extract the base migrations directory from the root group
  let baseMigrationsPath = "";
  
  function extractBasePath(group: MigrationGroup) {
    const fullPath = group.name;
    const pathParts = fullPath.split('/');
    const migrationsIndex = pathParts.findIndex(part => part === 'migrations');
    
    if (migrationsIndex !== -1) {
      baseMigrationsPath = pathParts.slice(0, migrationsIndex + 2).join('/');
    }
  }
  
  function normalizePath(path: string): string {
    const isAbsolute = path.startsWith('/');
    const parts = path.split('/');
    const normalized: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        if (normalized.length > 0 && normalized[normalized.length - 1] !== '..') {
          normalized.pop();
        } else if (!isAbsolute) {
          normalized.push('..');
        }
      } else if (part !== '.' && part !== '') {
        normalized.push(part);
      }
    }
    
    const result = normalized.join('/');
    return isAbsolute ? `/${result}` : result;
  }
  
  function collectIds(group: MigrationGroup, parentPath: string = "") {
    if (!baseMigrationsPath) {
      extractBasePath(group);
    }
    
    const groupId = parentPath ? `${parentPath}::${group.name}` : group.name;
    
    // Always collect group names to IDs for ALL groups (including nested ones)
    groupNameToId.set(group.name, groupId);
    
    // Only collect migrations from the deepest level (prioritize nested groups over file-level)
    // If a migration exists in a nested group, don't collect it from the parent file-level group
    for (const migrationInfo of group) {
      const migrationId = `${groupId}::${migrationInfo.migrationName}`;
      
      // Only add if this migration name hasn't been collected from a deeper level
      if (!migrationNameToId.has(migrationInfo.migrationName)) {
        migrationNameToId.set(migrationInfo.migrationName, migrationId);
      }
    }
    
    // Process nested groups FIRST to ensure they take priority
    for (const nestedGroup of group.groups) {
      collectIds(nestedGroup, groupId);
    }
    
    // After processing nested groups, re-check migrations from current level
    // If a migration was already collected from a nested group, remove it from current level
    for (const migrationInfo of group) {
      const migrationId = `${groupId}::${migrationInfo.migrationName}`;
      const existingId = migrationNameToId.get(migrationInfo.migrationName);
      
      // If the existing ID is from a deeper level (more :: separators), keep the deeper one
      if (existingId && existingId !== migrationId) {
        const existingDepth = existingId.split('::').length;
        const currentDepth = migrationId.split('::').length;
        
        if (currentDepth > existingDepth) {
          // Current is deeper, replace the existing
          migrationNameToId.set(migrationInfo.migrationName, migrationId);
        }
        // Otherwise keep the existing (deeper) one
      }
    }
  }
  
  function constructAbsolutePath(relativePath: string, currentGroupPath: string): string {
    // Extract the file path from the group path, ignoring nested group names
    const pathParts = currentGroupPath.split('::');
    
    // Find the first part that looks like a file path (contains '/' and ends with file extension)
    let filePart = '';
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (part?.includes('/') && (part.includes('.sql') || part.includes('.js') || part.includes('.ts'))) {
        filePart = part;
        break;
      }
    }
    
    // If we found a file part, use its directory; otherwise use the last meaningful path part
    let currentDir = '';
    if (filePart) {
      currentDir = filePart.split('/').slice(0, -1).join('/');
    } else {
      // Fallback: use the last path part that contains '/'
      for (let i = pathParts.length - 1; i >= 1; i--) {
        const part = pathParts[i];
        if (part?.includes('/')) {
          currentDir = part.split('/').slice(0, -1).join('/');
          break;
        }
      }
    }
    
    let resolvedPath: string;
    
    if (relativePath.startsWith('../') || relativePath.startsWith('./')) {
      const combinedPath = `${currentDir}/${relativePath}`;
      resolvedPath = normalizePath(combinedPath);
    } else if (relativePath.includes('/')) {
      resolvedPath = `${baseMigrationsPath}/${relativePath}`;
    } else {
      resolvedPath = `${currentDir}/${relativePath}`;
    }
    
    return resolvedPath;
  }
  
  function resolveDependencyId(dep: string, currentGroupPath: string, isGroupDependency: boolean = false): string {
    if (dep.startsWith('::')) {
      const relativeParts = dep.substring(2).split('::');
      const rootPart = currentGroupPath.split('::')[0];
      
      if (relativeParts.length === 1) {
        const relativePath = relativeParts[0];
        const absolutePath = constructAbsolutePath(relativePath!, currentGroupPath);
        return `${rootPart}::${absolutePath}`;
      } else if (relativeParts.length === 2) {
        const [relativePath, migrationName] = relativeParts;
        const absolutePath = constructAbsolutePath(relativePath!, currentGroupPath);
        return `${rootPart}::${absolutePath}::${migrationName}`;
      } else {
        const fullRelativePath = relativeParts.slice(0, -1).join('/');
        const migrationName = relativeParts[relativeParts.length - 1];
        const absolutePath = constructAbsolutePath(fullRelativePath, currentGroupPath);
        return `${rootPart}::${absolutePath}::${migrationName}`;
      }
    }
    
    // For simple names (no :: prefix), resolve based on dependency type
    if (isGroupDependency) {
      // For group dependencies, ONLY look for groups
      const groupId = groupNameToId.get(dep);
      if (groupId) {
        return groupId;
      }
    } else {
      // For migration dependencies, check migrations first, then groups
      const migrationId = migrationNameToId.get(dep);
      if (migrationId) {
        return migrationId;
      }
      
      const groupId = groupNameToId.get(dep);
      if (groupId) {
        return groupId;
      }
    }
    
    if (dep.startsWith('/') && !dep.includes('::')) {
      const absolutePath = `${baseMigrationsPath}${dep}`;
      const rootPart = currentGroupPath.split('::')[0];
      return `${rootPart}::${absolutePath}`;
    }
    
    return dep;
  }
  
  function processGroup(group: MigrationGroup, parentPath: string = "") {
    const groupId = parentPath ? `${parentPath}::${group.name}` : group.name;
    
    // Process ALL groups, not just file-level ones
    const isActualFile = group.name.includes('/') && !group.name.startsWith('root');
    const isNestedGroup = parentPath && !isActualFile;
    const isRootGroup = !parentPath && group.name === 'root';
    
    // Skip processing migrations from root group to avoid duplicates
    if (!isRootGroup) {
      if (isActualFile || isNestedGroup) {
        if (!groupDependencies.has(groupId)) {
          groupDependencies.set(groupId, {
            migrationDependencies: new Set<string>(),
            groupDependencies: new Set<string>()
          });
        }

        // Process group-level dependencies
        for (const dep of group.groupDependencies) {
          const depId = resolveDependencyId(dep, groupId, true); // true = isGroupDependency
          groupDependencies.get(groupId)?.groupDependencies.add(depId);
        }

        for (const dep of group.migrationDependencies) {
          const depId = resolveDependencyId(dep, groupId, false); // false = isMigrationDependency
          groupDependencies.get(groupId)?.migrationDependencies.add(depId);
        }
      }

      // Process individual migrations - only those that match the canonical ID
      for (const migrationInfo of group) {
        const migrationId = `${groupId}::${migrationInfo.migrationName}`;
        const canonicalId = migrationNameToId.get(migrationInfo.migrationName);
        
        // Only process this migration if this is its canonical location
        if (canonicalId === migrationId) {
          if (!migrationDependencies.has(migrationId)) {
            migrationDependencies.set(migrationId, {
              migrationDependencies: new Set<string>(),
              groupDependencies: new Set<string>()
            });
          }

          for (const dep of migrationInfo.migration.migrationDependencies) {
            const depId = resolveDependencyId(dep, groupId, false); // false = isMigrationDependency
            migrationDependencies.get(migrationId)?.migrationDependencies.add(depId);
          }

          for (const dep of migrationInfo.migration.groupDependencies) {
            const depId = resolveDependencyId(dep, groupId, true); // true = isGroupDependency
            migrationDependencies.get(migrationId)?.groupDependencies.add(depId);
          }
        }
      }
    }

    // Always recurse into nested groups
    for (const nestedGroup of group.groups) {
      processGroup(nestedGroup, groupId);
    }
  }

  // First collect all IDs (this will prioritize deeper nested groups)
  collectIds(rootGroup);
  
  // Then process dependencies
  processGroup(rootGroup);

  return { migrationDependencies, groupDependencies };
}
