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
  location: {
    public_region: {
      country: string;           // e.g. "CA" or "US"
      region: string;            // e.g. "ON"
      city: string;              // e.g. "Ottawa"
      postal_area: string;       // First 3 characters (FSA) e.g. "K1A" or 3-digit ZIP
    };
    internal_sidelining: {
      zone: string;              // e.g. "Office", "Basement", "Garage"
      shelf_or_bin: string;      // e.g. "Shelf B2", "Storage Box #4"
    };
    clearance_vault_ref?: string;// References vaulted exact pickup address (unlocked upon 'reserved' status)
  };
  specs: Record<string, any>;    // Public specs (CPU, RAM, storage, safety cert)
  clearance_identifiers?: {
    tokenized_tags: string[];    // e.g. ["{{SERVICE_TAG_1}}", "{{VIN_1}}"]
    vault_ref: string;           // Vault key holding real Service Tag / Serial / VIN
  };
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

---

## 4. `letgolist` Sovereign Client Feedback Protocol

In accordance with Section 6 of Universal Agent Governance, `letgolist` defines its own public feedback intake contract for downstream consumers (e.g. `pagesCloudflare`, `reachMe`, external WMS systems).

Downstream clients submit product improvement requests, missing schema attribute notices, or synchronization latency reports to `letgolist` via:

### A. Feedback Drop Inbox (`feedback/inbox/`)
Clients stage feedback events as JSON files in `c:\Users\alihm\Projects\letgolist\feedback\inbox/<client_name>_<timestamp>.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "client_project": "pagesCloudflare",
  "client_version": "1.2.0",
  "timestamp": "2026-11-10T14:30:00.000Z",
  "feedback_category": "schema_enhancement | rendering_issue | sync_latency | bug_report",
  "summary": "Need webp image variants for faster mobile rendering",
  "context": {
    "requested_fields": ["media.webp_thumbnails"],
    "observed_impact": "LCP performance score on mobile showroom dropped 12 points"
  },
  "suggested_improvement": "Generate optimized webp thumbnails during the build or intake step"
}
```

### B. Ingestion Protocol
During Turn 0 drift reconciliation and milestone planning, the `letgolist` agent scans `feedback/inbox/`, aggregates telemetry, updates `SESSION_LOG.md`, and prioritizes backlog adjustments.

---

## 5. Upstream Client Telemetry for `piiScrub`

As a consumer of `piiScrub`, `letgolist` stages feedback events under `feedback/outbox/piiScrub_feedback.jsonl` tracking:
* False positives on asset model numbers, dock SKUs, and firewall codes (e.g. `WD19S`, `TZ300W`).
* Tokenization and detokenization vault roundtrip accuracy.
* Format and latency reports.

When `piiScrub` publishes its intake method, `letgolist` delivers staged events through that channel.

