import test from 'node:test';
import assert from 'node:assert/strict';
import { previewUiBuildEnabled,alphaUiBuildEnabled } from '../build/preview-gate.mjs';

test('real experience build requires both an explicit flag and preview target',()=>{
  assert.equal(previewUiBuildEnabled({}),false);
  assert.equal(previewUiBuildEnabled({WP_PREVIEW_UI:'true'}),false);
  assert.equal(previewUiBuildEnabled({VERCEL_ENV:'production',WP_PREVIEW_UI:'true'}),false);
  assert.equal(previewUiBuildEnabled({VERCEL_ENV:'preview',WP_PREVIEW_UI:'false'}),false);
  assert.equal(previewUiBuildEnabled({VERCEL_ENV:'preview',WP_PREVIEW_UI:'true'}),true);
});
test('alpha root experience requires a separate literal production opt-in',()=>{
  for(const env of [{},{WP_ALPHA_RELEASE:'true'},{VERCEL_ENV:'production',WP_PREVIEW_UI:'true'},
    {VERCEL_ENV:'preview',WP_ALPHA_RELEASE:'true'},{VERCEL_ENV:'production',WP_ALPHA_RELEASE:'1'}])assert.equal(alphaUiBuildEnabled(env),false);
  assert.equal(alphaUiBuildEnabled({VERCEL_ENV:'production',WP_ALPHA_RELEASE:'true'}),true);
});
