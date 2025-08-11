import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export default async function getSqlFilePaths(
  root_directory: string,
): Promise<Dirent[]> {
  const files = await fs.readdir(root_directory, {
    withFileTypes: true,
  });

  const allFiles = (
    await Promise.all(
      files
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((file) => {
          const filePath = path.join(root_directory, file.name);
          if (file.isDirectory()) {
            return getSqlFilePaths(filePath);
          } else {
            return file;
          }
        }),
    )
  )
    .flat()
    .filter((f) => f.isFile());

  return allFiles;
}
