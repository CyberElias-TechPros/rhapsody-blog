/**
 * Ambient typing for the bindings that `cloudflare:test` (vitest-pool-workers) injects.
 * Normally `wrangler types` generates `Cloudflare.Env` for this; declaring it against our
 * own `Env` keeps `tsc --noEmit` green in CI without a network round-trip.
 */
declare module "cloudflare:test" {
  const env: import("../src/types").Env;
  const SELF: {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export { env, SELF };
}
