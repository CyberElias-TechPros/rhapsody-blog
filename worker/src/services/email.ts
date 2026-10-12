/**
 * Outbound email, through the HTTP API named by `EMAIL_API_URL` + `EMAIL_API_KEY` + `EMAIL_FROM`.
 *
 * Deliberately provider-shaped rather than provider-bound: the request is the body a Resend
 * `POST /emails` call takes (`from`, `to`, `subject`, `html`, `text`, `headers`), which is also the
 * shape several other transactional APIs accept behind a base URL. Point `EMAIL_API_URL` at
 * `https://api.resend.com/emails` and the daily digest works; point it somewhere compatible and it
 * works there too. Nothing in this file knows which.
 *
 * Two rules the digest depends on:
 *   1. `sendEmail` never throws. A bounced address, a provider outage or a missing key is a result
 *      to be counted, not an exception to crash a cron run over.
 *   2. Nothing is sent when the provider is not configured. The list keeps growing in D1 either
 *      way, so turning email on later is `wrangler secret put` — not a migration.
 */

import type { Env } from '../types';
import { logInfo, logWarn } from '../lib/logging';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative, for the clients that render it and the ones that only preview it. */
  text?: string;
  /** `List-Unsubscribe` and friends — see `services/digest.ts`. */
  headers?: Record<string, string>;
}

export type SendOutcome = 'sent' | 'failed' | 'unconfigured';

export interface SendResult {
  outcome: SendOutcome;
  to: string;
  status?: number;
  error?: string;
}

export interface SendBatchSummary {
  total: number;
  sent: number;
  failed: number;
  unconfigured: number;
  /** The first few failures, so a broken key shows up in one log line instead of 5,000. */
  errors: string[];
}

/** All three must be present: a URL without a key, or a key without a from-address, is not sending. */
export function emailConfigured(env: Env): boolean {
  return Boolean(env.EMAIL_API_URL?.trim() && env.EMAIL_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function sendEmail(env: Env, message: EmailMessage, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SendResult> {
  if (!emailConfigured(env)) return { outcome: 'unconfigured', to: message.to };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(env.EMAIL_API_URL as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // The provider's body explains a 401 or a 422 far better than the status alone.
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      logWarn('email: provider rejected the message', { to: message.to, status: response.status, detail });
      return { outcome: 'failed', to: message.to, status: response.status, error: detail || `status ${response.status}` };
    }
    return { outcome: 'sent', to: message.to, status: response.status };
  } catch (error) {
    logWarn('email: send failed', { to: message.to, error: String(error) });
    return { outcome: 'failed', to: message.to, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send many messages with a ceiling on in-flight requests.
 *
 * A digest goes to the whole list, and the list is the kind of thing that grows. Sending thousands
 * of requests at once would trip a provider's rate limit and blow the Worker's CPU budget, so this
 * keeps `concurrency` in flight and no more.
 */
export async function sendEach(
  env: Env,
  messages: EmailMessage[],
  concurrency = 5
): Promise<SendBatchSummary> {
  const summary: SendBatchSummary = { total: messages.length, sent: 0, failed: 0, unconfigured: 0, errors: [] };
  if (!messages.length) return summary;
  if (!emailConfigured(env)) {
    summary.unconfigured = messages.length;
    return summary;
  }

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, messages.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= messages.length) return;
      const result = await sendEmail(env, messages[index]);
      if (result.outcome === 'sent') summary.sent += 1;
      else if (result.outcome === 'unconfigured') summary.unconfigured += 1;
      else {
        summary.failed += 1;
        if (summary.errors.length < 5) summary.errors.push(`${result.to}: ${result.error ?? 'unknown'}`);
      }
    }
  });
  await Promise.all(workers);
  logInfo('email: batch complete', { total: summary.total, sent: summary.sent, failed: summary.failed });
  return summary;
}
