import test from 'node:test';
import assert from 'node:assert/strict';
import { addTimeCredit, remainingTimeMs, creditSelectedTag } from '../src/timeCredit.ts';

const start = 1_000_000;
test('eight hours keep decreasing offline and can be topped up at 32 minutes remaining', () => {
  const initial = addTimeCredit(null, 8 * 3600, start);
  const returnedAt = start + (8 * 3600 - 32 * 60) * 1000;
  assert.equal(remainingTimeMs(initial, returnedAt), 32 * 60 * 1000);
  const toppedUp = addTimeCredit(initial, 60, returnedAt);
  assert.equal(remainingTimeMs(toppedUp, returnedAt), 33 * 60 * 1000);
  assert.equal(toppedUp.secondsCreditedTotal, 8 * 3600 + 60);
  assert.equal(initial.secondsCreditedTotal, 8 * 3600);
});
test('expired time never becomes negative; a new tap starts a fresh second, preserving history', () => {
  const initial = addTimeCredit(null, 10, start);
  assert.equal(remainingTimeMs(initial, start + 10_000), 0);
  assert.equal(remainingTimeMs(initial, start + 90_000), 0);
  const revived = addTimeCredit(initial, 1, start + 90_000);
  assert.equal(remainingTimeMs(revived, start + 90_000), 1000);
  assert.equal(revived.secondsCreditedTotal, 11);
});
test('multiple hashtags remain active while only the selected tag receives new credit', () => {
  const a = addTimeCredit(null, 100, start);
  const original = { a };
  const withB = creditSelectedTag(original, 'b', 20, start + 10_000);
  assert.equal(withB.a, a);
  assert.equal(remainingTimeMs(withB.a, start + 15_000), 85_000);
  assert.equal(remainingTimeMs(withB.b, start + 15_000), 15_000);
  const backToA = creditSelectedTag(withB, 'a', 5, start + 15_000);
  assert.equal(remainingTimeMs(backToA.a, start + 15_000), 90_000);
  assert.equal(backToA.b, withB.b);
  assert.equal(creditSelectedTag(backToA, null, 1, start), backToA);
});
test('invalid credit and unsafe timestamps cannot silently overflow the balance', () => {
  for (const count of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => addTimeCredit(null, count, start), RangeError);
  }
  assert.throws(() => addTimeCredit(null, 1, -1), RangeError);
  assert.throws(() => addTimeCredit(null, 1, Number.MAX_SAFE_INTEGER), RangeError);
});
