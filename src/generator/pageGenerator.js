/**
 * letgolist - Standalone Item Webpage Generator (Cloudflare Pages Ready)
 * Generates an ultra-clean, mobile-first, high-conversion static HTML item detail page.
 * Distraction-free, zero runtime dependencies, optimized for buyers visiting from FB Marketplace, Kijiji, Amazon, etc.
 */

import { writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { InventoryStore } from '../model/schema.js';

export class PageGenerator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.distDir = options.distDir || resolve(this.projectRoot, 'dist');
    this.listingsDir = resolve(this.distDir, 'l');
    this.adminDir = options.adminDir || resolve(this.projectRoot, 'admin');
    this.store = new InventoryStore({ projectRoot: this.projectRoot });
    this.ensureDirs();
  }

  ensureDirs() {
    if (!existsSync(this.listingsDir)) {
      mkdirSync(this.listingsDir, { recursive: true });
    }
    if (!existsSync(this.adminDir)) {
      mkdirSync(this.adminDir, { recursive: true });
    }
  }

  /**
   * Generates a single standalone HTML page for an inventory item.
   */
  renderItemPage(item, allItems = null) {
    const loc = item.location?.public_region;
    const locStr = loc ? `${loc.city}, ${loc.region} (${loc.postal_area})` : 'Milton, ON (L9T area)';
    const priceDisplay = item.pricing?.active_price 
      ? `$${item.pricing.active_price} ${item.pricing.currency || 'CAD'}`
      : 'Contact for Price';

    const statusBadgeClass = item.status === 'sold' 
      ? 'status-sold' 
      : item.status === 'reserved' 
        ? 'status-reserved' 
        : item.status === 'in_use'
          ? 'status-in-use'
          : 'status-available';

    const statusLabel = item.status === 'sold'
      ? 'SOLD / LIQUIDATED'
      : item.status === 'reserved'
        ? 'PENDING PICKUP'
        : item.status === 'in_use'
          ? 'IN USE / UNAVAILABLE'
          : 'AVAILABLE FOR PICKUP';

    const gallery = item.media?.gallery || [];
    const primaryImg = item.media?.primary_image || gallery[0] || '';

    // Clean, encode, and format media paths for browsers and Cloudflare Pages
    // Root-relative paths ensure /l/<token>.html resolves media cleanly without duplicating Sales/
    const toRelativeMedia = (p) => {
      if (!p) return '';
      const cleanPath = p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
      const parts = cleanPath.split('/').map(seg => encodeURIComponent(seg));
      return `/${parts.join('/')}`;
    };

    const mediaList = gallery.map(m => ({
      src: toRelativeMedia(m),
      isVideo: m.toLowerCase().endsWith('.mov') || m.toLowerCase().endsWith('.mp4')
    }));

    // Filter public specs (exclude internal keys)
    const publicSpecs = Object.entries(item.specs || {})
      .filter(([k]) => !k.startsWith('inferred') && k !== 'media_count');

    const specRows = publicSpecs.map(([k, v]) => `
      <tr>
        <td class="spec-label">${this._formatKey(k)}</td>
        <td class="spec-value">${this._escape(String(v))}</td>
      </tr>
    `).join('');

    // Pre-calculate condition descriptions
    const conditionDescription = this._getConditionDetail(item.condition);

    // JSON-LD Structured Data (Schema.org/Product) for rich SEO / WhatsApp / FB preview
    const jsonLd = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": item.title,
      "image": gallery.map(g => `https://inventory.alhamaz.me/${g}`),
      "description": `${item.title} in ${item.condition} condition. Available for local pickup in ${locStr}.`,
      "brand": {
        "@type": "Brand",
        "name": item.brand
      },
      "offers": {
        "@type": "Offer",
        "priceCurrency": item.pricing?.currency || "CAD",
        "price": item.pricing?.active_price || 0,
        "availability": item.status === 'sold' ? "https://schema.org/SoldOut" : item.status === 'in_use' ? "https://schema.org/Discontinued" : "https://schema.org/InStock",
        "itemCondition": this._getSchemaCondition(item.condition)
      }
    };

    // Related items are omitted on public scattered pages by default to prevent inventory cross-discovery.
    let relatedHtml = '';
    const relatedIds = this.includeRelated ? (item.related_items || []) : [];
    if (relatedIds.length > 0) {
      let itemsList = allItems;
      if (!itemsList) {
        try {
          itemsList = this.store.read().items || [];
        } catch {
          itemsList = [];
        }
      }
      const matched = relatedIds
        .map(id => itemsList.find(i => i.id === id))
        .filter(Boolean);

      if (matched.length > 0) {
        relatedHtml = `
        <!-- Related Accessories & Companion Lots Card -->
        <div class="related-card">
          <div class="card-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Available Compatible Accessories & Companion Lots
          </div>
          <div class="related-items-grid">
            ${matched.map(r => {
              const rImg = r.media?.primary_image || (r.media?.gallery || [])[0] || '';
              const rPrice = r.pricing?.active_price ? `$${r.pricing.active_price} CAD` : (r.status === 'in_use' ? 'In Use' : 'Inquire');
              return `
                <a href="./${r.id}.html" class="related-item-link">
                  ${rImg ? `<img src="${toRelativeMedia(rImg)}" alt="${this._escape(r.title)}" class="related-item-thumb">` : `<div class="related-item-thumb-placeholder">No Pic</div>`}
                  <div class="related-item-info">
                    <span class="related-item-title">${this._escape(r.title)}</span>
                    <span class="related-item-price">${rPrice} • <span class="related-item-badge">${this._escape(r.condition?.replace(/_/g, ' ') || 'good')}</span></span>
                  </div>
                  <span class="related-item-arrow">→</span>
                </a>
              `;
            }).join('')}
          </div>
        </div>
        `;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${this._escape(item.title)} | Verified Item Profile</title>
  <meta name="description" content="${this._escape(item.title)} - ${this._escape(conditionDescription)}. Local pickup in ${this._escape(locStr)}.">
  
  <!-- OpenGraph / Social Cards (FB Marketplace, WhatsApp, iMessage, Discord) -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${this._escape(item.title)} - ${priceDisplay}">
  <meta property="og:description" content="${this._escape(conditionDescription)} • Local pickup in ${this._escape(locStr)}">
  <meta property="og:image" content="${toRelativeMedia(primaryImg)}">
  <meta property="product:price:amount" content="${item.pricing?.active_price || 0}">
  <meta property="product:price:currency" content="${item.pricing?.currency || 'CAD'}">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --accent: #10b981;
      --warn: #f59e0b;
      --danger: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.6;
      padding: 1rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 1.25rem 1rem 4rem 1rem;
    }

    /* Top Trust Bar */
    .trust-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 0.75rem 1.25rem;
      margin-bottom: 1.75rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .trust-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--accent);
      font-weight: 600;
    }

    /* Main Product Layout */
    .product-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
    }
    @media (min-width: 880px) {
      .product-grid {
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
        gap: 3rem;
        align-items: start;
      }
    }

    /* Gallery Section */
    .gallery-container {
      min-width: 0;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      position: sticky;
      top: 1.5rem;
    }
    .main-image-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      min-height: 360px;
      background: #060a12;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: zoom-in;
    }
    .main-image-wrap img, .main-image-wrap video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: transform 0.25s ease;
    }
    .main-image-wrap:hover img {
      transform: scale(1.02);
    }
    .expand-pill {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      gap: 0.4rem;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .thumbnail-row {
      display: flex;
      gap: 0.85rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      scrollbar-width: thin;
    }
    .thumbnail-btn {
      flex: 0 0 88px;
      height: 88px;
      border: 2px solid var(--card-border);
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      background: #060a12;
      padding: 0;
      transition: all 0.2s ease;
    }
    .thumbnail-btn.active, .thumbnail-btn:hover {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.35);
      transform: translateY(-2px);
    }
    .thumbnail-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Lightbox Modal */
    .lightbox-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 8, 16, 0.94);
      backdrop-filter: blur(16px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: 1.5rem;
    }
    .lightbox-modal.active {
      display: flex;
    }
    .lightbox-content {
      position: relative;
      max-width: 92vw;
      max-height: 86vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lightbox-img, .lightbox-video {
      max-width: 92vw;
      max-height: 84vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.85);
    }
    .lightbox-close {
      position: absolute;
      top: 24px;
      right: 28px;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 1.5rem;
      line-height: 1;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      z-index: 100001;
    }
    .lightbox-close:hover {
      background: var(--danger);
      color: #fff;
    }
    .lightbox-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 2.25rem;
      line-height: 1;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      z-index: 100001;
      user-select: none;
    }
    .lightbox-nav:hover {
      background: var(--primary);
      color: #04101e;
    }
    .lightbox-prev { left: 28px; }
    .lightbox-next { right: 28px; }
    .lightbox-counter {
      position: absolute;
      bottom: 24px;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      background: rgba(15, 23, 42, 0.85);
      padding: 0.4rem 1rem;
      border-radius: 9999px;
      border: 1px solid var(--card-border);
    }

    /* Information Section */
    .info-container {
      min-width: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .status-badge {
      align-self: flex-start;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .status-available { background: rgba(16, 185, 129, 0.2); color: var(--accent); border: 1px solid var(--accent); }
    .status-reserved { background: rgba(245, 158, 11, 0.2); color: var(--warn); border: 1px solid var(--warn); }
    .status-sold { background: rgba(239, 68, 68, 0.2); color: var(--danger); border: 1px solid var(--danger); }
    .status-in-use { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid #64748b; }

    .item-title {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.25;
      color: #fff;
    }

    .meta-subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .price-box {
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .price-val {
      font-size: 2.25rem;
      font-weight: 800;
      color: var(--primary);
      line-height: 1;
    }
    .price-sub {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    /* Action / Contact Card */
    .cta-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .cta-btn {
      background: var(--primary);
      color: #04101e;
      font-weight: 700;
      font-size: 1rem;
      border: none;
      border-radius: 8px;
      padding: 0.85rem;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }
    .cta-btn:hover { background: var(--primary-hover); }

    .pickup-info {
      font-size: 0.875rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .pickup-info strong { color: var(--text); }

    /* Specs & Condition Tables */
    .spec-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-top: 0.5rem;
    }
    .card-heading {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      table-layout: fixed;
    }
    .spec-table tr {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .spec-table tr:last-child { border-bottom: none; }
    .spec-table td {
      padding: 0.6rem 0;
      vertical-align: top;
    }
    .spec-label {
      color: var(--text-muted);
      width: 38%;
      font-weight: 500;
      word-break: break-word;
    }
    .spec-value {
      color: var(--text);
      font-weight: 600;
      word-break: break-word;
    }

    /* Verification Box */
    .verify-box {
      font-size: 0.8rem;
      color: var(--text-muted);
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 0.75rem;
      margin-top: 1rem;
    }

    /* Related Accessories Card */
    .related-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .related-items-grid {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .related-item-link {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.6rem 0.75rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, transform 0.15s;
    }
    .related-item-link:hover {
      border-color: var(--primary);
      transform: translateX(3px);
    }
    .related-item-thumb {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      object-fit: cover;
      background: #000;
      flex-shrink: 0;
    }
    .related-item-thumb-placeholder {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .related-item-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      flex: 1;
      min-width: 0;
    }
    .related-item-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .related-item-price {
      font-size: 0.8rem;
      color: var(--primary);
      font-weight: 700;
    }
    .related-item-badge {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: normal;
      text-transform: capitalize;
    }
    .related-item-arrow {
      color: var(--text-muted);
      font-size: 1rem;
      font-weight: 700;
    }
    .related-item-link:hover .related-item-arrow {
      color: var(--primary);
    }

    footer {
      margin-top: 3rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Top Trust Bar -->
    <div class="trust-banner">
      <div class="trust-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Direct Physical Verification
      </div>
      <div>Item Ref: <code>${item.sku || item.id}</code></div>
    </div>

    <div class="product-grid">
      <!-- Media Gallery Column -->
      <div class="gallery-container">
        <div class="main-image-wrap" id="mainMediaContainer" onclick="openLightbox()" title="Click to view full-size photo">
          ${primaryImg.toLowerCase().endsWith('.mov') || primaryImg.toLowerCase().endsWith('.mp4')
            ? `<video src="${toRelativeMedia(primaryImg)}" controls autoplay muted loop playsinline id="mainMedia"></video>`
            : `<img src="${toRelativeMedia(primaryImg)}" alt="${this._escape(item.title)}" id="mainMedia">`
          }
          <div class="expand-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <span>Click to Expand</span>
          </div>
        </div>

        ${gallery.length > 1 ? `
          <div class="thumbnail-row">
            ${gallery.map((mediaPath, idx) => {
              const isVideo = mediaPath.toLowerCase().endsWith('.mov') || mediaPath.toLowerCase().endsWith('.mp4');
              return `
                <button type="button" class="thumbnail-btn ${idx === 0 ? 'active' : ''}" onclick="switchMedia(${idx})">
                  ${isVideo 
                    ? `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:10px;text-align:center;">▶ VIDEO</div>`
                    : `<img src="${toRelativeMedia(mediaPath)}" alt="Thumbnail ${idx + 1}">`
                  }
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Item Information Column -->
      <div class="info-container">
        <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>

        <h1 class="item-title">${this._escape(item.title)}</h1>
        <div class="meta-subtitle">
          Category: <strong>${this._escape(item.category)}</strong> • Brand: <strong>${this._escape(item.brand)}</strong>
        </div>

        <div class="price-box">
          <div class="price-val">${item.status === 'in_use' ? 'Not for Sale' : item.status === 'sold' ? `${priceDisplay} (Sold Out)` : priceDisplay}</div>
          <div class="price-sub">${item.status === 'in_use' ? 'Currently deployed in internal homelab/workstation use' : item.status === 'sold' ? 'This lot has been liquidated / completed handoff' : 'Fixed local price • Cash or Interac e-Transfer upon physical inspection'}</div>
        </div>

        <!-- Call to Action -->
        ${item.status === 'in_use' ? `
          <div class="cta-card">
            <div style="color: #94a3b8; font-size: 0.95rem; line-height: 1.5;">
              🔒 <strong>Currently In Active Use:</strong> This asset is currently deployed in daily operational use on an internal workstation. It is cataloged in inventory for tracking but is unavailable for sale or pickup.
            </div>
          </div>
        ` : item.status === 'sold' ? `
          <div class="cta-card">
            <div style="color: #ef4444; font-size: 0.95rem; line-height: 1.5;">
              🤝 <strong>Sold Out / Liquidated:</strong> This item has been sold and handed off to a buyer. It is preserved in the circular inventory catalog for provenance, specification records, and e-waste diversion metrics.
            </div>
          </div>
        ` : `
          <div class="cta-card">
            <a href="mailto:inquire@alhamaz.me?subject=${encodeURIComponent(`Inquiry on ${item.title} (${item.sku || item.id})`)}&body=${encodeURIComponent(`Hi,\n\nI am interested in "${item.title}" listed for ${priceDisplay}.\n\nIs it still available for pickup in ${locStr}?\n\nThank you!`)}" class="cta-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Message Seller / Schedule Pickup
            </a>

            <div class="pickup-info">
              <div>📍 <strong>Location:</strong> Pickup at public community landmark in ${this._escape(locStr)}</div>
              <div>📦 <strong>Shipping:</strong> Canada-wide & International tracked shipping available (buyer pays shipping)</div>
              <div>⏱ <strong>Hand-off:</strong> Safe public daytime meeting / flexible schedule</div>
              <div>🛡 <strong>Inspection:</strong> Test thoroughly before paying</div>
            </div>
          </div>
        `}

        <!-- Condition & Specifications Card -->
        <div class="spec-card">
          <div class="card-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            Item Condition & Specs
          </div>
          <table class="spec-table">
            <tr>
              <td class="spec-label">Condition Grade</td>
              <td class="spec-value" style="color:var(--primary);text-transform:capitalize;">${item.condition.replace(/_/g, ' ')}</td>
            </tr>
            <tr>
              <td class="spec-label">Inspection Notes</td>
              <td class="spec-value">${this._escape(conditionDescription)}</td>
            </tr>
            ${specRows}
          </table>

          <div class="verify-box">
            🔒 <strong>Verified Ownership & Security:</strong> Hardware serial numbers and manufacturer validation tags are preserved securely in our local clearance vault and disclosed upon request to verified buyers.
          </div>
        </div>

        ${relatedHtml}
      </div>
    </div>

    <footer>
      Direct Asset Verification Showcase • Hosted via Cloudflare Pages
    </footer>
  </div>

  <!-- Lightbox Fullscreen Modal -->
  <div class="lightbox-modal" id="lightboxModal" onclick="handleBackdropClick(event)">
    <button class="lightbox-close" onclick="closeLightbox()" title="Close (Esc)">✕</button>
    ${gallery.length > 1 ? `
      <button class="lightbox-nav lightbox-prev" onclick="prevLightbox(event)" title="Previous photo (Left Arrow)">‹</button>
      <button class="lightbox-nav lightbox-next" onclick="nextLightbox(event)" title="Next photo (Right Arrow)">›</button>
    ` : ''}
    <div class="lightbox-content" id="lightboxContent"></div>
    <div class="lightbox-counter" id="lightboxCounter"></div>
  </div>

  <script>
    const galleryItems = ${JSON.stringify(mediaList)};
    let currentIndex = 0;

    function switchMedia(idx, isVideo, btn) {
      if (typeof idx !== 'number') {
        const found = galleryItems.findIndex(g => g.src === idx);
        idx = found !== -1 ? found : 0;
      }
      if (idx < 0 || idx >= galleryItems.length) return;
      currentIndex = idx;

      const container = document.getElementById('mainMediaContainer');
      const item = galleryItems[currentIndex];

      const btns = document.querySelectorAll('.thumbnail-btn');
      btns.forEach((b, i) => {
        if (i === currentIndex) b.classList.add('active');
        else b.classList.remove('active');
      });

      let mediaHtml = '';
      if (item.isVideo) {
        mediaHtml = '<video src="' + item.src + '" controls autoplay muted loop playsinline id="mainMedia"></video>';
      } else {
        mediaHtml = '<img src="' + item.src + '" alt="Product photo" id="mainMedia">';
      }
      container.innerHTML = mediaHtml + '<div class="expand-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg><span>Click to Expand</span></div>';
    }

    function openLightbox() {
      if (!galleryItems || galleryItems.length === 0) return;
      const modal = document.getElementById('lightboxModal');
      const content = document.getElementById('lightboxContent');
      const counter = document.getElementById('lightboxCounter');
      const item = galleryItems[currentIndex];

      if (item.isVideo) {
        content.innerHTML = '<video src="' + item.src + '" class="lightbox-video" controls autoplay loop playsinline></video>';
      } else {
        content.innerHTML = '<img src="' + item.src + '" class="lightbox-img" alt="Full size photo">';
      }

      if (counter) {
        counter.textContent = (currentIndex + 1) + ' / ' + galleryItems.length;
      }

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      const modal = document.getElementById('lightboxModal');
      if (modal) modal.classList.remove('active');
      const content = document.getElementById('lightboxContent');
      if (content) content.innerHTML = '';
      document.body.style.overflow = '';
    }

    function prevLightbox(e) {
      if (e) e.stopPropagation();
      let prevIdx = currentIndex - 1;
      if (prevIdx < 0) prevIdx = galleryItems.length - 1;
      switchMedia(prevIdx);
      openLightbox();
    }

    function nextLightbox(e) {
      if (e) e.stopPropagation();
      let nextIdx = currentIndex + 1;
      if (nextIdx >= galleryItems.length) nextIdx = 0;
      switchMedia(nextIdx);
      openLightbox();
    }

    function handleBackdropClick(e) {
      if (e.target.id === 'lightboxModal') {
        closeLightbox();
      }
    }

    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById('lightboxModal');
      if (!modal || !modal.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevLightbox();
      else if (e.key === 'ArrowRight') nextLightbox();
    });
  </script>
</body>
</html>`;

    return html;
  }

  /**
   * Writes the rendered page strictly to the scattered capability URL dist/l/<public_token>.html
   */
  writeItemPage(item, allItems = null) {
    const html = this.renderItemPage(item, allItems);
    const slug = item.public_token || item.id;
    const itemPath = resolve(this.listingsDir, `${slug}.html`);
    writeFileSync(itemPath, html, 'utf-8');
    return itemPath;
  }

  /**
   * Removes legacy predictable HTML files in dist/ and dist/items/ so
   * trimming a URL back to / or /items/ cannot enumerate inventory.
   */
  cleanLegacyPublicPages() {
    if (existsSync(this.distDir)) {
      for (const entry of readdirSync(this.distDir)) {
        if (entry.endsWith('.html') || entry === '_redirects') {
          try { unlinkSync(resolve(this.distDir, entry)); } catch {}
        }
      }
      const legacyItemsDir = resolve(this.distDir, 'items');
      if (existsSync(legacyItemsDir)) {
        try { rmSync(legacyItemsDir, { recursive: true, force: true }); } catch {}
      }
    }
    if (existsSync(this.listingsDir)) {
      for (const entry of readdirSync(this.listingsDir)) {
        if (entry.endsWith('.html')) {
          try { unlinkSync(resolve(this.listingsDir, entry)); } catch {}
        }
      }
    }
  }

  /**
   * Renders all items to scattered capability URLs under dist/l/<public_token>.html,
   * writes a neutral private-portal dist/index.html + dist/_headers,
   * and writes the full operator dashboard locally to admin/index.html.
   */
  renderAll(items) {
    this.cleanLegacyPublicPages();
    this.ensureDirs();

    const results = [];
    for (const item of items) {
      const p = this.writeItemPage(item, items);
      results.push({ id: item.id, public_token: item.public_token || item.id, path: p });
    }
    this.writePublicRootPortal();
    this.writeHeaders();
    this.writeAdminDashboard(items);
    return results;
  }

  /**
   * Writes Cloudflare Pages _headers to prevent search engine indexing of any route.
   */
  writeHeaders() {
    const headers = `/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n`;
    writeFileSync(resolve(this.distDir, '_headers'), headers, 'utf-8');
  }

  /**
   * Writes a neutral, zero-disclosure landing page at dist/index.html.
   * Exposes zero item counts, zero portfolio value, and zero links.
   */
  writePublicRootPortal() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Direct Listing Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .gate-card {
      max-width: 480px;
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 2.25rem;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.35);
    }
    .badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.3rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 1.15rem;
    }
    h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.75rem; }
    p { color: #94a3b8; font-size: 0.92rem; line-height: 1.55; }
  </style>
</head>
<body>
  <main class="gate-card">
    <div class="badge">Private Listing Portal</div>
    <h1>Direct Item Link Required</h1>
    <p>Individual item specifications and media galleries are accessible only via the direct listing link shared in the marketplace ad.</p>
  </main>
</body>
</html>`;
    writeFileSync(resolve(this.distDir, 'index.html'), html, 'utf-8');
  }

  /**
   * Generates the private operator dashboard at admin/index.html (outside dist/)
   * with portfolio value, search, status filters, channel tracking, and scattered /l/<token> links.
   */
  writeAdminDashboard(items) {
    const categories = Array.from(new Set(items.map(i => i.category || 'Other'))).sort();
    const activeCount = items.filter(i => i.status === 'active').length;
    const inUseCount = items.filter(i => i.status === 'in_use').length;
    const soldCount = items.filter(i => i.status === 'sold').length;
    const activeValue = items
      .filter(i => i.status === 'active')
      .reduce((sum, i) => sum + (i.pricing?.active_price || i.pricing?.fair_market || 0), 0);
    const totalEwaste = Math.round(items.reduce((sum, i) => sum + (i.circular_metrics?.estimated_weight_kg || 0), 0) * 10) / 10;

    const categorySections = categories.map(cat => {
      const catItems = items.filter(i => (i.category || 'Other') === cat);
      return `
        <section class="cat-section" data-cat="${this._escape(cat)}">
          <h2 class="cat-title">${this._escape(cat)} <span class="count-badge">${catItems.length}</span></h2>
          <div class="card-grid">
            ${catItems.map(item => {
              const primaryImg = item.media?.primary_image || (item.media?.gallery || [])[0] || '';
              const imgSrc = primaryImg ? `../${primaryImg.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}` : '';
              const slug = item.public_token || item.id;
              const fbState = item.channels?.facebook?.status || 'not_listed';
              const kjState = item.channels?.kijiji?.status || 'not_listed';
              const ebState = item.channels?.ebay?.status || 'not_listed';
              let priceStr = 'Contact for Price';
              if (item.status === 'in_use') {
                priceStr = 'Not for Sale';
              } else if (item.status === 'sold') {
                priceStr = item.pricing?.active_price ? `$${item.pricing.active_price} CAD (Sold)` : 'Sold Out';
              } else if (item.pricing?.active_price) {
                priceStr = `$${item.pricing.active_price} CAD`;
              }
              const searchHaystack = `${item.title} ${item.brand || ''} ${item.model || ''} ${item.category || ''} ${slug} ${JSON.stringify(item.specs || {})}`.toLowerCase();

              return `
                <a href="../dist/l/${slug}.html" class="item-card" data-status="${item.status}" data-cat="${this._escape(item.category || 'Other')}" data-search="${this._escape(searchHaystack)}">
                  <div class="card-img-wrap">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${this._escape(item.title)}" loading="lazy">` : `<div class="no-img">No Image</div>`}
                    <span class="card-badge ${item.status === 'sold' ? 'status-sold' : item.status === 'in_use' ? 'status-in-use' : 'status-avail'}">${item.status === 'sold' ? 'Sold' : item.status === 'in_use' ? 'In Use' : 'Available'}</span>
                  </div>
                  <div class="card-body">
                    <h3 class="card-title">${this._escape(item.title)}</h3>
                    <div class="card-meta">${this._escape(item.brand || '')} • ${this._escape(item.model || '')} • /l/${slug}</div>
                    <div class="card-meta">FB: ${fbState} | KJ: ${kjState} | eBay: ${ebState}</div>
                    <div class="card-price ${item.status === 'sold' ? 'price-sold' : item.status === 'in_use' ? 'price-in-use' : ''}">${priceStr}</div>
                  </div>
                </a>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>letgolist | Verified Inventory Showcase & Sidelining Catalog</title>
  <meta name="description" content="Direct, verified physical asset profiles, liquidation pricing, and circular economy hardware available in Milton, ON (L9T area).">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0ea5e9;
      --accent: #10b981;
      --danger: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--font); padding: 1.5rem 1rem 4rem; line-height: 1.5; }
    .container { max-width: 1140px; margin: 0 auto; }
    
    /* Header & Stats Banner */
    header { margin-bottom: 2rem; border-bottom: 1px solid var(--card-border); padding-bottom: 1.5rem; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; }
    h1 { font-size: 1.85rem; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
    .subtitle { color: var(--text-muted); font-size: 0.95rem; margin-top: 0.25rem; }
    
    .stats-row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .stat-badge { background: rgba(30, 41, 59, 0.9); border: 1px solid var(--card-border); padding: 0.45rem 0.85rem; border-radius: 8px; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }
    .stat-val { font-weight: 700; color: var(--primary); }
    .stat-accent { color: var(--accent); }

    /* Interactive Search & Controls Bar */
    .controls-panel { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.25rem; margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1rem; }
    .search-box { position: relative; width: 100%; }
    .search-box input { width: 100%; background: #0f172a; border: 1px solid var(--card-border); border-radius: 8px; padding: 0.75rem 1rem 0.75rem 2.5rem; color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.15s; }
    .search-box input:focus { border-color: var(--primary); }
    .search-icon { position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
    
    .filter-group { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .filter-label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-right: 0.25rem; }
    .filter-btn { background: #0f172a; border: 1px solid var(--card-border); color: var(--text-muted); padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.15s; user-select: none; }
    .filter-btn:hover { border-color: var(--primary); color: #fff; }
    .filter-btn.active { background: var(--primary); border-color: var(--primary); color: #0f172a; font-weight: 700; }

    /* Sections & Cards */
    .cat-section { margin-bottom: 2.5rem; }
    .cat-title { font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .count-badge { font-size: 0.75rem; background: var(--card-border); color: var(--text-muted); padding: 0.15rem 0.5rem; border-radius: 999px; }

    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1.25rem; }
    .item-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: transform 0.15s, border-color 0.15s; }
    .item-card:hover { transform: translateY(-3px); border-color: var(--primary); }
    .card-img-wrap { width: 100%; aspect-ratio: 4 / 3; background: #000; position: relative; overflow: hidden; }
    .card-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .no-img { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.85rem; }
    
    .card-badge { position: absolute; top: 8px; right: 8px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .status-avail { background: rgba(16, 185, 129, 0.9); color: #fff; }
    .status-sold { background: rgba(239, 68, 68, 0.9); color: #fff; }
    .status-in-use { background: rgba(100, 116, 139, 0.9); color: #fff; }
    
    .card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
    .card-title { font-size: 0.95rem; font-weight: 600; color: #fff; line-height: 1.35; }
    .card-meta { font-size: 0.8rem; color: var(--text-muted); }
    .card-price { font-size: 1.15rem; font-weight: 700; color: var(--primary); margin-top: auto; padding-top: 0.5rem; }
    .price-sold { color: var(--danger); font-size: 0.95rem; }
    .price-in-use { color: var(--text-muted); font-size: 0.95rem; font-style: italic; }

    #emptyState { display: none; text-align: center; padding: 3rem 1rem; background: var(--card-bg); border: 1px dashed var(--card-border); border-radius: 12px; margin-bottom: 2rem; }
    #emptyState h3 { color: #fff; margin-bottom: 0.5rem; font-size: 1.2rem; }
    #emptyState p { color: var(--text-muted); font-size: 0.9rem; }

    footer { text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 3.5rem; border-top: 1px solid var(--card-border); padding-top: 1.5rem; line-height: 1.6; }
    footer a { color: var(--primary); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-top">
        <div>
          <h1>Verified Asset Inventory Directory</h1>
          <div class="subtitle">Direct physical asset profiles • Local meetup in Milton, ON (L9T area) & Tracked Shipping</div>
        </div>
        <div class="stats-row">
          <div class="stat-badge"><span>Available:</span> <span class="stat-val stat-accent">${activeCount} Lots</span></div>
          <div class="stat-badge"><span>Active Value:</span> <span class="stat-val">$${activeValue} CAD</span></div>
          <div class="stat-badge"><span>Circular Saved:</span> <span class="stat-val">${totalEwaste} kg</span></div>
        </div>
      </div>
    </header>

    <!-- Controls Panel -->
    <div class="controls-panel">
      <div class="search-box">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" id="searchInput" placeholder="Search 30 lots by brand, model, storage, CPU (e.g. Dell, iPhone, 64GB, i7, iPad)...">
      </div>

      <div class="filter-group" id="statusFilters">
        <span class="filter-label">Status:</span>
        <button class="filter-btn active" data-filter-status="active">Available for Sale (${activeCount})</button>
        <button class="filter-btn" data-filter-status="all">All (${items.length})</button>
        <button class="filter-btn" data-filter-status="sold">Sold / Liquidated (${soldCount})</button>
        <button class="filter-btn" data-filter-status="in_use">In Use (${inUseCount})</button>
      </div>

      <div class="filter-group" id="categoryFilters">
        <span class="filter-label">Category:</span>
        <button class="filter-btn active" data-filter-cat="all">All Categories</button>
        ${categories.map(c => {
          const cCount = items.filter(i => (i.category || 'Other') === c).length;
          return `<button class="filter-btn" data-filter-cat="${this._escape(c)}">${this._escape(c)} (${cCount})</button>`;
        }).join('')}
      </div>
    </div>

    <!-- Empty Search State -->
    <div id="emptyState">
      <h3>No matching lots found</h3>
      <p>Try clearing your search terms or selecting "All" in the status and category filters.</p>
    </div>

    <!-- Inventory Sections -->
    <main id="catalogSections">
      ${categorySections}
    </main>

    <footer>
      🔒 <strong>Verified Ownership & Privacy Assurance:</strong> Serial numbers and manufacturer identifiers are vaulted locally. Pickups occur at neutral public community landmarks in Milton, ON.
      <br>
      Automated GitOps Liquidation Platform • Deployed live via Cloudflare Pages
    </footer>
  </div>

  <script>
    (function() {
      const searchInput = document.getElementById('searchInput');
      const statusBtns = document.querySelectorAll('#statusFilters .filter-btn');
      const catBtns = document.querySelectorAll('#categoryFilters .filter-btn');
      const itemCards = document.querySelectorAll('.item-card');
      const catSections = document.querySelectorAll('.cat-section');
      const emptyState = document.getElementById('emptyState');

      let currentSearch = '';
      let currentStatus = 'active';
      let currentCat = 'all';

      function applyFilters() {
        let visibleCount = 0;

        catSections.forEach(sec => {
          let visibleInCategory = 0;
          const cards = sec.querySelectorAll('.item-card');

          cards.forEach(card => {
            const cardStatus = card.getAttribute('data-status');
            const cardCat = card.getAttribute('data-cat');
            const cardSearch = card.getAttribute('data-search') || '';

            const matchStatus = (currentStatus === 'all') || (cardStatus === currentStatus);
            const matchCat = (currentCat === 'all') || (cardCat === currentCat);
            const matchSearch = (!currentSearch) || (cardSearch.includes(currentSearch));

            if (matchStatus && matchCat && matchSearch) {
              card.style.display = 'flex';
              visibleInCategory++;
              visibleCount++;
            } else {
              card.style.display = 'none';
            }
          });

          // Toggle visibility of category header
          sec.style.display = visibleInCategory > 0 ? 'block' : 'none';
        });

        // Toggle empty state
        emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
      }

      // Search input handler with debounce
      let searchTimeout;
      searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          currentSearch = e.target.value.trim().toLowerCase();
          applyFilters();
        }, 120);
      });

      // Status button handlers
      statusBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          statusBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentStatus = this.getAttribute('data-filter-status');
          applyFilters();
        });
      });

      // Category button handlers
      catBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          catBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentCat = this.getAttribute('data-filter-cat');
          applyFilters();
        });
      });

      // Initial filter execution to show only active available lots by default
      applyFilters();
    })();
  </script>
</body>
</html>`;

    writeFileSync(resolve(this.adminDir, 'index.html'), html, 'utf-8');
  }

  _formatKey(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  _escape(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _getConditionDetail(cond) {
    switch (cond) {
      case 'new': return 'Brand new, unopened in original packaging.';
      case 'like_new': return 'Flawless cosmetic condition, fully functional with zero signs of wear.';
      case 'good': return 'Tested and fully working, minor normal signs of handling.';
      case 'fair': return 'Fully operational, noticeable cosmetic wear or scratches.';
      case 'needs_rehaul': return 'Power tested, needs servicing or maintenance before regular use.';
      case 'parts_only': return 'Sold for parts or salvage component recovery.';
      default: return 'Tested and verified operational.';
    }
  }

  _getSchemaCondition(cond) {
    switch (cond) {
      case 'new': return 'https://schema.org/NewCondition';
      case 'like_new': return 'https://schema.org/RefurbishedCondition';
      default: return 'https://schema.org/UsedCondition';
    }
  }
}
