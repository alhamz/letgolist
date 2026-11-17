# Project State: letgolist (Circular Asset Management & Regional Intelligence)

> **Canonical Host:** `theCore` (`10.23.40.3/24` on `LAN` `10.23.40.0/24`)  
> **Workspace Path:** `c:\Users\alihm\Projects\letgolist`  
> **Git Remote:** `git@github.com:alhamz/letgolist.git` (`origin/master` synced)  
> **Current Status:** Deployed Live to Cloudflare Pages (`https://letgolist.pages.dev`)  
> **Production Hostname:** `letgolist.pages.dev` (Cloudflare Pages legacy static workflow)  
> **Last Updated:** 2026-11-13

---

## 1. Network & Ingress Context (Inherited Baseline)

This project strictly adheres to the homelab network topology defined in `c:\Users\alihm\Projects\infraEng\NETWORK_CONTEXT.md`:

| Plane / Resource | Target IP / CIDR | Role & Policy |
| :--- | :--- | :--- |
| **Local Workstation (`theCore`)** | `10.23.40.3/24` | Primary development workstation (`LAN` `10.23.40.0/24`, Gateway `fence` `10.23.40.1`). |
| **Application Services (`SERV_VLAN`)** | `10.23.45.0/24` | Target plane for deployed backend APIs / containers (`vmbr0`, VLAN Tag `45`). Inbound from LAN permitted; inbound to `MGMT_VLAN` strictly blocked. |
| **Management Plane (`MGMT_VLAN`)** | `10.23.43.0/24` | Isolated hypervisors, iDRAC, switches, and gateway admin interfaces. Inaccessible from application workloads. |
| **Ingress Architecture (`alhamaz.me`)** | Cloudflare Pages / Tunnels | Public browsable catalog deployable via Cloudflare Pages or Cloudflare Tunnel (`cloudflared` connector targeting `http://localhost:<port>` inside target container). `SERV_VLAN` IPs (`10.23.45.x`) remain strictly internal to OPNsense (`fence`). |
| **Prohibited Subnets** | `10.0.0.0/24`, `10.11.12.0/24`, `10.39.64.0/24`, `10.11.13.0/24` | **NEVER BIND OR ROUTE.** |

---

## 2. Active Inventory Baseline (`Sales/` Directory)

Total scanned items: **10 top-level categories**, 403MB media assets:

1. **`CarSeats`**: `AhmedBooster` (4 photos), `EvenFloTriumph` (6 photos), `HarmonyCommanderDeluxe` (3 photos).
2. **`Dock`**: Dell `WD15` (2 photos), Dell `WD19S` (2 photos).
3. **`Firewall`**: Dell SonicWall `TZ300W` (3 photos).
4. **`iPad`**: 6th Gen (`#0` 5 photos, `#1` 3 photos), 9th Gen (`#0` 3 photos, `#1` 5 photos), Accessories (`LogitechCase`, `PinkCase`, `ZAGG Keyboard Case`).
5. **`iPhones`**: `iPhone11Pro`, `iPhone6S`, `iPhone7s`, `iPhone8Plus`.
6. **`Latitutde`**: Dell Latitude enterprise laptops (`%1` through `%6`).
7. **`Networking`**: Powerline adapters (2 photos), TP-Link PoE injector (4 photos).
8. **`Peripherals`**: ASUS keyboard (4 photos), Microsoft Designer keyboard and mouse (3 photos).
9. **`SurfacePros`**: Microsoft Surface Pro units (`_1` 4 photos, `_2` 4 photos).
10. **`Treadmill`**: Motorized folding treadmill (3 photos, 1 demonstration video).

---

## 3. Milestones & Implementation Roadmap

- [x] **Milestone 0: Discovery & Interpretation** (Aligned with user on circular economy, regional public comps data, and WMS scalability).
- [x] **Milestone 1: GitOps Governance Scaffolding** (`git init`, `PROJECT_STATE.md`, `SESSION_LOG.md`, `PRD.md`, `UserStories.md`).
- [x] **Milestone 2: Asset Data Schema & Inventory Model** (Normalized schema, polymorphic specs, sidelining location, harm-based classification, `data/inventory.json` with 30 discovered lots).
- [x] **Milestone 2.1: Sovereign Feedback & piiScrub Blackbox Integration** (`FEEDBACK.md`, `data/feedback.jsonl`, `src/security/piiClient.js`, automated upstream feedback handshake verified).
- [x] **Milestone 3.1: Interactive Curation Engine & CLI** (`src/curator/curator.js`, `bin/letgo.js curate`, clearance vaulting, dynamic multi-channel syndication refresh, 6/6 tests passing).
- [x] **Milestone 3.2: Lot Curation Execution (Completed)**
  - Enforced strict Zero-Residential-Exposure privacy: 0 residential addresses recorded or disclosed; local pickups designated exclusively at neutral public community landmarks in Milton, ON (`L9T area`).
  - Added `'in_use'` lifecycle state for assets deployed in daily operations (`dock-dell-wd19s` marked unavailable / dormant).
  - Added `'sold'` lifecycle state handling: suppresses active CTA, renders `[SOLD / LIQUIDATED]` badge, and preserves archival provenance.
  - Curated Batch 1 (Docks): `dock-dell-wd15` activated ($50 CAD, 130W OEM adapter, tested) with tracked shipping (Canada/International) and local public landmark hand-off.
  - Curated Batch 2 (Tablets & Accessories): 4 iPads activated (2x 6th Gen 32GB @ $150 CAD, 2x 9th Gen 64GB @ $280 CAD) + 3 standalone cases ($15–$35 CAD), with bidirectional related-accessories linking on each item profile.
  - Curated Batch 3 (Phones): 4 Apple iPhones activated (iPhone 11 Pro 64GB with cracked screen @ $175 CAD, iPhone 8 Plus 64GB @ $130 CAD, iPhone 7 32GB @ $70 CAD, iPhone 6s 32GB @ $50 CAD), with inter-phone cross-linking.
  - Curated Batch 4 (Laptops & 2-in-1s): 6 Dell Latitude laptops activated (3x Latitude 7490 @ $195 CAD, 1x Latitude 5400 @ $220 CAD, 2x Latitude 5420 i7 @ $380 CAD) with OEM power adapters and reciprocal WD15 dock cross-linking; 2x Surface Pro units marked `'sold'` ($240 CAD archival liquidated).
  - Curated Batch 5 (Networking): 3 networking lots activated (SonicWall TZ300W Wireless-AC @ $75 CAD with power brick & antenna, Speedy Link 200Mbps Powerline Kit pair @ $25 CAD, TP-Link TL-POE150S Gigabit PoE Injector @ $20 CAD like new in film).
  - Curated Batch 6 (Baby Gear & Fitness): 3x Car Seats marked `'sold'` (Evenflo Triumph, Highback Booster, Harmony Commander Deluxe); 1x XTERRA TR955 Folding Motorized Treadmill activated ($340 CAD with power incline, speakers, cooling fan, video demo verified).
  - Curated Batch 7 (Desktop Peripherals): 2 desktop keyboard & mouse sets activated (ASUS G01 Backlit Keyboard + USB Mouse Set @ $30 CAD; Microsoft Designer Bluetooth Wireless Keyboard & Mouse Set @ $45 CAD).
  - **Full Portfolio Metrics:** 30 total lots (24 active @ $4,210 CAD total value, 1 in-use, 5 sold, 0 draft; 130.8 kg e-waste diverted). All 30 standalone HTML profiles compiled in `dist/` and `dist/items/`.
- [x] **Milestone 4: Regional Market Pricing & Syndication Generator** (`src/syndication/exporter.js`, `bin/letgo.js export/export-all`, formatted ad copy bundles for Facebook Marketplace, Kijiji, and eBay, `syndication_bundles/` with 24 active listing bundles + master index, 2/2 tests passing).
- [x] **Milestone 5.1: Standalone Item Webpage Generator (Cloudflare Pages Ready)** (`src/generator/pageGenerator.js`, `bin/letgo.js build/render`, 30 standalone item profiles in `dist/items/`, responsive photo/video gallery, OpenGraph & Schema.org JSON-LD metadata, 7/7 tests passing).
- [x] **Milestone 5.2: GitHub Remote & Cloudflare Pages CI/CD Setup** (Repository `alhamz/letgolist` deployed live to Cloudflare Pages at `https://letgolist.pages.dev`; automated CI/CD builds on git push to `master`/`main`).
- [x] **Milestone 5.3: Parent Collections & Aggregated Showroom (Production Hardened)**
  - Enhanced `dist/index.html` with real-time text search, instant status filter pills [All, Available, Sold, In-Use], category filters, aggregate value/e-waste banner, and dynamic category visibility.
  - PII scrubbing audit & remediation completed: purged residual `AHMEDBOO` slug/SKU remnants (`carseats-ahmedbooster` renamed to `carseats-highback-booster`, SKU `LGL-CAR-HIGHBACK-659`).
  - Standardized location strictly to Milton, ON (`L9T area`) across 100% of lots (30/30), completely eliminating historical Ottawa default remnants.
  - Enriched specifications, exact manufacturer identifiers, and safety expiry compliance dates for all 3 liquidated car seats (Cosco Go Time Booster Model 35012434C expiry July 2028; Evenflo Triumph; Harmony Commander Deluxe).
  - Implemented Cloudflare Pages `_redirects` and static HTML redirect fallback stubs (`/carseats-ahmedbooster` -> `/carseats-highback-booster`) for zero broken links or legacy PII exposure.
  - Dual-branch Git synchronization: pushes mirrored to both `origin/master` and `origin/main` to guarantee Cloudflare Pages builds from the latest production state regardless of default branch tracking.
- [ ] **Milestone 6: Commercial & Warehouse Expansion API** (Barcode/QR, batch status transitions, webhook ingress).

---

## 4. Cross-Project Interoperability & Infusion Matrix (`theCore` Ecosystem)

To ensure any other workspace or autonomous agent on `theCore` can read, integrate with, or syndicate this project's state, the following interface contracts are established (detailed in [`PROJECT_INTERFACE.md`](./PROJECT_INTERFACE.md) and [`project-manifest.json`](./project-manifest.json)):

| Target Workspace / Service | Infusion Mechanism | Consumed Artifacts & Interfaces |
| :--- | :--- | :--- |
| **`pagesCloudflare`** (`c:\Users\alihm\Projects\pagesCloudflare`) | Web Showcase / Subpath Embedding | Reads `data/inventory.json` or consumes compiled static catalog bundle in `dist/` to embed live inventory under `portfolio.alhamaz.me/inventory` or deploy standalone to Cloudflare Pages. |
| **`piiScrub`** (`c:\Users\alihm\Projects\piiScrub`) | Upstream Security Blackbox | Standalone CLI (`bin/pii-scrub.js`) invoked to scrub/tokenize PII and hardware identifiers; `letgolist` stages client feedback in `feedback/outbox/piiScrub_feedback.jsonl`. |
| **`syncServe`** (`CT300`, `10.23.45.105`) | Mobile Intake Automation | Mounts / syncs a Syncthing camera folder from mobile devices directly to `c:\Users\alihm\Projects\letgolist\Sales/Intake` for zero-friction intake. |
| **`backupCore`** (`CT200`, `10.23.43.2`) | Automated GitOps Backup | Targets `c:\Users\alihm\Projects\letgolist` under `targets.d/letgolist.sh` to preserve Git commit history, inventory ledger, and media. |
| **`reachCore` / `reachMe`** (`CT1000` / `CT2000`) | P2P Buyer Messaging & Alerts | Connects to `@reachcore/core` WebSockets for real-time buyer lead notifications and P2P communication switchboard. |
| **`infraEng`** (`c:\Users\alihm\Projects\infraEng`) | Upstream Living Network Baseline | Syncs service registration, tunnel routes (`inventory.alhamaz.me`), and container allocations (`SERV_VLAN`) into `NETWORK_CONTEXT.md`. |

