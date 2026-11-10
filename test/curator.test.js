import test from 'node:test';
import assert from 'node:assert';
import { ItemCurator } from '../src/curator/curator.js';
import { InventoryStore } from '../src/model/schema.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

test('ItemCurator - getPendingItems and getItem', () => {
  const curator = new ItemCurator();
  const pending = curator.getPendingItems();

  assert.ok(Array.isArray(pending));
  assert.ok(pending.length > 0, 'Should have pending draft items');

  const first = pending[0];
  const fetched = curator.getItem(first.id);
  assert.strictEqual(fetched.id, first.id);
});

test('ItemCurator - programmatic curation with clearance vaulting and syndication refresh', () => {
  const store = new InventoryStore();
  const curator = new ItemCurator();

  // Create temporary test item
  const testId = 'test-curation-laptop';
  store.upsertItem({
    id: testId,
    sku: 'LGL-TEST-001',
    title: 'Test Dell Latitude',
    category: 'Laptops',
    brand: 'Dell',
    model: 'Latitude 5520',
    condition: 'good',
    location: {
      public_region: { country: 'CA', region: 'ON', city: 'Ottawa', postal_area: 'K1A' },
      internal_sidelining: { zone: 'Office', shelf_or_bin: 'Rack A' },
    },
    specs: {},
    pricing: { currency: 'CAD', fast_liquidation: 0, fair_market: 0, optimistic_anchor: 0, active_price: 0 },
    status: 'draft',
    media: { primary_image: 'test.jpg', gallery: ['test.jpg'] },
    syndication: {},
  });

  const curated = curator.curateItem(testId, {
    condition: 'like_new',
    specs: {
      cpu: 'Intel Core i5-1145G7',
      ram: '16GB DDR4',
      storage: '256GB NVMe SSD',
      battery: '85% Health',
    },
    pricing: {
      fast_liquidation: 220,
      fair_market: 280,
      optimistic_anchor: 320,
      active_price: 280,
    },
    location: {
      internal_sidelining: { zone: 'Office', shelf_or_bin: 'Rack B Shelf 2' },
    },
    clearance_identifiers: {
      raw_identifiers: {
        service_tag: '74E6E2FE',
      },
    },
    status: 'sidelined',
  });

  assert.strictEqual(curated.status, 'sidelined');
  assert.strictEqual(curated.condition, 'like_new');
  assert.strictEqual(curated.specs.cpu, 'Intel Core i5-1145G7');
  assert.strictEqual(curated.location.internal_sidelining.shelf_or_bin, 'Rack B Shelf 2');
  assert.strictEqual(curated.pricing.active_price, 280);

  // Check syndication generation
  assert.ok(curated.syndication.facebook.description.includes('Intel Core i5-1145G7'));
  assert.ok(curated.syndication.kijiji.description.includes('like new'));
  assert.ok(curated.syndication.ebay.title.includes('Dell'));

  // Clean up
  const db = store.read();
  db.items = db.items.filter(i => i.id !== testId);
  store.write(db);

  const vaultFile = resolve('data', `vault_${testId}.json`);
  if (existsSync(vaultFile)) unlinkSync(vaultFile);
});
