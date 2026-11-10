# User Stories & Acceptance Criteria: letgolist

## Epic 1: Asset Ingestion & Interactive Curation

### Story 1.1: Automated Folder Ingestion
As a user parting with household items and tech,  
I want the system to recursively discover all assets and media in the `Sales/` directory,  
So that I do not need to manually enter file paths or upload images one by one.

* **Scenario: Initial scan of `Sales/` hierarchy**
  - **Given** an uncataloged `Sales/` directory containing media organized into categories and sub-lots,
  - **When** the ingestion scanner executes,
  - **Then** all 10 top-level categories and their subdirectories are identified as candidate inventory items,
  - **And** all valid media paths (`.jpg`, `.jpeg`, `.png`, `.mov`) are linked to their respective item records,
  - **And** zero-byte placeholder files (e.g. `.protondoc`) are flagged for interactive attribute entry without crashing.

### Story 1.2: Guided Agent Triage & Sidelining
As a user organizing sidelined inventory,  
I want the agent to interactively ask me targeted questions about condition, included accessories, and physical storage location,  
So that every asset has a complete profile and an assigned shelf or bin.

* **Scenario: Triaging a discovered Dell Latitude laptop**
  - **Given** a discovered lot `Sales/Latitutde/%1`,
  - **When** the interactive curation agent initiates triage for the item,
  - **Then** it prompts for CPU/RAM/Storage, battery health, and cosmetic grade,
  - **And** it prompts for the physical storage location (e.g. `Office Shelf B2`),
  - **And** the responses are saved atomically into the persistent inventory ledger.

---

## Epic 2: Multi-Platform Syndication & Valuation

### Story 2.1: Multi-Channel Ad Copy Generation
As a seller listing across multiple platforms,  
I want the system to generate distinct, platform-optimized ad copy for Kijiji, Facebook Marketplace, and eBay,  
So that I can post with maximum speed and tailored appeal for each buyer demographic.

* **Scenario: Generating listings for an infant car seat**
  - **Given** an inventory item `HarmonyCommanderDeluxe` with confirmed expiry date and cleanliness status,
  - **When** the syndication generator runs for this item,
  - **Then** it produces a Facebook Marketplace copy focused on local pickup, safety compliance, and condition bullets,
  - **And** it produces a Kijiji copy with regional pickup parameters and Ontario safety guidelines,
  - **And** it generates an eBay title and description highlighting the exact model number and shipping specs.

### Story 2.2: Tiered Valuation Strategy
As a seller balancing speed versus financial return,  
I want the agent to recommend three distinct price points (Fast Liquidation, Fair Market, Optimistic Anchor),  
So that I can choose the optimal pricing strategy based on my urgency.

* **Scenario: Pricing an iPad 9th Gen**
  - **Given** a 9th Gen iPad in Good condition with an included case,
  - **When** valuation analysis is performed,
  - **Then** three calculated price tiers are presented alongside historical regional comps,
  - **And** selecting a tier updates the active listing price in the ledger.

---

## Epic 3: Public Browsable Catalog

### Story 3.1: Instant Web Showroom
As a seller who wants to share all available inventory with personal contacts or bulk buyers,  
I want a responsive, fast-loading web catalog showing available items,  
So that buyers can browse current inventory, inspect photos, and express interest in real time.

* **Scenario: Buyer visits public web showroom**
  - **Given** active inventory items published in the ledger,
  - **When** the web catalog is loaded in a browser,
  - **Then** items are displayed in a clean responsive grid with category filters and price badges,
  - **And** each item card displays high-resolution photos, condition tags, and an "Inquire" button,
  - **And** items marked as `Sold` or `Reserved` update their status visual indicators automatically.

---

## Epic 4: Regional Market Intelligence & Circular Analytics

### Story 4.1: Public Comps Ingestion & Reuse Metrics
As a researcher and circular economy advocate,  
I want to log public regional sales comps and circular diversion metrics,  
So that I can measure the economic value preserved and the physical weight diverted from e-waste streams.

* **Scenario: Logging a regional comp and circular recovery record**
  - **Given** observed market sale data for a Dell WD19S dock in the local region,
  - **When** a comp record is entered into the analytics store,
  - **Then** the platform records the sale price, date, channel, and estimated e-waste weight diverted,
  - **And** the data is queryable for regional pricing intelligence and historical reporting.
