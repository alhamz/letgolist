import test from 'node:test';
import assert from 'node:assert';
import { SyndicationExporter } from '../src/syndication/exporter.js';
import { existsSync, unlinkSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

test('SyndicationExporter - formatListing for all channels', () => {
  const exporter = new SyndicationExporter();
  const testItem = {
    id: 'test-item-phone',
    public_token: 'abc123xyz789',
    sku: 'LGL-PHO-TEST-001',
    title: 'Test Phone 128GB',
    category: 'Phones',
    brand: 'Apple',
    model: 'iPhone Test',
    condition: 'very_good',
    location: {
      public_region: { country: 'CA', region: 'ON', city: 'Milton', postal_area: 'L9T area' }
    },
    pricing: { active_price: 250, fair_market: 250 },
    status: 'active',
    specs: {
      storage: '128 GB',
      display: '6.1 inch OLED',
      battery: '100% Health'
    },
    media: {
      primary_image: 'Sales/iPhones/test.jpg',
      gallery: ['Sales/iPhones/test.jpg', 'Sales/iPhones/test2.jpg']
    },
    syndication: {
      facebook: { title: 'Test Phone Facebook', description: 'FB custom description', tags: ['Phone', 'Apple'] },
      kijiji: { title: 'Test Phone Kijiji', description: 'Kijiji custom description', tags: ['Phone', 'Classifieds'] },
      ebay: { title: 'Test Phone eBay', description: 'eBay custom description', shipping_weight_kg: 0.4 }
    }
  };

  const output = exporter.formatListing(testItem, 'all');
  assert.ok(output.includes('ITEM: Test Phone 128GB'));
  assert.ok(output.includes('$250 CAD'));
  assert.ok(output.includes('FACEBOOK MARKETPLACE LISTING COPY'));
  assert.ok(output.includes('KIJIJI CLASSIFIEDS LISTING COPY'));
  assert.ok(output.includes('EBAY LISTING SUMMARY'));
  assert.ok(output.includes('https://letgolist.pages.dev/l/abc123xyz789.html'));
  assert.ok(output.includes('Sales/iPhones/test.jpg'));
});

test('SyndicationExporter - exportAll creates bundle files and master summary', () => {
  const exporter = new SyndicationExporter();
  const tempDir = 'test_syndication_output';

  const res = exporter.exportAll(tempDir, { status: 'active' });
  assert.ok(res.total_exported > 0, 'Should export at least one active item');
  assert.ok(existsSync(res.index_file), 'Master summary index file should exist');

  // Verify first file exists and contains valid content
  assert.ok(existsSync(res.files[0]));

  // Clean up test output directory
  rmSync(resolve(tempDir), { recursive: true, force: true });
});
