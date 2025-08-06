import { access, constants } from 'fs/promises';

export default async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
