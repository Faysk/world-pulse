import test from 'node:test';
import assert from 'node:assert/strict';
import {tagInk,tagLabelStyle} from '../src/tagLabel.ts';
test('Low-contrast blue uses readable ink without changing its persistent identity color',()=>{
  const storedColor='#5d5de5';
  assert.equal(tagInk(storedColor),'#e6f3f4');
  assert.ok(tagLabelStyle(storedColor).borderInlineStart.includes(storedColor));
  assert.equal(storedColor,'#5d5de5');
  assert.equal(tagInk('#ffffff'),'#ffffff');assert.equal(tagInk('#ff9465'),'#ff9465');
  assert.equal(tagInk('#10212d'),'#e6f3f4');assert.equal(tagInk(undefined),'#e6f3f4');
  assert.equal(tagInk('invalid'),'#e6f3f4');
});
