import {readFile} from 'node:fs/promises';
import {pathsFor,assertHealthyBurst} from './capacity-model.mjs';
try{
  const profile=process.argv[2];pathsFor(profile);
  const report=JSON.parse(await readFile(new URL(`../test-artifacts/capacity-${profile}-burst.json`,import.meta.url),'utf8'));
  if(report.configuration.profile!==profile)throw new Error();
  assertHealthyBurst(report);
  console.log('Every cold-cache burst request returned 200; budget configuration is recorded in the artifact.');
}catch{console.error('Cold-cache burst regression: inspect aggregate benchmark artifact.');process.exitCode=1;}
