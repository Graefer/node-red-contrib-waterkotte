'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

class WaterkotteAuthError extends Error {
    constructor(msg) { super(msg); this.name = 'WaterkotteAuthError'; }
}

class WaterkotteHttpError extends Error {
    constructor(msg, statusCode) {
        super(msg);
        this.name = 'WaterkotteHttpError';
        this.statusCode = statusCode;
    }
}

class WaterkotteClient {
    constructor({ host, port, protocol, username, password, timeout, logger } = {}) {
        if (!host) throw new Error('host required');
        this.host = host;
        this.port = port || (protocol === 'https' ? 443 : 80);
        this.protocol = protocol === 'https' ? 'https' : 'http';
        this.username = username || '';
        this.password = password || '';
        this.timeout = timeout || 10000;
        this.logger = logger || { debug() {}, warn() {}, error() {} };
        this.token = null;
        this._loginPromise = null;
    }

    async login() {
        if (this._loginPromise) return this._loginPromise;
        this._loginPromise = this._doLogin().finally(() => { this._loginPromise = null; });
        return this._loginPromise;
    }

    async _doLogin() {
        const path = `/cgi/login?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
        const res = await this._request(path, {});
        if (res.body.includes('#E')) {
            throw new WaterkotteAuthError(`Login rejected: ${res.body.trim().slice(0, 120)}`);
        }
        const cookieHeader = res.headers['set-cookie'];
        let token = null;
        if (Array.isArray(cookieHeader)) {
            for (const c of cookieHeader) {
                const m = c.match(/IDALToken=([^;]+)/);
                if (m) { token = m[1]; break; }
            }
        }
        if (!token) {
            const m = res.body.match(/[a-f0-9]{32}/i);
            if (m) token = m[0];
        }
        if (!token) throw new WaterkotteAuthError('No IDALToken in login response');
        this.token = token;
        this.logger.debug(`Waterkotte login ok, token=${token.slice(0, 6)}…`);
        return token;
    }

    async readTags(tags, opts = {}) {
        if (!Array.isArray(tags) || tags.length === 0) return opts.raw ? { values: {}, raw: '' } : {};
        if (!this.token) await this.login();
        try {
            return await this._readTagsOnce(tags, opts);
        } catch (err) {
            if (err instanceof WaterkotteAuthError ||
                (err instanceof WaterkotteHttpError && (err.statusCode === 401 || err.statusCode === 403))) {
                this.logger.warn('Waterkotte token expired, re-login');
                this.token = null;
                await this.login();
                return this._readTagsOnce(tags, opts);
            }
            throw err;
        }
    }

    async _readTagsOnce(tags, opts = {}) {
        const params = [`n=${tags.length}`];
        tags.forEach((t, i) => params.push(`t${i + 1}=${encodeURIComponent(t)}`));
        const path = `/cgi/readTags?${params.join('&')}`;
        const res = await this._request(path, { cookie: `IDALToken=${this.token}` });
        if (res.body.includes('#E')) {
            throw new WaterkotteAuthError(`API rejected: ${res.body.trim().slice(0, 120)}`);
        }
        const values = parseTagResponse(res.body, tags);
        return opts.raw ? { values, raw: res.body, url: path } : values;
    }

    _request(path, { cookie } = {}) {
        const lib = this.protocol === 'https' ? https : http;
        const opts = {
            host: this.host,
            port: this.port,
            path,
            method: 'GET',
            headers: {},
            timeout: this.timeout
        };
        if (cookie) opts.headers['Cookie'] = cookie;
        return new Promise((resolve, reject) => {
            const req = lib.request(opts, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ statusCode: res.statusCode, headers: res.headers, body });
                    } else {
                        reject(new WaterkotteHttpError(`HTTP ${res.statusCode}`, res.statusCode));
                    }
                });
            });
            req.on('timeout', () => { req.destroy(new Error(`timeout after ${this.timeout}ms`)); });
            req.on('error', reject);
            req.end();
        });
    }
}

function parseTagResponse(body, tags) {
    const out = {};
    const lines = body.split(/\r?\n/);
    for (const tag of tags) {
        out[tag] = null;
        for (const line of lines) {
            if (!line || line.startsWith('#')) continue;
            const fields = line.split('\t');
            if (fields.length < 3) continue;
            if (fields[1] === tag) {
                const n = Number(fields[2]);
                out[tag] = Number.isFinite(n) ? n : fields[2];
                break;
            }
        }
    }
    return out;
}

module.exports = {
    WaterkotteClient,
    WaterkotteAuthError,
    WaterkotteHttpError,
    parseTagResponse
};
