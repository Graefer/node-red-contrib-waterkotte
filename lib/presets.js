'use strict';

const COMMON_TAGS = [
    { tag: 'A1',  name: 'temp_outdoor',          scale: 0.1, unit: '°C',  desc: 'Außentemperatur aktuell' },
    { tag: 'A2',  name: 'temp_outdoor_1h',       scale: 0.1, unit: '°C',  desc: 'Außentemperatur 1h Mittel' },
    { tag: 'A3',  name: 'temp_outdoor_24h',      scale: 0.1, unit: '°C',  desc: 'Außentemperatur 24h Mittel' },
    { tag: 'A10', name: 'temp_return_set',       scale: 0.1, unit: '°C',  desc: 'Rücklauf Soll' },
    { tag: 'A11', name: 'temp_return',           scale: 0.1, unit: '°C',  desc: 'Rücklauf' },
    { tag: 'A12', name: 'temp_flow',             scale: 0.1, unit: '°C',  desc: 'Vorlauf' },
    { tag: 'A19', name: 'temp_water',            scale: 0.1, unit: '°C',  desc: 'Warmwasser' },
    { tag: 'A30', name: 'heating_return',        scale: 0.1, unit: '°C',  desc: 'Heizung Rücklauf' },
    { tag: 'A31', name: 'heating_set',           scale: 0.1, unit: '°C',  desc: 'Heizung Soll' },
    { tag: 'A51', name: 'percent_heat_circ_pump',scale: 0.1, unit: '%',   desc: 'Heizungsumwälzpumpe' },
    { tag: 'A58', name: 'percent_compressor',    scale: 0.1, unit: '%',   desc: 'Verdichterleistung' },
    // Bits counted from 0 (LSB), as in openHAB EcoTouchTags.java
    { tag: 'I51', name: 'status',                scale: 1,   unit: 'bits',desc: 'Status-Register',
      bits: { 0: 'source_pump', 1: 'heating_pump', 2: 'evd', 3: 'compressor', 4: 'compressor2',
              5: 'heater', 6: 'alarm', 7: 'cooling', 8: 'water', 9: 'pool', 10: 'solar', 11: 'cooling_4way' } },
    { tag: 'I53', name: 'interruptions',         scale: 1,   unit: '',    desc: 'Unterbrechungen' },
    // Same register, bit-decoded; the pump may report I53 negative, so bits are taken from |I53|
    { tag: 'I53', name: 'interruption_flags',    scale: 1,   unit: 'bits',desc: 'Unterbrechungen (Bits)',
      abs: true, bits: { 2: 'evu' } }
];

function applyTransform(rawValue, def) {
    if (rawValue == null || typeof rawValue !== 'number') return rawValue;
    if (def.bits) {
        const out = { _raw: rawValue };
        const value = def.abs ? Math.abs(rawValue) : rawValue;
        for (const [bit, name] of Object.entries(def.bits)) {
            out[name] = (value >> Number(bit)) & 1;
        }
        return out;
    }
    const scale = def.scale != null ? def.scale : 1;
    return scale === 1 ? rawValue : +(rawValue * scale).toFixed(3);
}

module.exports = { COMMON_TAGS, applyTransform };
