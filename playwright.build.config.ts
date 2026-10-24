import { defineConfig,devices } from '@playwright/test';
export default defineConfig({testDir:'./tests/build-browser',outputDir:'test-results-build-gate',workers:1,timeout:45000,expect:{timeout:15000},reporter:'list',
  use:{...devices['Desktop Chrome'],launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}},
  projects:[{name:'production',use:{baseURL:'http://127.0.0.1:4175'}},{name:'preview',use:{baseURL:'http://127.0.0.1:4176'}}],
  webServer:[
    {command:'npx vite build --outDir dist-gate-production && npx vite preview --outDir dist-gate-production --host 127.0.0.1 --port 4175 --strictPort',url:'http://127.0.0.1:4175',env:{VERCEL_ENV:'production',WP_PREVIEW_UI:'true'},timeout:60000,reuseExistingServer:false},
    {command:'npx vite build --outDir dist-gate-preview && npx vite preview --outDir dist-gate-preview --host 127.0.0.1 --port 4176 --strictPort',url:'http://127.0.0.1:4176',env:{VERCEL_ENV:'preview',WP_PREVIEW_UI:'true'},timeout:60000,reuseExistingServer:false}
  ]
});
