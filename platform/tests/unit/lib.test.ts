import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode } from '../../src/lib/codes.ts';
import { formatDuration, parseDuration } from '../../src/lib/format.ts';

test('normalizeCode يقبل الصيغ المختلفة ويوحّدها', () => {
  assert.equal(normalizeCode('ALW-ABCD-EFGH-JKMN'), 'ALW-ABCD-EFGH-JKMN');
  assert.equal(normalizeCode('alw abcd efgh jkmn'), 'ALW-ABCD-EFGH-JKMN');
  assert.equal(normalizeCode('abcdefghjkmn'), 'ALW-ABCD-EFGH-JKMN');
});

test('normalizeCode يرفض الرموز الخاطئة', () => {
  assert.equal(normalizeCode(''), null);
  assert.equal(normalizeCode('ALW-ABCD-EFGH'), null);
  assert.equal(normalizeCode('ALW-ABCD-EFGH-JKM0'), null); // 0 غير مستخدم
  assert.equal(normalizeCode("ALW-ABCD-EFGH-JKMN' OR 1=1"), null);
});

test('parseDuration', () => {
  assert.equal(parseDuration('45'), 45 * 60);
  assert.equal(parseDuration('45:30'), 45 * 60 + 30);
  assert.equal(parseDuration('1:05:30'), 3930);
  assert.equal(parseDuration(''), null);
  assert.ok(Number.isNaN(parseDuration('abc')));
});

test('formatDuration', () => {
  assert.equal(formatDuration(3930), '1:05:30');
  assert.equal(formatDuration(40), '0:40');
  assert.equal(formatDuration(null), null);
});
