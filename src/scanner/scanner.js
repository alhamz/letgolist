/**
 * letgolist - Sales Directory Ingestion & Catalog Scanner
 * Recursively discovers assets, lots, and media in Sales/
 * Maps them into typed InventoryItem records, integrating with PiiClient.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';
import { PiiClient } from '../security/piiClient.js';
import { InventoryStore } from '../model/schema.js';

const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.mov', '.mp4'];

export class CatalogScanner {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.salesDir = options.salesDir || resolve(this.projectRoot, 'Sales');
    this.store = new InventoryStore({ projectRoot: this.projectRoot });
    this.piiClient = new PiiClient();
  }

  /**
   * Scans the Sales directory and returns all discovered candidate item lots.
   */
  scan() {
    if (!existsSync(this.salesDir)) {
      throw new Error(`Sales directory not found at: ${this.salesDir}`);
    }

    const lots = [];
    this._traverse(this.salesDir, lots);

    // Persist discovered lots into inventory ledger idempotently
    const currentDb = this.store.read();
    let createdCount = 0;
    let updatedCount = 0;

    for (const lot of lots) {
      const existing = currentDb.items.find(i => i.id === lot.id);
      if (!existing) {
        this.store.upsertItem(lot);
        createdCount++;
      } else {
        // Update media paths if new files were added
        const mergedGallery = Array.from(new Set([...(existing.media?.gallery || []), ...(lot.media.gallery || [])]));
        existing.media.gallery = mergedGallery;
        if (!existing.media.primary_image && lot.media.primary_image) {
          existing.media.primary_image = lot.media.primary_image;
        }
        this.store.upsertItem(existing);
        updatedCount++;
      }
    }

    const finalDb = this.store.read();
    return {
      total_lots_discovered: lots.length,
      created_count: createdCount,
      updated_count: updatedCount,
      summary: finalDb.summary,
      items: finalDb.items,
    };
  }

  _traverse(currentPath, lots) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    const files = [];
    const dirs = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(entry.name);
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'));
        if (MEDIA_EXTENSIONS.includes(ext)) {
          files.push(entry.name);
        }
      }
    }

    // If current directory contains media files, treat it as an item lot
    if (files.length > 0) {
      const lot = this._buildLotRecord(currentPath, files);
      lots.push(lot);
    }

    // Recurse into subdirectories
    for (const dir of dirs) {
      this._traverse(join(currentPath, dir), lots);
    }
  }

  _buildLotRecord(lotPath, fileNames) {
    const relPath = relative(this.salesDir, lotPath);
    const pathParts = relPath.split(/[\\/]/);
    const topCategory = pathParts[0] || 'Uncategorized';
    const subFolder = pathParts.slice(1).join(' ') || topCategory;

    // Generate stable unique slug
    const slug = relPath
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { category, brand, model, title, weightKg, defaultLocation } = this._inferAttributes(pathParts);

    // Sort media, picking primary image (prefer jpg/png over video)
    const sortedFiles = [...fileNames].sort((a, b) => {
      const isMovA = a.toLowerCase().endsWith('.mov') || a.toLowerCase().endsWith('.mp4');
      const isMovB = b.toLowerCase().endsWith('.mov') || b.toLowerCase().endsWith('.mp4');
      if (isMovA && !isMovB) return 1;
      if (!isMovA && isMovB) return -1;
      return a.localeCompare(b);
    });

    const mediaPaths = sortedFiles.map(f => relative(this.projectRoot, join(lotPath, f)).replace(/\\/g, '/'));
    const primaryImage = mediaPaths.find(p => !p.endsWith('.mov') && !p.endsWith('.mp4')) || mediaPaths[0] || '';

    // Generate SKU
    const sku = this._generateSku(category, subFolder);

    return {
      id: slug,
      sku,
      title,
      category,
      brand,
      model,
      condition: 'good',
      location: {
        public_region: {
          country: 'CA',
          region: 'ON',
          city: 'Ottawa',
          postal_area: 'K1A area',
        },
        internal_sidelining: defaultLocation,
      },
      specs: {
        inferred_from_path: relPath,
        media_count: fileNames.length,
      },
      clearance_identifiers: {
        tokenized_tags: [],
        vault_ref: `vlt_${slug}`,
      },
      pricing: {
        currency: 'CAD',
        fast_liquidation: 0,
        fair_market: 0,
        optimistic_anchor: 0,
        active_price: 0,
      },
      circular_metrics: {
        estimated_weight_kg: weightKg,
        refurb_status: 'ready_for_curation',
      },
      status: 'draft',
      media: {
        primary_image: primaryImage,
        gallery: mediaPaths,
      },
      syndication: {
        facebook: { title, description: '', tags: [] },
        kijiji: { title, description: '', tags: [] },
        ebay: { title, description: '' },
      },
    };
  }

  _inferAttributes(pathParts) {
    const top = pathParts[0];
    const sub = pathParts.slice(1).join(' ');

    let category = 'Other';
    let brand = 'Generic';
    let model = sub || top;
    let title = `${top} - ${sub}`;
    let weightKg = 1.0;
    let defaultLocation = { zone: 'Storage', shelf_or_bin: 'General Sidelining' };

    switch (top) {
      case 'CarSeats':
        category = 'Car Seats & Baby Gear';
        weightKg = 8.5;
        defaultLocation = { zone: 'Basement', shelf_or_bin: 'Baby Gear Rack' };
        if (sub.includes('AhmedBooster')) {
          brand = 'Cosco / Safety 1st';
          model = 'Booster Seat';
          title = 'Highback Booster Car Seat';
        } else if (sub.includes('EvenFloTriumph')) {
          brand = 'Evenflo';
          model = 'Triumph Convertible';
          title = 'Evenflo Triumph Convertible Car Seat';
        } else if (sub.includes('HarmonyCommanderDeluxe')) {
          brand = 'Harmony';
          model = 'Commander Deluxe';
          title = 'Harmony Commander Deluxe Youth Booster Seat';
        }
        break;

      case 'Dock':
        category = 'Docks';
        brand = 'Dell';
        weightKg = 1.2;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Dock Bin #1' };
        if (sub.includes('WD15')) {
          model = 'WD15 USB-C';
          title = 'Dell WD15 K17A USB-C Docking Station with Power Supply';
        } else if (sub.includes('WD19S')) {
          model = 'WD19S Modular USB-C';
          title = 'Dell WD19S 130W/180W USB-C Modular Docking Station';
        }
        break;

      case 'Firewall':
        category = 'Firewalls & Security';
        brand = 'SonicWall (Dell)';
        model = 'TZ300W Wireless-AC';
        title = 'SonicWall TZ300W Wireless-AC Security Firewall';
        weightKg = 1.8;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Network Gear Shelf' };
        break;

      case 'iPad':
        category = 'Tablets';
        brand = 'Apple';
        weightKg = 0.5;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Tablet Drawer A' };
        if (sub.includes('6th Gen')) {
          model = `iPad (6th Generation) ${sub.includes('#1') ? 'Unit 2' : 'Unit 1'}`;
          title = `Apple iPad 6th Gen 9.7" Wi-Fi (${sub.includes('#1') ? 'Unit 2' : 'Unit 1'})`;
        } else if (sub.includes('9th Gen')) {
          model = `iPad (9th Generation) ${sub.includes('#1') ? 'Unit 2' : 'Unit 1'}`;
          title = `Apple iPad 9th Gen 10.2" Wi-Fi (${sub.includes('#1') ? 'Unit 2' : 'Unit 1'})`;
        } else if (sub.includes('Accessories')) {
          category = 'Peripherals & Accessories';
          model = sub;
          title = `Apple iPad Accessory - ${sub}`;
        }
        break;

      case 'iPhones':
        category = 'Phones';
        brand = 'Apple';
        weightKg = 0.25;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Phone Tray' };
        if (sub.includes('11Pro')) {
          model = 'iPhone 11 Pro';
          title = 'Apple iPhone 11 Pro';
        } else if (sub.includes('6S')) {
          model = 'iPhone 6s';
          title = 'Apple iPhone 6s';
        } else if (sub.includes('7s') || sub.includes('7')) {
          model = 'iPhone 7';
          title = 'Apple iPhone 7';
        } else if (sub.includes('8Plus')) {
          model = 'iPhone 8 Plus';
          title = 'Apple iPhone 8 Plus';
        }
        break;

      case 'Latitutde':
        category = 'Laptops';
        brand = 'Dell';
        model = `Latitude Series (${sub})`;
        title = `Dell Latitude Enterprise Laptop ${sub}`;
        weightKg = 2.1;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Laptop Rack B' };
        break;

      case 'Networking':
        category = 'Networking';
        weightKg = 0.6;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Networking Shelf' };
        if (sub.includes('powerline')) {
          brand = 'D-Link / TP-Link';
          model = 'AV Powerline Adapter Kit';
          title = 'Ethernet-over-Power Powerline Adapter Kit';
        } else if (sub.includes('tp-link POE')) {
          brand = 'TP-Link';
          model = 'Gigabit PoE Injector';
          title = 'TP-Link Gigabit Power-over-Ethernet (PoE) Injector';
        }
        break;

      case 'Peripherals':
        category = 'Peripherals & Accessories';
        weightKg = 1.0;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Peripherals Bin' };
        if (sub.includes('ASUS')) {
          brand = 'ASUS';
          model = 'USB Desktop Keyboard';
          title = 'ASUS Wired Desktop Keyboard';
        } else if (sub.includes('Microsoft Designer')) {
          brand = 'Microsoft';
          model = 'Designer Bluetooth Desktop';
          title = 'Microsoft Designer Bluetooth Keyboard and Mouse Set';
        }
        break;

      case 'SurfacePros':
        category = 'Laptops';
        brand = 'Microsoft';
        model = `Surface Pro (${sub})`;
        title = `Microsoft Surface Pro 2-in-1 Tablet/Laptop ${sub}`;
        weightKg = 1.1;
        defaultLocation = { zone: 'Office', shelf_or_bin: 'Laptop Rack B' };
        break;

      case 'Treadmill':
        category = 'Fitness & Sports';
        brand = 'Folding Motorized';
        model = 'Compact Folding Electric Treadmill';
        title = 'Folding Motorized Running & Walking Treadmill with Console';
        weightKg = 42.0;
        defaultLocation = { zone: 'Basement / Gym', shelf_or_bin: 'Fitness Floor Area' };
        break;
    }

    return { category, brand, model, title, weightKg, defaultLocation };
  }

  _generateSku(category, subFolder) {
    const catCode = category.slice(0, 3).toUpperCase();
    const cleanSub = subFolder.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase().slice(0, 8);
    const rand = Math.floor(100 + Math.random() * 900);
    return `LGL-${catCode}-${cleanSub || 'LOT'}-${rand}`;
  }
}
