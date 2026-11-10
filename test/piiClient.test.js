import test from 'node:test';
import assert from 'node:assert';
import { PiiClient } from '../src/security/piiClient.js';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

test('PiiClient - basic redaction', () => {
  const client = new PiiClient();
  const raw = 'Contact John Doe at 613-555-0199 or test@example.com for pickup.';
  const scrubbed = client.scrub(raw);

  assert.ok(!scrubbed.includes('613-555-0199'), 'Phone number must be scrubbed');
  assert.ok(!scrubbed.includes('test@example.com'), 'Email must be scrubbed');
  assert.ok(scrubbed.includes('[REDACTED_PHONE]'), 'Contains REDACTED_PHONE');
  assert.ok(scrubbed.includes('[REDACTED_EMAIL]'), 'Contains REDACTED_EMAIL');
});

test('PiiClient - reversible tokenization with vault', () => {
  const client = new PiiClient();
  const vaultPath = resolve('test', 'test_vault.json');

  if (existsSync(vaultPath)) unlinkSync(vaultPath);

  const raw = 'Secret serial code is AB-987654-XYZ and contact is 416-555-1234.';
  const tokenized = client.tokenize(raw, vaultPath);

  assert.ok(existsSync(vaultPath), 'Vault file must be created');
  assert.ok(!tokenized.includes('416-555-1234'), 'Phone number tokenized');

  const detokenized = client.detokenize(tokenized, vaultPath);
  assert.strictEqual(detokenized, raw, 'Detokenized string must match original');

  if (existsSync(vaultPath)) unlinkSync(vaultPath);
});

test('PiiClient - audit mode', () => {
  const client = new PiiClient();
  const raw = 'Call me at 613-555-0199';
  const report = client.audit(raw);

  assert.ok(report.total_detected >= 1, 'Should detect at least 1 PII entity');
  assert.ok(report.entity_summary.PHONE >= 1, 'Should detect phone');
});
