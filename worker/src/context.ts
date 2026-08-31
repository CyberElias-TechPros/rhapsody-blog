/**
 * Request context threaded through the router.
 */

import type { Env, AuthedUser } from './types';

export interface Ctx {
  request: Request;
  url: URL;
  params: Record<string, string>;
  env: Env;
  execution: ExecutionContext;
  requestId: string;
  clientIp: string;
  /** Populated after JWT verification (null = anonymous). */
  user: AuthedUser | null;
  /** Base origin used to build absolute media URLs. */
  origin: string;
}
