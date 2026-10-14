/**
 * Optional third-party integrations, in one place, all of which degrade gracefully.
 *
 * The site is a static blog with a Cloudflare Worker behind it, so nothing here is required for
 * a deploy to work: every value has a usable default, and every feature that needs a key says so
 * out loud (in the console on the server, in the UI where a reader would notice) instead of
 * throwing. `.env.example` documents each one; `docs/ROADMAP.md` lists what a key unlocks.
 *
 * `NEXT_PUBLIC_` only: this module is imported from client components (the audio player), so a
 * non-public variable would be inlined as `undefined` and fail confusingly at runtime.
 */

/** Which engine reads an article aloud. `browser` needs no key and no network. */
export type TtsProvider = 'browser' | 'openai' | 'elevenlabs';

const TTS_PROVIDERS: TtsProvider[] = ['browser', 'openai', 'elevenlabs'];

/** The voice each studio provider uses when `NEXT_PUBLIC_TTS_VOICE` is not set. */
export const DEFAULT_TTS_VOICE: Record<TtsProvider, string> = {
  browser: '',
  openai: 'gideon',
  elevenlabs: '21m00Tcm4TlvDq8ikWAM', // ElevenLabs' built-in "Rachel"
};

export const DEFAULT_TTS_MODEL: Record<TtsProvider, string> = {
  browser: '',
  openai: 'gpt-4o-mini-tts',
  elevenlabs: 'eleven_multilingual_v2',
};

function readProvider(raw: string | undefined): TtsProvider {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'browser';
  const found = TTS_PROVIDERS.find((provider) => provider === value);
  if (!found) {
    // A typo'd provider must not take audio down: fall back and say why, once, on the server.
    if (typeof window === 'undefined') {
      console.warn(`[env] NEXT_PUBLIC_TTS_PROVIDER="${raw}" is not one of ${TTS_PROVIDERS.join(', ')} — using the browser voice.`);
    }
    return 'browser';
  }
  return found;
}

export const TTS_PROVIDER: TtsProvider = readProvider(process.env.NEXT_PUBLIC_TTS_PROVIDER);

export const TTS_VOICE: string = (process.env.NEXT_PUBLIC_TTS_VOICE ?? '').trim() || DEFAULT_TTS_VOICE[TTS_PROVIDER];

export const TTS_MODEL: string = (process.env.NEXT_PUBLIC_TTS_MODEL ?? '').trim() || DEFAULT_TTS_MODEL[TTS_PROVIDER];

/** Whether a studio voice is even worth asking the API for. */
export function studioVoiceConfigured(provider: TtsProvider = TTS_PROVIDER): boolean {
  if (provider === 'browser') return false;
  // The secret itself is server-only; the client can only know a provider was chosen.
  return TTS_PROVIDERS.includes(provider);
}

/** Where the player sends a section to be spoken when a studio voice is configured. */
export const TTS_ENDPOINT = '/api/tts';

/**
 * Every optional key the app knows about, with what it unlocks. `/admin` and the build log use
 * this to tell an operator what is still switched off — which is the "just add the keys" list.
 */
export interface OptionalIntegration {
  /** Env var that switches it on. */
  key: string;
  /** Where it is read (the browser only ever sees `NEXT_PUBLIC_` ones). */
  scope: 'public' | 'server' | 'worker';
  feature: string;
  /** What happens without it — always "the site still works", but specifically. */
  fallback: string;
}

export const OPTIONAL_INTEGRATIONS: OptionalIntegration[] = [
  {
    key: 'NEXT_PUBLIC_ADSENSE_SLOT_FEED',
    scope: 'public',
    feature: 'In-feed ad units on the home grid, /devotionals, edition pages and search results',
    fallback: 'The position renders nothing at all — no empty box, no layout shift.',
  },
  {
    key: 'NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE',
    scope: 'public',
    feature: 'Below-the-article ad units',
    fallback: 'No unit is rendered inside or under a devotional.',
  },
  {
    key: 'NEXT_PUBLIC_ADSENSE_SLOT_PAGE',
    scope: 'public',
    feature: 'Ad units on standalone pages such as /about',
    fallback: 'No unit is rendered on those pages.',
  },
  {
    key: 'NEXT_PUBLIC_TTS_PROVIDER',
    scope: 'public',
    feature: 'Studio narration ("Listen") through OpenAI or ElevenLabs',
    fallback: 'The browser’s own speech synthesis reads the article — free, offline, no key.',
  },
  {
    key: 'OPENAI_API_KEY',
    scope: 'server',
    feature: 'OpenAI narration for /api/tts',
    fallback: '/api/tts answers 501 and the player uses the browser voice.',
  },
  {
    key: 'ELEVENLABS_API_KEY',
    scope: 'server',
    feature: 'ElevenLabs narration for /api/tts',
    fallback: '/api/tts answers 501 and the player uses the browser voice.',
  },
  {
    key: 'NEXT_PUBLIC_API_URL',
    scope: 'public',
    feature: 'Accounts, saved-library sync, admin console and newsletter sign-up',
    fallback: 'Every dynamic screen shows its offline state; reading, search and saving locally all still work.',
  },
  {
    key: 'RESEND_API_KEY',
    scope: 'worker',
    feature: 'The daily devotional email (05:00 cron) and the welcome message',
    fallback: 'Subscriptions are still stored; nothing is sent and the run is logged as skipped.',
  },
  {
    key: 'POSTMARK_SERVER_TOKEN',
    scope: 'worker',
    feature: 'The daily email through Postmark instead of Resend',
    fallback: 'As above — the first configured provider wins.',
  },
];

/** The integrations that are switched off right now, for an operator-facing list. */
export function missingIntegrations(available: Record<string, string | undefined>): OptionalIntegration[] {
  return OPTIONAL_INTEGRATIONS.filter((integration) => !(available[integration.key] ?? '').trim());
}
