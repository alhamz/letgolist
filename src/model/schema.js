/**
 * letgolist - Asset Schema & Inventory Database Manager
 * Supports polymorphic categories (Tech, Baby/Child, Networking, Peripherals, Fitness, Vehicles).
 * Enforces harm-based classification, geographic specificity tiering, and clearance vaulting.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

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
    if (existingIndex >= 0) {
      db.items[existingIndex] = {
        ...db.items[existingIndex],
        ...itemData,
        updated_at: now,
      };
    } else {
      db.items.push({
        ...itemData,
        created_at: now,
        updated_at: now,
      });
    }

    this.write(db);

    if (clearanceData && itemData.clearance_identifiers?.vault_ref) {
      const vault = this.readVault();
      vault.records[itemData.clearance_identifiers.vault_ref] = {
        item_id: itemData.id,
        updated_at: now,
        ...clearanceData,
      };
      this.writeVault(vault);
    }

    return itemData;
  }
}
