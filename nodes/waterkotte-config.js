'use strict';

const { WaterkotteClient } = require('../lib/client');

module.exports = function (RED) {
    function WaterkotteConfigNode(n) {
        RED.nodes.createNode(this, n);
        const node = this;

        const username = (node.credentials && node.credentials.username) || '';
        const password = (node.credentials && node.credentials.password) || '';

        if (!n.host) node.error('Waterkotte config: host missing');
        if (!username || !password) node.error('Waterkotte config: username/password missing');

        node.client = new WaterkotteClient({
            host: n.host,
            port: n.port ? Number(n.port) : undefined,
            protocol: n.protocol || 'http',
            username,
            password,
            timeout: n.timeout ? Number(n.timeout) : 10000,
            logger: {
                debug: (m) => node.debug(m),
                warn:  (m) => node.warn(m),
                error: (m) => node.error(m)
            }
        });

        node.getClient = function () { return node.client; };

        node.on('close', function (done) {
            try { node.client.token = null; } catch (_) {}
            done && done();
        });
    }

    RED.nodes.registerType('waterkotte-config', WaterkotteConfigNode, {
        credentials: {
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });
};
