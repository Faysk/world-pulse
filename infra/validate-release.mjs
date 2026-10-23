import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function validateRelease(root) {
  let app, lock;
  try {
    app = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  } catch {
    throw new Error('Release requires application package.json and committed package-lock.json in main.');
  }
  if (!app.scripts?.test || !app.scripts?.build) {
    throw new Error('Release requires application test and build scripts.');
  }
  if (!lock.lockfileVersion || !lock.packages?.['']) {
    throw new Error('Release requires a current npm lockfile; regenerate and commit it.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await validateRelease(process.cwd()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
