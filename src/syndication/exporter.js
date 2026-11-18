/**
 * letgolist - Multi-Channel Syndication Exporter
 * Generates formatted, copy-paste-ready listing bundles for Facebook Marketplace,
 * Kijiji, and eBay, including direct photo paths and Cloudflare Pages links.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { InventoryStore } from '../model/schema.js';

export class SyndicationExporter {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.store = new InventoryStore({ projectRoot: this.projectRoot });
    this.baseUrl = options.baseUrl || 'https://letgolist.pages.dev';
  }

  /**
   * Format an item listing for a specific marketplace channel.
   * @param {Object} item - Normalized InventoryItem record
   * @param {string} channel - 'facebook' | 'kijiji' | 'ebay' | 'all'
   * @returns {string} Formatted text / markdown ready for clipboard pasting
   */
  formatListing(item, channel = 'all') {
    if (!item) throw new Error('Item record is required');

    const price = item.pricing?.active_price || item.pricing?.fair_market || 0;
    const priceStr = `$${price} CAD`;
    const loc = item.location?.public_region;
    const locStr = loc ? `${loc.city}, ${loc.region} (${loc.postal_area})` : 'Milton, ON (L9T area)';
    const slug = item.public_token || item.id;
    const webUrl = `${this.baseUrl}/l/${slug}.html`;
    const photos = item.media?.gallery || (item.media?.primary_image ? [item.media.primary_image] : []);

    const sections = [];

    // Header Metadata
    sections.push(`=======================================================`);
    sections.push(`ITEM: ${item.title}`);
    sections.push(`SKU / ID: ${item.sku || item.id}`);
    sections.push(`PRICE: ${priceStr}`);
    sections.push(`CONDITION: ${item.condition.replace(/_/g, ' ').toUpperCase()}`);
    sections.push(`STATUS: ${item.status.toUpperCase()}`);
    sections.push(`PUBLIC SHOWCASE LINK: ${webUrl}`);
    sections.push(`PHOTOS TO ATTACH (${photos.length}):`);
    photos.forEach((p, idx) => sections.push(`  [${idx + 1}] ${p}`));
    sections.push(`=======================================================\n`);

    if (item.status === 'in_use') {
      sections.push(`[NOTICE] This item is currently deployed in daily personal use and is UNAVAILABLE for sale.\n`);
      return sections.join('\n');
    }

    if (item.status === 'sold') {
      sections.push(`[NOTICE] This item has been SOLD / LIQUIDATED.\n`);
      return sections.join('\n');
    }

    // 1. Facebook Marketplace Format
    if (channel === 'facebook' || channel === 'all') {
      const fb = item.syndication?.facebook || {};
      sections.push(`-------------------------------------------------------`);
      sections.push(`📘 FACEBOOK MARKETPLACE LISTING COPY`);
      sections.push(`-------------------------------------------------------`);
      sections.push(`TITLE: ${fb.title || item.title}`);
      sections.push(`PRICE: ${price}`);
      sections.push(`CATEGORY: ${item.category}`);
      sections.push(`CONDITION: ${this._mapFbCondition(item.condition)}`);
      sections.push(`LOCATION: ${locStr}`);
      sections.push(`\nDESCRIPTION:\n${fb.description || this._generateDefaultDescription(item, locStr, webUrl)}`);
      if (fb.tags && fb.tags.length > 0) {
        sections.push(`\nTAGS: ${fb.tags.join(', ')}`);
      }
      sections.push(`\n`);
    }

    // 2. Kijiji Format
    if (channel === 'kijiji' || channel === 'all') {
      const kj = item.syndication?.kijiji || {};
      sections.push(`-------------------------------------------------------`);
      sections.push(`🍁 KIJIJI CLASSIFIEDS LISTING COPY`);
      sections.push(`-------------------------------------------------------`);
      sections.push(`TITLE: ${kj.title || `${item.title} - ${locStr}`}`);
      sections.push(`PRICE: ${price}`);
      sections.push(`LOCATION: ${locStr}`);
      sections.push(`\nDESCRIPTION:\n${kj.description || this._generateDefaultDescription(item, locStr, webUrl)}`);
      if (kj.tags && kj.tags.length > 0) {
        sections.push(`\nKEYWORDS: ${kj.tags.join(', ')}`);
      }
      sections.push(`\n`);
    }

    // 3. eBay Format
    if (channel === 'ebay' || channel === 'all') {
      const eb = item.syndication?.ebay || {};
      sections.push(`-------------------------------------------------------`);
      sections.push(`🏷️ EBAY LISTING SUMMARY`);
      sections.push(`-------------------------------------------------------`);
      sections.push(`TITLE: ${eb.title || item.title}`.slice(0, 80));
      sections.push(`BUY IT NOW / STARTING PRICE: ${priceStr}`);
      sections.push(`ESTIMATED SHIPPING WEIGHT: ${eb.shipping_weight_kg || item.circular_metrics?.estimated_weight_kg || 1.0} kg`);
      sections.push(`\nDESCRIPTION:\n${eb.description || this._generateDefaultDescription(item, locStr, webUrl)}`);
      sections.push(`\n`);
    }

    return sections.join('\n');
  }

  /**
   * Export all active item syndication bundles to a target folder.
   * @param {string} outputDir - Directory to save generated markdown files
   * @param {Object} filter - Optional status filter, defaults to active listings
   * @returns {Object} Summary of export operation
   */
  exportAll(outputDir = 'syndication_bundles', filter = { status: 'active' }) {
    const fullOutDir = resolve(this.projectRoot, outputDir);
    if (!existsSync(fullOutDir)) {
      mkdirSync(fullOutDir, { recursive: true });
    }

    const db = this.store.read();
    let targetItems = db.items || [];
    if (filter.status) {
      targetItems = targetItems.filter(i => i.status === filter.status);
    }

    const exportedFiles = [];
    const summaryRows = [];

    for (const item of targetItems) {
      const content = this.formatListing(item, 'all');
      const filename = `${item.id}.md`;
      const filePath = join(fullOutDir, filename);
      writeFileSync(filePath, content, 'utf-8');
      exportedFiles.push(filePath);

      const price = item.pricing?.active_price || item.pricing?.fair_market || 0;
      summaryRows.push(`| [${item.title}](./${filename}) | ${item.category} | **$${price} CAD** | ${item.condition} | [Web Link](${this.baseUrl}/${item.id}.html) |`);
    }

    // Write Master Index / Summary
    const summaryContent = `# Active Syndication & Listing Bundles

Generated on: ${new Date().toISOString()}  
Total Active Listings: **${targetItems.length}**  
Master Showcase: [${this.baseUrl}](${this.baseUrl})

| Listing Title | Category | Price (CAD) | Condition | Live Web Page |
| :--- | :--- | :--- | :--- | :--- |
${summaryRows.join('\n')}

---

### How to Use These Listing Bundles:
1. Open the corresponding item markdown file in \`syndication_bundles/<item_id>.md\`.
2. Copy the **Facebook Marketplace** or **Kijiji** block directly into the posting form.
3. Attach the listed high-resolution photos located in \`Sales/\`.
4. Handoffs occur at central public community landmarks in Milton, ON (\`L9T area\`) or via tracked shipping.
`;

    const indexPath = join(fullOutDir, 'CATALOG_SUMMARY.md');
    writeFileSync(indexPath, summaryContent, 'utf-8');

    return {
      output_directory: fullOutDir,
      total_exported: exportedFiles.length,
      index_file: indexPath,
      files: exportedFiles,
    };
  }

  _generateDefaultDescription(item, locStr, webUrl) {
    const bullets = Object.entries(item.specs || {})
      .filter(([k]) => !k.startsWith('inferred') && k !== 'media_count')
      .map(([k, v]) => `• ${k.replace(/_/g, ' ')}: ${v}`)
      .join('\n');

    return `${item.title}\n\nCondition: ${item.condition.replace(/_/g, ' ').toUpperCase()}\n\nSpecifications:\n${bullets || '• Tested and verified operational'}\n\nPickup Location: Central public community landmark in ${locStr}.\nShipping: Tracked Canada-wide & International shipping available (buyer pays shipping).\nFull High-Res Photos & Details: ${webUrl}`;
  }

  _mapFbCondition(cond) {
    switch (cond) {
      case 'new_sealed': return 'New';
      case 'like_new': return 'Used - Like New';
      case 'very_good':
      case 'good': return 'Used - Good';
      case 'fair': return 'Used - Fair';
      default: return 'Used - Good';
    }
  }
}

function fullOutDirSafe(p) {
  return p;
}
