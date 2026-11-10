/**
 * letgolist - piiScrub Client Adapter (Blackbox Invocation)
 * Adheres strictly to Universal Governance Section 6 (No State Bleeding, Contract-First).
 * Communicates with piiScrub exclusively via its published CLI contract.
 */

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PII_SCRUB_CLI = resolve(__dirname, '..', '..', '..', 'piiScrub', 'bin', 'pii-scrub.js');

export class PiiClient {
  constructor(options = {}) {
    this.cliPath = options.cliPath || PII_SCRUB_CLI;
  }

  /**
   * Executes a command against the piiScrub CLI.
   */
  _exec(args, input = '') {
    const res = spawnSync('node', [this.cliPath, ...args], {
      input,
      encoding: 'utf-8',
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });

    if (res.error) {
      throw new Error(`Failed to invoke piiScrub CLI: ${res.error.message}`);
    }

    return {
      status: res.status,
      stdout: res.stdout || '',
      stderr: res.stderr || '',
    };
  }

  /**
   * Scrubs raw text using irreversible redaction or category masking.
   */
  scrub(text, options = {}) {
    const args = ['--mode=redact'];
    if (options.mask) args.push(`--mask=${options.mask}`);
    if (options.allowlist) args.push(`--allowlist=${options.allowlist}`);
    if (options.denylist) args.push(`--denylist=${options.denylist}`);

    const res = this._exec(args, text);
    if (res.status !== 0) {
      throw new Error(`piiScrub failed (code ${res.status}): ${res.stderr}`);
    }
    return res.stdout.trimEnd();
  }

  /**
   * Tokenizes sensitive entities into context-preserving surrogate tokens,
   * persisting the mapping in the specified JSON vault.
   */
  tokenize(text, vaultPath) {
    const args = ['--mode=tokenize', `--vault=${resolve(vaultPath)}`];
    const res = this._exec(args, text);
    if (res.status !== 0) {
      throw new Error(`piiScrub tokenize failed (code ${res.status}): ${res.stderr}`);
    }
    return res.stdout.trimEnd();
  }

  /**
   * Restores surrogate tokens back to their original values using the vault.
   */
  detokenize(text, vaultPath) {
    const args = ['--mode=detokenize', `--vault=${resolve(vaultPath)}`];
    const res = this._exec(args, text);
    if (res.status !== 0) {
      throw new Error(`piiScrub detokenize failed (code ${res.status}): ${res.stderr}`);
    }
    return res.stdout.trimEnd();
  }

  /**
   * Audits text and returns a structured report of detected PII.
   */
  audit(text) {
    const args = ['--mode=audit'];
    const res = this._exec(args, text);
    if (res.status !== 0 && res.status !== 2) {
      throw new Error(`piiScrub audit failed (code ${res.status}): ${res.stderr}`);
    }
    try {
      return JSON.parse(res.stdout);
    } catch {
      return { raw: res.stdout, total_detected: 0 };
    }
  }

  /**
   * Submits structured feedback to piiScrub using its published feedback contract.
   */
  submitFeedback(feedbackData) {
    const piiRoot = resolve(dirname(this.cliPath), '..');
    const jsonlPath = resolve(piiRoot, 'data', 'feedback.jsonl');
    const mdPath = resolve(piiRoot, 'FEEDBACK.md');

    const args = [
      'feedback',
      'submit',
      `--jsonl=${jsonlPath}`,
      `--markdown=${mdPath}`,
      `--category=${feedbackData.category || 'other'}`,
      `--severity=${feedbackData.severity || 'medium'}`,
      `--reporter=${feedbackData.reporter || 'agent:letgolist'}`,
      `--sample=${feedbackData.sample || ''}`,
      `--expected=${feedbackData.expected || ''}`,
      `--actual=${feedbackData.actual || ''}`,
      `--notes=${feedbackData.notes || ''}`,
    ];

    const res = this._exec(args);
    if (res.status !== 0) {
      throw new Error(`Failed to submit feedback to piiScrub: ${res.stderr}`);
    }
    try {
      return JSON.parse(res.stdout);
    } catch {
      return { status: 'ok', raw: res.stdout };
    }
  }
}
