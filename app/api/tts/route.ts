import { buildTtsRequest, MAX_TTS_CHARS, resolveProvider, ttsCacheKey } from '@/lib/tts-providers';
import { TTS_MODEL, TTS_PROVIDER, TTS_VOICE } from '@/lib/env';

/**
 * Studio narration: text in, MP3 out.
 *
 * The player in `components/audio/AudioProvider.tsx` reads an article with the browser's own
 * speech synthesis by default, which needs no key, no network and no money. This route is the
 * upgrade path — set `NEXT_PUBLIC_TTS_PROVIDER` and drop in `OPENAI_API_KEY` or
 * `ELEVENLABS_API_KEY` and the same player streams a studio voice instead, section by section.
 *
 * `GET` reports what is configured so the client can choose an engine without a request that is
 * going to fail; `POST` renders one section. Nothing here throws when a key is missing — an
 * unconfigured deployment answers 501 with a plain-language reason and the player falls back.
 */

export const dynamic = 'force-dynamic';

const jsonBody = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const error = (status: number, code: string, message: string, details?: unknown) =>
  jsonBody({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status);

/** What the client needs to decide whether a studio voice exists at all. */
export function GET() {
  const provider = resolveProvider(process.env, TTS_PROVIDER);
  return jsonBody(
    {
      // `browser` when no key is present: the player then never calls POST at all.
      provider: provider ?? 'browser',
      configured: Boolean(provider),
      voice: provider ? TTS_VOICE : '',
      model: provider ? TTS_MODEL : '',
      maxChars: MAX_TTS_CHARS,
    },
    200,
    // Changes only when a deploy adds a key, so a short shared cache is free money.
    { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' }
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return error(400, 'INVALID_JSON', 'Expected a JSON body: { "text": "…" }.');
  }

  const { text, voice, model, provider, speed } = (payload ?? {}) as {
    text?: unknown;
    voice?: unknown;
    model?: unknown;
    provider?: unknown;
    speed?: unknown;
  };

  if (typeof text !== 'string' || !text.trim()) {
    return error(400, 'TEXT_REQUIRED', 'A non-empty "text" string is required.');
  }
  if (text.length > MAX_TTS_CHARS) {
    // The player chunks sections well under this; hitting the cap means someone is using the
    // endpoint as a free text-to-speech proxy, which is the one thing it must not become.
    return error(413, 'TEXT_TOO_LONG', `"text" must be at most ${MAX_TTS_CHARS} characters.`, {
      received: text.length,
      limit: MAX_TTS_CHARS,
    });
  }

  const chosen = resolveProvider(process.env, typeof provider === 'string' ? provider : TTS_PROVIDER);
  if (!chosen) {
    return error(
      501,
      'TTS_NOT_CONFIGURED',
      'Studio narration is not configured on this deployment. Set OPENAI_API_KEY or ELEVENLABS_API_KEY, or leave NEXT_PUBLIC_TTS_PROVIDER unset and the player will use the browser voice.',
      { hint: 'GET /api/tts reports what is configured.' }
    );
  }

  const apiKey = (process.env[chosen === 'openai' ? 'OPENAI_API_KEY' : 'ELEVENLABS_API_KEY'] ?? '').trim();
  const spec = buildTtsRequest({
    provider: chosen,
    text: text.trim(),
    voice: typeof voice === 'string' ? voice : TTS_VOICE,
    model: typeof model === 'string' ? model : TTS_MODEL,
    speed: typeof speed === 'number' ? speed : 1,
    apiKey,
  });

  const cacheKey = await ttsCacheKey(spec);

  try {
    const upstream = await fetch(spec.url, {
      method: spec.method,
      headers: spec.headers,
      body: spec.body,
      // Narration is generated, not streamed live; give a slow provider room but not forever.
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok || !upstream.body) {
      // Never echo the upstream body: an auth failure can quote the request headers back, and
      // the key is in them.
      return error(502, 'TTS_UPSTREAM', `The narration provider returned ${upstream.status}.`, {
        provider: chosen,
        status: upstream.status,
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || spec.contentType,
        // The same words in the same voice are the same bytes forever.
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${cacheKey}"`,
        'X-TTS-Provider': chosen,
      },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
    return error(
      timedOut ? 504 : 502,
      timedOut ? 'TTS_TIMEOUT' : 'TTS_UPSTREAM',
      timedOut ? 'The narration provider did not answer in time.' : 'Could not reach the narration provider.'
    );
  }
}
