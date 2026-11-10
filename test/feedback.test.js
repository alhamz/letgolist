import test from 'node:test';
import assert from 'node:assert';
import { FeedbackManager } from '../src/core/feedback.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

test('FeedbackManager - submit, read, triage, markdown sync', () => {
  const jsonlPath = resolve('test', 'test_feedback.jsonl');
  const markdownPath = resolve('test', 'TEST_FEEDBACK.md');

  if (existsSync(jsonlPath)) unlinkSync(jsonlPath);
  if (existsSync(markdownPath)) unlinkSync(markdownPath);

  const mgr = new FeedbackManager({ jsonlPath, markdownPath });

  const record = mgr.submit({
    category: 'schema_gap',
    severity: 'medium',
    sample: 'Missing battery cycle count on iPad 9th Gen',
    expected: 'battery_cycle_count field in specs',
    reporter: 'client:pagesCloudflare',
    notes: 'Required for battery health display',
  });

  assert.ok(record.id.startsWith('lgl_fb_'), 'Record ID must match prefix');
  assert.strictEqual(record.status, 'open');

  const all = mgr.readAll();
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].sample, 'Missing battery cycle count on iPad 9th Gen');

  assert.ok(existsSync(markdownPath), 'FEEDBACK.md must exist');

  const updated = mgr.triage(record.id, {
    status: 'triaged',
    notes: 'Scheduled for Milestone 2 schema update',
  });

  assert.strictEqual(updated.status, 'triaged');
  assert.strictEqual(updated.resolution_notes, 'Scheduled for Milestone 2 schema update');

  if (existsSync(jsonlPath)) unlinkSync(jsonlPath);
  if (existsSync(markdownPath)) unlinkSync(markdownPath);
});
