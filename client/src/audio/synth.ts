// Sons Foley sintetizados em WebAudio (zero arquivos externos):
// Teclado mecânico retrô, cliques de mouse, passos no piso, impressora puxando papel,
// folhas virando, cafeteira/xícara, bebedouro glug-glug, cadeira giratória, servidor/HD,
// elevador com porta deslizando, pingue-pongue, fliperama e comemoração.
import type { SoundKind } from './scheduler';

export interface VoiceOpts {
  /** Ganho final (já com o volume mestre). */
  gain: number;
  /** -1 .. 1 (esquerda .. direita). */
  pan?: number;
  /** Teclado: teclas na rajada. */
  count?: number;
  rng: () => number;
  /** Ruído branco reutilizável (base de teclas, passos, papel, impressora e café). */
  noise: AudioBuffer | null;
}

/** Envelope percussivo: ataque curto e queda exponencial. */
function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(
  ac: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  freq: number,
  t: number,
  peak: number,
  attack: number,
  decay: number,
  toFreq?: number,
): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t + Math.min(decay, 0.12));
  env(g, t, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

/** Dispara um recorte filtrado do buffer de ruído branco. */
function noiseBurst(
  ac: AudioContext,
  out: AudioNode,
  noise: AudioBuffer | null,
  t: number,
  dur: number,
  filterType: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  attack: number,
  decay: number,
  toFreq?: number,
  offset = 0,
): void {
  if (!noise) return;
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = dur > noise.duration * 0.85;
  const flt = ac.createBiquadFilter();
  flt.type = filterType;
  flt.frequency.setValueAtTime(freq, t);
  if (toFreq) flt.frequency.exponentialRampToValueAtTime(Math.max(40, toFreq), t + dur);
  flt.Q.value = q;
  const g = ac.createGain();
  env(g, t, peak, attack, decay);
  src.connect(flt).connect(g).connect(out);
  const startOff = Math.min(Math.max(0, offset), Math.max(0, noise.duration - 0.05));
  src.start(t, startOff, dur);
}

/** Cria um buffer de ruído branco de 0.45s (suficiente para impressora, café, papel, passos e teclas). */
export function makeNoise(ac: AudioContext): AudioBuffer | null {
  try {
    const len = Math.floor(ac.sampleRate * 0.45);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  } catch {
    return null;
  }
}

/** Toca `kind` em `t` (tempo do AudioContext) na saída `dest`. */
export function playVoice(ac: AudioContext, dest: AudioNode, kind: SoundKind, t: number, o: VoiceOpts): void {
  let out: AudioNode = dest;
  if (o.pan && typeof ac.createStereoPanner === 'function') {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    p.connect(dest);
    out = p;
  }
  const g = o.gain;
  switch (kind) {
    case 'chime':
      tone(ac, out, 'sine', 880, t, 0.16 * g, 0.012, 1.1);
      tone(ac, out, 'sine', 1318.5, t, 0.08 * g, 0.012, 1.1);
      tone(ac, out, 'sine', 1174.7, t + 0.14, 0.1 * g, 0.012, 1.1);
      return;
    case 'pop':
      tone(ac, out, 'triangle', 740, t, 0.14 * g, 0.008, 0.15, 330);
      return;
    case 'elevator':
      // "Ding-Dong" clássico + porta deslizando suave
      tone(ac, out, 'sine', 880, t, 0.12 * g, 0.004, 0.9);
      tone(ac, out, 'sine', 1760, t, 0.03 * g, 0.004, 0.45);
      tone(ac, out, 'sine', 659.25, t + 0.16, 0.11 * g, 0.004, 1.2);
      noiseBurst(ac, out, o.noise, t + 0.24, 0.28, 'lowpass', 480, 1.2, 0.045 * g, 0.04, 0.24, 240, 0.02);
      return;
    case 'keys':
      keys(ac, out, t, o);
      return;
    case 'mouse':
      mouseClick(ac, out, t, o);
      return;
    case 'step':
      footstep(ac, out, t, o);
      return;
    case 'printer':
      printerFoley(ac, out, t, o);
      return;
    case 'paper':
      paperFlip(ac, out, t, o);
      return;
    case 'coffee':
      coffeePour(ac, out, t, o);
      return;
    case 'water':
      waterCooler(ac, out, t, o);
      return;
    case 'chair':
      chairSwivel(ac, out, t, o);
      return;
    case 'server':
      serverRackTick(ac, out, t, o);
      return;
    case 'cheer':
      cheerBurst(ac, out, t, o);
      return;
    case 'pingpong':
      tone(ac, out, 'sine', 1250, t, 0.1 * g, 0.002, 0.06, 880);
      return;
    case 'table':
      tone(ac, out, 'sine', 760, t, 0.07 * g, 0.002, 0.045, 520);
      return;
    case 'arcade': {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      lp.connect(out);
      const scale = [1046.5, 1318.5, 1568, 1760, 2093];
      for (let i = 0; i < 3; i++) {
        const f = scale[Math.floor(o.rng() * scale.length)];
        tone(ac, lp, 'square', f, t + i * 0.055, 0.036 * g, 0.003, 0.05);
      }
      return;
    }
  }
}

/** Rajada de teclado mecânico retrô: estalo da tecla + thock da carcaça + barra de espaço/Enter. */
function keys(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  if (!o.noise) return;
  const n = Math.max(2, Math.min(9, o.count ?? 5));
  let at = t;
  for (let i = 0; i < n; i++) {
    const isSpace = i === n - 1 && o.rng() < 0.45;
    const freq = isSpace ? 1150 + o.rng() * 350 : 2100 + o.rng() * 1700;
    const amp = (isSpace ? 0.14 : 0.105) * o.gain * (0.65 + o.rng() * 0.35);
    // Estalo tátil da tecla
    noiseBurst(ac, out, o.noise, at, 0.038, 'bandpass', freq, 1.8, amp, 0.0012, isSpace ? 0.03 : 0.02, undefined, o.rng() * 0.2);
    // "Thock" suave na mesa de madeira
    tone(ac, out, 'triangle', isSpace ? 210 : 320 + o.rng() * 90, at, amp * 0.38, 0.001, 0.018, 120);
    at += 0.055 + o.rng() * 0.075 + (o.rng() < 0.16 ? 0.11 : 0);
  }
}

/** Clique de mouse retrô (simples ou duplo clique). */
function mouseClick(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const clicks = o.rng() < 0.45 ? 2 : 1;
  for (let i = 0; i < clicks; i++) {
    const at = t + i * (0.095 + o.rng() * 0.03);
    // Clique para baixo (mais agudo) + soltura (micro clique 18ms depois)
    noiseBurst(ac, out, o.noise, at, 0.018, 'bandpass', 3600 + o.rng() * 600, 3.0, 0.11 * o.gain, 0.0008, 0.012, undefined, o.rng() * 0.15);
    noiseBurst(ac, out, o.noise, at + 0.022, 0.014, 'highpass', 2800, 1.2, 0.055 * o.gain, 0.0008, 0.01, undefined, o.rng() * 0.15);
  }
}

/** Passo no piso do escritório: impacto abafado de sola + leve toque do salto. */
function footstep(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  const pitchVar = 0.88 + o.rng() * 0.24;
  // Impacto abafado no piso (carpete / porcelanato / madeira)
  noiseBurst(ac, out, o.noise, t, 0.065, 'lowpass', 540 * pitchVar, 1.1, 0.13 * g, 0.003, 0.055, 220, o.rng() * 0.2);
  // Batidinha leve do salto
  tone(ac, out, 'sine', 135 * pitchVar, t, 0.09 * g, 0.002, 0.042, 68);
  noiseBurst(ac, out, o.noise, t + 0.01, 0.025, 'bandpass', 1450 * pitchVar, 2.2, 0.045 * g, 0.002, 0.02, undefined, o.rng() * 0.25);
}

/** Impressora de escritório: motor puxando papel + 3 passadas do carro de impressão + folha saindo. */
function printerFoley(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  // 1. Motor puxando a folha (whirr ascendente)
  tone(ac, out, 'sawtooth', 165, t, 0.032 * g, 0.03, 0.26, 290);
  noiseBurst(ac, out, o.noise, t, 0.24, 'bandpass', 720, 2.5, 0.075 * g, 0.02, 0.21, 1350, 0.01);

  // 2. 3 passadas rítmicas da cabeça de impressão / rolete laser
  for (let i = 0; i < 3; i++) {
    const at = t + 0.28 + i * 0.22;
    const goRight = i % 2 === 0;
    noiseBurst(ac, out, o.noise, at, 0.16, 'bandpass', goRight ? 1800 : 2300, 3.2, 0.085 * g, 0.01, 0.14, goRight ? 2600 : 1600, 0.05 + i * 0.07);
    tone(ac, out, 'square', goRight ? 420 : 370, at, 0.022 * g, 0.005, 0.13, goRight ? 520 : 310);
  }

  // 3. Folha deslizando para a bandeja
  noiseBurst(ac, out, o.noise, t + 0.96, 0.22, 'highpass', 2400, 1.0, 0.08 * g, 0.02, 0.19, 3900, 0.12);
}

/** Folha de papel / página de relatório virando. */
function paperFlip(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  noiseBurst(ac, out, o.noise, t, 0.13, 'highpass', 2200, 1.1, 0.095 * g, 0.012, 0.11, 4100, o.rng() * 0.18);
  noiseBurst(ac, out, o.noise, t + 0.055, 0.09, 'bandpass', 3100, 1.8, 0.06 * g, 0.008, 0.075, 1900, o.rng() * 0.15);
}

/** Cafeteira passando café (chiado de vapor quente) + tilintar suave de xícara de porcelana. */
function coffeePour(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  // Vapor / líquido caindo na caneca
  noiseBurst(ac, out, o.noise, t, 0.36, 'bandpass', 1550, 1.9, 0.085 * g, 0.04, 0.31, 2400, 0.03);
  // Tilintar delicado da xícara de porcelana no final
  tone(ac, out, 'sine', 2180, t + 0.34, 0.06 * g, 0.002, 0.14);
  tone(ac, out, 'sine', 3320, t + 0.34, 0.03 * g, 0.002, 0.09);
}

/** Bebedouro com galão: clássico "glug-glug-glug" de bolhas subindo + água enchendo copo. */
function waterCooler(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  // Jato suave de água
  noiseBurst(ac, out, o.noise, t, 0.35, 'bandpass', 1900, 1.4, 0.055 * g, 0.03, 0.3, 2700, 0.06);
  // 3 bolhas "glug-glug-glug" subindo no galão
  const freqs = [280, 340, 410];
  freqs.forEach((f, i) => {
    const at = t + 0.06 + i * 0.115;
    tone(ac, out, 'sine', f, at, 0.11 * g, 0.008, 0.085, f * 1.85);
  });
}

/** Cadeira de escritório girando / amortecedor pneumático ao sentar ou levantar. */
function chairSwivel(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  // Amortecedor pneumático suave + rolamento das rodinhas
  tone(ac, out, 'sine', 195 + o.rng() * 35, t, 0.075 * g, 0.01, 0.12, 118);
  noiseBurst(ac, out, o.noise, t + 0.02, 0.14, 'lowpass', 620, 1.5, 0.05 * g, 0.015, 0.12, 340, o.rng() * 0.1);
}

/** Atividade sutil de rack de servidores 42U: estalos de disco rígido + micro-bipe de telemetria. */
function serverRackTick(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  for (let i = 0; i < 4; i++) {
    const at = t + i * (0.045 + o.rng() * 0.04);
    noiseBurst(ac, out, o.noise, at, 0.012, 'bandpass', 2800 + o.rng() * 1100, 4.0, 0.05 * g, 0.001, 0.01, undefined, o.rng() * 0.2);
  }
  if (o.rng() < 0.5) {
    tone(ac, out, 'sine', 1760, t + 0.18, 0.032 * g, 0.002, 0.045);
  }
}

/** Comemoração / risada leve em grupo no escritório. */
function cheerBurst(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  const g = o.gain;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone(ac, out, 'triangle', f, t + i * 0.055, 0.07 * g, 0.004, 0.11);
  });
}
