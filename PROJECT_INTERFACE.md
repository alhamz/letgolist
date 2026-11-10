# Project Interface Specification: letgolist

> **Canonical Workspace:** `c:\Users\alihm\Projects\letgolist`  
> **Host:** `theCore` (`10.23.40.3`)  
> **Status:** Active / Interoperable Contract  
> **Last Updated:** 2026-11-10

This specification defines the machine-readable file paths, data schemas, and integration points so that **any other project on `theCore`** (e.g. `pagesCloudflare`, `reachMe`, `reachCore`, `syncServe`, `infraEng`, `backupCore`) can read and infuse with this project's state without ambiguity.

---

## 1. Canonical State & Data Files

| Artifact | Relative Path | Format | Inter-Project Consumer Role |
| :--- | :--- | :--- | :--- |
| **Project State** | `PROJECT_STATE.md` | Markdown | Read by any agent performing cross-project drift checks or multi-repo synchronization. |
| **Project Manifest** | `project-manifest.json` | JSON | Machine-readable metadata: version, repository state, export paths, and integration hooks. |
| **Inventory Ledger** | `data/inventory.json` | JSON | Authoritative single-source-of-truth inventory data (items, specs, sidelining location, price, status). Read directly by web frontends (e.g., `pagesCloudflare`). |
| **Regional Comps Store** | `data/regional_comps.json` | JSON | Historical secondary market prices, observed sales, and circular recovery metrics. |
| **Compiled Web Catalog** | `dist/` | Static Web Assets | Pre-rendered HTML/CSS/JS showroom artifacts for standalone deployment or subpath routing. |
| **Media Repository** | `Sales/` | File Hierarchy | Categorized asset media, product photos, and condition documentation. |

---

## 2. Core Data Contracts (`data/inventory.json`)

External projects reading `data/inventory.json` can rely on the following typed contract:

```typescript
export interface InventoryDatabase {
  schema_version: string;        // e.g. "1.0.0"
  last_updated: string;          // ISO 8601 UTC timestamp
  summary: {
    total_items: number;
    active_listings: number;
    sidelined_items: number;
    sold_items: number;
    total_estimated_value: number;
    circular_ewaste_diverted_kg: number;
  };
  items: InventoryItem[];
}

export type LifecycleStatus = 
  | 'draft'          // Discovered media, pending full triage
  | 'sidelined'      // In storage, cataloged, ready for listing
  | 'active'         // Published across market channels
  | 'reserved'       // Buyer offer accepted / pending pickup
  | 'sold'           // Handed off / finalized
  | 'archived';      // Withdrawn or kept for internal use

export interface InventoryItem {
  id: string;                    // Unique slug, e.g. "dell-latitude-lot-1"
  sku: string;                   // Human readable SKU, e.g. "TECH-DELL-LAT-001"
  title: string;                 // Clean public title
  category: string;              // e.g. "Laptops", "Car Seats", "Networking", "Vehicles"
  brand: string;
  model: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'needs_rehaul' | 'parts_only';
  physical_location: {
    zone: string;                // e.g. "Office", "Basement", "Garage"
    shelf_or_bin: string;        // e.g. "Shelf B2", "Storage Box #4"
  };
  specs: Record<string, any>;    // Polymorphic specs (CPU, RAM, storage, safety cert, VIN)
  pricing: {
    currency: 'CAD' | 'USD';
    fast_liquidation: number;    // Quick cash / low-friction local price
    fair_market: number;         // Standard competitive price
    optimistic_anchor: number;   // High-margin starting point
    active_price: number;        // Current asking price
    sold_price?: number;
  };
  status: LifecycleStatus;
  media: {
    primary_image: string;       // Relative path to hero photo
    gallery: string[];           // Additional image paths
  };
  syndication: {
    facebook?: { title: string; description: string; tags: string[] };
    kijiji?: { title: string; description: string; tags: string[] };
    ebay?: { title: string; description: string; shipping_weight_kg?: number };
  };
  created_at: string;
  updated_at: string;
}
```

---

## 3. Integration Recipes for Neighboring Projects

### A. Infusion with `pagesCloudflare` (Portfolio Integration)
* **Goal:** Present your available inventory under `portfolio.alhamaz.me/inventory` or a dedicated showcase widget.
* **Mechanism:**
  - `pagesCloudflare` can read `c:\Users\alihm\Projects\letgolist\data\inventory.json` during build time, or dynamically import the pre-rendered web catalog from `dist/`.
  - Alternatively, a shared GitHub Actions / local build script copies `data/inventory.json` into `pagesCloudflare/public/inventory.json`.

### B. Infusion with `syncServe` (Syncthing Mobile Intake)
* **Goal:** Zero-click intake from your smartphone camera.
* **Mechanism:**
  - A Syncthing folder mapped on `CT300` (`10.23.45.105`) synchronizes a designated camera folder on your phone directly to `c:\Users\alihm\Projects\letgolist\Sales/Intake`.
  - The local `letgolist` agent monitors this directory for new files.

### C. Infusion with `backupCore` (`CT200`)
* **Goal:** Automated backup and off-site synchronization of inventory records and media.
* **Mechanism:**
  - Defined in `c:\Users\alihm\Projects\backupCore\targets.d\letgolist.sh`:
    - Backs up Git bundle, `data/inventory.json`, and `data/regional_comps.json`.

### D. Infusion with `reachCore` / `reachMe` (`CT1000` / `CT2000`)
* **Goal:** Real-time buyer notifications and communication switchboard.
* **Mechanism:**
  - Public catalog contact links generate a secure P2P inquiry routed into `reachMe` (`reachme.alhamaz.me`), allowing prospective buyers to communicate without leaking personal phone numbers.
