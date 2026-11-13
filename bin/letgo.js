#!/usr/bin/env node

/**
 * letgolist - Main CLI Executable
 * Asset Liquidation, Sidelining Ledger, and Sovereign Feedback CLI
 */

import { CatalogScanner } from '../src/scanner/scanner.js';
import { InventoryStore } from '../src/model/schema.js';
import { PiiClient } from '../src/security/piiClient.js';
import { FeedbackManager } from '../src/core/feedback.js';
import { ItemCurator } from '../src/curator/curator.js';
import { PageGenerator } from '../src/generator/pageGenerator.js';

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
  build                  Generate standalone, high-conversion static HTML pages for Cloudflare Pages (dist/items/)
  render <id>            Render a standalone HTML page for a specific item to dist/items/<id>.html
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
  console.log(`  Sidelined / Cataloged:   ${summary.sidelined_items}`);
  console.log(`  Draft / Needs Curation:  ${db.items.filter(i => i.status === 'draft').length}`);
  console.log(`  Sold / Liquidated:       ${summary.sold_items}`);
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
  console.log(`Generating standalone item web pages for Cloudflare Pages (dist/items/)...`);
  const store = new InventoryStore();
  const db = store.read();
  const generator = new PageGenerator();

  const rendered = generator.renderAll(db.items);
  console.log(`\n✔ Successfully generated ${rendered.length} standalone item pages in dist/items/\n`);
  for (const r of rendered.slice(0, 5)) {
    console.log(`  • dist/items/${r.id}.html`);
  }
  if (rendered.length > 5) {
    console.log(`  • ...and ${rendered.length - 5} more item pages.`);
  }
  console.log(`\nReady for Cloudflare Pages direct deployment or embedding!`);
}

function handleRender(args) {
  const id = args[0];
  if (!id) {
    console.error('Error: Please provide an item ID to render. Run "node bin/letgo.js curate --list" to view available IDs.');
    process.exit(1);
  }

  const store = new InventoryStore();
  const db = store.read();
  const item = db.items.find(i => i.id === id);

  if (!item) {
    console.error(`Error: Item with ID "${id}" not found.`);
    process.exit(1);
  }

  const generator = new PageGenerator();
  const outPath = generator.writeItemPage(item);
  console.log(`✔ Rendered standalone page: ${outPath}`);
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
    case 'render':
      handleRender(args.slice(1));
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
