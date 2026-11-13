/**
 * letgolist - Standalone Item Webpage Generator (Cloudflare Pages Ready)
 * Generates an ultra-clean, mobile-first, high-conversion static HTML item detail page.
 * Distraction-free, zero runtime dependencies, optimized for buyers visiting from FB Marketplace, Kijiji, Amazon, etc.
 */

import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

export class PageGenerator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.distDir = options.distDir || resolve(this.projectRoot, 'dist');
    this.itemsDir = resolve(this.distDir, 'items');
    this.ensureDirs();
  }

  ensureDirs() {
    if (!existsSync(this.itemsDir)) {
      mkdirSync(this.itemsDir, { recursive: true });
    }
  }

  /**
   * Generates a single standalone HTML page for an inventory item.
   */
  renderItemPage(item) {
    const loc = item.location?.public_region;
    const locStr = loc ? `${loc.city}, ${loc.region} (${loc.postal_area})` : 'Ottawa, ON (Local Pickup)';
    const priceDisplay = item.pricing?.active_price 
      ? `$${item.pricing.active_price} ${item.pricing.currency || 'CAD'}`
      : 'Contact for Price';

    const statusBadgeClass = item.status === 'sold' 
      ? 'status-sold' 
      : item.status === 'reserved' 
        ? 'status-reserved' 
        : 'status-available';

    const statusLabel = item.status === 'sold'
      ? 'SOLD / LIQUIDATED'
      : item.status === 'reserved'
        ? 'PENDING PICKUP'
        : 'AVAILABLE FOR PICKUP';

    const gallery = item.media?.gallery || [];
    const primaryImg = item.media?.primary_image || gallery[0] || '';

    // Relative path to media from dist/items/ (pointing to dist/Sales/ or workspace Sales/)
    const toRelativeMedia = (p) => {
      if (!p) return '';
      const cleanPath = p.replace(/\\/g, '/');
      if (cleanPath.startsWith('Sales/')) {
        return `../${cleanPath}`;
      }
      return cleanPath;
    };

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
        "availability": item.status === 'sold' ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        "itemCondition": this._getSchemaCondition(item.condition)
      }
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
      padding: 1rem 0 3rem 0;
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
      margin-bottom: 1.5rem;
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
      gap: 2rem;
    }
    @media (min-width: 768px) {
      .product-grid {
        grid-template-columns: 1.1fr 0.9fr;
      }
    }

    /* Gallery Section */
    .gallery-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      overflow: hidden;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .main-image-wrap {
      width: 100%;
      aspect-ratio: 4 / 3;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .main-image-wrap img, .main-image-wrap video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .thumbnail-row {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      scrollbar-width: thin;
    }
    .thumbnail-btn {
      flex: 0 0 72px;
      height: 72px;
      border: 2px solid var(--card-border);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      background: #000;
      padding: 0;
      transition: border-color 0.2s;
    }
    .thumbnail-btn.active, .thumbnail-btn:hover {
      border-color: var(--primary);
    }
    .thumbnail-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Information Section */
    .info-container {
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
    }
    .spec-table tr {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .spec-table tr:last-child { border-bottom: none; }
    .spec-table td {
      padding: 0.6rem 0;
    }
    .spec-label {
      color: var(--text-muted);
      width: 40%;
      font-weight: 500;
    }
    .spec-value {
      color: var(--text);
      font-weight: 600;
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
        <div class="main-image-wrap" id="mainMediaContainer">
          ${primaryImg.toLowerCase().endsWith('.mov') || primaryImg.toLowerCase().endsWith('.mp4')
            ? `<video src="${toRelativeMedia(primaryImg)}" controls autoplay muted loop playsinline id="mainVideo"></video>`
            : `<img src="${toRelativeMedia(primaryImg)}" alt="${this._escape(item.title)}" id="mainImg">`
          }
        </div>

        ${gallery.length > 1 ? `
          <div class="thumbnail-row">
            ${gallery.map((mediaPath, idx) => {
              const isVideo = mediaPath.toLowerCase().endsWith('.mov') || mediaPath.toLowerCase().endsWith('.mp4');
              return `
                <button type="button" class="thumbnail-btn ${idx === 0 ? 'active' : ''}" onclick="switchMedia('${toRelativeMedia(mediaPath)}', ${isVideo}, this)">
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
          <div class="price-val">${priceDisplay}</div>
          <div class="price-sub">Fixed local price • Cash or Interac e-Transfer upon physical inspection</div>
        </div>

        <!-- Call to Action -->
        <div class="cta-card">
          <a href="mailto:inquire@alhamaz.me?subject=${encodeURIComponent(`Inquiry on ${item.title} (${item.sku || item.id})`)}&body=${encodeURIComponent(`Hi,\n\nI am interested in "${item.title}" listed for ${priceDisplay}.\n\nIs it still available for pickup in ${locStr}?\n\nThank you!`)}" class="cta-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message Seller / Schedule Pickup
          </a>

          <div class="pickup-info">
            <div>📍 <strong>Location:</strong> Pickup in ${this._escape(locStr)}</div>
            <div>⏱ <strong>Hand-off:</strong> Safe daytime meeting / flexible schedule</div>
            <div>🛡 <strong>Inspection:</strong> Test thoroughly before paying</div>
          </div>
        </div>

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
      </div>
    </div>

    <footer>
      Direct Asset Verification Showcase • Hosted via Cloudflare Pages
    </footer>
  </div>

  <script>
    function switchMedia(src, isVideo, btn) {
      const container = document.getElementById('mainMediaContainer');
      document.querySelectorAll('.thumbnail-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (isVideo) {
        container.innerHTML = '<video src="' + src + '" controls autoplay muted loop playsinline></video>';
      } else {
        container.innerHTML = '<img src="' + src + '" alt="Product photo">';
      }
    }
  </script>
</body>
</html>`;

    return html;
  }

  /**
   * Writes the rendered page to dist/items/<id>.html
   */
  writeItemPage(item) {
    const html = this.renderItemPage(item);
    const filePath = resolve(this.itemsDir, `${item.id}.html`);
    writeFileSync(filePath, html, 'utf-8');
    return filePath;
  }

  /**
   * Renders all items currently in the database into dist/items/
   */
  renderAll(items) {
    const results = [];
    for (const item of items) {
      const p = this.writeItemPage(item);
      results.push({ id: item.id, path: p });
    }
    return results;
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
