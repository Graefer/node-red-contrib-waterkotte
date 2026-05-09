'use strict';

const { COMMON_TAGS, applyTransform } = require('../lib/presets');

module.exports = function (RED) {
    function WaterkotteReadNode(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        const cfg = RED.nodes.getNode(n.server);

        if (!cfg) {
            node.status({ fill: 'red', shape: 'ring', text: 'no server config' });
            return;
        }

        const tagDefs = parseTagDefs(n.tags, n.preset);
        if (!tagDefs.length) {
            node.status({ fill: 'red', shape: 'ring', text: 'no tags' });
            return;
        }
        const tagNames = tagDefs.map((d) => d.tag);

        const flatten    = !!n.flatten;
        const includeRaw = !!n.includeRaw;
        const debug      = !!n.debug;

        let pollTimer = null;
        const pollSec = Number(n.poll);
        const pollMs = Number.isFinite(pollSec) && pollSec > 0 ? Math.max(1000, pollSec * 1000) : 0;
        let busy = false;

        async function poll(triggerMsg) {
            if (busy) return;
            busy = true;
            const send = node.send.bind(node);
            const t0 = Date.now();
            try {
                node.status({ fill: 'blue', shape: 'dot', text: 'reading' });
                const client = cfg.getClient();
                const result = await client.readTags(tagNames, { raw: debug });
                const raw = debug ? result.values : result;
                const payload = flatten ? {} : {};
                for (const def of tagDefs) {
                    const value = applyTransform(raw[def.tag], def);
                    if (flatten && value && typeof value === 'object' && def.bits) {
                        for (const [k, v] of Object.entries(value)) {
                            if (k === '_raw') continue;
                            payload[`${def.name}_${k}`] = v;
                        }
                        if (includeRaw) payload[`${def.name}_raw`] = value._raw;
                    } else {
                        payload[def.name] = value;
                    }
                    if (includeRaw && !def.bits) payload[`${def.name}_raw`] = raw[def.tag];
                }
                const dt = Date.now() - t0;
                node.status({ fill: 'green', shape: 'dot', text: `${tagNames.length} tags · ${dt} ms` });
                const out = { ...(triggerMsg || {}), payload, topic: 'waterkotte' };
                if (debug) {
                    out.raw = result.raw;
                    out.url = result.url;
                    out.parsedTags = result.values;
                }
                send(out);
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message.slice(0, 40) });
                node.error(err, triggerMsg || {});
            } finally {
                busy = false;
            }
        }

        node.on('input', function (msg) { poll(msg); });

        if (pollMs > 0) {
            pollTimer = setInterval(() => poll(null), pollMs);
            setTimeout(() => poll(null), 500);
        }

        node.on('close', function (done) {
            if (pollTimer) clearInterval(pollTimer);
            done && done();
        });
    }

    function parseTagDefs(tagsConfig, preset) {
        if (preset === 'all') return COMMON_TAGS.slice();
        if (!tagsConfig || tagsConfig === '[]') return [];
        let parsed;
        if (typeof tagsConfig === 'string') {
            try { parsed = JSON.parse(tagsConfig); }
            catch (e) { return []; }
        } else {
            parsed = tagsConfig;
        }
        if (!Array.isArray(parsed)) return [];
        return parsed.map((entry) => {
            if (typeof entry === 'string') {
                const known = COMMON_TAGS.find((t) => t.tag === entry);
                return known || { tag: entry, name: entry, scale: 1 };
            }
            return Object.assign({ name: entry.tag, scale: 1 }, entry);
        }).filter((d) => d && d.tag);
    }

    RED.nodes.registerType('waterkotte-read', WaterkotteReadNode);
};
