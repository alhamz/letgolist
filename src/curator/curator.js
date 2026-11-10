/**
 * letgolist - Interactive Curation Engine
 * Manages item curation workflows, missing spec discovery,
 * physical storage sidelining assignment, and piiScrub clearance vaulting.
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { InventoryStore, CONDITIONS, LIFECYCLE_STATUSES } from '../model/schema.js';
import { PiiClient } from '../security/piiClient.js';
import { resolve } from 'node:path';

export class ItemCurator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.store = new InventoryStore({ projectRoot: this.projectRoot });
    this.piiClient = new PiiClient();
  }

  /**
   * Returns list of items pending curation (draft status).
   */
  getPendingItems() {
    const db = this.store.read();
    return (db.items || []).filter(item => item.status === 'draft');
  }

  /**
   * Retrieves a single item by its unique ID.
   */
  getItem(id) {
    const db = this.store.read();
    return (db.items || []).find(item => item.id === id);
  }

  /**
   * Programmatically updates an item with curated attributes,
   * enforcing clearance vaulting for sensitive hardware identifiers.
   */
  curateItem(id, updates = {}) {
    const db = this.store.read();
    const item = db.items.find(i => i.id === id);
    if (!item) {
      throw new Error(`Item with ID "${id}" not found.`);
    }

    // Merge basic attributes
    if (updates.title) item.title = updates.title;
    if (updates.brand) item.brand = updates.brand;
    if (updates.model) item.model = updates.model;
    if (updates.category) item.category = updates.category;
    if (updates.condition && CONDITIONS.includes(updates.condition)) {
      item.condition = updates.condition;
    }

    // Merge location
    if (updates.location) {
      if (updates.location.public_region) {
        item.location.public_region = {
          ...item.location.public_region,
          ...updates.location.public_region,
        };
      }
      if (updates.location.internal_sidelining) {
        item.location.internal_sidelining = {
          ...item.location.internal_sidelining,
          ...updates.location.internal_sidelining,
        };
      }
    }

    // Merge specs
    if (updates.specs) {
      item.specs = {
        ...item.specs,
        ...updates.specs,
      };
    }

    // Handle sensitive clearance identifiers (Service Tag, Serial, VIN)
    let clearanceData = null;
    if (updates.clearance_identifiers && updates.clearance_identifiers.raw_identifiers) {
      const rawIdentifiers = updates.clearance_identifiers.raw_identifiers;
      const vaultPath = resolve(this.projectRoot, 'data', `vault_${item.id}.json`);
      
      const textToTokenize = Object.entries(rawIdentifiers)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      const tokenizedResult = this.piiClient.tokenize(textToTokenize, vaultPath);

      item.clearance_identifiers = {
        tokenized_tags: [tokenizedResult],
        vault_ref: `vlt_${item.id}`,
      };

      clearanceData = {
        raw_identifiers: rawIdentifiers,
        exact_pickup_address: updates.location?.exact_address || null,
        tokenized_text: tokenizedResult,
      };
    }

    // Merge pricing
    if (updates.pricing) {
      item.pricing = {
        ...item.pricing,
        ...updates.pricing,
      };
    }

    // Update circular recovery metrics if provided
    if (updates.circular_metrics) {
      item.circular_metrics = {
        ...item.circular_metrics,
        ...updates.circular_metrics,
      };
    }

    // Update status
    if (updates.status && LIFECYCLE_STATUSES.includes(updates.status)) {
      item.status = updates.status;
    } else if (item.status === 'draft') {
      // Default to sidelined once basic specs and location are confirmed
      item.status = 'sidelined';
    }

    // Regenerate syndication ad copy drafts
    this._refreshSyndication(item);

    // Save to store
    this.store.upsertItem(item, clearanceData);
    return item;
  }

  _refreshSyndication(item) {
    const loc = item.location?.public_region;
    const locStr = loc ? `${loc.city} (${loc.postal_area})` : 'Local Ottawa Area';

    // Facebook Marketplace (Concise, key features, local pickup)
    const fbBullets = Object.entries(item.specs || {})
      .filter(([k]) => !k.startsWith('inferred') && k !== 'media_count')
      .map(([k, v]) => `• ${k.replace(/_/g, ' ')}: ${v}`)
      .join('\n');

    item.syndication.facebook = {
      title: item.title,
      description: `${item.title}\n\nCondition: ${item.condition.replace(/_/g, ' ').toUpperCase()}\n\nKey Specs & Details:\n${fbBullets || '• Fully tested and clean'}\n\nPickup Location: ${locStr}\nCash or Interac e-Transfer upon inspection.`,
      tags: [item.category, item.brand, item.model].filter(Boolean),
    };

    // Kijiji (Detailed, regional Ontario focus, clear payment/terms)
    item.syndication.kijiji = {
      title: `${item.title} - ${locStr}`,
      description: `For sale: ${item.title} in ${item.condition.replace(/_/g, ' ')} condition.\n\nSpecifications:\n${fbBullets || '• Standard specifications'}\n\nLocation: Pickup in ${locStr}.\nContact for any questions or to schedule a pickup.`,
      tags: [item.category, item.brand, 'local pickup', 'classifieds'],
    };

    // eBay (Detailed specs, tokenized identifiers)
    item.syndication.ebay = {
      title: `${item.brand} ${item.model} ${item.title}`.slice(0, 80),
      description: `Item: ${item.title}\nBrand: ${item.brand}\nModel: ${item.model}\nCondition: ${item.condition}\n\nSpecifications:\n${fbBullets}`,
      shipping_weight_kg: item.circular_metrics?.estimated_weight_kg || 1.0,
    };
  }

  /**
   * Interactive CLI wizard to curate an item via terminal prompts.
   */
  async runInteractiveCuration(targetId = null) {
    const rl = readline.createInterface({ input, output });

    try {
      const itemsToCurate = targetId 
        ? [this.getItem(targetId)].filter(Boolean)
        : this.getPendingItems();

      if (itemsToCurate.length === 0) {
        console.log('\nNo items pending curation. All items are cataloged!\n');
        return;
      }

      console.log(`\nStarting Curation Wizard (${itemsToCurate.length} items to review)...\n`);

      for (let i = 0; i < itemsToCurate.length; i++) {
        const item = itemsToCurate[i];
        console.log(`\n======================================================`);
        console.log(`[Item ${i + 1}/${itemsToCurate.length}] ID: ${item.id}`);
        console.log(`Title:    ${item.title}`);
        console.log(`Category: ${item.category} | Brand: ${item.brand} | Model: ${item.model}`);
        console.log(`Photos (${item.media?.gallery?.length || 0}):`);
        for (const p of (item.media?.gallery || []).slice(0, 3)) {
          console.log(`   - ${p}`);
        }
        if ((item.media?.gallery?.length || 0) > 3) {
          console.log(`   - ...and ${item.media.gallery.length - 3} more photos`);
        }
        console.log(`Current Sidelining: ${item.location.internal_sidelining.zone} -> ${item.location.internal_sidelining.shelf_or_bin}`);
        console.log(`======================================================`);

        const action = await rl.question('\nOptions: [c]urate, [s]kip, [q]uit: ');
        if (action.toLowerCase() === 'q') break;
        if (action.toLowerCase() === 's') continue;

        // Collect updates
        const updates = { specs: {}, location: { internal_sidelining: {} }, pricing: {} };

        // 1. Title & Model Confirmation
        const newTitle = await rl.question(`Title [${item.title}]: `);
        if (newTitle.trim()) updates.title = newTitle.trim();

        // 2. Condition
        console.log(`Available conditions: ${CONDITIONS.join(', ')}`);
        const cond = await rl.question(`Condition [${item.condition}]: `);
        if (cond.trim() && CONDITIONS.includes(cond.trim())) {
          updates.condition = cond.trim();
        }

        // 3. Category-Specific Specs
        if (item.category === 'Laptops' || item.category === 'Tablets' || item.category === 'Phones') {
          const storage = await rl.question('Storage Capacity (e.g. 64GB, 256GB SSD) [Skip]: ');
          if (storage.trim()) updates.specs.storage = storage.trim();

          const ram = await rl.question('RAM / Memory (e.g. 8GB, 16GB) [Skip]: ');
          if (ram.trim()) updates.specs.ram = ram.trim();

          const battery = await rl.question('Battery Health / Status (e.g. 88%, Good, Normal) [Skip]: ');
          if (battery.trim()) updates.specs.battery = battery.trim();

          const accessories = await rl.question('Included Accessories (e.g. Charger, Original Box, Case) [Skip]: ');
          if (accessories.trim()) updates.specs.accessories = accessories.trim();

          const serial = await rl.question('Serial / Service Tag (Stored securely in Clearance Vault) [Skip]: ');
          if (serial.trim()) {
            updates.clearance_identifiers = {
              raw_identifiers: {
                hardware_serial: serial.trim(),
              },
            };
          }
        } else if (item.category === 'Car Seats & Baby Gear') {
          const expiry = await rl.question('Manufacturer Expiry Date (MM/YYYY) [Skip]: ');
          if (expiry.trim()) updates.specs.expiry_date = expiry.trim();

          const standard = await rl.question('CMVSS / Safety Sticker Verified (yes/no) [yes]: ');
          updates.specs.safety_compliance = standard.trim() || 'yes';
        } else if (item.category === 'Docks' || item.category === 'Networking') {
          const power = await rl.question('Power Adapter Included (yes/no) [yes]: ');
          updates.specs.power_supply_included = power.trim() || 'yes';

          const tested = await rl.question('Functional Test Status (e.g. Tested Working, Powers On) [Tested Working]: ');
          updates.specs.test_status = tested.trim() || 'Tested Working';
        }

        // 4. Physical Sidelining Location
        const zone = await rl.question(`Storage Zone [${item.location.internal_sidelining.zone}]: `);
        const shelf = await rl.question(`Shelf / Bin / Rack [${item.location.internal_sidelining.shelf_or_bin}]: `);
        if (zone.trim()) updates.location.internal_sidelining.zone = zone.trim();
        if (shelf.trim()) updates.location.internal_sidelining.shelf_or_bin = shelf.trim();

        // 5. Pricing
        const fastPrice = await rl.question('Fast Liquidation Price ($ CAD) [Skip]: ');
        if (fastPrice.trim()) updates.pricing.fast_liquidation = parseFloat(fastPrice.trim());

        const fairPrice = await rl.question('Fair Market Asking Price ($ CAD) [Skip]: ');
        if (fairPrice.trim()) {
          updates.pricing.fair_market = parseFloat(fairPrice.trim());
          updates.pricing.active_price = parseFloat(fairPrice.trim());
        }

        const optimisticPrice = await rl.question('Optimistic Anchor Price ($ CAD) [Skip]: ');
        if (optimisticPrice.trim()) updates.pricing.optimistic_anchor = parseFloat(optimisticPrice.trim());

        // 6. Target Status
        const statusChoice = await rl.question('Set Status: [s]idelined (cataloged), [a]ctive (ready to list), [d]raft [sidelined]: ');
        if (statusChoice.toLowerCase() === 'a') updates.status = 'active';
        else if (statusChoice.toLowerCase() === 'd') updates.status = 'draft';
        else updates.status = 'sidelined';

        // Save curation
        const curated = this.curateItem(item.id, updates);
        console.log(`\n✔ Item "${curated.id}" successfully curated! Status: ${curated.status.toUpperCase()}`);
      }

      console.log('\nCuration session completed!\n');
    } finally {
      rl.close();
    }
  }
}
