import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_REGIONS } from '../src/gta6LaunchSchedule.ts';
import {
  GTA6_UNLOCK_MOMENTS, buildUnlockMoments, crossedUnlockMoments, geographicCenter
} from '../src/gta6CameraMoments.ts';

test('Camera moments group simultaneous releases instead of revisiting each store', () => {
  const groups = buildUnlockMoments(RELEASE_REGIONS);
  assert.equal(groups.length, new Set(RELEASE_REGIONS.map(r => Date.parse(r.unlockAt))).size);
  assert.ok(groups.length > 12);
  assert.deepEqual(groups.map(g => g.at), [...groups.map(g => g.at)].sort((a,b) => a-b));
  assert.equal(groups.reduce((sum, group) => sum + group.regions.length, 0), RELEASE_REGIONS.length);
});

test('USA and Canada share one verified camera moment, not separate time-zone flyovers', () => {
  const at = Date.parse('2026-11-19T05:00:00Z');
  const moment = GTA6_UNLOCK_MOMENTS.find(g => g.at === at);
  assert.ok(moment);
  assert.equal(moment.verified, true);
  assert.deepEqual([...moment.codes].sort(), ['CA','US']);
  assert.match(moment.title, /Canadá/);
  assert.match(moment.title, /Estados Unidos/);
  assert.ok(moment.center[0] < -90 && moment.center[0] > -120);
  assert.ok(moment.center[1] > 25 && moment.center[1] < 65);
});

test('Brazil joins other real simultaneous South American markets in one focus', () => {
  const at=Date.parse('2026-11-19T03:00:00Z');
  const moment=GTA6_UNLOCK_MOMENTS.find(g=>g.at===at);
  assert.ok(moment);
  assert.ok(moment.codes.includes('BR'),moment.codes.join(','));
  assert.ok(moment.codes.includes('CL'),moment.codes.join(','));
  assert.equal(moment.verified,true);
});

test('Geographic center is safe near the antimeridian', () => {
  const center=geographicCenter([[179,0],[-179,0]]);
  assert.ok(Math.abs(center[0])>178);
  assert.ok(Math.abs(center[1])<1);
});

test('Moment detection only emits newly crossed timestamps (no initial-page replay)', () => {
  const a=GTA6_UNLOCK_MOMENTS[0], b=GTA6_UNLOCK_MOMENTS[1];
  assert.equal(crossedUnlockMoments(GTA6_UNLOCK_MOMENTS,a.at,a.at).length,0);
  assert.deepEqual(crossedUnlockMoments(GTA6_UNLOCK_MOMENTS,a.at-1,a.at).map(m=>m.at),[a.at]);
  assert.deepEqual(crossedUnlockMoments(GTA6_UNLOCK_MOMENTS,a.at,b.at).map(m=>m.at),[b.at]);
  assert.deepEqual(crossedUnlockMoments(GTA6_UNLOCK_MOMENTS,b.at,a.at),[]);
  assert.deepEqual(crossedUnlockMoments(GTA6_UNLOCK_MOMENTS,NaN,b.at),[]);
});
