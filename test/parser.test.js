'use strict';

const assert = require('assert');
const { parseTagResponse } = require('../lib/client');
const { applyTransform, COMMON_TAGS } = require('../lib/presets');

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); console.log(`  ok  ${name}`); pass++; }
    catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); fail++; }
}

console.log('parser');

t('single A-tag (real WP response)', () => {
    const body = '#A1\tS_OK\n192\t167\n';
    const out = parseTagResponse(body, ['A1']);
    assert.strictEqual(out.A1, 167);
});

t('multi-tag response (real WP format)', () => {
    const body = '#A1\tS_OK\n192\t167\n#A11\tS_OK\n192\t211\n#A12\tS_OK\n192\t208\n';
    const out = parseTagResponse(body, ['A1', 'A11', 'A12']);
    assert.deepStrictEqual(out, { A1: 167, A11: 211, A12: 208 });
});

t('missing tag stays null', () => {
    const body = '#A1\tS_OK\n192\t167\n';
    const out = parseTagResponse(body, ['A1', 'A99']);
    assert.strictEqual(out.A1, 167);
    assert.strictEqual(out.A99, null);
});

t('integer I-tag (status register)', () => {
    const body = '#I51\tS_OK\n192\t141\n';
    const out = parseTagResponse(body, ['I51']);
    assert.strictEqual(out.I51, 141);
});

t('error status leaves tag null', () => {
    const body = '#A1\tS_ERR\n192\t0\n';
    const out = parseTagResponse(body, ['A1']);
    assert.strictEqual(out.A1, null);
});

t('handles trailing whitespace', () => {
    const body = '#A1\tS_OK\n192\t167\n\n';
    const out = parseTagResponse(body, ['A1']);
    assert.strictEqual(out.A1, 167);
});

console.log('transforms');

t('A-tag scaled by 0.1', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'A1');
    assert.strictEqual(applyTransform(215, def), 21.5);
});

t('I51 bit decoding', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'I51');
    const out = applyTransform(0b10000101, def);
    assert.strictEqual(out.pump, 1);
    assert.strictEqual(out.evu, 0);
    assert.strictEqual(out.compressor, 1);
    assert.strictEqual(out.cooling_valve, 0);
    assert.strictEqual(out.water_valve, 1);
    assert.strictEqual(out._raw, 0b10000101);
});

t('null passes through', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'A1');
    assert.strictEqual(applyTransform(null, def), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
