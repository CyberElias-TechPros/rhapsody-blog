/**
 * zod-based request validation at the API boundary.
 * All user input (body + query) passes through here before touching business logic.
 */

import type { z } from 'zod';
import { ApiError } from './http';

/** Convert a zod error into a flat { field: messages } map for the response envelope. */
export function zodDetails(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  const ct = request.headers.get('content-type') ?? '';
  try {
    raw = ct.includes('application/json') ? await request.json() : await request.text();
    if (typeof raw === 'string' && raw.trim() === '') raw = {};
    if (typeof raw === 'string') {
      raw = JSON.parse(raw);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest('Request body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(400, 'Validation failed', 'VALIDATION', zodDetails(result.error));
  return result.data;
}

export function parseQuery<T extends z.ZodTypeAny>(url: URL, schema: T): z.infer<T> {
  const obj: Record<string, string> = {};
  for (const [k, v] of url.searchParams) obj[k] = v;
  const result = schema.safeParse(obj);
  if (!result.success) throw new ApiError(400, 'Validation failed', 'VALIDATION', zodDetails(result.error));
  return result.data;
}
