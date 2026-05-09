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
    { tag: 'I51', name: 'status',                scale: 1,   unit: 'bits',desc: 'Status-Register',
      bits: { 1: 'pump', 2: 'evu', 3: 'compressor', 7: 'cooling_valve', 8: 'water_valve' } },
    { tag: 'I53', name: 'interruptions',         scale: 1,   unit: '',    desc: 'Unterbrechungen' }
];

function applyTransform(rawValue, def) {
    if (rawValue == null || typeof rawValue !== 'number') return rawValue;
    if (def.bits) {
        const out = { _raw: rawValue };
        for (const [bit, name] of Object.entries(def.bits)) {
            out[name] = (rawValue >> (Number(bit) - 1)) & 1;
        }
        return out;
    }
    const scale = def.scale != null ? def.scale : 1;
    return scale === 1 ? rawValue : +(rawValue * scale).toFixed(3);
}

module.exports = { COMMON_TAGS, applyTransform };
