import test from 'node:test';
import assert from 'node:assert/strict';
import { previewUiBuildEnabled } from '../build/preview-gate.mjs';

test('real experience build requires both an explicit flag and preview target',()=>{
  assert.equal(previewUiBuildEnabled({}),false);
  assert.equal(previewUiBuildEnabled({WP_PREVIEW_UI:'true'}),false);
  assert.equal(previewUiBuildEnabled({VERCEL_ENV:'production',WP_PREVIEW_UI:'true'}),false);
  assert.equal(previewUiBuildEnabled({VERCEL_ENV:'preview',WP_PREVIEW_UI:'false'}),false);
  assert.equal(previewUiBuildEnabled({VERCEL_ENV:'preview',WP_PREVIEW_UI:'true'}),true);
});
