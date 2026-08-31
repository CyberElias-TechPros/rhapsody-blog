/**
 * Tiny method+pattern router (no dependency). Patterns: `/api/posts/:channelSlug/:slug`.
 * `*` as the final segment captures the remainder in `params.wildcard`.
 */

import { ApiError } from './http';
import type { Ctx } from '../context';

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, segments: pattern.split('/').filter(Boolean), handler });
    return this;
  }
  get = (p: string, h: Handler) => this.add('GET', p, h);
  post = (p: string, h: Handler) => this.add('POST', p, h);
  patch = (p: string, h: Handler) => this.add('PATCH', p, h);
  delete = (p: string, h: Handler) => this.add('DELETE', p, h);

  /** Returns the matched handler + params, or throws 404/405. */
  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } {
    const parts = pathname.split('/').filter(Boolean);
    let pathExists = false;
    for (const route of this.routes) {
      const params = matchSegments(route.segments, parts);
      if (!params) continue;
      pathExists = true;
      if (route.method !== method) continue;
      return { handler: route.handler, params };
    }
    if (pathExists) throw new ApiError(405, `Method ${method} not allowed`, 'METHOD_NOT_ALLOWED');
    throw ApiError.notFound(`Route ${method} ${pathname} not found`);
  }
}

function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i];
    if (seg === '*') {
      params.wildcard = parts.slice(i).map(decodeURIComponent).join('/');
      return params;
    }
    if (i >= parts.length) return null;
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = safeDecode(parts[i]);
    } else if (seg !== parts[i]) {
      return null;
    }
  }
  return pattern.length === parts.length ? params : null;
}

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
