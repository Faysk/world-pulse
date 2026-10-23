import { appendFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { required } from './config.mjs';
import { validateRelease } from './validate-release.mjs';
import { stagedRelease, smokeStaticSite, SmokeCheckError } from './staged-release.mjs';
import { vercelApi } from './vercel-api.mjs';

let lastStage = 'Initial release validation';
try {
  required(['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'GITHUB_SHA', 'GITHUB_REPOSITORY_ID']);
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error();
  await validateRelease(process.cwd());
  const { VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID } = process.env;
  const api = vercelApi({ token: VERCEL_TOKEN, team: VERCEL_ORG_ID });
  const id = await stagedRelease({ api, smoke: smokeStaticSite, sha: process.env.GITHUB_SHA,
    project: VERCEL_PROJECT_ID, repo: process.env.GITHUB_REPOSITORY_ID, pause: setTimeout,
    receipt: id => console.log(`Staged production deployment: ${id}`),
    progress: message => { lastStage = message; console.log(message); },
  });
  console.log(`Deployment ${id} tested before promotion; production confirmed and HTTPS/assets passed.`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `Deployment: ${id}\n\nCommit: ${process.env.GITHUB_SHA}\n\nStaged HTML/JS/CSS smoke passed before promotion. Temporary access revoked.\n\n[Production](https://map.faysk.dev)\n`);
} catch (error) {
  // Fetch/driver errors and response bodies can contain temporary access credentials.
  console.error('Staged release failed. Inspect build, access, smoke and promotion status; private details suppressed. No promotion is requested unless candidate checks and access revocation pass.');
  // Stage messages are fixed strings authored in staged-release.mjs, never provider bodies.
  console.error(`Last safe release stage: ${lastStage}`);
  if (error instanceof SmokeCheckError) console.error(`Safe smoke failure: ${error.message}`);
  if (Number.isInteger(error?.providerStatus) && error.providerStatus >= 400 && error.providerStatus <= 599) {
    console.error(`Provider HTTP status: ${error.providerStatus}`);
  }
  process.exitCode = 1;
}
