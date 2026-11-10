# Project State: letgolist (Circular Asset Management & Regional Intelligence)

> **Canonical Host:** `theCore` (`10.23.40.3/24` on `LAN` `10.23.40.0/24`)  
> **Workspace Path:** `c:\Users\alihm\Projects\letgolist`  
> **Initial Status:** Bootstrap & Discovery Complete (Phase 3 Documentation)  
> **Last Updated:** 2026-11-10

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
- [ ] **Milestone 2: Asset Data Schema & Inventory Model** (Normalized schema for tech, household goods, vehicles; physical bin/shelf sidelining).
- [ ] **Milestone 3: Vision Intake & Interactive Curation Engine** (Interactive Q&A script to populate missing attributes for `Sales/` items).
- [ ] **Milestone 4: Regional Market Pricing & Syndication Generator** (Comps store schema, multi-tier pricing, Kijiji / FB / eBay ad copy generators).
- [ ] **Milestone 5: Fast Public Showroom / Browsable Web Catalog** (Lightweight, responsive web catalog matching Cloudflare Pages / portfolio standard).
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

