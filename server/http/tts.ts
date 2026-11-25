// Endpoint HTTP de síntese de voz neural PT-BR (/api/tts) usando Edge Neural TTS (msedge-tts).
// Suporta 8 perfis humanos calibrados + prosódia emocional dinâmica (modelo PAD: alegria, empolgação,
// cansaço, estresse, flerte, alívio, ironia, curiosidade, orgulho, calma) + humanizador PT-BR falado.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { HttpError, readJson, sendJson } from './app';
import { log } from '../log';

export type EmotionTag =
  | 'joy'
  | 'excited'
  | 'warm'
  | 'flirty'
  | 'curious'
  | 'stressed'
  | 'tired'
  | 'proud'
  | 'sarcastic'
  | 'relieved'
  | 'calm';

export interface TtsVoicePreset {
  id: string;
  label: string;
  voice: string;
  baseRate: number; // percentual, ex: +2
  basePitch: number; // Hz, ex: -2
  gender: 'm' | 'f';
}

// Faixas humanas naturais (sem deslocamentos robóticos extremos!)
export const NEURAL_VOICE_PRESETS: Record<string, TtsVoicePreset> = {
  vicente: {
    id: 'vicente',
    label: 'Vicente · Antônio (Líder Natural)',
    voice: 'pt-BR-AntonioNeural',
    baseRate: 2,
    basePitch: -2,
    gender: 'm',
  },
  dev: {
    id: 'dev',
    label: 'Dev · Antônio (Descontraído)',
    voice: 'pt-BR-AntonioNeural',
    baseRate: 6,
    basePitch: 2,
    gender: 'm',
  },
  fx: {
    id: 'fx',
    label: 'FX & Áudio · Antônio (Expressivo)',
    voice: 'pt-BR-AntonioNeural',
    baseRate: 5,
    basePitch: 5,
    gender: 'm',
  },
  qa: {
    id: 'qa',
    label: 'QA Auditor · Francisca (Analítica)',
    voice: 'pt-BR-FranciscaNeural',
    baseRate: 1,
    basePitch: -2,
    gender: 'f',
  },
  user: {
    id: 'user',
    label: 'User Advocate · Thalita (Acolhedora)',
    voice: 'pt-BR-ThalitaMultilingualNeural',
    baseRate: 3,
    basePitch: 1,
    gender: 'f',
  },
  art: {
    id: 'art',
    label: 'Art Designer · Thalita (Criativa)',
    voice: 'pt-BR-ThalitaMultilingualNeural',
    baseRate: 5,
    basePitch: 4,
    gender: 'f',
  },
  ux: {
    id: 'ux',
    label: 'UX/UI Lead · Francisca (Fluida)',
    voice: 'pt-BR-FranciscaNeural',
    baseRate: 4,
    basePitch: 2,
    gender: 'f',
  },
  release: {
    id: 'release',
    label: 'Release Lead · Antônio (Firme)',
    voice: 'pt-BR-AntonioNeural',
    baseRate: -1,
    basePitch: -5,
    gender: 'm',
  },
};

// Modulação prosódica baseada no modelo emocional PAD (Pleasure-Arousal-Dominance)
const EMOTION_PROSODY: Record<EmotionTag, { rate: number; pitch: number }> = {
  excited: { rate: 9, pitch: 5 },
  joy: { rate: 5, pitch: 3 },
  proud: { rate: 2, pitch: 2 },
  curious: { rate: 3, pitch: 4 },
  flirty: { rate: -5, pitch: -1 },
  warm: { rate: -3, pitch: 0 },
  relieved: { rate: -4, pitch: -2 },
  calm: { rate: -2, pitch: -1 },
  sarcastic: { rate: -3, pitch: -3 },
  stressed: { rate: 8, pitch: 3 },
  tired: { rate: -9, pitch: -4 },
};

const ALLOWED_VOICES = new Set([
  'pt-BR-AntonioNeural',
  'pt-BR-FranciscaNeural',
  'pt-BR-ThalitaMultilingualNeural',
]);

const MAX_CACHE_ITEMS = 180;
const audioCache = new Map<string, Buffer>();

/** Humaniza texto para fala natural em PT-BR (remove códigos/emojis, suaviza siglas e pausas). */
function sanitizeSpeechText(raw: string): string {
  return raw
    .replace(/\((y|n|h|w|c|l|k|f|b|d|p|s|\*|@|&)\)/gi, '')
    .replace(/[:;=]-?[)D(P/\\|oO]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[`*_~#<>[\]{}|]/g, ' ')
    .replace(/https?:\/\/\S+/g, 'o link')
    .replace(/\bQA\b/g, 'Q A')
    .replace(/\bUX\/UI\b/gi, 'U X e U I')
    .replace(/\bUX\b/g, 'U X')
    .replace(/\bUI\b/g, 'U I')
    .replace(/\bAPI\b/g, 'A P I')
    .replace(/\bCSS\b/g, 'C S S')
    .replace(/\bPWA\b/g, 'P W A')
    .replace(/\bTTS\b/g, 'voz neural')
    .replace(/\b3D\b/g, 'três D')
    .replace(/\b2D\b/g, 'dois D')
    .replace(/\bXP\b/g, 'X P')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\.{3,}/g, '... ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 340);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function formatSigned(n: number, unit: '%' | 'Hz'): string {
  return `${n >= 0 ? '+' : ''}${n}${unit}`;
}

function computeEmotionalProsody(
  preset: TtsVoicePreset,
  emotionRaw: unknown,
  text: string,
): { rate: string; pitch: string } {
  const emo = (typeof emotionRaw === 'string' && emotionRaw in EMOTION_PROSODY
    ? emotionRaw
    : 'calm') as EmotionTag;
  const mod = EMOTION_PROSODY[emo];

  // Pequena variação orgânica determinística por frase (±1%) para nunca soar monótono
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  const microRate = (Math.abs(h) % 3) - 1; // -1, 0 ou +1
  const microPitch = (Math.abs(h >> 2) % 3) - 1;

  // Perguntas ganham leve subida melódica; exclamações ganham leve energia
  const punctPitch = text.endsWith('?') ? 2 : text.endsWith('!') ? 1 : 0;
  const punctRate = text.includes('...') ? -2 : 0;

  const finalRate = clamp(preset.baseRate + mod.rate + microRate + punctRate, -15, 18);
  const finalPitch = clamp(preset.basePitch + mod.pitch + microPitch + punctPitch, -9, 9);

  return {
    rate: formatSigned(finalRate, '%'),
    pitch: formatSigned(finalPitch, 'Hz'),
  };
}

function safeRate(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^[+-]?\d{1,2}%$/.test(val.trim())) return val.trim();
  return fallback;
}

function safePitch(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^[+-]?\d{1,2}(Hz|%)$/.test(val.trim())) return val.trim();
  return fallback;
}

async function synthesizeEdgeMp3Once(text: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  let timer: NodeJS.Timeout | null = null;
  try {
    const run = async (): Promise<Buffer> => {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate, pitch });
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    };
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('edge-tts timeout')), 4500);
    });
    return await Promise.race([run(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      tts.close();
    } catch {
      // ignore
    }
  }
}

async function synthesizeEdgeMp3(text: string, voice: string, rate: string, pitch: string): Promise<Buffer> {
  const key = `${voice}|${rate}|${pitch}|${text}`;
  const cached = audioCache.get(key);
  if (cached) {
    audioCache.delete(key);
    audioCache.set(key, cached);
    return cached;
  }

  let buf = Buffer.alloc(0);
  try {
    buf = await synthesizeEdgeMp3Once(text, voice, rate, pitch);
  } catch {
    buf = await synthesizeEdgeMp3Once(text, voice, rate, pitch);
  }

  if (buf.length > 0) {
    if (audioCache.size >= MAX_CACHE_ITEMS) {
      const oldest = audioCache.keys().next().value;
      if (oldest) audioCache.delete(oldest);
    }
    audioCache.set(key, buf);
  }
  return buf;
}

export function handleTtsRoute(req: IncomingMessage, res: ServerResponse, path: string, url?: URL): boolean {
  if (path === '/api/tts/voices') {
    if ((req.method ?? 'GET') !== 'GET') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return true;
    }
    sendJson(res, 200, {
      engine: 'edge-neural-pad',
      presets: Object.values(NEURAL_VOICE_PRESETS),
      emotions: Object.keys(EMOTION_PROSODY),
    });
    return true;
  }

  // GET /api/tts/play?agent=dev&emotion=excited&text=... — Streaming direto para <audio playsinline> no iOS/Android!
  if (path === '/api/tts/play') {
    if ((req.method ?? 'GET') !== 'GET') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return true;
    }
    const parsed = url ?? new URL(req.url ?? '/api/tts/play', 'http://localhost');
    const rawText = parsed.searchParams.get('text') ?? '';
    const text = sanitizeSpeechText(rawText);
    if (!text) {
      sendJson(res, 400, { error: 'text obrigatório' });
      return true;
    }
    const agentKey = (parsed.searchParams.get('agent') ?? 'vicente').toLowerCase();
    const emotion = parsed.searchParams.get('emotion') ?? 'warm';
    const preset = NEURAL_VOICE_PRESETS[agentKey] ?? NEURAL_VOICE_PRESETS.vicente;
    const computed = computeEmotionalProsody(preset, emotion, text);

    void (async () => {
      try {
        const mp3 = await synthesizeEdgeMp3(text, preset.voice, computed.rate, computed.pitch);
        if (!mp3.length) {
          sendJson(res, 502, { error: 'áudio vazio' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(mp3.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=300',
        });
        res.end(mp3);
      } catch (err: any) {
        log.warn(`[tts/play] Falha: ${err?.message ?? err}`);
        if (!res.headersSent) sendJson(res, 200, { fallback: true });
      }
    })();
    return true;
  }

  if (path !== '/api/tts') return false;

  if ((req.method ?? 'GET') !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return true;
  }

  void (async () => {
    try {
      const body = (await readJson(req, 16 * 1024)) as {
        text?: unknown;
        agent?: unknown;
        emotion?: unknown;
        voice?: unknown;
        rate?: unknown;
        pitch?: unknown;
      };
      const rawText = typeof body?.text === 'string' ? body.text : '';
      const text = sanitizeSpeechText(rawText);
      if (!text) {
        sendJson(res, 400, { error: 'text obrigatório' });
        return;
      }

      const agentKey = typeof body?.agent === 'string' ? body.agent.toLowerCase() : 'vicente';
      const preset = NEURAL_VOICE_PRESETS[agentKey] ?? NEURAL_VOICE_PRESETS.vicente;
      const voice = typeof body?.voice === 'string' && ALLOWED_VOICES.has(body.voice) ? body.voice : preset.voice;
      const computed = computeEmotionalProsody(preset, body?.emotion, text);
      const rate = safeRate(body?.rate, computed.rate);
      const pitch = safePitch(body?.pitch, computed.pitch);

      const mp3 = await synthesizeEdgeMp3(text, voice, rate, pitch);
      if (!mp3.length) {
        sendJson(res, 200, { fallback: true });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': mp3.length,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(mp3);
    } catch (err: any) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      log.warn(`[tts] Fallback local de voz: ${err?.message ?? err}`);
      if (!res.headersSent) {
        sendJson(res, 200, { fallback: true });
      }
    }
  })();

  return true;
}
