/**
 * letgolist - Product Feedback & Anomaly Ledger Engine
 * Handles structured consumer feedback from downstream clients (pagesCloudflare, reachMe, WMS)
 * with dual persistence: data/feedback.jsonl (machine-readable) and FEEDBACK.md (dashboard).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

export const FEEDBACK_CATEGORIES = [
  'schema_gap',
  'pricing_anomaly',
  'catalog_rendering',
  'sync_issue',
  'pii_leak_hazard',
  'feature_request',
  'other',
];

export const FEEDBACK_STATUSES = [
  'open',
  'triaged',
  'resolved',
  'rejected',
];

export class FeedbackManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || resolve('.');
    this.jsonlPath = options.jsonlPath || resolve(this.projectRoot, 'data', 'feedback.jsonl');
    this.markdownPath = options.markdownPath || resolve(this.projectRoot, 'FEEDBACK.md');
    this.ensureDirs();
  }

  ensureDirs() {
    const jsonlDir = dirname(this.jsonlPath);
    if (!existsSync(jsonlDir)) {
      mkdirSync(jsonlDir, { recursive: true });
    }
  }

  generateId() {
    const timestamp = Date.now().toString(36);
    const rand = randomBytes(3).toString('hex');
    return `lgl_fb_${timestamp}_${rand}`;
  }

  readAll() {
    if (!existsSync(this.jsonlPath)) {
      return [];
    }

    const content = readFileSync(this.jsonlPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

    const records = [];
    for (const line of lines) {
      try {
        records.push(JSON.parse(line));
      } catch (err) {
        // Skip malformed lines
      }
    }
    return records;
  }

  writeAll(records) {
    this.ensureDirs();
    const content = records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
    writeFileSync(this.jsonlPath, content, 'utf-8');
    this.syncMarkdown(records);
  }

  submit(data) {
    const category = FEEDBACK_CATEGORIES.includes(data.category) ? data.category : 'other';
    const severity = ['low', 'medium', 'high', 'critical'].includes(data.severity) ? data.severity : 'medium';

    const record = {
      id: this.generateId(),
      created_at: new Date().toISOString(),
      reporter: data.reporter || 'anonymous',
      category,
      severity,
      sample: data.sample || '',
      expected: data.expected || '',
      actual: data.actual || '',
      notes: data.notes || '',
      status: 'open',
      resolved_at: null,
      resolution_notes: null,
    };

    this.ensureDirs();
    appendFileSync(this.jsonlPath, JSON.stringify(record) + '\n', 'utf-8');

    const allRecords = this.readAll();
    this.syncMarkdown(allRecords);

    return record;
  }

  triage(id, updates = {}) {
    const records = this.readAll();
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      throw new Error(`Feedback record with ID "${id}" not found.`);
    }

    const current = records[index];

    if (updates.status && FEEDBACK_STATUSES.includes(updates.status)) {
      current.status = updates.status;
      if (updates.status === 'resolved' || updates.status === 'rejected') {
        current.resolved_at = new Date().toISOString();
      }
    }

    if (updates.notes) {
      current.resolution_notes = updates.notes;
    }

    if (updates.severity) {
      current.severity = updates.severity;
    }

    records[index] = current;
    this.writeAll(records);

    return current;
  }

  syncMarkdown(records = null) {
    const items = records !== null ? records : this.readAll();

    const counts = {
      total: items.length,
      open: items.filter(r => r.status === 'open').length,
      triaged: items.filter(r => r.status === 'triaged').length,
      resolved: items.filter(r => r.status === 'resolved').length,
      rejected: items.filter(r => r.status === 'rejected').length,
      schema_gaps: items.filter(r => r.category === 'schema_gap').length,
      pricing_anomalies: items.filter(r => r.category === 'pricing_anomaly').length,
    };

    let md = `# Product Feedback & Anomaly Ledger: letgolist\n\n`;
    md += `> **Canonical Host:** \`theCore\` (\`10.23.40.3\`)\n`;
    md += `> **Machine Ledger:** \`data/feedback.jsonl\`\n`;
    md += `> **Last Synchronized:** ${new Date().toISOString()}\n\n`;

    md += `## 1. Feedback Metrics & Health\n\n`;
    md += `| Total Feedback | Open | Triaged | Resolved | Rejected | Schema Gaps | Pricing Anomalies |\n`;
    md += `| :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    md += `| **${counts.total}** | **${counts.open}** | **${counts.triaged}** | **${counts.resolved}** | **${counts.rejected}** | **${counts.schema_gaps}** | **${counts.pricing_anomalies}** |\n\n`;

    md += `---\n\n## 2. Active Feedback Records\n\n`;

    if (items.length === 0) {
      md += `*No feedback records logged yet. Downstream consumers can submit issues via \`node bin/letgo.js feedback submit\` or by dropping records into \`feedback/inbox/\`.*\n\n`;
    } else {
      md += `| ID | Status | Category | Severity | Reporter | Summary / Issue | Created |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      for (const item of items) {
        const shortSample = (item.sample || item.notes || '-').replace(/[\r\n]+/g, ' ').slice(0, 45);
        md += `| \`${item.id}\` | **${item.status.toUpperCase()}** | \`${item.category}\` | \`${item.severity}\` | \`${item.reporter}\` | ${shortSample}... | ${item.created_at.slice(0, 10)} |\n`;
      }

      md += `\n---\n\n## 3. Record Details\n\n`;

      for (const item of items) {
        md += `### Record \`${item.id}\` — [${item.status.toUpperCase()}]\n\n`;
        md += `- **Category:** \`${item.category}\` (Severity: \`${item.severity}\`)\n`;
        md += `- **Reporter:** \`${item.reporter}\`\n`;
        md += `- **Created At:** \`${item.created_at}\`\n`;
        if (item.resolved_at) {
          md += `- **Resolved At:** \`${item.resolved_at}\`\n`;
        }
        md += `- **Sample Snippet:** \`${item.sample || 'N/A'}\`\n`;
        md += `- **Expected:** ${item.expected || 'N/A'}\n`;
        md += `- **Actual:** ${item.actual || 'N/A'}\n`;
        if (item.resolution_notes) {
          md += `- **Resolution Notes:** ${item.resolution_notes}\n`;
        }
        md += `\n`;
      }
    }

    md += `---\n\n## 4. How External Consumers Submit Feedback\n\n`;
    md += `Downstream consumers (e.g. \`pagesCloudflare\`, \`reachMe\`, warehouse management clients, or operator scripts) submit feedback via CLI:\n\n`;
    md += `\`\`\`bash\nnode bin/letgo.js feedback submit \\\n  --category=schema_gap \\\n  --sample="Missing battery health field on iPad" \\\n  --expected="Add battery_cycle_count and max_capacity_pct" \\\n  --reporter="client:pagesCloudflare" \\\n  --severity=medium\n\`\`\`\n`;

    writeFileSync(this.markdownPath, md, 'utf-8');
  }
}
