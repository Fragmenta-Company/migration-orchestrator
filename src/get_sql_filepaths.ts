import { readdirSync, type Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';

const directoryRegex = /^[0-9]{3}-[a-zA-Z0-9-_]+$/;
const fileRegex = /^[0-9]{3}-[a-zA-Z0-9-_]+\.sql$/;

export default async function getSqlFilePaths(root_directory: string): Promise<Dirent<string>[]> {
  const files = await fs.readdir(root_directory, {
    withFileTypes: true,
  });

  const allFiles = 
    (await Promise.all(files.sort((a, b) => a.name.localeCompare(b.name))
      .filter(file => {
        if(file.isDirectory()) {
          return directoryRegex.test(file.name);
        } else if(file.isFile()) {
          return fileRegex.test(file.name);
        }
      })
      .map(file => {
        const filePath = path.join(root_directory, file.name);
        if (file.isDirectory()) {
          return getSqlFilePaths(filePath);
        } else {
          return file;
        }
      })))
      .flat()
      .filter(f => f.isFile());

  const fileNames = new Map<string, Set<string>>();
  const dirNames = new Map<string, Set<string>>();

  // Step 1: Process files
  allFiles.forEach(file => {
    const match = file.name.match(/^(\d{3})-/);
    if (!match?.[1]) {
      throw new Error(`File name does not match expected pattern: ${file}`);
    }

    const number = match[1].padStart(3, '0');

    if (!fileNames.has(file.parentPath)) {
      fileNames.set(file.parentPath, new Set());
    }

    const numbersSet = fileNames.get(file.parentPath)!;
    if (numbersSet.has(number)) {
      throw new Error(`Duplicate number found in directory ${file.parentPath}: ${number}`);
    }

    numbersSet.add(number);
  });

  // Step 2: Process directories for potential migration steps
  fileNames.forEach((_, directory) => {
    const entries = readdirSync(directory, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^(\d{3})-/);
        if (match?.[1]) {
          const number = match[1].padStart(3, '0');
          if (!dirNames.has(directory)) {
            dirNames.set(directory, new Set());
          }
          dirNames.get(directory)!.add(number);
        }
      }
    });
  });

  // Step 3: Conflict detection between file-based and dir-based steps
  fileNames.forEach((fileSet, directory) => {
    const dirSet = dirNames.get(directory) ?? new Set();

    for (const number of fileSet) {
      if (dirSet.has(number)) {
        throw new Error(`Conflict in ${directory}: migration step ${number} exists as both file and directory`);
      }
    }
  });

  return allFiles;
}
