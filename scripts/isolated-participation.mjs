// Test/development harness. Never imported by api/ or production builds.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createServer } from 'vite';
import { useTestPool } from '../server/store.mjs';
import { route } from '../server/handlers.mjs';

if (process.env.WP_ISOLATED_TEST !== '1' || process.env.DATABASE_URL || process.env.DATABASE_MIGRATION_URL) {
  throw new Error('Isolated harness requires explicit opt-in and refuses production database variables');
}
// Fixed loopback, database and disposable credentials: no arbitrary remote URL.
const owner = new pg.Pool({ connectionString: 'postgresql://postgres:local-only@127.0.0.1:5432/world_pulse_ci', ssl:false });
try {
  await owner.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='world_pulse_app') THEN CREATE ROLE world_pulse_app LOGIN PASSWORD 'local-only'; END IF; END $$");
  for (const name of ['0001-runtime-access.sql','0002-participation-core.sql','0003-time-balances.sql']) {
    await owner.query(await readFile(new URL('../infra/sql/'+name,import.meta.url),'utf8'));
  }
} finally { await owner.end(); }

const app = new pg.Pool({ connectionString: 'postgresql://world_pulse_app:local-only@127.0.0.1:5432/world_pulse_ci', ssl:false,max:4 });
process.env.NODE_ENV='test';
useTestPool(app);
process.env.NODE_ENV='development'; // HTTP/cookies accepted only in this loopback harness.
process.env.WP_API_ENABLED='true';
const handlers = Object.fromEntries(['session','tags','select','taps','ranking','activity','history'].map(kind=>['/api/'+kind,route(kind)]));

const server = await createServer({
  server:{host:'127.0.0.1',port:4174,strictPort:true},
  plugins:[{name:'isolated-participation-api',configureServer(vite){
    vite.middlewares.use(async(req,res,next)=>{
      const path=(req.url||'').split('?')[0];
      const handler=handlers[path];
      if(!handler) return next();
      let body='';
      for await(const chunk of req){
        body+=chunk.toString();
        if(Buffer.byteLength(body)>8192){res.statusCode=413;res.end();return;}
      }
      req.body=body;
      const response={
        setHeader:(name,value)=>res.setHeader(name,value),
        status(code){res.statusCode=code;return this;},
        end:value=>res.end(value)
      };
      await handler(req,response);
    });
  }}]
});
await server.listen();
console.log('Isolated participation: http://127.0.0.1:4174/?participationPreview=1 (disposable PostgreSQL only)');
for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await server.close();await app.end();process.exit(0);});
