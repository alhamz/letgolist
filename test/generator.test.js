import test from 'node:test';
import assert from 'node:assert';
import { PageGenerator } from '../src/generator/pageGenerator.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

test('PageGenerator - renderItemPage output integrity', () => {
  const generator = new PageGenerator();

  const mockItem = {
    id: 'test-dock-wd19s',
    sku: 'LGL-DOC-WD19S-101',
    title: 'Dell WD19S 130W USB-C Docking Station',
    category: 'Docks',
    brand: 'Dell',
    model: 'WD19S',
    condition: 'like_new',
    location: {
      public_region: { country: 'CA', region: 'ON', city: 'Ottawa', postal_area: 'K1A' },
      internal_sidelining: { zone: 'Office', shelf_or_bin: 'Dock Bin #1' },
    },
    specs: {
      power_supply: '130W Original Dell Adapter',
      connectivity: 'USB-C DisplayPort over Type-C',
      ports: '2x DP 1.4, 1x HDMI 2.0b, 1x USB-C Multi-function',
    },
    pricing: {
      currency: 'CAD',
      fast_liquidation: 85,
      fair_market: 110,
      optimistic_anchor: 130,
      active_price: 110,
    },
    status: 'active',
    media: {
      primary_image: 'Sales/Dock/Dell/WD19S/test.jpg',
      gallery: ['Sales/Dock/Dell/WD19S/test.jpg', 'Sales/Dock/Dell/WD19S/test2.jpg'],
    },
    syndication: {},
  };

  const html = generator.renderItemPage(mockItem);

  assert.ok(html.includes('<!DOCTYPE html>'), 'Must be valid HTML5');
  assert.ok(html.includes('Dell WD19S 130W USB-C Docking Station'), 'Contains item title');
  assert.ok(html.includes('$110 CAD'), 'Contains price display');
  assert.ok(html.includes('AVAILABLE FOR PICKUP'), 'Contains available status');
  assert.ok(html.includes('Ottawa, ON (K1A)'), 'Contains public location');
  assert.ok(html.includes('https://schema.org/'), 'Contains JSON-LD Schema.org context');
  assert.ok(html.includes('"@type": "Product"'), 'Contains JSON-LD Schema.org Product type');
  assert.ok(html.includes('og:title'), 'Contains OpenGraph tags');
  assert.ok(html.includes('switchMedia'), 'Contains interactive gallery switcher script');

  // Verify file write
  const writtenPath = generator.writeItemPage(mockItem);
  assert.ok(existsSync(writtenPath), 'Generated HTML file must exist on disk');

  // Cleanup
  if (existsSync(writtenPath)) unlinkSync(writtenPath);
});
