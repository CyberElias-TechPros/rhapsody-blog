'use client';

/**
 * The narration player's state machine.
 *
 * It lives in the root layout (`components/providers.tsx`), not on the article page, so a reader
 * can start a devotional and keep listening while they browse the library, open another day or
 * search — the audio does not belong to the page that started it.
 *
 * Two engines share one state machine:
 *
 * - `browser` — `window.speechSynthesis`. No key, no network, no cost, and it works offline.
 *   The platform quirks are handled here rather than in the UI: Chrome stops speaking somewhere
 *   around fifteen seconds into one utterance, so a section is cut into chunks (`chunkSection` in
 *   `lib/tts.ts`) with a keep-alive nudge running while it speaks; `pause()` is ignored by some
 *   builds, so it is checked 150ms later and, when it did not take, the chunk is cancelled and
 *   remembered instead.
 * - `studio` — `POST /api/tts` per section, played through an `<audio>` element. Used only when
 *   `NEXT_PUBLIC_TTS_PROVIDER` is set *and* the route reports a key is configured; any failure
 *   (501, network, decode) falls back to the browser voice mid-article rather than going silent.
 *
 * Progress (which section a reader reached) and preferences (rate, voice, engine) persist in
 * localStorage, so "Listen" on a half-finished article offers to resume where it stopped.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { DEFAULT_RATE, chunkSection, pickVoice, sortedVoices, type SpokenScript } from '@/lib/tts';
import { TTS_ENDPOINT, TTS_PROVIDER, TTS_VOICE } from '@/lib/env';

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error' | 'unsupported';
export type EngineId = 'browser' | 'studio';

const PREFS_KEY = 'rhapsody.audio.prefs';
const PROGRESS_KEY = 'rhapsody.audio.progress';
/** A resume point older than this is stale — nobody picks up a devotional a fortnight later. */
const RESUME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface Prefs {
  rate: number;
  voiceURI: string | null;
  engine: EngineId;
}

interface Progress {
  href: string;
  title: string;
  index: number;
  at: number;
}

const DEFAULT_PREFS: Prefs = { rate: DEFAULT_RATE, voiceURI: null, engine: 'browser' };

function readPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      rate: typeof parsed.rate === 'number' && parsed.rate >= 0.5 && parsed.rate <= 3 ? parsed.rate : DEFAULT_RATE,
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : null,
      engine: parsed.engine === 'studio' ? 'studio' : 'browser',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: Prefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* blocked storage costs the reader a preference, not the feature */
  }
}

function readProgress(): Progress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (typeof parsed.href !== 'string' || typeof parsed.index !== 'number' || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > RESUME_WINDOW_MS) return null;
    return { href: parsed.href, title: parsed.title ?? '', index: parsed.index, at: parsed.at };
  } catch {
    return null;
  }
}

function writeProgress(progress: Progress | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (progress) window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    else window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* a lost resume point is not worth an error */
  }
}

/* ------------------------------------------------------- the resume point, as an external store
 *
 * "Where did I stop?" lives in localStorage, which does not exist during a server render. The
 * obvious implementation — read it in an effect, `setState` the answer — makes every consumer
 * render twice and puts the second render a frame behind the first. `useSyncExternalStore` is the
 * React-shaped way to read an external mutable store: the server snapshot is `null`, the client
 * snapshot is what was stored, and the provider and every Listen button see one value at one time.
 *
 * The snapshot is cached because a store must return a referentially stable object between reads,
 * and `setProgress` keeps the cache and the storage in step.
 */
const progressListeners = new Set<() => void>();
let progressSnapshot: Progress | null = null;
let progressLoaded = false;

function progressStore(): Progress | null {
  if (!progressLoaded) {
    progressSnapshot = readProgress();
    progressLoaded = true;
  }
  return progressSnapshot;
}

function onStorageEvent(event: StorageEvent): void {
  if (event.key !== null && event.key !== PROGRESS_KEY) return;
  progressSnapshot = readProgress();
  for (const listener of progressListeners) listener();
}

function subscribeProgress(listener: () => void): () => void {
  progressListeners.add(listener);
  // The same tab is covered by `setProgress`; this is for a reader with the site open twice.
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorageEvent);
  return () => {
    progressListeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorageEvent);
  };
}

/** Write the resume point and tell every subscriber — the only way progress changes. */
function setProgress(next: Progress | null): void {
  writeProgress(next);
  progressSnapshot = next;
  progressLoaded = true;
  for (const listener of progressListeners) listener();
}

const serverProgress = (): Progress | null => null;

/**
 * Where a reader stopped on `href`, when they stopped part-way and it was recent enough to be
 * worth offering. `null` means "start at the top".
 */
export function useResumeIndex(href: string): number | null {
  const progress = useSyncExternalStore(subscribeProgress, progressStore, serverProgress);
  return progress && progress.href === href && progress.index > 0 ? progress.index : null;
}

/** Does this browser have a speech engine at all? False on the server, so hydration agrees. */
const supportsSpeech = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const subscribeNever = (): (() => void) => () => {};
const serverSupportsSpeech = (): boolean => false;

interface AudioState {
  status: AudioStatus;
  script: SpokenScript | null;
  index: number;
  chunk: number;
  rate: number;
  voiceURI: string | null;
  engine: EngineId;
  error: string | null;
}

type Action =
  | { type: 'load'; script: SpokenScript; index: number }
  | { type: 'status'; status: AudioStatus }
  | { type: 'section'; index: number; chunk?: number }
  | { type: 'chunk'; chunk: number }
  | { type: 'rate'; rate: number }
  | { type: 'voice'; voiceURI: string | null }
  | { type: 'engine'; engine: EngineId }
  | { type: 'error'; message: string }
  | { type: 'stop' }
  | { type: 'ready'; prefs: Prefs; supported: boolean };

function reducer(state: AudioState, action: Action): AudioState {
  switch (action.type) {
    case 'ready':
      return {
        ...state,
        rate: action.prefs.rate,
        voiceURI: action.prefs.voiceURI,
        engine: action.prefs.engine,
        status: action.supported ? (state.status === 'unsupported' ? 'idle' : state.status) : 'unsupported',
      };
    case 'load':
      return { ...state, script: action.script, index: action.index, chunk: 0, status: 'playing', error: null };
    case 'status':
      return { ...state, status: action.status };
    case 'section':
      return { ...state, index: action.index, chunk: action.chunk ?? 0 };
    case 'chunk':
      return { ...state, chunk: action.chunk };
    case 'rate':
      return { ...state, rate: action.rate };
    case 'voice':
      return { ...state, voiceURI: action.voiceURI };
    case 'engine':
      return { ...state, engine: action.engine };
    case 'error':
      return { ...state, status: 'error', error: action.message };
    case 'stop':
      return { ...state, status: 'idle', script: null, index: 0, chunk: 0, error: null };
    default:
      return state;
  }
}

const INITIAL: AudioState = {
  status: 'idle',
  script: null,
  index: 0,
  chunk: 0,
  rate: DEFAULT_RATE,
  voiceURI: null,
  engine: 'browser',
  error: null,
};

export interface AudioContextValue extends AudioState {
  /** False with no speech synthesis and no studio key — every control hides itself. */
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  /** True once `GET /api/tts` has confirmed a studio key exists. */
  studioAvailable: boolean;
  /** Where this script was left off, when it was left off part-way through. */
  resumeIndex: number | null;
  chunks: number;
  sections: number;
  /** 0–1 across the whole script, accurate to the chunk being spoken. */
  progress: number;
  sectionLabel: string;
  play: (script: SpokenScript, startIndex?: number) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seek: (index: number) => void;
  setRate: (rate: number) => void;
  setVoice: (voiceURI: string | null) => void;
  setEngine: (engine: EngineId) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [studioAvailable, setStudioAvailable] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);

  // Capability and the resume point are read from the outside world, not held in state: a browser
  // either has a speech engine or it does not, and the answer must not differ between the server
  // HTML and the first client paint.
  const browserCanSpeak = useSyncExternalStore(subscribeNever, supportsSpeech, serverSupportsSpeech);
  const supported = browserCanSpeak || studioAvailable;
  const storedProgress = useSyncExternalStore(subscribeProgress, progressStore, serverProgress);
  // Offered only while it is a part-way point in the article that is loaded, and only within the
  // section count of that article — a stale index past the end would start playback nowhere.
  const resumeIndex =
    state.script && storedProgress && storedProgress.href === state.script.href
      ? storedProgress.index > 0 && storedProgress.index < state.script.sections.length
        ? storedProgress.index
        : null
      : null;

  // Refs the engine callbacks read, so an utterance that ends three sections later still sees
  // the state of that moment rather than the state it was created in. They are written in an
  // effect rather than during the render: under concurrent rendering a render can be thrown away,
  // and a ref holding the state of a render that never committed is a ref holding a lie.
  const stateRef = useRef(state);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const studioRef = useRef(studioAvailable);
  useEffect(() => {
    stateRef.current = state;
    voicesRef.current = voices;
    studioRef.current = studioAvailable;
  });
  /** Bumped before every start; a callback from an older run is a no-op. */
  const runRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const keepAliveRef = useRef<number | null>(null);
  const startedSectionRef = useRef<string | null>(null);

  /* ------------------------------------------------------------------ capability + prefs */

  useEffect(() => {
    // Read directly rather than from the store: this runs once, on mount, before the store's
    // client snapshot has replaced the server one.
    const canSpeak = supportsSpeech();
    dispatch({ type: 'ready', prefs: readPrefs(), supported: canSpeak });

    if (!canSpeak) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices() ?? []);
    load();
    // Safari and Chrome fill the list asynchronously, after the first paint.
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  // Ask once whether a studio voice exists. Without a key this is a cheap GET answering
  // `configured: false`, and the browser engine carries on untouched.
  useEffect(() => {
    if (TTS_PROVIDER === 'browser') return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(TTS_ENDPOINT, { method: 'GET' });
        if (!response.ok) return;
        const data = (await response.json()) as { configured?: boolean };
        if (!cancelled && data.configured) setStudioAvailable(true);
      } catch {
        /* no studio voice — the browser engine is the feature, this is the upgrade */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------ engine plumbing */

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      window.clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    // Chrome's synthesis stalls on long utterances; a pause/resume pair every ten seconds keeps
    // it alive, and is inaudible because it lands between chunks.
    keepAliveRef.current = window.setInterval(() => {
      if (!window.speechSynthesis?.speaking) return;
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10_000);
  }, [stopKeepAlive]);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute('src');
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  /** Stop everything in flight. Pending callbacks from the previous run then do nothing. */
  const cancelAll = useCallback(() => {
    runRef.current += 1;
    startedSectionRef.current = null;
    stopKeepAlive();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* cancelling an idle engine throws in some browsers */
      }
    }
    releaseAudio();
  }, [releaseAudio, stopKeepAlive]);

  const advance = useCallback((script: SpokenScript, index: number) => {
    if (index + 1 < script.sections.length) {
      setProgress({ href: script.href, title: script.title, index: index + 1, at: Date.now() });
      startedSectionRef.current = null;
      dispatch({ type: 'section', index: index + 1, chunk: 0 });
      return;
    }
    setProgress(null);
    startedSectionRef.current = null;
    dispatch({ type: 'status', status: 'ended' });
  }, []);

  const startBrowserSection = useCallback(
    (script: SpokenScript, index: number, fromChunk: number) => {
      const section = script.sections[index];
      if (!section) {
        dispatch({ type: 'status', status: 'ended' });
        return;
      }
      const { rate, voiceURI } = stateRef.current;
      const parts = chunkSection(section.text);
      setChunkCount(parts.length);
      const runId = ++runRef.current;
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* as above */
      }
      startKeepAlive();
      dispatch({ type: 'status', status: 'playing' });

      const speakChunk = (chunkIndex: number) => {
        if (runId !== runRef.current) return;
        if (chunkIndex >= parts.length) {
          advance(script, index);
          return;
        }
        dispatch({ type: 'chunk', chunk: chunkIndex });
        const utterance = new SpeechSynthesisUtterance(parts[chunkIndex]);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voice = pickVoice(voicesRef.current, voiceURI);
        utterance.voice = voice ?? null;
        utterance.lang = voice?.lang || 'en-GB';
        utterance.onend = () => {
          if (runId !== runRef.current) return;
          speakChunk(chunkIndex + 1);
        };
        utterance.onerror = (event) => {
          if (runId !== runRef.current) return;
          // Stopping, pausing and navigating all arrive as errors; they are not faults.
          if (event.error === 'interrupted' || event.error === 'canceled') return;
          stopKeepAlive();
          dispatch({
            type: 'error',
            message: 'Your browser stopped reading aloud. Try again, or choose a different voice in the player.',
          });
        };
        window.speechSynthesis.speak(utterance);
      };

      speakChunk(Math.max(0, Math.min(fromChunk, parts.length - 1)));
    },
    [advance, startKeepAlive, stopKeepAlive]
  );

  const startStudioSection = useCallback(
    (script: SpokenScript, index: number) => {
      const section = script.sections[index];
      if (!section) {
        dispatch({ type: 'status', status: 'ended' });
        return;
      }
      const runId = ++runRef.current;
      setChunkCount(1);
      dispatch({ type: 'status', status: 'loading' });

      /** Never leave a listener in silence: drop to the browser voice and carry on from here. */
      const fallBack = () => {
        if (runId !== runRef.current) return;
        toast.error('Studio voice unavailable — continuing with your browser’s voice.');
        setStudioAvailable(false);
        dispatch({ type: 'engine', engine: 'browser' });
        writePrefs({ ...readPrefs(), engine: 'browser' });
        startBrowserSection(script, index, 0);
      };

      void (async () => {
        try {
          const response = await fetch(TTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: section.text,
              provider: TTS_PROVIDER,
              voice: TTS_VOICE,
              speed: stateRef.current.rate,
            }),
          });
          if (!response.ok) throw new Error(`status ${response.status}`);
          const blob = await response.blob();
          if (runId !== runRef.current) return;

          releaseAudio();
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          const audio = audioRef.current ?? new Audio();
          audioRef.current = audio;
          audio.src = url;
          audio.playbackRate = stateRef.current.rate;
          audio.onended = () => {
            if (runId !== runRef.current) return;
            advance(script, index);
          };
          audio.onerror = fallBack;
          dispatch({ type: 'status', status: 'playing' });
          await audio.play();
        } catch {
          fallBack();
        }
      })();
    },
    [advance, releaseAudio, startBrowserSection]
  );

  /** Start one section with whichever engine is in use. Idempotent per (script, section). */
  const startSection = useCallback(
    (script: SpokenScript, index: number, fromChunk = 0) => {
      const key = `${script.href}#${index}`;
      if (startedSectionRef.current === key) return;
      startedSectionRef.current = key;
      if (stateRef.current.engine === 'studio' && (studioRef.current || TTS_PROVIDER !== 'browser')) {
        startStudioSection(script, index);
        return;
      }
      startBrowserSection(script, index, fromChunk);
    },
    [startBrowserSection, startStudioSection]
  );

  const startSectionRef = useRef(startSection);
  useEffect(() => {
    // Declared (and mirrored) after `startSection` so the driver effect below reads the callback
    // built from this render's state, not the first one's.
    startSectionRef.current = startSection;
  });

  /* ------------------------------------------------------------------ driver */

  // The reducer owns "which section"; this effect owns "speak it", so next / previous / seek all
  // funnel through one path. `startSection` is idempotent, which keeps a re-render from
  // restarting the sentence being read.
  useEffect(() => {
    const { script, index, status } = state;
    if (!script) return;
    if (status !== 'playing' && status !== 'loading') return;
    startSectionRef.current(script, index);
  }, [state, stateRef, voicesRef]);

  // Stop the engines if the provider is ever unmounted (it lives in the root layout, so this is
  // only a hot-reload or a test teardown — but a stuck utterance outliving a page is worth preventing).
  useEffect(() => () => cancelAll(), [cancelAll]);

  /* ------------------------------------------------------------------ public actions */

  const play = useCallback(
    (script: SpokenScript, startIndex = 0) => {
      if (!script.sections.length) {
        dispatch({ type: 'error', message: 'There is nothing to read aloud in this article.' });
        return;
      }
      if (!supported) {
        dispatch({ type: 'status', status: 'unsupported' });
        toast.error('This browser cannot read aloud. Try Chrome, Edge or Safari.');
        return;
      }
      cancelAll();
      const index = Math.max(0, Math.min(startIndex, script.sections.length - 1));
      dispatch({ type: 'load', script, index });
      startSectionRef.current(script, index, 0);
    },
    [cancelAll, supported]
  );

  const pause = useCallback(() => {
    const { engine, index, script } = stateRef.current;
    if (engine === 'studio') {
      audioRef.current?.pause();
      dispatch({ type: 'status', status: 'paused' });
      return;
    }
    try {
      window.speechSynthesis.pause();
    } catch {
      /* the check below covers a pause that did not take */
    }
    dispatch({ type: 'status', status: 'paused' });
    // Some Chrome builds ignore pause() mid-utterance and keep reading. Check, and if it did not
    // take, cancel and let resume() restart this chunk — a repeated sentence beats a player that
    // says "paused" while talking over itself.
    window.setTimeout(() => {
      if (stateRef.current.status !== 'paused') return;
      if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
        runRef.current += 1;
        stopKeepAlive();
        // The idempotency key stays set: `resume()` restarts this chunk itself, and the driver
        // effect must not start a second copy of the same section behind it.
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* nothing to cancel */
        }
        if (script) setProgress({ href: script.href, title: script.title, index, at: Date.now() });
      }
    }, 150);
  }, [stopKeepAlive]);

  const resume = useCallback(() => {
    const { engine, script, index, chunk, status } = stateRef.current;
    if (!script || status === 'playing' || status === 'loading') return;
    if (engine === 'studio' && audioRef.current?.src) {
      dispatch({ type: 'status', status: 'playing' });
      void audioRef.current.play().catch(() => {
        startedSectionRef.current = null;
        startSectionRef.current(script, index, 0);
      });
      return;
    }
    if (engine === 'browser' && typeof window !== 'undefined' && window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      startKeepAlive();
      dispatch({ type: 'status', status: 'playing' });
      return;
    }
    // Cancelled (or the tab slept, which browsers do to a backgrounded synthesis): restart from
    // the chunk the reader was on.
    dispatch({ type: 'status', status: 'playing' });
    startBrowserSection(script, index, chunk);
  }, [startBrowserSection, startKeepAlive]);

  const toggle = useCallback(() => {
    const { status, script } = stateRef.current;
    if (status === 'playing' || status === 'loading') {
      pause();
      return;
    }
    if (status === 'paused') {
      resume();
      return;
    }
    if (script) play(script, 0); // ended or errored with a script still loaded: start again
  }, [pause, play, resume]);

  const stop = useCallback(() => {
    cancelAll();
    setProgress(null);
    dispatch({ type: 'stop' });
  }, [cancelAll]);

  const seek = useCallback((index: number) => {
    const { script } = stateRef.current;
    if (!script) return;
    const bounded = Math.max(0, Math.min(index, script.sections.length - 1));
    cancelAll();
    dispatch({ type: 'section', index: bounded, chunk: 0 });
    dispatch({ type: 'status', status: 'playing' });
    startSectionRef.current(script, bounded, 0);
  }, [cancelAll]);

  const next = useCallback(() => {
    const { script, index } = stateRef.current;
    if (script && index + 1 < script.sections.length) seek(index + 1);
  }, [seek]);

  const previous = useCallback(() => {
    const { index } = stateRef.current;
    if (index > 0) seek(index - 1);
  }, [seek]);

  /**
   * Stop the engines and let the driver effect start the current section again — used when a
   * preference (rate, voice, engine) changes mid-playback and an in-flight utterance cannot pick
   * it up. Clearing the idempotency key is what makes the effect willing to restart it.
   */
  const restartCurrentSection = useCallback(() => {
    const { script, status } = stateRef.current;
    if (!script || (status !== 'playing' && status !== 'loading')) return;
    cancelAll();
    dispatch({ type: 'status', status: 'playing' });
  }, [cancelAll]);

  const setRate = useCallback(
    (rate: number) => {
      dispatch({ type: 'rate', rate });
      writePrefs({ ...readPrefs(), rate });
      // A studio clip is an <audio> element, so its rate can change without losing position.
      if (audioRef.current?.src) {
        audioRef.current.playbackRate = rate;
        return;
      }
      restartCurrentSection();
    },
    [restartCurrentSection]
  );

  const setVoice = useCallback(
    (voiceURI: string | null) => {
      dispatch({ type: 'voice', voiceURI });
      writePrefs({ ...readPrefs(), voiceURI });
      // Voices only exist for the browser engine; a paused player picks the new one up on resume.
      if (stateRef.current.engine === 'browser') restartCurrentSection();
    },
    [restartCurrentSection]
  );

  const setEngine = useCallback(
    (engine: EngineId) => {
      dispatch({ type: 'engine', engine });
      writePrefs({ ...readPrefs(), engine });
      const { status } = stateRef.current;
      if (status === 'idle' || status === 'unsupported' || status === 'ended') return;
      cancelAll();
      dispatch({ type: 'status', status: 'playing' });
    },
    [cancelAll]
  );

  const sections = state.script?.sections.length ?? 0;
  const sectionLabel = state.script?.sections[state.index]?.label ?? '';
  const progress = useMemo(() => {
    if (!sections) return 0;
    const within = chunkCount > 1 ? (state.chunk + 1) / chunkCount : 1;
    return Math.min(1, (state.index + within) / sections);
  }, [chunkCount, sections, state.chunk, state.index]);

  const value: AudioContextValue = {
    ...state,
    supported,
    voices,
    studioAvailable,
    resumeIndex,
    chunks: chunkCount,
    sections,
    progress,
    sectionLabel,
    play,
    toggle,
    pause,
    resume,
    stop,
    next,
    previous,
    seek,
    setRate,
    setVoice,
    setEngine,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used inside <AudioProvider>.');
  return context;
}

/** Voices in the order the picker should show them: this language first, local ones before network. */
export function useSortedVoices() {
  const { voices } = useAudio();
  return useMemo(() => sortedVoices(voices), [voices]);
}
