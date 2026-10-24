import pg from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { validateRuntime } from './config.mjs';
import {runtimeHostMetadata} from './production-target.mjs';

let stage = 'configuration';
try {
  validateRuntime();
  const verifiedHost=runtimeHostMetadata(process.env.DATABASE_URL);
  stage = 'PostgreSQL TLS connection and read-only query';
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15_000, query_timeout: 15_000 });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query('SELECT 1 AS ok');
    if (result.rows[0]?.ok !== 1) throw new Error();
    const privileges = await client.query(`SELECT current_user = 'world_pulse_app' AS runtime_role,
      has_schema_privilege(current_user, 'world_pulse', 'USAGE') AS can_use,
      has_schema_privilege(current_user, 'world_pulse', 'CREATE') AS can_create,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public`);
    const p = privileges.rows[0];
    if (!p.runtime_role || !p.can_use || p.can_create || p.can_create_public) throw new Error();
    await client.query('ROLLBACK');
  } finally { await client.end(); }
  console.log('PostgreSQL: TLS connection, read-only query and restricted runtime role OK');
  console.log(`Verified production runtime host: ${verifiedHost}`); // Non-secret metadata, after TLS/role verification only.

  stage = 'R2 write/read/delete probe';
  const s3 = new S3Client({
    region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    requestHandler: { connectionTimeout: 15_000, requestTimeout: 30_000 }, maxAttempts: 2,
  });
  const object = { Bucket: process.env.R2_BUCKET_NAME, Key: `_infra-check/${randomUUID()}.txt` };
  try {
    await s3.send(new PutObjectCommand({ ...object, Body: 'world-pulse-infrastructure-probe', ContentType: 'text/plain' }));
    const response = await s3.send(new GetObjectCommand(object));
    if (await response.Body.transformToString() !== 'world-pulse-infrastructure-probe') throw new Error();
  } finally {
    try { await s3.send(new DeleteObjectCommand(object)); } finally { s3.destroy(); }
  }
  console.log('R2: private object write/read/delete OK');
} catch {
  // Driver errors may contain connection strings or account information.
  console.error(`Infrastructure check failed: ${stage}. Inspect provider configuration; credentials suppressed.`);
  process.exitCode = 1;
}
