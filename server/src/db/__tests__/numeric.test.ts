// server/src/db/__tests__/numeric.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { toNumber, toOptionalNumber } from '../numeric';

test('toNumber coerces valid numbers, numeric strings, and bigints', () => {
  assert.equal(toNumber('4.5'), 4.5);
  assert.equal(toNumber('75.25'), 75.25);
  assert.equal(toNumber(' 3.0 '), 3);
  assert.equal(toNumber('-0.5'), -0.5);
  assert.equal(toNumber(4.5), 4.5);
  assert.equal(toNumber(0), 0);
  assert.equal(toNumber(BigInt(42)), 42);
  assert.equal(typeof toNumber('4.0'), 'number');
  assert.equal(toNumber('4.5') + 0.5, 5);
});

test('toNumber rejects nullish, empty/whitespace strings, booleans, objects, and non-finite numbers', () => {
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined, 3.8), 3.8);
  assert.equal(toNumber('', 3.8), 3.8);
  assert.equal(toNumber('   ', 3.8), 3.8);
  assert.equal(toNumber('not-a-number', 0), 0);
  assert.equal(toNumber(true, 3.8), 3.8);
  assert.equal(toNumber(false, 3.8), 3.8);
  assert.equal(toNumber({}, 3.8), 3.8);
  assert.equal(toNumber([], 3.8), 3.8);
  assert.equal(toNumber(Number.NaN, 3.8), 3.8);
  assert.equal(toNumber(Number.POSITIVE_INFINITY, 3.8), 3.8);
  assert.equal(toNumber(Number.NEGATIVE_INFINITY, 3.8), 3.8);
});

test('toOptionalNumber returns finite number or undefined', () => {
  assert.equal(toOptionalNumber('4.5'), 4.5);
  assert.equal(toOptionalNumber(0), 0);
  assert.equal(toOptionalNumber(null), undefined);
  assert.equal(toOptionalNumber(undefined), undefined);
  assert.equal(toOptionalNumber(''), undefined);
  assert.equal(toOptionalNumber('   '), undefined);
  assert.equal(toOptionalNumber(true), undefined);
  assert.equal(toOptionalNumber(Number.NaN), undefined);
});
