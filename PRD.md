# Product Requirements Document (PRD): letgolist (Circular Asset Management & Regional Intelligence)

## 1. Executive Summary & North Star Metric

**letgolist** is an intelligent, circular asset liquidation and inventory management platform designed to eliminate friction in parting with items, tracking sidelined inventory, and maximizing functional reuse over wasteful disposal. It combines vision-assisted asset intake, guided interactive valuation, multi-channel marketplace copy generation, a high-performance browsable public catalog, and a persistent regional sales data store.

### North Star Metric
> **Time-to-Liquidity Efficiency (TLE):** Reduce total user active interaction time per liquidated asset from $> 30$ minutes (manual photo editing, spec lookup, copywriting, price researching, and multi-app posting) to **$< 3$ minutes**, while achieving $\ge 90\%$ of fair regional secondary market value.

---

## 2. Problem Statement & Strategic Goals

1. **High Friction in Asset Liquidation:** High mental overhead in determining market prices, crafting platform-specific ads, managing messaging, and coordinating physical storage leads to clutter and deferred action.
2. **Wasteful Obsolescence vs. Circular Rehaul:** Usable tech and appliances are prematurely scrapped or discarded due to lack of exposure and accessible local secondary channels.
3. **Lack of Personal Inventory Visibility:** Items "sidelined" in storage bins, closets, or basements become forgotten without a unified ledger indicating their exact physical location and readiness for sale.
4. **Isolated Marketplaces:** Selling across Kijiji, FB Marketplace, and eBay requires duplicate data entry and manual synchronization.

---

## 3. MoSCoW Scope Boundary

### MUST Have (Phase 1 Baseline)
* **Local Ingestion & Catalog Scanner:** Recursive parser for the `Sales/` folder mapping image paths, item identifiers, and folder hierarchies into structured records.
* **Interactive Curation Agent:** Terminal / interactive prompt to triage each discovered lot, confirm model/specs, identify physical storage location, and set condition.
* **Unified Asset Schema:** JSON / SQLite store supporting core fields (`id`, `sku`, `title`, `category`, `specs`, `condition`, `physical_location`, `pricing_tiers`, `status`, `media_paths`).
* **Multi-Channel Syndication Copy Generator:** Platform-optimized listing outputs (title, markdown/plain-text description, tags, suggested category) tailored for:
  - Facebook Marketplace (concise, local pickup friendly, feature bullets)
  - Kijiji (local regional Ontario focus, payment/pickup terms)
  - eBay (detailed specifications, model numbers, shipping parameters)
* **High-Performance Public Browsable Catalog:** Responsive web showcase (filterable by category, price, availability status) ready for immediate deployment via Cloudflare Pages or Cloudflare Tunnel.

### SHOULD Have (Phase 2 Enhancement)
* **Regional Public Comps Data Store:** Normalized schema to store historical sales data, observed asking prices, and regional market liquidity curves.
* **Valuation Tiers:** Automatic calculation of *Fast Liquidation* (discounted for rapid pickup), *Fair Market*, and *Optimistic Anchor* pricing.
* **QR / Barcode Sidelining Labels:** Printable or renderable identifiers for physical storage boxes/bins.

### COULD Have (Phase 3 Expansion)
* **Vehicles & Heavy Equipment Module:** Specialized schema extensions (VIN decoding, mileage, drivetrain, safety certificate status).
* **Automated Headless Syndication:** Playwright / browser automation for posting drafts directly into marketplace accounts where permitted by terms.
* **Multi-Tenant Warehouse Management (WMS):** Inbound receipt, picking, pallet/shelf bin hierarchy, and multi-user inventory API.

### WON'T Have (Out of Initial Scope)
* In-app proprietary payment processing (transactions settle via e-Transfer, cash on pickup, or native platform escrow).
* Shipping carrier API integrations with label printing in initial phase.

---

## 4. Architectural Layers

1. **Intake & Discovery Layer:** Watches/reads `Sales/` directory; groups media files into logical lots.
2. **Intelligence & Valuation Layer:** Analyzes photos, queries public specs, prompts user for unknown attributes, and computes pricing recommendations.
3. **Ledger & Persistence Layer:** Local durable store (e.g. SQLite / structured JSON) maintaining single-source-of-truth inventory state.
4. **Presentation & Syndication Layer:**
   - Static/SSR Web Catalog for public showcase.
   - Formatted clipboard/export bundles for one-click marketplace submission.
5. **Analytics & Regional Store:** Seed repository for regional comps, depreciation curves, and circular reuse metrics.

---

## 5. Harm-Based Information Classification & Clearance Vaulting

All data handled within `letgolist` (whether destined for external AI ingestion or public web syndication) is classified strictly by **Harm if Exposed**, eliminating artificial splits between AI and public visibility:

1. **Classification Matrix:**
   - **Critical / High Harm (Never Exposed):** Private financial details, exact home address, personal phone numbers, and private identity documents. These are either permanently scrubbed via `piiScrub` or stored strictly within an encrypted local clearance vault.
   - **Operational & Verification Identifiers (Referenced & Hidden):** Dell Service Tags, Apple Serial Numbers, IMEI, and Vehicle Identification Numbers (VINs).
     - *In Transit / Public / AI:* Represented by context-preserving surrogate tokens (`{{SERVICE_TAG_1}}`, `{{VIN_1}}`) generated via `piiScrub` tokenization vaults.
     - *Clearance Recall:* Preserved securely in the local ledger so they can be recalled and disclosed on-demand to verified buyers (e.g., verifying Dell warranty status or running a vehicle history report).
   - **Public Specifications (Freely Exposed):** Brand, model family, dimensions, general specifications, cosmetic grading, and functional condition.

---

## 6. Geographic Specificity & Privacy Architecture

Classified buyers require regional distance awareness, while sellers require privacy and defense against unwanted in-person visits:
1. **Public / Advertising Layer:** Restricted to high-level geographic areas:
   - Canada: Forward Sortation Area (FSA - first 3 characters of postal code, e.g. `K1A`, `M5V`) or major municipal intersection.
   - US: 3-digit ZIP prefix or metropolitan region.
2. **Clearance Pickup Layer:** Exact residential street address and apartment numbers are preserved in the secure local vault and released exclusively when a transaction reaches the `reserved` status with a confirmed pickup appointment.

---

## 7. Sovereign Client Feedback & Continuous Improvement Architecture

In alignment with Section 6 of Universal Agent Governance, `letgolist` enforces autonomous product feedback loops:
1. **As a Client of `piiScrub`:** `letgolist` stages structured telemetry on false positives, false negatives, and asset-specific identifier edge cases, delivering it through `piiScrub`'s self-designed client intake protocol.
2. **For Clients of `letgolist`:** `letgolist` establishes its own public feedback intake contract (`feedback/inbox/` and CLI `--feedback`), enabling downstream consumers (e.g. `pagesCloudflare`, `reachMe`, warehouse management clients) to submit product improvement data, schema gap requests, and synchronization telemetry back to `letgolist`.

