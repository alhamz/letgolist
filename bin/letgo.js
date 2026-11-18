#!/usr/bin/env node

/**
 * letgolist - Main CLI Executable
 * Asset Liquidation, Sidelining Ledger, and Sovereign Feedback CLI
 */

import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { CatalogScanner } from '../src/scanner/scanner.js';
import { InventoryStore } from '../src/model/schema.js';
import { PiiClient } from '../src/security/piiClient.js';
import { FeedbackManager } from '../src/core/feedback.js';
import { ItemCurator } from '../src/curator/curator.js';
import { PageGenerator } from '../src/generator/pageGenerator.js';
import { SyndicationExporter } from '../src/syndication/exporter.js';
import { AssistedPoster } from '../src/automation/assistedPoster.js';
import { AdminServer } from '../src/server/adminServer.js';

const VERSION = '1.0.0';

function printHelp() {
  console.log(`
letgolist (v${VERSION}) - Circular Asset Liquidation & Inventory Platform

USAGE:
  node bin/letgo.js <command> [options]

COMMANDS:
  scan                   Scan the Sales/ folder and index candidate item lots into data/inventory.json
  status                 Display inventory summary, counts, and sidelining statistics
  curate [id]            Run interactive curation wizard for all draft items, or a specific item ID
  curate --list          List all draft items awaiting curation and missing attributes
  export <id>            Export copy-paste listing bundle for Facebook, Kijiji, and eBay
  export-all             Export all active item syndication bundles to syndication_bundles/
  build                  Generate scattered capability pages (dist/l/<token>.html) & private admin/index.html
  admin                  Start local private admin server (127.0.0.1:4173) and open dashboard in browser
  render <id>            Render a scattered standalone HTML page for a specific item
  links                  List active items with their scattered /l/<token>.html URLs and channel status
  channels <id|list>     View or update live marketplace URLs/IDs (--fb=URL --kijiji=URL --ebay=ID)
  post <id>              Launch Playwright assisted form-fill for --channel=facebook|kijiji
  sold <id>              Mark item sold, re-render public page, and flag other channels for delisting
  pii-audit              Run piiScrub audit over all inventory records to ensure zero PII leakage
  pii-feedback submit    Submit upstream product feedback / edge case report to piiScrub
  feedback submit        Submit client product feedback to letgolist (for downstream consumers)
  feedback list          List all registered consumer feedback records
  feedback triage <id>   Triage or resolve a feedback record

OPTIONS:
  -h, --help             Show this help message and exit
  --version              Display version and exit
`);
}

function handleFeedback(args) {
  const manager = new FeedbackManager();
  const sub = args[0];

  if (!sub || sub === '-h' || sub === '--help') {
    printHelp();
    process.exit(0);
  }

  if (sub === 'submit') {
    const data = {
      category: 'other',
      severity: 'medium',
      sample: '',
      expected: '',
      actual: '',
      reporter: 'anonymous',
      notes: '',
    };

    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--category=')) data.category = a.split('=')[1];
      else if (a === '--category') data.category = args[++i];
      else if (a.startsWith('--sample=')) data.sample = a.split('=')[1];
      else if (a === '--sample') data.sample = args[++i];
      else if (a.startsWith('--expected=')) data.expected = a.split('=')[1];
      else if (a === '--expected') data.expected = args[++i];
      else if (a.startsWith('--actual=')) data.actual = a.split('=')[1];
      else if (a === '--actual') data.actual = args[++i];
      else if (a.startsWith('--reporter=')) data.reporter = a.split('=')[1];
      else if (a === '--reporter') data.reporter = args[++i];
      else if (a.startsWith('--severity=')) data.severity = a.split('=')[1];
      else if (a === '--severity') data.severity = args[++i];
      else if (a.startsWith('--notes=')) data.notes = a.split('=')[1];
      else if (a === '--notes') data.notes = args[++i];
    }

    const created = manager.submit(data);
    console.log(JSON.stringify({ status: 'ok', message: 'Feedback submitted to letgolist', feedback: created }, null, 2));
    process.exit(0);
  }

  if (sub === 'list') {
    const records = manager.readAll();
    console.log(`\n=== letgolist Consumer Feedback Ledger (${records.length} records) ===\n`);
    for (const r of records) {
      console.log(`[${r.status.toUpperCase()}] ID: ${r.id} | Cat: ${r.category} | Sev: ${r.severity} | By: ${r.reporter}`);
      if (r.sample) console.log(`  Sample:   ${r.sample}`);
      if (r.expected) console.log(`  Expected: ${r.expected}`);
      if (r.notes) console.log(`  Notes:    ${r.notes}`);
      console.log('');
    }
    process.exit(0);
  }

  if (sub === 'triage') {
    const id = args[1];
    if (!id || id.startsWith('--')) {
      console.error('Error: Missing feedback ID.');
      process.exit(1);
    }
    const updates = {};
    for (let i = 2; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--status=')) updates.status = a.split('=')[1];
      else if (a === '--status') updates.status = args[++i];
      else if (a.startsWith('--notes=')) updates.notes = a.split('=')[1];
      else if (a === '--notes') updates.notes = args[++i];
    }
    const updated = manager.triage(id, updates);
    console.log(JSON.stringify({ status: 'ok', feedback: updated }, null, 2));
    process.exit(0);
  }

  if (sub === 'sync') {
    manager.syncMarkdown();
    console.log('FEEDBACK.md synchronized with data/feedback.jsonl');
    process.exit(0);
  }

  console.error(`Unknown feedback command: ${sub}`);
  process.exit(1);
}

function handlePiiFeedback(args) {
  const pii = new PiiClient();
  const sub = args[0];

  if (sub !== 'submit') {
    console.error('Usage: node bin/letgo.js pii-feedback submit [options]');
    process.exit(1);
  }

  const data = {
    category: 'false_positive',
    severity: 'medium',
    sample: '',
    expected: '',
    actual: '',
    reporter: 'agent:letgolist',
    notes: '',
  };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--category=')) data.category = a.split('=')[1];
    else if (a === '--category') data.category = args[++i];
    else if (a.startsWith('--sample=')) data.sample = a.split('=')[1];
    else if (a === '--sample') data.sample = args[++i];
    else if (a.startsWith('--expected=')) data.expected = a.split('=')[1];
    else if (a === '--expected') data.expected = args[++i];
    else if (a.startsWith('--actual=')) data.actual = a.split('=')[1];
    else if (a === '--actual') data.actual = args[++i];
    else if (a.startsWith('--severity=')) data.severity = a.split('=')[1];
    else if (a === '--severity') data.severity = args[++i];
    else if (a.startsWith('--notes=')) data.notes = a.split('=')[1];
    else if (a === '--notes') data.notes = args[++i];
  }

  try {
    const res = pii.submitFeedback(data);
    console.log(JSON.stringify({ status: 'ok', message: 'Feedback delivered to piiScrub', result: res }, null, 2));
  } catch (err) {
    console.error(`Error delivering feedback to piiScrub: ${err.message}`);
    process.exit(1);
  }
}

function handleStatus() {
  const store = new InventoryStore();
  const db = store.read();
  const summary = db.summary;

  console.log(`\n================ letgolist Inventory Summary ================`);
  console.log(`  Total Item Lots:         ${summary.total_items}`);
  console.log(`  Active Market Listings:  ${summary.active_listings}`);
  console.log(`  In-Use / Dormant:        ${summary.in_use_items || db.items.filter(i => i.status === 'in_use').length}`);
  console.log(`  Sidelined / Cataloged:   ${summary.sidelined_items || 0}`);
  console.log(`  Draft / Needs Curation:  ${db.items.filter(i => i.status === 'draft').length}`);
  console.log(`  Sold / Liquidated:       ${summary.sold_items || 0}`);
  console.log(`  Total Estimated Value:   $${summary.total_estimated_value} CAD`);
  console.log(`  Circular e-Waste Saved:  ${summary.circular_ewaste_diverted_kg} kg`);
  console.log(`=============================================================\n`);

  if (db.items.length > 0) {
    console.log(`Item Lots:`);
    for (const item of db.items) {
      const photos = item.media?.gallery?.length || 0;
      console.log(`  • [${item.status.toUpperCase()}] ${item.title} (${photos} photos) -> ${item.location.internal_sidelining.shelf_or_bin}`);
    }
    console.log('');
  }
}

function handleScan() {
  console.log(`Scanning Sales/ directory...`);
  const scanner = new CatalogScanner();
  const result = scanner.scan();

  console.log(`Scan complete! Discovered ${result.total_lots_discovered} item lots (${result.created_count} new, ${result.updated_count} refreshed).`);
  handleStatus();
}

function handlePiiAudit() {
  console.log(`Running piiScrub privacy audit on inventory records...`);
  const store = new InventoryStore();
  const db = store.read();
  const pii = new PiiClient();

  let totalDetected = 0;
  for (const item of db.items) {
    const textToAudit = `${item.title} ${item.model} ${JSON.stringify(item.specs)}`;
    const report = pii.audit(textToAudit);
    if (report.total_detected > 0) {
      console.log(`[ALERT] Item ${item.id} (${item.title}) triggered PII audit detections:`);
      console.log(JSON.stringify(report.entity_summary, null, 2));
      totalDetected += report.total_detected;
    }
  }

  if (totalDetected === 0) {
    console.log(`Audit Clean: 0 PII entities detected across all public item descriptions.`);
  } else {
    console.log(`Audit Completed with ${totalDetected} warnings. Consider tokenizing sensitive attributes.`);
  }
}

async function handleCurate(args) {
  const curator = new ItemCurator();
  const sub = args[0];

  if (sub === '--list' || sub === '-l') {
    const pending = curator.getPendingItems();
    console.log(`\n=== Items Awaiting Curation (${pending.length} lots) ===\n`);
    for (const item of pending) {
      const photos = item.media?.gallery?.length || 0;
      console.log(`• ID: ${item.id}`);
      console.log(`  Title:    ${item.title}`);
      console.log(`  Category: ${item.category} | Model: ${item.model}`);
      console.log(`  Photos:   ${photos} photos available`);
      console.log(`  Location: ${item.location.internal_sidelining.zone} -> ${item.location.internal_sidelining.shelf_or_bin}`);
      console.log('');
    }
    return;
  }

  const targetId = (sub && !sub.startsWith('-')) ? sub : null;
  await curator.runInteractiveCuration(targetId);
}

function handleBuild() {
  console.log(`Generating scattered capability pages (dist/l/) & private operator dashboard (admin/)...`);
  const store = new InventoryStore();
  const backfill = store.ensureAllTokensAndChannels();
  if (backfill.updated > 0) {
    console.log(`Assigned persistent public_token & channel state to ${backfill.updated} items.`);
  }
  const db = store.read();
  const generator = new PageGenerator();

  // Sync Sales media once to dist/Sales (root-relative /Sales/... resolves from /l/<token>.html)
  const salesSrc = resolve('Sales');
  if (existsSync(salesSrc)) {
    cpSync(salesSrc, resolve('dist', 'Sales'), { recursive: true, force: true });
  }

  const rendered = generator.renderAll(db.items);
  console.log(`\n✔ Successfully generated ${rendered.length} scattered item pages in dist/l/`);
  console.log(`✔ Neutral zero-disclosure root portal written to dist/index.html (+ dist/_headers noindex)`);
  console.log(`✔ Private operator dashboard written to admin/index.html\n`);
  for (const r of rendered.slice(0, 5)) {
    console.log(`  • ${r.id} -> dist/l/${r.public_token}.html`);
  }
  if (rendered.length > 5) {
    console.log(`  • ...and ${rendered.length - 5} more scattered item pages.`);
  }
  console.log(`\nReady for Cloudflare Pages deployment without exposing total inventory!`);
}

function handleRender(args) {
  const id = args[0];
  if (!id) {
    console.error('Error: Please provide an item ID to render. Run "node bin/letgo.js curate --list" to view available IDs.');
    process.exit(1);
  }

  const store = new InventoryStore();
  store.ensureAllTokensAndChannels();
  const db = store.read();
  const item = db.items.find(i => i.id === id);

  if (!item) {
    console.error(`Error: Item with ID "${id}" not found.`);
    process.exit(1);
  }

  const generator = new PageGenerator();
  const outPath = generator.writeItemPage(item);
  console.log(`✔ Rendered scattered page: ${outPath}`);
}

function handleLinks() {
  const store = new InventoryStore();
  store.ensureAllTokensAndChannels();
  const db = store.read();
  const baseUrl = 'https://letgolist.pages.dev';

  console.log(`\n=== Scattered Public Capability Links (Active Lots) ===\n`);
  for (const item of db.items.filter(i => i.status === 'active')) {
    const slug = item.public_token || item.id;
    const fb = item.channels?.facebook?.status || 'not_listed';
    const kj = item.channels?.kijiji?.status || 'not_listed';
    const eb = item.channels?.ebay?.status || 'not_listed';
    console.log(`• ${item.title} ($${item.pricing?.active_price || 0} CAD)`);
    console.log(`  ID:   ${item.id}`);
    console.log(`  Link: ${baseUrl}/l/${slug}.html`);
    console.log(`  Ch:   FB=${fb} | Kijiji=${kj} | eBay=${eb}\n`);
  }
}

function handleChannels(args) {
  const store = new InventoryStore();
  store.ensureAllTokensAndChannels();
  const sub = args[0];

  if (!sub || sub === 'list') {
    const db = store.read();
    console.log(`\n=== Marketplace Channel Sync Status ===\n`);
    for (const item of db.items) {
      const ch = item.channels || {};
      const alerts = ['facebook', 'kijiji', 'ebay'].filter(c => ch[c]?.status === 'needs_delist');
      const alertStr = alerts.length ? `  [ACTION: DELIST ${alerts.join(', ').toUpperCase()}]` : '';
      console.log(`• [${item.status.toUpperCase()}] ${item.id}${alertStr}`);
      console.log(`    FB:     ${ch.facebook?.status || 'not_listed'} ${ch.facebook?.url ? `(${ch.facebook.url})` : ''}`);
      console.log(`    Kijiji: ${ch.kijiji?.status || 'not_listed'} ${ch.kijiji?.url ? `(${ch.kijiji.url})` : ''}`);
      console.log(`    eBay:   ${ch.ebay?.status || 'not_listed'} ${ch.ebay?.listing_id ? `[#${ch.ebay.listing_id}]` : ''} ${ch.ebay?.url ? `(${ch.ebay.url})` : ''}`);
    }
    console.log('');
    return;
  }

  const itemId = sub;
  let fbUrl = null;
  let kjUrl = null;
  let ebId = null;
  let ebUrl = null;
  let statusOverride = null;

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--fb=')) fbUrl = a.split('=')[1];
    else if (a.startsWith('--kijiji=')) kjUrl = a.split('=')[1];
    else if (a.startsWith('--ebay=')) ebId = a.split('=')[1];
    else if (a.startsWith('--ebay-url=')) ebUrl = a.split('=')[1];
    else if (a.startsWith('--status=')) statusOverride = a.split('=')[1];
  }

  if (fbUrl) store.updateChannelState(itemId, 'facebook', { status: statusOverride || 'listed', url: fbUrl });
  if (kjUrl) store.updateChannelState(itemId, 'kijiji', { status: statusOverride || 'listed', url: kjUrl });
  if (ebId || ebUrl) store.updateChannelState(itemId, 'ebay', { status: statusOverride || 'listed', ...(ebId ? { listing_id: ebId } : {}), ...(ebUrl ? { url: ebUrl } : {}) });

  const updated = store.read().items.find(i => i.id === itemId);
  console.log(JSON.stringify({ status: 'ok', id: itemId, channels: updated?.channels }, null, 2));
}

function handleSold(args) {
  const itemId = args[0];
  if (!itemId) {
    console.error('Error: Provide an item ID. Usage: node bin/letgo.js sold <id> [--channel=facebook|kijiji|ebay]');
    process.exit(1);
  }
  let soldChannel = null;
  for (const a of args.slice(1)) {
    if (a.startsWith('--channel=')) soldChannel = a.split('=')[1];
  }

  const store = new InventoryStore();
  store.ensureAllTokensAndChannels();
  const { item, flaggedToDelist } = store.markSoldAndFlagChannels(itemId, soldChannel);

  const generator = new PageGenerator();
  const outPath = generator.writeItemPage(item);
  generator.writeAdminDashboard(store.read().items);

  console.log(`✔ Marked "${item.title}" as SOLD.`);
  console.log(`✔ Updated scattered public page: ${outPath}`);
  if (flaggedToDelist.length > 0) {
    console.log(`\n⚠ Flagged ${flaggedToDelist.length} other channel(s) for delisting:`);
    for (const f of flaggedToDelist) {
      console.log(`  • ${f.channel.toUpperCase()}: ${f.url || f.listing_id || '(URL not recorded)'}`);
    }
  }
}

async function handlePost(args) {
  const itemId = args[0];
  if (!itemId) {
    console.error('Error: Provide an item ID. Usage: node bin/letgo.js post <id> --channel=facebook|kijiji');
    process.exit(1);
  }
  let channel = 'facebook';
  for (const a of args.slice(1)) {
    if (a.startsWith('--channel=')) channel = a.split('=')[1];
  }

  const store = new InventoryStore();
  store.ensureAllTokensAndChannels();
  const item = store.read().items.find(i => i.id === itemId);
  if (!item) {
    console.error(`Error: Item "${itemId}" not found.`);
    process.exit(1);
  }

  const poster = new AssistedPoster();
  const res = await poster.launchAssistedPost(item, channel);
  console.log(JSON.stringify(res, null, 2));
}

function handleExport(args) {
  const itemId = args[0];
  if (!itemId) {
    console.error('Error: Please specify an item ID to export. Run "node bin/letgo.js status" to see item IDs.');
    process.exit(1);
  }

  let channel = 'all';
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--channel=')) channel = a.split('=')[1];
    else if (a === '--channel') channel = args[++i];
  }

  const exporter = new SyndicationExporter();
  const store = new InventoryStore();
  const db = store.read();
  const item = db.items.find(i => i.id === itemId);

  if (!item) {
    console.error(`Error: Item "${itemId}" not found in inventory.`);
    process.exit(1);
  }

  const output = exporter.formatListing(item, channel);
  console.log(output);
}

function handleExportAll(args) {
  let dir = 'syndication_bundles';
  let status = 'active';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--dir=')) dir = a.split('=')[1];
    else if (a === '--dir') dir = args[++i];
    else if (a.startsWith('--status=')) status = a.split('=')[1];
    else if (a === '--status') status = args[++i];
  }

  console.log(`Exporting syndication bundles (status="${status}") into "${dir}"...`);
  const exporter = new SyndicationExporter();
  const res = exporter.exportAll(dir, { status });

  console.log(`\n✔ Successfully exported ${res.total_exported} syndication bundles into "${dir}/"!`);
  console.log(`  • Master Catalog Summary: ${res.index_file}`);
  console.log(`  • Copy/paste ready for Facebook Marketplace, Kijiji, and eBay.\n`);
}

async function handleAdmin(args) {
  let port = 4173;
  let openBrowser = true;
  for (const a of args) {
    if (a.startsWith('--port=')) port = Number(a.split('=')[1]) || 4173;
    else if (a === '--no-open') openBrowser = false;
  }

  const server = new AdminServer({ port });
  const info = await server.start();
  console.log(`\nletgolist Private Admin Dashboard running at ${info.url}`);
  console.log(`Press Ctrl+C to stop.\n`);

  if (openBrowser) {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', info.url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [info.url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [info.url], { detached: true, stdio: 'ignore' }).unref();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '-h' || cmd === '--help') {
    printHelp();
    process.exit(0);
  }

  if (cmd === '--version') {
    console.log(`letgolist v${VERSION}`);
    process.exit(0);
  }

  switch (cmd) {
    case 'scan':
      handleScan();
      break;
    case 'status':
      handleStatus();
      break;
    case 'curate':
      await handleCurate(args.slice(1));
      break;
    case 'build':
      handleBuild();
      break;
    case 'admin':
      await handleAdmin(args.slice(1));
      break;
    case 'render':
      handleRender(args.slice(1));
      break;
    case 'links':
      handleLinks();
      break;
    case 'channels':
      handleChannels(args.slice(1));
      break;
    case 'sold':
      handleSold(args.slice(1));
      break;
    case 'post':
      await handlePost(args.slice(1));
      break;
    case 'export':
      handleExport(args.slice(1));
      break;
    case 'export-all':
      handleExportAll(args.slice(1));
      break;
    case 'pii-audit':
      handlePiiAudit();
      break;
    case 'feedback':
      handleFeedback(args.slice(1));
      break;
    case 'pii-feedback':
      handlePiiFeedback(args.slice(1));
      break;
    default:
      console.error(`Unknown command "${cmd}". Run "node bin/letgo.js --help" for usage.`);
      process.exit(1);
  }
}

main();
