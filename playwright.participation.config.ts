import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/participation-browser',workers:1,fullyParallel:false,
  timeout:90_000,retries:process.env.CI?1:0,
  expect:{timeout:15_000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:4174',screenshot:'only-on-failure',trace:'retain-on-failure',
    launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
    {name:'mobile',use:{...devices['Pixel 7']}}
  ],
  webServer:{command:'node scripts/isolated-participation.mjs',url:'http://127.0.0.1:4174',reuseExistingServer:false,timeout:30_000,
    env:{WP_ISOLATED_TEST:'1'}}
});
