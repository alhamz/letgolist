/**
 * letgolist - Local Private Operator Server (127.0.0.1 only)
 * Serves admin/index.html, local previews of dist/l/ and Sales/, and
 * provides one-click API endpoints for Copy Link, Mark Sold, Channels, and Rebuild.
 */

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, normalize } from 'node:path';
import { InventoryStore } from '../model/schema.js';
import { PageGenerator } from '../generator/pageGenerator.js';
import { SyndicationExporter } from '../syndication/exporter.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.svg': 'image/svg+xml',
};

export class AdminServer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.host = '127.0.0.1';
    this.port = options.port || 4173;
    this.store = new InventoryStore({ projectRoot: this.projectRoot });
    this.generator = new PageGenerator({ projectRoot: this.projectRoot });
    this.exporter = new SyndicationExporter({ projectRoot: this.projectRoot });
    this.server = null;
  }

  _readJsonBody(req) {
    return new Promise((resolveBody, rejectBody) => {
      let raw = '';
      req.on('data', chunk => {
        raw += chunk;
        if (raw.length > 1024 * 1024) {
          rejectBody(new Error('Payload too large'));
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          resolveBody(raw ? JSON.parse(raw) : {});
        } catch {
          rejectBody(new Error('Invalid JSON body'));
        }
      });
      req.on('error', rejectBody);
    });
  }

  _sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  _serveFile(res, baseDir, relPath) {
    const safeRel = normalize(decodeURIComponent(relPath)).replace(/^([/\\])+/, '');
    const fullPath = resolve(baseDir, safeRel);
    if (!fullPath.startsWith(resolve(baseDir))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!existsSync(fullPath) || statSync(fullPath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(readFileSync(fullPath));
  }

  async _handleRequest(req, res) {
    const urlPath = (req.url || '/').split('?')[0];

    try {
      if (req.method === 'GET' && (urlPath === '/' || urlPath === '/admin' || urlPath === '/admin/')) {
        const adminIndex = resolve(this.projectRoot, 'admin', 'index.html');
        if (!existsSync(adminIndex)) {
          this.store.ensureAllTokensAndChannels();
          this.generator.writeAdminDashboard(this.store.read().items);
        }
        this._serveFile(res, resolve(this.projectRoot, 'admin'), 'index.html');
        return;
      }

      if (req.method === 'GET' && urlPath.startsWith('/dist/l/')) {
        this._serveFile(res, resolve(this.projectRoot, 'dist', 'l'), urlPath.slice('/dist/l/'.length));
        return;
      }

      if (req.method === 'GET' && urlPath.startsWith('/l/')) {
        this._serveFile(res, resolve(this.projectRoot, 'dist', 'l'), urlPath.slice('/l/'.length));
        return;
      }

      if (req.method === 'GET' && urlPath.startsWith('/Sales/')) {
        this._serveFile(res, resolve(this.projectRoot, 'Sales'), urlPath.slice('/Sales/'.length));
        return;
      }

      if (req.method === 'GET' && urlPath === '/api/items') {
        this._sendJson(res, 200, this.store.read());
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/build') {
        this.store.ensureAllTokensAndChannels();
        const db = this.store.read();
        const rendered = this.generator.renderAll(db.items);
        const exported = this.exporter.exportAll('syndication_bundles', { status: 'active' });
        this._sendJson(res, 200, { status: 'ok', rendered: rendered.length, exported: exported.total_exported });
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/sold') {
        const body = await this._readJsonBody(req);
        if (!body.id) {
          this._sendJson(res, 400, { error: 'Missing item id' });
          return;
        }
        const { item, flaggedToDelist } = this.store.markSoldAndFlagChannels(body.id, body.channel || null);
        this.generator.writeItemPage(item);
        this.generator.writeAdminDashboard(this.store.read().items);
        this._sendJson(res, 200, { status: 'ok', item_id: item.id, flaggedToDelist });
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/channels') {
        const body = await this._readJsonBody(req);
        if (!body.id || !body.channel) {
          this._sendJson(res, 400, { error: 'Missing id or channel' });
          return;
        }
        const updated = this.store.updateChannelState(body.id, body.channel, {
          ...(body.status ? { status: body.status } : {}),
          ...(body.url !== undefined ? { url: body.url } : {}),
          ...(body.listing_id !== undefined ? { listing_id: body.listing_id } : {}),
        });
        this.generator.writeAdminDashboard(this.store.read().items);
        this._sendJson(res, 200, { status: 'ok', channels: updated.channels });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      this._sendJson(res, 500, { error: err.message });
    }
  }

  start() {
    return new Promise((resolveStart, rejectStart) => {
      this.server = http.createServer((req, res) => this._handleRequest(req, res));
      this.server.on('error', rejectStart);
      this.server.listen(this.port, this.host, () => {
        resolveStart({ host: this.host, port: this.port, url: `http://${this.host}:${this.port}` });
      });
    });
  }

  stop() {
    return new Promise(resolveStop => {
      if (!this.server) return resolveStop();
      this.server.close(() => resolveStop());
    });
  }
}
