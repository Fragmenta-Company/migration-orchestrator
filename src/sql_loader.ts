import fs from "fs/promises";
import fileExists from "./utils/file_exists.js";

export default class SqlLoader {

  private _sqlFiles: Map<string, string> = new Map();

  constructor() {}

  public static async create(filePaths: string[]): Promise<SqlLoader> {
    const loader = new SqlLoader();
    const results = await loader.loadSqlFiles(filePaths);

    results
      .filter(result => !result.success)
      .forEach(r => {
        console.warn(
          `Failed to load SQL file: ${r.fileName}\n`,
          r?.error?.message, r?.error?.stack
        );
      })
    
    return loader;
  }

  public get sqlFiles() {
    return this._sqlFiles;
  }

  private async loadSqlFiles(filePaths: string[]): Promise<{
    fileName: string;
    error?: {
      message: string;
      stack?: string | undefined;
    };
    success: boolean;
  }[]> {
    const results = await Promise.all(filePaths.map(async (filePath) => {
      const result = await this.loadSqlFile(filePath);
      return {
        fileName: filePath,
        ...result,
      };
    }));

    return results;
  }

  private async loadSqlFile(filePath: string): Promise<{
    success: boolean;
    error?: {
      message: string;
      stack?: string | undefined;
    };
  }> {
    try {
      const exist = await fileExists(filePath);
      if (!exist) {
        const errorMessage = `SQL file does not exist: ${filePath}`;
        console.error(errorMessage);
        return {
          success: false,
          error: {
            message: errorMessage,
          },
        };
      }

      const sqlContent = await fs.readFile(filePath, "utf-8");

      this._sqlFiles.set(
        filePath,
        sqlContent
      );

      return {
        success: true,
      }
    } catch (e) {
      console.error(`Error loading SQL file: ${filePath}`, e);
      return {
        success: false,
        error: {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        }
      };
    }
  }
}
