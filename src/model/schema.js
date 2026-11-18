/**
 * letgolist - Asset Schema & Inventory Database Manager
 * Supports polymorphic categories (Tech, Baby/Child, Networking, Peripherals, Fitness, Vehicles).
 * Enforces harm-based classification, geographic specificity tiering, and clearance vaulting.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

export function generatePublicToken(bytes = 9) {
  return randomBytes(bytes).toString('base64url');
}

export function createDefaultChannels() {
  return {
    facebook: { status: 'not_listed', url: null, posted_at: null, last_synced_at: null },
    kijiji: { status: 'not_listed', url: null, posted_at: null, last_synced_at: null },
    ebay: { status: 'not_listed', listing_id: null, url: null, posted_at: null, last_synced_at: null },
  };
}

export const CATEGORIES = [
  'Laptops',
  'Tablets',
  'Phones',
  'Docks',
  'Firewalls & Security',
  'Networking',
  'Car Seats & Baby Gear',
  'Peripherals & Accessories',
  'Fitness & Sports',
  'Vehicles',
  'Other',
];

export const CONDITIONS = [
  'new',
  'like_new',
  'good',
  'fair',
  'needs_rehaul',
  'parts_only',
];

export const LIFECYCLE_STATUSES = [
  'draft',
  'sidelined',
  'active',
  'reserved',
  'sold',
  'in_use',
  'archived',
];

export class InventoryStore {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.dataPath = options.dataPath || resolve(this.projectRoot, 'data', 'inventory.json');
    this.vaultPath = options.vaultPath || resolve(this.projectRoot, 'data', 'clearance_vault.json');
    this.ensureDirs();
  }

  ensureDirs() {
    const dataDir = dirname(this.dataPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  read() {
    if (!existsSync(this.dataPath)) {
      return {
        schema_version: '1.0.0',
        last_updated: new Date().toISOString(),
        summary: {
          total_items: 0,
          active_listings: 0,
          sidelined_items: 0,
          sold_items: 0,
          total_estimated_value: 0,
          circular_ewaste_diverted_kg: 0,
        },
        items: [],
      };
    }

    try {
      return JSON.parse(readFileSync(this.dataPath, 'utf-8'));
    } catch {
      return {
        schema_version: '1.0.0',
        last_updated: new Date().toISOString(),
        summary: { total_items: 0, active_listings: 0, sidelined_items: 0, sold_items: 0, total_estimated_value: 0, circular_ewaste_diverted_kg: 0 },
        items: [],
      };
    }
  }

  write(db) {
    this.ensureDirs();
    db.last_updated = new Date().toISOString();
    this.updateSummary(db);
    writeFileSync(this.dataPath, JSON.stringify(db, null, 2), 'utf-8');
  }

  updateSummary(db) {
    const items = db.items || [];
    let estimatedVal = 0;
    let ewasteKg = 0;

    for (const item of items) {
      estimatedVal += (item.pricing?.active_price || item.pricing?.fair_market || 0);
      ewasteKg += (item.circular_metrics?.estimated_weight_kg || 0);
    }

    db.summary = {
      total_items: items.length,
      active_listings: items.filter(i => i.status === 'active').length,
      in_use_items: items.filter(i => i.status === 'in_use').length,
      sidelined_items: items.filter(i => i.status === 'sidelined').length,
      sold_items: items.filter(i => i.status === 'sold').length,
      total_estimated_value: Math.round(estimatedVal * 100) / 100,
      circular_ewaste_diverted_kg: Math.round(ewasteKg * 10) / 10,
    };
  }

  readVault() {
    if (!existsSync(this.vaultPath)) {
      return { vault_version: '1.0.0', last_updated: new Date().toISOString(), records: {} };
    }
    try {
      return JSON.parse(readFileSync(this.vaultPath, 'utf-8'));
    } catch {
      return { vault_version: '1.0.0', last_updated: new Date().toISOString(), records: {} };
    }
  }

  writeVault(vault) {
    this.ensureDirs();
    vault.last_updated = new Date().toISOString();
    writeFileSync(this.vaultPath, JSON.stringify(vault, null, 2), 'utf-8');
  }

  upsertItem(itemData, clearanceData = null) {
    const db = this.read();
    const existingIndex = db.items.findIndex(i => i.id === itemData.id);

    const now = new Date().toISOString();
    let savedItem;
    if (existingIndex >= 0) {
      const existing = db.items[existingIndex];
      savedItem = {
        ...existing,
        ...itemData,
        public_token: itemData.public_token || existing.public_token || generatePublicToken(),
        channels: itemData.channels || existing.channels || createDefaultChannels(),
        updated_at: now,
      };
      db.items[existingIndex] = savedItem;
    } else {
      savedItem = {
        ...itemData,
        public_token: itemData.public_token || generatePublicToken(),
        channels: itemData.channels || createDefaultChannels(),
        created_at: now,
        updated_at: now,
      };
      db.items.push(savedItem);
    }

    this.write(db);

    if (clearanceData && savedItem.clearance_identifiers?.vault_ref) {
      const vault = this.readVault();
      vault.records[savedItem.clearance_identifiers.vault_ref] = {
        item_id: savedItem.id,
        updated_at: now,
        ...clearanceData,
      };
      this.writeVault(vault);
    }

    return savedItem;
  }

  /**
   * Backfills persistent unguessable public_token and channel tracking objects
   * on all existing inventory items without overwriting existing tokens.
   */
  ensureAllTokensAndChannels() {
    const db = this.read();
    let changed = 0;
    const seen = new Set(db.items.map(i => i.public_token).filter(Boolean));

    for (const item of db.items) {
      let itemChanged = false;
      if (!item.public_token) {
        let token = generatePublicToken();
        while (seen.has(token)) {
          token = generatePublicToken();
        }
        seen.add(token);
        item.public_token = token;
        itemChanged = true;
      }
      if (!item.channels) {
        item.channels = createDefaultChannels();
        itemChanged = true;
      }
      if (itemChanged) changed++;
    }

    if (changed > 0) {
      this.write(db);
    }
    return { total: db.items.length, updated: changed };
  }

  /**
   * Updates marketplace channel state (facebook, kijiji, ebay) for an item.
   */
  updateChannelState(itemId, channel, patch = {}) {
    const validChannels = ['facebook', 'kijiji', 'ebay'];
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel "${channel}". Expected one of: ${validChannels.join(', ')}`);
    }

    const db = this.read();
    const item = db.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Item "${itemId}" not found.`);
    }

    if (!item.channels) {
      item.channels = createDefaultChannels();
    }

    const now = new Date().toISOString();
    item.channels[channel] = {
      ...item.channels[channel],
      ...patch,
      last_synced_at: now,
    };
    if (patch.status === 'listed' && !item.channels[channel].posted_at) {
      item.channels[channel].posted_at = now;
    }
    item.updated_at = now;

    this.write(db);
    return item;
  }

  /**
   * Marks an item as sold and flags any other listed channels as 'needs_delist'.
   */
  markSoldAndFlagChannels(itemId, soldChannel = null) {
    const db = this.read();
    const item = db.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Item "${itemId}" not found.`);
    }

    if (!item.channels) {
      item.channels = createDefaultChannels();
    }

    const now = new Date().toISOString();
    item.status = 'sold';
    item.updated_at = now;

    const flaggedToDelist = [];
    for (const ch of ['facebook', 'kijiji', 'ebay']) {
      if (soldChannel && ch === soldChannel) {
        item.channels[ch].status = 'sold';
        item.channels[ch].last_synced_at = now;
      } else if (item.channels[ch]?.status === 'listed') {
        item.channels[ch].status = 'needs_delist';
        item.channels[ch].last_synced_at = now;
        flaggedToDelist.push({ channel: ch, url: item.channels[ch].url, listing_id: item.channels[ch].listing_id || null });
      }
    }

    this.write(db);
    return { item, flaggedToDelist };
  }
}
