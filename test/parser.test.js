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

const I51_OFF = {
    source_pump: 0, heating_pump: 0, evd: 0, compressor: 0, compressor2: 0, heater: 0,
    alarm: 0, cooling: 0, water: 0, pool: 0, solar: 0, cooling_4way: 0
};

t('I51 = 67: bits 0, 1, 6 (live value)', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'I51');
    assert.deepStrictEqual(applyTransform(67, def), {
        ...I51_OFF, _raw: 67, source_pump: 1, heating_pump: 1, alarm: 1
    });
});

t('I51 = 355: bits 0, 1, 5, 6, 8 (live value)', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'I51');
    assert.deepStrictEqual(applyTransform(355, def), {
        ...I51_OFF, _raw: 355, source_pump: 1, heating_pump: 1, heater: 1, alarm: 1, water: 1
    });
});

t('I51 bit 0 and bit 11 (both ends)', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'I51');
    assert.deepStrictEqual(applyTransform(1, def), { ...I51_OFF, _raw: 1, source_pump: 1 });
    assert.deepStrictEqual(applyTransform(2048, def), { ...I51_OFF, _raw: 2048, cooling_4way: 1 });
});

t('I53 = -32764: EVU from |I53| bit 2, interruptions stays a number', () => {
    const defs = COMMON_TAGS.filter((d) => d.tag === 'I53');
    const plain = defs.find((d) => d.name === 'interruptions');
    const flags = defs.find((d) => d.name === 'interruption_flags');
    assert.strictEqual(applyTransform(-32764, plain), -32764);
    assert.deepStrictEqual(applyTransform(-32764, flags), { _raw: -32764, evu: 1 });
});

t('I53 = 0: no EVU', () => {
    const flags = COMMON_TAGS.find((d) => d.name === 'interruption_flags');
    assert.deepStrictEqual(applyTransform(0, flags), { _raw: 0, evu: 0 });
});

t('custom bits map counts from 0', () => {
    const out = applyTransform(0b101, { tag: 'X', name: 'x', bits: { 0: 'a', 1: 'b', 2: 'c' } });
    assert.deepStrictEqual(out, { _raw: 5, a: 1, b: 0, c: 1 });
});

t('null passes through', () => {
    const def = COMMON_TAGS.find((d) => d.tag === 'A1');
    assert.strictEqual(applyTransform(null, def), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
