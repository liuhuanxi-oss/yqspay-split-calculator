import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, toCents, formatMoney, exportCSV } from '../src/core.js';
const example = JSON.parse(readFileSync(new URL('../examples/platform.json', import.meta.url), 'utf8'));
const config = () => structuredClone(example);
const conserve = r => assert.equal(r.rows.reduce((s, p) => s + BigInt(p.netCents), 0n) + BigInt(r.feeCents), BigInt(r.totalCents));
test('fee-first example uses net base and does not charge the fee twice', () => {
  const r = calculate(config());
  assert.equal(r.feeCents, 380); assert.equal(r.baseCents, 99620);
  assert.deepEqual(r.rows.map(p => p.netCents), [4981, 29886, 64753]);
  assert.deepEqual(r.rows.map(p => p.feeCents), [0, 0, 0]); conserve(r);
});
test('designated participant bears the entire fee after allocation', () => {
  const c = config(); c.fee.mode = 'participant'; c.fee.participantId = 'platform'; const r = calculate(c);
  assert.deepEqual(r.rows.map(p => p.allocatedCents), [5000, 30000, 65000]);
  assert.deepEqual(r.rows.map(p => p.netCents), [4620, 30000, 65000]); conserve(r);
});
test('proportional fees sum exactly to the single order fee', () => {
  const c = config(); c.fee.mode = 'proportional'; const r = calculate(c);
  assert.deepEqual(r.rows.map(p => p.feeCents), [19, 114, 247]); conserve(r);
});
test('fixed amounts do not reduce the percentage base', () => {
  const c = config(); c.fee.rate = '0'; c.participants[1] = { id: 'supplier', name: '供应商', kind: 'fixed', value: '200' };
  assert.deepEqual(calculate(c).rows.map(p => p.netCents), [5000, 20000, 75000]);
});
test('one-cent split uses largest remainders then stable input order', () => {
  const c = config(); c.total = '0.01'; c.fee.rate = '0'; c.participants[0].value = '33.33'; c.participants[1].value = '33.33';
  const r = calculate(c); assert.deepEqual(r.rows.map(p => p.netCents), [1, 0, 0]);
  assert.equal(r.rows[0].roundingCents, 1); conserve(r);
  c.participants[1].value = '33.34'; assert.deepEqual(calculate(c).rows.map(p => p.netCents), [0, 1, 0]);
});
test('fee is half-up rounded once then fixed fee is added', () => {
  const c = config(); c.total = '1'; c.fee.rate = '0.50'; c.fee.fixed = '0.01';
  assert.equal(calculate(c).feeCents, 2);
});
test('oversubscription is rejected even if rounding would hide it', () => {
  const c = config(); c.total = '0.01'; c.fee.rate = '0'; c.participants[0].value = '100'; c.participants[1].value = '0.01';
  assert.throws(() => calculate(c), /超过/);
  c.participants[1] = { id: 'supplier', name: '供应商', kind: 'fixed', value: '0.01' }; assert.throws(() => calculate(c), /超过/);
});
test('a missing payer or an insufficient payer allocation is rejected', () => {
  const c = config(); c.fee.mode = 'participant'; c.fee.participantId = 'missing'; assert.throws(() => calculate(c), /有效/);
  c.fee.participantId = 'platform'; c.fee.fixed = '100'; assert.throws(() => calculate(c), /不足/);
});
test('a single remainder party and a 100% fee are supported', () => {
  const c = config(); c.participants = [c.participants[2]]; assert.equal(calculate(c).rows[0].netCents, 99620);
  c.fee.rate = '100'; const r = calculate(c); assert.equal(r.rows[0].netCents, 0); conserve(r);
});
test('invalid monetary input and unsafe values fail rather than being coerced', () => {
  for (const value of ['', '-1', '1.001', '1e3', true, null, '1,000', '90071992547409.92']) assert.throws(() => toCents(value));
  assert.equal(toCents('0.29'), 29); assert.equal(formatMoney(toCents('90071992547409.91')), '90071992547409.91');
  const c = config(); c.total = '0'; assert.throws(() => calculate(c));
});
test('malformed party and fee rules fail explicitly', () => {
  for (const mutate of [c => { c.fee.mode = 'unknown'; }, c => { c.fee.rate = '100.01'; }, c => { c.fee.fixed = '1001'; }, c => { c.participants[0].id = 'store'; }, c => { c.participants[0].name = ''; }, c => { c.participants[0].kind = 'remainder'; }, c => { c.participants[2].kind = 'percent'; c.participants[2].value = '10'; }, c => { c.participants = Array(51).fill(c.participants[0]); }]) {
    const c = config(); mutate(c); assert.throws(() => calculate(c));
  }
});
test('JSON round trip is deterministic and CSV prevents formula execution', () => {
  const c = config(); c.participants[0].name = '=HYPERLINK("https://example.invalid")';
  const r = calculate(c); assert.deepEqual(calculate(r.config), r); assert.match(exportCSV(r), /'=/);
});
test('all three fee modes conserve cents across 300 varying order values', () => {
  for (let i = 1; i <= 300; i++) {
    for (const mode of ['before', 'participant', 'proportional']) {
      const c = config(); c.total = formatMoney(i * 137); c.fee.mode = mode; c.fee.participantId = 'store'; c.fee.rate = '0.38';
      const r = calculate(c); conserve(r); assert.ok(r.rows.every(p => p.netCents >= 0 && Number.isSafeInteger(p.netCents)));
    }
  }
});
test('maximum supported amount is processed without loss of integer precision', () => {
  const c = config(); c.total = '90071992547409.91'; for (const mode of ['before', 'participant', 'proportional']) { c.fee.mode = mode; c.fee.participantId = 'store'; conserve(calculate(c)); }
});
