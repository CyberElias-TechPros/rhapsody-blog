/**
 * Studio narration providers for `/api/tts`.
 *
 * Server-only: it reads the secret keys, which must never reach the client bundle. Kept apart
 * from the route handler so the request-building is a pure function that can be unit-tested
 * without a key, a network or a running server — the route is then just validation plus a fetch.
 *
 * Both providers are "text in, MP3 out", so the shape is the same and adding a third (Azure,
 * Google, Play.ht) is one more entry in `buildTtsRequest`.
 */

import type { TtsProvider } from './env';
import { DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from './env';

export interface TtsRequestSpec {
  provider: Exclude<TtsProvider, 'browser'>;
  text: string;
  voice?: string;
  model?: string;
  /** Playback speed, 0.75–2. Providers that cannot express it are asked for the closest. */
  speed?: number;
  apiKey: string;
}

export interface TtsRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  /** What comes back, so the route can set an honest Content-Type. */
  contentType: string;
  provider: TtsRequestSpec['provider'];
}

/**
 * Longest text a single request may carry. Both providers accept more, but a section this long
 * is already a minute of audio, and a hard cap is what stands between a public endpoint and an
 * open proxy for a paid API.
 */
export const MAX_TTS_CHARS = 4_000;

/** The env var that holds each provider's secret. */
export const TTS_KEY_ENV: Record<Exclude<TtsProvider, 'browser'>, string> = {
  openai: 'OPENAI_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

export function isStudioProvider(value: string | undefined): value is Exclude<TtsProvider, 'browser'> {
  return value === 'openai' || value === 'elevenlabs';
}

/**
 * Which provider can actually be used, given the keys in this environment.
 * `preferred` is what the deployment asked for; a provider without a key is skipped rather than
 * failing, so an unconfigured `NEXT_PUBLIC_TTS_PROVIDER` cannot break narration.
 */
export function resolveProvider(
  env: Record<string, string | undefined>,
  preferred?: string | null
): Exclude<TtsProvider, 'browser'> | undefined {
  const candidates: Exclude<TtsProvider, 'browser'>[] = isStudioProvider(preferred ?? undefined)
    ? [preferred as Exclude<TtsProvider, 'browser'>, 'openai', 'elevenlabs']
    : ['openai', 'elevenlabs'];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if ((env[TTS_KEY_ENV[candidate]] ?? '').trim()) return candidate;
  }
  return undefined;
}

/** The upstream request for a provider. Pure — no env, no fetch, no side effects. */
export function buildTtsRequest(spec: TtsRequestSpec): TtsRequest {
  const voice = (spec.voice ?? '').trim() || DEFAULT_TTS_VOICE[spec.provider];
  const model = (spec.model ?? '').trim() || DEFAULT_TTS_MODEL[spec.provider];
  const speed = clampSpeed(spec.speed);

  if (spec.provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/audio/speech',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${spec.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: spec.text,
        response_format: 'mp3',
        // OpenAI's `speed` is 0.25–4.0 and maps directly onto the player's rate.
        speed,
      }),
      contentType: 'audio/mpeg',
      provider: 'openai',
    };
  }

  return {
    // ElevenLabs encodes the format in the query, and the voice in the path.
    url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
    method: 'POST',
    headers: {
      'xi-api-key': spec.apiKey,
      'Content-Type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: spec.text,
      model_id: model,
      // ElevenLabs has no `speed` field on this endpoint; the player changes rate locally by
      // setting `playbackRate` on the <audio> element instead.
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
    contentType: 'audio/mpeg',
    provider: 'elevenlabs',
  };
}

export function clampSpeed(speed: number | undefined): number {
  if (!speed || Number.isNaN(speed)) return 1;
  return Math.min(2, Math.max(0.75, Number(speed.toFixed(2))));
}

/** A stable cache key for a rendered clip — the same words in the same voice are the same file. */
export async function ttsCacheKey(request: TtsRequest): Promise<string> {
  const material = `${request.provider}|${request.url}|${request.body}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
