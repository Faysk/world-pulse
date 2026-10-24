import test from 'node:test';
import assert from 'node:assert/strict';
import { TapGestureGuard, MAX_TAP_MS, MAX_CLICK_AFTER_RELEASE_MS } from '../src/tapGesture.ts';

const input = (id, x, y, at, pointerType = 'mouse') => ({ id, x, y, at, pointerType });

test('Short stationary mouse click credits exactly once', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(1, 100, 100, 10));
  guard.pointerUp(input(1, 100, 100, 80));
  assert.equal(guard.consumeClick(100, 100, 95), true);
  assert.equal(guard.consumeClick(100, 100, 96), false, 'double delivery must not duplicate');
});

test('A touch tap allows natural jitter but not a drag', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(5, 200, 200, 100, 'touch'));
  guard.pointerMove(input(5, 210, 202, 120, 'touch'));
  guard.pointerUp(input(5, 211, 203, 160, 'touch'));
  assert.equal(guard.consumeClick(211, 203, 180), true);

  guard.pointerDown(input(5, 200, 200, 300, 'touch'));
  guard.pointerMove(input(5, 250, 240, 320, 'touch'));
  guard.pointerUp(input(5, 250, 240, 360, 'touch'));
  assert.equal(guard.consumeClick(250, 240, 400), false);
});

test('Even if motion events are missed, a displaced release is not a tap', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(1, 15, 15, 1));
  guard.pointerUp(input(1, 160, 160, 18));
  assert.equal(guard.consumeClick(160, 160, 21), false);
});

test('A second finger invalidates the whole pinch sequence', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(1, 100, 100, 0, 'touch'));
  guard.pointerDown(input(2, 200, 200, 20, 'touch'));
  guard.pointerUp(input(2, 202, 203, 60, 'touch'));
  guard.pointerUp(input(1, 100, 100, 80, 'touch'));
  assert.equal(guard.consumeClick(100, 100, 90), false);
  guard.pointerDown(input(3, 100, 100, 100, 'touch'));
  guard.pointerUp(input(3, 100, 100, 150, 'touch'));
  assert.equal(guard.consumeClick(100, 100, 190), true);
});

test('Wheel / map-camera motion invalidates a pending click', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(1, 0, 0, 5));
  guard.invalidate();
  guard.pointerUp(input(1, 0, 0, 15));
  assert.equal(guard.consumeClick(0, 0, 20), false);
  guard.pointerDown(input(1, 0, 0, 30));
  guard.pointerUp(input(1, 0, 0, 60));
  guard.invalidate();
  assert.equal(guard.consumeClick(0, 0, 65), false);
});

test('Canceled gestures and long-presses never credit', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(1, 0, 0, 5));
  guard.pointerCancel(1);
  guard.pointerUp(input(1, 0, 0, 20));
  assert.equal(guard.consumeClick(0, 0, 30), false);
  guard.pointerDown(input(1, 0, 0, 100));
  guard.pointerUp(input(1, 0, 0, 100 + MAX_TAP_MS + 1));
  assert.equal(guard.consumeClick(0, 0, 100 + MAX_TAP_MS + 10), false);
});

test('Stale, unmatched or unpaired synthetic clicks are ignored', () => {
  const guard = new TapGestureGuard();
  assert.equal(guard.consumeClick(10, 10, 50), false);
  guard.pointerDown(input(1, 40, 40, 100));
  guard.pointerUp(input(1, 40, 40, 130));
  assert.equal(guard.consumeClick(80, 80, 135), false);
  guard.pointerDown(input(1, 40, 40, 200));
  guard.pointerUp(input(1, 40, 40, 240));
  assert.equal(guard.consumeClick(40, 40, 240 + MAX_CLICK_AFTER_RELEASE_MS + 1), false);
});

test('An eligible click cannot be consumed during another pointer gesture', () => {
  const guard = new TapGestureGuard();
  guard.pointerDown(input(1, 0, 0, 5));
  assert.equal(guard.consumeClick(0, 0, 10), false);
  guard.pointerUp(input(1, 0, 0, 20));
  assert.equal(guard.consumeClick(0, 0, 22), true);
});
