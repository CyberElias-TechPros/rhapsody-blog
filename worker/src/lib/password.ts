/**
 * Password hashing via WebCrypto PBKDF2-SHA256.
 *
 * Why not bcrypt: bcrypt implementations that run on Workers (bcryptjs) consume large
 * amounts of billed CPU and depend on Node Buffer semantics. PBKDF2 is provided natively
 * by crypto.subtle in workerd (fast, off-CPU), and at 250k iterations is a safe standard.
 * If you prefer argon2/scrypt, scrypt is also available via crypto.subtle in recent runtimes.
 *
 * Storage format: pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>
 */

const ENC = new TextEncoder();
const ITERATIONS = 250_000;
const KEY_LEN_BITS = 256;
const SALT_BYTES = 16;

export type PasswordHash = string;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ENC.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    KEY_LEN_BITS
  );
  return new Uint8Array(bits);
}

const toHexLocal = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const fromHexLocal = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toHexLocal(salt)}$${toHexLocal(hash)}`;
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 1_000_000) return false;
  let expected: Uint8Array;
  let actual: Uint8Array;
  try {
    expected = fromHexLocal(parts[3]);
    actual = await derive(password, fromHexLocal(parts[2]), iterations);
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  // constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return diff === 0;
}
