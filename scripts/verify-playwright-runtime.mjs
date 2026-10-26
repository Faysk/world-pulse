import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url);let browser;
try{
  const project=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const version=require('@playwright/test/package.json').version;
  if(version!==project.devDependencies['@playwright/test']||version!==process.env.PLAYWRIGHT_IMAGE_VERSION)throw new Error('version_mismatch');
  const executable=chromium.executablePath();
  if(!executable.startsWith('/ms-playwright/'))throw new Error('unexpected_browser_path');
  await access(executable);
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage();
  const webgl=await page.evaluate(()=>Boolean(document.createElement('canvas').getContext('webgl2')));
  if(!webgl)throw new Error('webgl_unavailable');
  console.log(`Pinned Playwright ${version}, bundled Chromium ${browser.version()} and software WebGL2 verified.`);
}catch{console.error('Pinned Playwright runtime verification failed: check image/package/browser compatibility and WebGL.');process.exitCode=1;}
finally{await browser?.close();}
