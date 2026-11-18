import test from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InventoryStore } from '../src/model/schema.js';
import { PageGenerator } from '../src/generator/pageGenerator.js';
import { AssistedPoster } from '../src/automation/assistedPoster.js';
import { AdminServer } from '../src/server/adminServer.js';

test('InventoryStore - assigns public_token and flags other channels on sold', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'lgl-test-'));
  try {
    const store = new InventoryStore({ projectRoot: tempRoot });
    const saved = store.upsertItem({
      id: 'dock-test-1',
      title: 'Dell WD15 Dock',
      category: 'Docks',
      condition: 'good',
      pricing: { active_price: 50, currency: 'CAD' },
      status: 'active',
    });

    assert.ok(saved.public_token && saved.public_token.length >= 10, 'Generates unguessable public_token');
    assert.strictEqual(saved.channels.facebook.status, 'not_listed');

    store.updateChannelState('dock-test-1', 'facebook', { status: 'listed', url: 'https://fb.com/item/123' });
    store.updateChannelState('dock-test-1', 'kijiji', { status: 'listed', url: 'https://kijiji.ca/v-123' });

    const { item, flaggedToDelist } = store.markSoldAndFlagChannels('dock-test-1', 'facebook');
    assert.strictEqual(item.status, 'sold');
    assert.strictEqual(item.channels.facebook.status, 'sold');
    assert.strictEqual(item.channels.kijiji.status, 'needs_delist');
    assert.strictEqual(flaggedToDelist.length, 1);
    assert.strictEqual(flaggedToDelist[0].channel, 'kijiji');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('PageGenerator - neutral root portal hides total value while admin dashboard retains it', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'lgl-gen-'));
  try {
    const gen = new PageGenerator({ projectRoot: tempRoot });
    const items = [
      {
        id: 'dock-test-1',
        public_token: 'tok999aaa111',
        title: 'Dell WD15 Dock',
        category: 'Docks',
        brand: 'Dell',
        model: 'WD15',
        condition: 'good',
        pricing: { active_price: 50, currency: 'CAD' },
        status: 'active',
        media: { gallery: [] },
        specs: {},
      },
    ];

    gen.renderAll(items);

    const rootHtml = readFileSync(join(tempRoot, 'dist', 'index.html'), 'utf-8');
    assert.ok(!rootHtml.includes('$50 CAD'), 'Root portal must not expose inventory value');
    assert.ok(!rootHtml.includes('Dell WD15 Dock'), 'Root portal must not expose item titles');
    assert.ok(rootHtml.includes('Direct Item Link Required'), 'Root portal shows neutral gate');

    const scatteredPath = join(tempRoot, 'dist', 'l', 'tok999aaa111.html');
    assert.ok(existsSync(scatteredPath), 'Scattered listing exists at dist/l/<token>.html');

    const adminHtml = readFileSync(join(tempRoot, 'admin', 'index.html'), 'utf-8');
    assert.ok(adminHtml.includes('$50 CAD'), 'Private admin dashboard retains active value');
    assert.ok(adminHtml.includes('tok999aaa111.html'), 'Private admin dashboard links to scattered URL');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('AssistedPoster - builds normalized payload with scattered showcase URL', () => {
  const poster = new AssistedPoster({ baseUrl: 'https://letgolist.pages.dev' });
  const payload = poster.buildPostingPayload({
    id: 'dock-test-1',
    public_token: 'tok999aaa111',
    title: 'Dell WD15 Dock',
    condition: 'good',
    pricing: { active_price: 50 },
    location: { public_region: { city: 'Milton', region: 'ON', postal_area: 'L9T area' } },
    specs: { power: '130W' },
    media: { gallery: [] },
  }, 'facebook');

  assert.strictEqual(payload.showcaseUrl, 'https://letgolist.pages.dev/l/tok999aaa111.html');
  assert.ok(payload.description.includes('https://letgolist.pages.dev/l/tok999aaa111.html'));
});

test('AdminServer - serves dashboard and handles /api/items and /api/sold on 127.0.0.1', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'lgl-srv-'));
  const server = new AdminServer({ projectRoot: tempRoot, port: 0 });
  try {
    server.store.upsertItem({
      id: 'dock-srv-1',
      public_token: 'srvtok123456',
      title: 'Test Server Dock',
      category: 'Docks',
      condition: 'good',
      pricing: { active_price: 45, currency: 'CAD' },
      status: 'active',
      media: { gallery: [] },
      specs: {},
    });

    const { port } = await new Promise((resStart, rejStart) => {
      import('node:http').then(({ default: http }) => {
        server.server = http.createServer((req, res) => server._handleRequest(req, res));
        server.server.on('error', rejStart);
        server.server.listen(0, '127.0.0.1', () => resStart(server.server.address()));
      });
    });

    const base = `http://127.0.0.1:${port}`;
    const dashRes = await fetch(`${base}/`);
    assert.strictEqual(dashRes.status, 200);
    const dashHtml = await dashRes.text();
    assert.ok(dashHtml.includes('Test Server Dock'));
    assert.ok(dashHtml.includes('Copy Link'));
    assert.ok(dashHtml.includes('Mark Sold'));

    const soldRes = await fetch(`${base}/api/sold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'dock-srv-1' }),
    });
    assert.strictEqual(soldRes.status, 200);
    const soldData = await soldRes.json();
    assert.strictEqual(soldData.status, 'ok');
    assert.strictEqual(server.store.read().items[0].status, 'sold');
  } finally {
    await server.stop();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
