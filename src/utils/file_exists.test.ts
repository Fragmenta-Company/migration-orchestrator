import { describe, expect, test } from "vitest";
import file_exists from "./file_exists.js";

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

describe("file_exists", () => {
  test("Should return true for an existing file", async () => {
    const result = await file_exists(__filename);
    expect(result).toBe(true);
  })

  test("Should return false for a non-existing file", async () => {
    const result = await file_exists("non_existing_file.txt");
    expect(result).toBe(false);
  })
})
