import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests/staging-browser',workers:1,fullyParallel:false,timeout:180000,retries:0,expect:{timeout:20000},reporter:'list',
  use:{baseURL:'https://127.0.0.1:4178',ignoreHTTPSErrors:true,trace:'off',screenshot:'only-on-failure',
    launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['Pixel 7']}}],
  webServer:{command:'node scripts/staging-https-smoke.mjs',url:'https://127.0.0.1:4178',ignoreHTTPSErrors:true,reuseExistingServer:false,timeout:60000,stdout:'pipe',
    gracefulShutdown:{signal:'SIGTERM',timeout:30000}}
});
