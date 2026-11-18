/**
 * letgolist - Assisted Marketplace Poster (Playwright Persistent Profile)
 * Pre-fills Facebook Marketplace & Kijiji listing forms using the user's
 * logged-in browser profile, uploads local photos, and pauses at Publish.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SyndicationExporter } from '../syndication/exporter.js';

export class AssistedPoster {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.baseUrl = options.baseUrl || 'https://letgolist.pages.dev';
    this.profileDir = options.profileDir || resolve(this.projectRoot, '.playwright-profile');
    this.exporter = new SyndicationExporter({
      projectRoot: this.projectRoot,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Builds a normalized, channel-ready payload with absolute photo paths
   * and the scattered /l/<public_token>.html spec-card URL.
   */
  buildPostingPayload(item, channel) {
    if (!item) throw new Error('Item record is required.');
    const ch = channel.toLowerCase();
    if (!['facebook', 'kijiji', 'ebay'].includes(ch)) {
      throw new Error(`Unsupported channel "${channel}". Expected: facebook, kijiji, or ebay.`);
    }

    const slug = item.public_token || item.id;
    const showcaseUrl = `${this.baseUrl}/l/${slug}.html`;
    const price = item.pricing?.active_price || item.pricing?.fair_market || 0;
    const loc = item.location?.public_region;
    const locStr = loc ? `${loc.city}, ${loc.region} (${loc.postal_area})` : 'Milton, ON (L9T area)';

    const rawPhotos = item.media?.gallery || (item.media?.primary_image ? [item.media.primary_image] : []);
    const photoPaths = rawPhotos
      .filter(p => !p.toLowerCase().endsWith('.mov') && !p.toLowerCase().endsWith('.mp4'))
      .map(p => resolve(this.projectRoot, p))
      .filter(abs => existsSync(abs));

    const channelData = item.syndication?.[ch] || {};
    const title = (channelData.title || item.title).slice(0, ch === 'ebay' ? 80 : 100);
    const description = channelData.description || this.exporter._generateDefaultDescription(item, locStr, showcaseUrl);

    return {
      itemId: item.id,
      channel: ch,
      title,
      price: String(price),
      condition: item.condition,
      location: locStr,
      showcaseUrl,
      description,
      photoPaths,
      tags: channelData.tags || [],
    };
  }

  /**
   * Launches a persistent Chromium session (logged-in cookies preserved in .playwright-profile/)
   * and pre-fills the marketplace form, leaving the final Publish click to the operator.
   */
  async launchAssistedPost(item, channel) {
    const payload = this.buildPostingPayload(item, channel);
    if (payload.channel === 'ebay') {
      throw new Error('eBay uses API/Seller Hub flow rather than local browser form-fill. Use `export <id> --channel=ebay`.');
    }

    let playwright;
    try {
      playwright = await import('playwright');
    } catch {
      return {
        status: 'playwright_missing',
        message: 'Playwright is not installed. Run `npm install -D playwright` (or `npx playwright install chromium`) to enable assisted browser pre-fill.',
        payload,
      };
    }

    const context = await playwright.chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      viewport: { width: 1360, height: 900 },
    });

    const page = context.pages()[0] || await context.newPage();

    if (payload.channel === 'facebook') {
      await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' });
      await this._tryFillFacebook(page, payload);
    } else if (payload.channel === 'kijiji') {
      await page.goto('https://www.kijiji.ca/p-select-category.html', { waitUntil: 'domcontentloaded' });
      await this._tryFillKijiji(page, payload);
    }

    return {
      status: 'ready_for_review',
      message: `Browser opened for ${payload.channel}. Review pre-filled fields, click Publish, then record the URL with: node bin/letgo.js channels ${item.id} --${payload.channel}=<LISTING_URL>`,
      payload,
    };
  }

  async _tryFillFacebook(page, payload) {
    // Best-effort selectors; if user is not logged in yet, browser stays open for login + manual retry.
    try {
      await page.waitForSelector('input[type="file"]', { timeout: 8000 });
      if (payload.photoPaths.length > 0) {
        await page.setInputFiles('input[type="file"]', payload.photoPaths.slice(0, 10));
      }
      const titleInput = page.locator('label:has-text("Title") input, input[aria-label="Title"]').first();
      if (await titleInput.count()) await titleInput.fill(payload.title);

      const priceInput = page.locator('label:has-text("Price") input, input[aria-label="Price"]').first();
      if (await priceInput.count()) await priceInput.fill(payload.price);

      const descInput = page.locator('label:has-text("Description") textarea, textarea[aria-label="Description"]').first();
      if (await descInput.count()) await descInput.fill(payload.description);
    } catch {
      // Login wall or layout shift — leave browser open with payload printed in terminal.
    }
  }

  async _tryFillKijiji(page, payload) {
    try {
      const titleInput = page.locator('#AdTitleForm, input[name="postAdForm.title"]').first();
      if (await titleInput.count()) {
        await titleInput.fill(payload.title);
      }
    } catch {
      // Category selection or login wall — leave browser open.
    }
  }
}
