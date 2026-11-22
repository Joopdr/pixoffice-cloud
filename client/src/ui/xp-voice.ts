// AgentVoiceEngine & MSN Balloon Chat for Habblaud
// Motor Híbrido de Vozes (Neural PT-BR via /api/tts + Modo Talk It! Retrô WebAudio DSP + Web Speech Fallback)
// + Botão de Mudo + Tradutor Humano de Ações (zero repetição) + Balões MSN individuais por boneco
// + Integração com o Prédio Multi-Andar (Elevador + Corte Vertical)

import type { WorldApi } from '../world/api';
import type { OfficeStore } from '../net/store';
import type { AgentInfo, Activity } from '../../../shared/types';
import type { SoundKind } from '../audio/scheduler';
import type { SoundControl } from './sound';
import type { UiContext } from './context';
import { BuildingTowerUI, type BuildingFloorDto } from './xp-building';
import { OfficeLifeEngine, stageBadge, type EmotionTag, type GeneratedExchange } from './xp-life';
import { MeetingModalUI } from './meeting-modal';
import { PhoneModalUI } from './phone-modal';

export type VoiceMode = 'neural' | 'talkit' | 'webspeech';
export type TalkItPreset = 'auto' | 'robo' | 'elfo' | 'crianca' | 'alien' | 'velho' | 'locutor' | 'sussurro' | 'eco';

export interface AgentVoiceProfile {
  key: string;
  name: string;
  shortName: string;
  role: string;
  pitch: number;
  rate: number;
  talkItStyle: Exclude<TalkItPreset, 'auto'>;
  avatar: string;
  color: string;
  agentId: string;
}

export const AGENT_PROFILES: Record<string, AgentVoiceProfile> = {
  vicente: {
    key: 'vicente',
    name: 'Vicente · 00 @researcher',
    shortName: 'Vicente',
    role: 'Arquiteto Líder',
    pitch: 0.94,
    rate: 1.04,
    talkItStyle: 'locutor',
    avatar: '🧭',
    color: '#0054E3',
    agentId: 'ag_vicente',
  },
  dev: {
    key: 'dev',
    name: 'Dev · 01 @dev',
    shortName: 'Dev',
    role: 'Engine & Full-Stack',
    pitch: 1.12,
    rate: 1.1,
    talkItStyle: 'robo',
    avatar: '💻',
    color: '#0D7A3E',
    agentId: 'ag_dev',
  },
  fx: {
    key: 'fx',
    name: 'FX & Áudio · 02 @fx-audio',
    shortName: 'FX & Áudio',
    role: 'Vozes & DSP Talk It!',
    pitch: 1.24,
    rate: 1.06,
    talkItStyle: 'alien',
    avatar: '🎛️',
    color: '#C2410C',
    agentId: 'ag_fx',
  },
  qa: {
    key: 'qa',
    name: 'QA Auditor · 03 @qa',
    shortName: 'QA Auditor',
    role: 'Qualidade & Contraste',
    pitch: 0.86,
    rate: 0.98,
    talkItStyle: 'velho',
    avatar: '🛡️',
    color: '#9333EA',
    agentId: 'ag_qa',
  },
  user: {
    key: 'user',
    name: 'User · 04 @user',
    shortName: 'User',
    role: 'Usabilidade & Ergonomia',
    pitch: 1.04,
    rate: 1.05,
    talkItStyle: 'crianca',
    avatar: '🙋',
    color: '#0284C7',
    agentId: 'ag_user',
  },
  art: {
    key: 'art',
    name: 'Art XP · 05 @art-designer',
    shortName: 'Art XP',
    role: 'Habbo & Windows XP',
    pitch: 1.22,
    rate: 1.03,
    talkItStyle: 'elfo',
    avatar: '🎨',
    color: '#BE185D',
    agentId: 'ag_art',
  },
  ux: {
    key: 'ux',
    name: 'UX/UI · 06 @ux-ui',
    shortName: 'UX/UI',
    role: 'Layout & Prédio',
    pitch: 1.08,
    rate: 1.06,
    talkItStyle: 'sussurro',
    avatar: '📐',
    color: '#0F766E',
    agentId: 'ag_ux',
  },
  release: {
    key: 'release',
    name: 'Release · 07 @release',
    shortName: 'Release',
    role: 'Entregas & Esteira',
    pitch: 0.88,
    rate: 1.0,
    talkItStyle: 'eco',
    avatar: '🚀',
    color: '#B45309',
    agentId: 'ag_release',
  },
};

const TALK_IT_LABELS: Record<TalkItPreset, string> = {
  auto: 'Automático (1 voz por agente)',
  robo: '🤖 Robô Clássico',
  elfo: '🧝 Elfo Agudo',
  crianca: '🧒 Criança',
  alien: '👽 Alienígena',
  velho: '👴 Velho / Grave',
  locutor: '📻 Locutor Rádio',
  sussurro: '🌬️ Sussurro',
  eco: '🏔️ Eco de Caverna',
};

export type SpeechPriority = 'social' | 'work' | 'urgent';

const PRIORITY_RANK: Record<SpeechPriority, number> = {
  social: 1,
  work: 2,
  urgent: 3,
};

export interface DialogueTurn {
  agentKey: string;
  text: string;
  emotion?: EmotionTag;
  pose?: 'dance' | 'flirt' | 'wave' | 'clap' | 'cheer' | 'laugh' | 'talk';
  emoji?: string;
  particle?: string;
  prefetched?: Promise<AudioBuffer | null>;
}

interface DialogueBatch {
  id: number;
  priority: SpeechPriority;
  enqueuedAt: number;
  turns: DialogueTurn[];
}

export class AgentVoiceAndChat {
  private world: WorldApi;
  private store: OfficeStore;
  private root: HTMLElement;
  private sound?: SoundControl;
  private ctx?: UiContext;
  private balloonLayer: HTMLElement;
  private voicePopover: HTMLElement;
  private building: BuildingTowerUI;
  private life: OfficeLifeEngine;
  private meeting: MeetingModalUI;
  private phone: PhoneModalUI;
  private meetingMode = false;
  private meetingAudioSeq = 0;

  private muted = false;
  private sfxEnabled = true;
  private voiceMode: VoiceMode = 'neural';
  private talkItPreset: TalkItPreset = 'auto';

  private batchQueue: DialogueBatch[] = [];
  private batchSeq = 1;
  private isProcessingQueue = false;
  private currentPriority: SpeechPriority | null = null;
  private activeBatchId = 0;
  private activePlaybackCancel: (() => void) | null = null;
  private decodedAudioCache = new Map<string, AudioBuffer>();

  // Foco espacial & sintonização por clique no balão
  private tunedAgentId: string | null = null;
  private tunedUntil = 0;

  private audioCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeBalloons = new Map<string, HTMLElement>();
  private balloonTimers = new Map<string, any>();

  private rafId = 0;
  private workChatTimer: any = null;
  private parallelTimer: any = null;
  private debateIndex = 0;
  private seenActivityIds = new Set<string>();
  private recentTopics = new Map<string, number>();
  private phraseCursor = 0;

  constructor(root: HTMLElement, world: WorldApi, store: OfficeStore, sound?: SoundControl, ctx?: UiContext) {
    this.root = root;
    this.world = world;
    this.store = store;
    this.sound = sound;
    this.ctx = ctx;

    // Restaura preferências salvas
    try {
      const savedMuted = localStorage.getItem('habblaud_voice_muted');
      const savedSfx = localStorage.getItem('habblaud_sfx_enabled');
      const savedMode = localStorage.getItem('habblaud_voice_mode') as VoiceMode | null;
      const savedPreset = localStorage.getItem('habblaud_talkit_preset') as TalkItPreset | null;
      if (savedMuted === '1') this.muted = true;
      if (savedSfx === '0') this.sfxEnabled = false;
      if (savedMode === 'neural' || savedMode === 'talkit' || savedMode === 'webspeech') this.voiceMode = savedMode;
      if (savedPreset && savedPreset in TALK_IT_LABELS) this.talkItPreset = savedPreset;

      // Garante que os novos efeitos sonoros do escritório (teclas, passos, impressora, café...)
      // já venham ligados mesmo para quem tinha prefs antigas com sound: false!
      if (this.ctx && localStorage.getItem('habblaud_foley_v1') !== '1') {
        localStorage.setItem('habblaud_foley_v1', '1');
        this.ctx.updatePrefs({ sound: !this.muted && this.sfxEnabled });
      }
    } catch {
      // ignore
    }

    // Camada de balões flutuantes ancorados sobre cada boneco
    this.balloonLayer = document.createElement('div');
    this.balloonLayer.id = 'xp-speech-layer';
    this.balloonLayer.className = 'xp-speech-layer';
    document.body.appendChild(this.balloonLayer);

    // Popover de controle de vozes (Neural / Talk It! / Mudo)
    this.voicePopover = document.createElement('div');
    this.voicePopover.id = 'xp-voice-popover';
    this.voicePopover.className = 'xp-voice-popover';
    this.voicePopover.hidden = true;
    document.body.appendChild(this.voicePopover);

    // Prédio Corporativo Multi-Andar (Elevador + Corte Vertical)
    this.building = new BuildingTowerUI({
      onFloorSelected: (floor) => this.onFloorChanged(floor),
    });

    // Motor de Vida Real, Personalidades, Amizade & Romance (zero repetição!)
    this.life = new OfficeLifeEngine(world, store, {
      onTriggerScene: (ex) => this.playLifeScene(ex, true, 'urgent'),
    });

    // Sala de Reunião 3D WebGL (Slides Reais, Gráficos, Telas e Narração Zero-Atraso)
    this.meeting = new MeetingModalUI({
      setMeetingMode: (active) => this.setMeetingMode(active),
      prefetchPresenterLine: (agentKey, text) => {
        const prof = this.resolveProfile(agentKey);
        void this.prefetchAudioBuffer(prof, text);
      },
      speakPresenterLine: (agentKey, text, onStart) => this.speakPresenterLine(agentKey, text, onStart),
      stopMeetingAudio: () => this.stopMeetingAudio(),
      playFoley: (kind) => this.playFoley(kind),
      getLiveAgents: () => {
        const snap = this.store.liveSnapshot;
        if (!snap?.agents?.length) return [];
        return snap.agents.map((a) => {
          const key = this.mapAgentToProfileKey(a);
          const prof = this.resolveProfile(key);
          const hexNum = parseInt(prof.color.replace('#', ''), 16) || 0x0054e3;
          return {
            key,
            name: a.name || prof.shortName,
            seed: a.seed,
            look: a.look,
            parts: a.parts,
            accent: hexNum,
          };
        });
      },
    });

    // Habblaud Phone PWA (Ligações, Dúvidas e Autorizações Remotas pelo Celular)
    this.phone = new PhoneModalUI();

    // Barra de tarefas do Windows XP + botão de mudo na barra superior
    this.injectXpTaskbar();
    this.injectTopbarVoiceControls();
    this.renderVoicePopover();

    // Fecha a sidebar enorme vazia por padrão para o escritório brilhar em tela cheia
    setTimeout(() => {
      this.collapseDefaultClutter();
    }, 300);

    // Sincroniza posições dos balões em 60fps via requestAnimationFrame (perfeito no zoom!)
    this.startPositionTracker();

    // Escuta atividades reais do Antigravity / Claude / Codex
    this.listenToAgentActivities();

    // Debate de abertura entre bonecos separados + 1ª conversa paralela viva
    setTimeout(() => {
      this.triggerInitialTeamDebate();
      setTimeout(() => this.triggerParallelConversation(), 1800);
    }, 1800);

    // Interações paralelas orgânicas contínuas (amizade, romance, hobbies, trabalho)
    this.startPeriodicWorkInteraction();
  }

  private collapseDefaultClutter() {
    // Mantém o feed compacto no canto inferior direito e fecha a sidebar até o usuário abrir
    const sidebar = document.querySelector('.ui-sidebar') as HTMLElement | null;
    if (sidebar && this.root.classList.contains('has-sidebar')) {
      const btn = document.querySelector('.ui-btn-sidebar') as HTMLButtonElement | null;
      btn?.click();
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) this.audioCtx = new AC();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Som suave do MSN Messenger ao aparecer balão (respeita botão Mudo!)
  private playMsnChime() {
    if (this.muted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.0, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // ignore
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    try {
      localStorage.setItem('habblaud_voice_muted', mute ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.ctx) {
      this.ctx.updatePrefs({ sound: !mute && this.sfxEnabled });
    }
    if (mute) {
      this.stopCurrentAudio();
    } else if (this.sfxEnabled) {
      void this.sound?.board.unlock();
    }
    this.syncVoiceLabels();
    this.renderVoicePopover();
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    try {
      localStorage.setItem('habblaud_sfx_enabled', enabled ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.ctx) {
      this.ctx.updatePrefs({ sound: enabled && !this.muted });
    }
    if (enabled && !this.muted) {
      this.sound?.preview('keys');
    }
    this.renderVoicePopover();
  }

  public playFoley(kind: SoundKind) {
    if (!this.sound) return;
    if (this.muted) this.setMuted(false);
    if (!this.sfxEnabled) this.setSfxEnabled(true);
    this.sound.preview(kind);
  }

  public setVoiceMode(mode: VoiceMode) {
    this.voiceMode = mode;
    try {
      localStorage.setItem('habblaud_voice_mode', mode);
    } catch {
      // ignore
    }
    if (this.muted) this.setMuted(false);
    this.syncVoiceLabels();
    this.renderVoicePopover();
  }

  public setTalkItPreset(preset: TalkItPreset) {
    this.talkItPreset = preset;
    try {
      localStorage.setItem('habblaud_talkit_preset', preset);
    } catch {
      // ignore
    }
    this.renderVoicePopover();
  }

  private stopCurrentAudio() {
    this.activeBatchId = 0;
    if (this.activePlaybackCancel) {
      const cancel = this.activePlaybackCancel;
      this.activePlaybackCancel = null;
      cancel();
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch {
        // ignore
      }
      this.activeSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /** Verifica se a conversa está no foco espacial da câmera ou sintonizada pelo clique do usuário. */
  public isInSpatialFocus(agentIds: string[]): boolean {
    const now = Date.now();
    if (this.tunedAgentId && now < this.tunedUntil) {
      return agentIds.some((id) => id === this.tunedAgentId || this.resolveProfile(id).agentId === this.tunedAgentId);
    }
    // Se nenhum está sintonizado manualmente, verifica se algum falante está na área central visível (78% da tela)
    const cx = window.innerWidth * 0.45;
    const cy = window.innerHeight * 0.5;
    const maxDist = Math.hypot(window.innerWidth * 0.44, window.innerHeight * 0.44);
    for (const rawId of agentIds) {
      const id = this.resolveProfile(rawId).agentId;
      const pos = this.world.screenPositionOf(id);
      if (pos && Math.hypot(pos.x - cx, pos.y - cy) <= maxDist) return true;
    }
    return false;
  }

  /** Pré-carrega e decodifica o MP3 neural com prosódia emocional PAD ANTES do balão abrir (zero atraso!). */
  private async prefetchAudioBuffer(
    profile: AgentVoiceProfile,
    text: string,
    emotion?: EmotionTag,
  ): Promise<AudioBuffer | null> {
    if (this.muted || this.voiceMode === 'webspeech') return null;
    const emo = emotion ?? this.life.getAgentEmotion(profile.agentId);
    const cacheKey = `${profile.key}|${emo}|${text}`;
    const cached = this.decodedAudioCache.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, agent: profile.key, emotion: emo }),
      });
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 100) return null;

      const ctx = this.getAudioContext();
      if (!ctx) return null;
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      if (this.decodedAudioCache.size >= 80) {
        const oldest = this.decodedAudioCache.keys().next().value;
        if (oldest) this.decodedAudioCache.delete(oldest);
      }
      this.decodedAudioCache.set(cacheKey, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  /** Enfileira uma fala única com prioridade (default: 'work'). */
  public speak(agentKey: string, text: string, priority: SpeechPriority = 'work') {
    const clean = text.trim();
    if (!clean) return;
    this.speakDialogue([{ agentKey, text: clean }], priority);
  }

  public setMeetingMode(active: boolean) {
    this.meetingMode = active;
    if (active) {
      this.batchQueue = [];
      this.stopCurrentAudio();
    } else {
      this.stopMeetingAudio();
    }
  }

  public stopMeetingAudio() {
    this.meetingAudioSeq++;
    this.stopCurrentAudio();
  }

  /** Fala sincronizada para o apresentador da Sala de Reunião 3D (prefetch → onStart → onended). */
  public async speakPresenterLine(agentKey: string, text: string, onStart?: () => void): Promise<boolean> {
    const clean = text.trim();
    if (!clean) return true;
    const seq = ++this.meetingAudioSeq;
    const profile = this.resolveProfile(agentKey);

    const audioBuf = !this.muted && (this.voiceMode === 'neural' || this.voiceMode === 'talkit')
      ? await this.prefetchAudioBuffer(profile, clean)
      : null;

    if (seq !== this.meetingAudioSeq || !this.meetingMode) return false;
    onStart?.();

    const batchTag = 900000 + seq;
    this.activeBatchId = batchTag;

    if (this.muted) {
      await this.cancellableDelay(Math.max(2400, Math.min(5400, clean.length * 48)), batchTag);
    } else if (audioBuf) {
      await this.playDecodedAudioBuffer(audioBuf, profile, batchTag);
    } else {
      await this.playWebSpeechFallback(profile, clean);
    }

    return seq === this.meetingAudioSeq && this.meetingMode;
  }

  /**
   * Orquestrador Zero-Atraso:
   * - Pré-carrega o áudio de TODOS os turnos do diálogo em paralelo ANTES de abrir o 1º balão.
   * - Aplica 3 prioridades (urgent > work > social) e descarta itens antigos (> 4s).
   * - Passa a vez estritamente no `onended` (+350ms), eliminando atropelamento.
   */
  public speakDialogue(turns: DialogueTurn[], priority: SpeechPriority = 'social') {
    if (this.meetingMode) return;
    const validTurns = turns
      .map((t) => ({ ...t, text: t.text.trim() }))
      .filter((t) => t.text.length > 0);
    if (!validTurns.length) return;

    // 1. Pré-busca imediata em paralelo de todos os turnos do diálogo com prosódia emocional PAD!
    for (const t of validTurns) {
      const prof = this.resolveProfile(t.agentKey);
      t.prefetched = this.prefetchAudioBuffer(prof, t.text, t.emotion);
    }

    const rank = PRIORITY_RANK[priority];

    // 2. Regras de Prioridade:
    // - Urgent: interrompe papo social ativo imediatamente e limpa papos sociais na fila!
    // - Work: limpa papos sociais pendentes na fila para entrar logo após a frase atual!
    if (rank >= PRIORITY_RANK.work) {
      this.batchQueue = this.batchQueue.filter((b) => PRIORITY_RANK[b.priority] >= rank);
    }
    if (priority === 'urgent' && this.currentPriority === 'social') {
      this.stopCurrentAudio();
    }

    // Limita fila a no máximo 2 lotes (nunca acumula atraso!)
    if (this.batchQueue.length >= 2) {
      if (priority === 'social') return; // descarta social se fila já tem trabalho
      this.batchQueue.shift();
    }

    const batch: DialogueBatch = {
      id: this.batchSeq++,
      priority,
      enqueuedAt: Date.now(),
      turns: validTurns,
    };

    // Insere respeitando prioridade (urgent/work antes de social)
    const idx = this.batchQueue.findIndex((b) => PRIORITY_RANK[b.priority] < rank);
    if (idx === -1) this.batchQueue.push(batch);
    else this.batchQueue.splice(idx, 0, batch);

    if (!this.isProcessingQueue) {
      void this.processQueue();
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.batchQueue.length > 0) {
        const batch = this.batchQueue.shift()!;

        // Descarte automático de fila velha (> 4s esperando sem tocar) para ZERO atraso acumulado!
        if (batch.priority !== 'urgent' && Date.now() - batch.enqueuedAt > 4000) {
          continue;
        }

        this.currentPriority = batch.priority;
        this.activeBatchId = batch.id;

        for (let i = 0; i < batch.turns.length; i++) {
          if (this.activeBatchId !== batch.id) break;
          const turn = batch.turns[i];
          const profile = this.resolveProfile(turn.agentKey);

          // Aguarda o áudio pré-carregado ANTES de abrir o balão → sincronia 0ms!
          const audioBuf = !this.muted && (this.voiceMode === 'neural' || this.voiceMode === 'talkit')
            ? await (turn.prefetched ?? this.prefetchAudioBuffer(profile, turn.text))
            : null;

          if (this.activeBatchId !== batch.id) break;

          // Marca balões anteriores de outros colegas como "recentes" (ficam +2.2s suavizados para leitura!)
          for (const [k, el] of this.activeBalloons.entries()) {
            if (k !== profile.agentId) {
              el.classList.remove('is-speaking');
              el.classList.add('is-recent');
            }
          }

          // Dispara animação + partícula no exato instante da fala
          if (turn.pose) this.world.playEmote?.(profile.agentId, turn.pose, turn.emoji, 3800);
          if (turn.particle) this.life.spawnParticle(profile.agentId, turn.particle);

          // Abre balão E dispara áudio no MESMO MILISSEGUNDO!
          this.playMsnChime();
          const isTuned = Boolean(this.tunedAgentId === profile.agentId && Date.now() < this.tunedUntil);
          const balloonEl = this.showSpeechBalloon(profile.agentId, profile, turn.text, isTuned);

          if (this.muted) {
            await this.cancellableDelay(Math.max(2100, Math.min(4200, turn.text.length * 46)), batch.id);
          } else if (audioBuf) {
            await this.playDecodedAudioBuffer(audioBuf, profile, batch.id);
          } else {
            await this.playWebSpeechFallback(profile, turn.text);
          }

          balloonEl.classList.remove('is-speaking');
          balloonEl.classList.add('is-recent');
          // Agenda remoção suave 2.2s após o fim real do áudio!
          this.scheduleBalloonFade(profile.agentId, balloonEl, 2200);

          if (this.activeBatchId !== batch.id) break;

          // Pausa natural de 350ms DEPOIS do fim real (onended) antes do colega responder!
          if (i < batch.turns.length - 1) {
            await this.cancellableDelay(350, batch.id);
          }
        }

        if (this.activeBatchId === batch.id) {
          this.activeBatchId = 0;
          await this.cancellableDelay(280, 0);
        }
      }
    } finally {
      this.currentPriority = null;
      this.isProcessingQueue = false;
      if (this.batchQueue.length > 0) {
        void this.processQueue();
      }
    }
  }

  private cancellableDelay(ms: number, batchId: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        if (this.activePlaybackCancel === cancel) this.activePlaybackCancel = null;
        resolve();
      }, ms);
      const cancel = () => {
        clearTimeout(t);
        resolve();
      };
      if (batchId !== 0) this.activePlaybackCancel = cancel;
    });
  }

  /** Toca um AudioBuffer já decodificado em 0ms (com DSP Talk It! se ativo), resolvendo no `onended` exato. */
  private playDecodedAudioBuffer(audioBuf: AudioBuffer, profile: AgentVoiceProfile, batchId: number): Promise<void> {
    const ctx = this.getAudioContext();
    if (!ctx || this.muted || this.activeBatchId !== batchId) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      this.activeSource = src;

      const outGain = ctx.createGain();
      outGain.gain.value = 1.0;

      const cleanupNodes: AudioNode[] = [];
      const cleanupOscs: OscillatorNode[] = [];

      if (this.voiceMode === 'talkit') {
        const style = this.talkItPreset === 'auto' ? profile.talkItStyle : this.talkItPreset;
        this.wireTalkItDsp(ctx, src, outGain, style, cleanupNodes, cleanupOscs);
      } else {
        src.connect(outGain);
      }

      outGain.connect(ctx.destination);

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        for (const o of cleanupOscs) {
          try {
            o.stop();
          } catch {
            // ignore
          }
        }
        if (this.activeSource === src) this.activeSource = null;
        if (this.activePlaybackCancel === cancel) this.activePlaybackCancel = null;
        resolve();
      };

      const cancel = () => {
        try {
          src.stop();
        } catch {
          // ignore
        }
        finish();
      };

      this.activePlaybackCancel = cancel;
      src.onended = finish;
      src.start(0);
    });
  }

  /** Cadeia WebAudio DSP estilo Microsoft Talk It! (Robô, Elfo, Criança, Alien, Velho, Locutor, Sussurro, Eco). */
  private wireTalkItDsp(
    ctx: AudioContext,
    src: AudioBufferSourceNode,
    dest: AudioNode,
    style: Exclude<TalkItPreset, 'auto'>,
    _nodes: AudioNode[],
    oscs: OscillatorNode[],
  ) {
    switch (style) {
      case 'robo': {
        src.playbackRate.value = 1.04;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1350;
        bp.Q.value = 2.4;

        // Ring modulator clássico de robô Talk It! (105Hz)
        const ringGain = ctx.createGain();
        ringGain.gain.value = 0.55;
        const carrier = ctx.createOscillator();
        carrier.type = 'sawtooth';
        carrier.frequency.value = 105;
        const carrierDepth = ctx.createGain();
        carrierDepth.gain.value = 0.45;
        carrier.connect(carrierDepth);
        carrierDepth.connect(ringGain.gain);
        carrier.start();
        oscs.push(carrier);

        src.connect(bp);
        bp.connect(ringGain);
        ringGain.connect(dest);
        break;
      }
      case 'elfo': {
        src.playbackRate.value = 1.36;
        const hi = ctx.createBiquadFilter();
        hi.type = 'highshelf';
        hi.frequency.value = 2200;
        hi.gain.value = 8;
        src.connect(hi);
        hi.connect(dest);
        break;
      }
      case 'crianca': {
        src.playbackRate.value = 1.24;
        const peak = ctx.createBiquadFilter();
        peak.type = 'peaking';
        peak.frequency.value = 1900;
        peak.Q.value = 1.4;
        peak.gain.value = 6;
        src.connect(peak);
        peak.connect(dest);
        break;
      }
      case 'alien': {
        src.playbackRate.value = 1.08;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 950;
        bp.Q.value = 3.2;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 8.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 380;
        lfo.connect(lfoGain);
        lfoGain.connect(bp.frequency);
        lfo.start();
        oscs.push(lfo);

        const delay = ctx.createDelay();
        delay.delayTime.value = 0.085;
        const wet = ctx.createGain();
        wet.gain.value = 0.45;

        src.connect(bp);
        bp.connect(dest);
        bp.connect(delay);
        delay.connect(wet);
        wet.connect(dest);
        break;
      }
      case 'velho': {
        src.playbackRate.value = 0.85;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2100;

        const trem = ctx.createGain();
        trem.gain.value = 0.85;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.16;
        lfo.connect(lfoGain);
        lfoGain.connect(trem.gain);
        lfo.start();
        oscs.push(lfo);

        src.connect(lp);
        lp.connect(trem);
        trem.connect(dest);
        break;
      }
      case 'locutor': {
        src.playbackRate.value = 0.94;
        const bass = ctx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 200;
        bass.gain.value = 7;
        const radio = ctx.createBiquadFilter();
        radio.type = 'bandpass';
        radio.frequency.value = 1100;
        radio.Q.value = 0.7;
        src.connect(bass);
        bass.connect(radio);
        radio.connect(dest);
        break;
      }
      case 'sussurro': {
        src.playbackRate.value = 1.02;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1250;
        const gain = ctx.createGain();
        gain.gain.value = 1.35;
        src.connect(hp);
        hp.connect(gain);
        gain.connect(dest);
        break;
      }
      case 'eco': {
        src.playbackRate.value = 0.96;
        const delay = ctx.createDelay();
        delay.delayTime.value = 0.16;
        const fb = ctx.createGain();
        fb.gain.value = 0.38;
        src.connect(dest);
        src.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(dest);
        break;
      }
    }
  }

  private playWebSpeechFallback(profile: AgentVoiceProfile, text: string): Promise<void> {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return new Promise((r) => setTimeout(r, 2200));
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/\((y|h|w|c|l)\)/gi, '').trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'pt-BR';
    utter.pitch = this.voiceMode === 'talkit' ? Math.min(2, profile.pitch * 1.15) : profile.pitch;
    utter.rate = profile.rate;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => /pt[-_]BR/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang));
    if (ptVoice) utter.voice = ptVoice;

    return new Promise<void>((resolve) => {
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }

  private scheduleBalloonFade(agentKey: string, balloon: HTMLElement, delayMs: number) {
    const oldTimer = this.balloonTimers.get(agentKey);
    if (oldTimer) clearTimeout(oldTimer);
    const t = setTimeout(() => {
      balloon.classList.add('xp-balloon-fade');
      setTimeout(() => {
        balloon.remove();
        if (this.activeBalloons.get(agentKey) === balloon) {
          this.activeBalloons.delete(agentKey);
        }
      }, 360);
    }, delayMs);
    this.balloonTimers.set(agentKey, t);
  }

  private showSpeechBalloon(agentKey: string, profile: AgentVoiceProfile, text: string, isTuned = false): HTMLElement {
    const oldTimer = this.balloonTimers.get(agentKey);
    if (oldTimer) clearTimeout(oldTimer);
    if (this.activeBalloons.has(agentKey)) {
      this.activeBalloons.get(agentKey)?.remove();
      this.activeBalloons.delete(agentKey);
    }

    const modeBadge =
      this.muted
        ? '🔇'
        : isTuned
          ? '🎙️ sintonizado'
          : this.voiceMode === 'talkit'
            ? `🤖 ${TALK_IT_LABELS[this.talkItPreset === 'auto' ? profile.talkItStyle : this.talkItPreset].split(' ')[1] || 'TalkIt'}`
            : '🗣️ falando';

    const balloon = document.createElement('div');
    balloon.className = `xp-speech-balloon is-speaking${isTuned ? ' is-tuned' : ''}`;
    balloon.dataset.agentKey = agentKey;
    balloon.dataset.agentId = profile.agentId;
    balloon.style.borderColor = profile.color;
    balloon.innerHTML = `
      <div class="xp-balloon-header" style="border-bottom-color: ${profile.color}33">
        <span class="xp-balloon-avatar">${profile.avatar}</span>
        <strong style="color: ${profile.color}">${profile.shortName}</strong>
        <span class="xp-balloon-role">${profile.role}</span>
        <span class="xp-balloon-wave">${modeBadge}</span>
      </div>
      <div class="xp-balloon-body">${this.formatEmoticons(text)}</div>
      <div class="xp-balloon-tail" style="border-top-color: ${profile.color}"></div>
    `;

    this.balloonLayer.appendChild(balloon);
    this.activeBalloons.set(agentKey, balloon);
    this.updateAllBalloonPositions();

    // Failsafe máximo caso o áudio nunca dispare onended
    this.scheduleBalloonFade(agentKey, balloon, 14000);
    return balloon;
  }

  private formatEmoticons(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/:\)/g, '😊')
      .replace(/:\(/g, '😟')
      .replace(/:D/g, '😃')
      .replace(/\(y\)/gi, '👍')
      .replace(/\(H\)/gi, '😎')
      .replace(/\(C\)/gi, '☕')
      .replace(/\(W\)/gi, '✨')
      .replace(/\(L\)/gi, '❤️');
  }

  /** Resolve perfil vocal/visual tanto para os 8 especialistas quanto para qualquer novo agente que chegar! */
  private resolveProfile(agentKeyOrId: string): AgentVoiceProfile {
    if (AGENT_PROFILES[agentKeyOrId]) return AGENT_PROFILES[agentKeyOrId];
    for (const prof of Object.values(AGENT_PROFILES)) {
      if (prof.agentId === agentKeyOrId) return prof;
    }
    const snap = this.store.liveSnapshot;
    const found = snap?.agents.find((a) => a.id === agentKeyOrId);
    const name = found?.name || agentKeyOrId;
    const palette = ['#0054E3', '#0D7A3E', '#C2410C', '#9333EA', '#0284C7', '#BE185D', '#0F766E', '#B45309'];
    let h = 0;
    for (let i = 0; i < agentKeyOrId.length; i++) h = (h * 31 + agentKeyOrId.charCodeAt(i)) >>> 0;
    const styles: Exclude<TalkItPreset, 'auto'>[] = ['locutor', 'robo', 'alien', 'velho', 'crianca', 'elfo', 'sussurro', 'eco'];
    return {
      key: agentKeyOrId,
      name,
      shortName: name,
      role: found?.role || 'Agente no Andar',
      pitch: 0.88 + (h % 35) / 100,
      rate: 0.98 + (h % 16) / 100,
      talkItStyle: styles[h % styles.length],
      avatar: '💬',
      color: palette[h % palette.length],
      agentId: found?.id || agentKeyOrId,
    };
  }

  /** Sintoniza o microfone em uma conversa paralela ao clicar no balão! */
  public tuneToConversation(turns: DialogueTurn[]) {
    if (!turns.length) return;
    const lead = this.resolveProfile(turns[0].agentKey);
    this.tunedAgentId = lead.agentId;
    this.tunedUntil = Date.now() + 18_000;
    if (this.muted) this.setMuted(false);
    this.speakDialogue(turns, 'urgent');
  }

  /** Exibe um balão de conversa paralela simultânea (sem disputar o canal de voz; clique em 🎧 Ouvir para sintonizar!). */
  public showParallelBalloon(agentId: string, text: string, badgeLabel = '💬 papo', tuneTurns?: DialogueTurn[]) {
    const profile = this.resolveProfile(agentId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pixhotel:agent-speak', { detail: { agentId: profile.key || profile.agentId || agentId, text } }));
    }
    const key = profile.agentId || agentId;
    const oldTimer = this.balloonTimers.get(key);
    if (oldTimer) clearTimeout(oldTimer);
    if (this.activeBalloons.has(key)) {
      this.activeBalloons.get(key)?.remove();
      this.activeBalloons.delete(key);
    }

    const balloon = document.createElement('div');
    balloon.className = 'xp-speech-balloon is-parallel';
    balloon.dataset.agentKey = key;
    balloon.dataset.agentId = profile.agentId;
    balloon.style.borderColor = profile.color;
    balloon.title = 'Clique para puxar o microfone e ouvir esta conversa!';
    balloon.innerHTML = `
      <div class="xp-balloon-header" style="border-bottom-color: ${profile.color}33">
        <span class="xp-balloon-avatar">${profile.avatar}</span>
        <strong style="color: ${profile.color}">${profile.shortName}</strong>
        <span class="xp-balloon-role">${profile.role}</span>
        <button type="button" class="xp-balloon-tune-btn" title="Puxar o microfone para ouvir este papo">🎧 Ouvir</button>
      </div>
      <div class="xp-balloon-body">${this.formatEmoticons(text)}</div>
      <div class="xp-balloon-tail" style="border-top-color: ${profile.color}"></div>
    `;

    const turnsToTune: DialogueTurn[] = tuneTurns && tuneTurns.length ? tuneTurns : [{ agentKey: profile.agentId, text }];
    const onTune = (e: Event) => {
      e.stopPropagation();
      this.tuneToConversation(turnsToTune);
    };
    balloon.querySelector('.xp-balloon-tune-btn')?.addEventListener('click', onTune);
    balloon.addEventListener('click', onTune);

    this.balloonLayer.appendChild(balloon);
    this.activeBalloons.set(key, balloon);
    this.updateAllBalloonPositions();

    this.scheduleBalloonFade(key, balloon, 5800);
  }

  // Ancoragem EXATA em 60fps sobre a cabeça do boneco (100% imune a problemas de zoom e pan!)
  private updateAllBalloonPositions() {
    const snap = this.store.liveSnapshot;
    const zoom = this.world.getZoom?.() ?? 1.6;
    const elevEl = document.getElementById('xp-elevator-panel');
    const elevOpen = Boolean(elevEl && !elevEl.classList.contains('is-collapsed'));
    const rightReserve = elevOpen ? 405 : 160;
    const placedRects: { cx: number; cy: number }[] = [];

    for (const [key, el] of this.activeBalloons.entries()) {
      const profile = this.resolveProfile(key);
      let targetId = el.dataset.agentId || profile.agentId;

      if (snap && !snap.agents.some((a) => a.id === targetId)) {
        const fuzzy = snap.agents.find(
          (a) =>
            a.id === key ||
            a.id.toLowerCase().includes(key.toLowerCase()) ||
            a.name.toLowerCase().includes(profile.shortName.toLowerCase()),
        );
        if (fuzzy) targetId = fuzzy.id;
      }

      const pos = targetId ? this.world.screenPositionOf(targetId) : null;

      // Se o boneco saiu da tela durante zoom/pan, oculta suavemente em vez de teleportar para o vazio!
      if (!pos || pos.x < 12 || pos.x > window.innerWidth - 12 || pos.y < 52 || pos.y > window.innerHeight - 34) {
        el.classList.add('is-offscreen');
        continue;
      }

      el.classList.remove('is-offscreen');
      const halfW = Math.min(148, Math.max(95, el.offsetWidth / 2 || 130));
      const minX = halfW + 10;
      const maxX = Math.max(minX, window.innerWidth - rightReserve);
      const clampedX = Math.max(minX, Math.min(maxX, Math.round(pos.x)));

      // Desloca o rabicho do balão proporcionalmente ao clamp para continuar apontando direto pra cabeça!
      const tailShift = Math.max(-halfW + 18, Math.min(halfW - 18, Math.round(pos.x - clampedX)));
      el.style.setProperty('--tail-shift', `${tailShift}px`);

      // Distância vertical escalada pelo zoom (nunca cobre o rosto ao aproximar e nunca cola longe ao afastar!)
      const headClearance = Math.round(10 + Math.min(zoom, 4) * 3.5);
      const feetClearance = Math.round(Math.min(125, Math.max(30, 28 * zoom)));

      const openBelow = pos.y < 162;
      let finalY = openBelow ? Math.round(pos.y + feetClearance) : Math.round(pos.y - headClearance);

      // Evita sobreposição direta entre 2 balões paralelos próximos
      for (const prev of placedRects) {
        if (Math.abs(prev.cx - clampedX) < 185 && Math.abs(prev.cy - finalY) < 76) {
          finalY += openBelow ? 78 : -78;
        }
      }
      finalY = Math.max(openBelow ? 56 : 124, Math.min(window.innerHeight - (openBelow ? 115 : 42), finalY));
      placedRects.push({ cx: clampedX, cy: finalY });

      el.classList.toggle('is-below', openBelow);
      el.style.left = `${clampedX}px`;
      el.style.top = `${finalY}px`;
      el.style.transform = openBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    }
  }

  private startPositionTracker() {
    const tick = () => {
      if (this.activeBalloons.size > 0) {
        this.updateAllBalloonPositions();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // Botão rápido de Mudo + Modo de Voz direto na barra superior (fácil de achar em < 2s)
  private injectTopbarVoiceControls() {
    const inject = () => {
      const rightBar = document.querySelector('.ui-topbar__right') as HTMLElement | null;
      if (!rightBar || document.getElementById('xp-top-voice-wrap')) return;

      const wrap = document.createElement('div');
      wrap.id = 'xp-top-voice-wrap';
      wrap.className = 'xp-top-voice-wrap';
      wrap.innerHTML = `
        <button type="button" class="ui-btn xp-top-voice-btn xp-top-phone-btn" id="xp-top-btn-phone" title="Habblaud Phone: chamadas, dúvidas e autorizações mobile">Telefone</button>
        <button type="button" class="ui-btn xp-top-voice-btn xp-top-meeting-btn" id="xp-top-btn-meeting" title="Sala de Reunião 3D: dados reais da sprint e telão executivo">Sala 3D</button>
        <button type="button" class="ui-btn xp-top-voice-btn" id="xp-top-btn-life" title="Gestão de Pessoas: perfis, afinidades e guarda-roupa">Equipe</button>
        <button type="button" class="ui-btn xp-top-voice-btn" id="xp-top-btn-cutaway" title="Visão Geral do Edifício Corporativo">Andares</button>
        <button type="button" class="ui-btn xp-top-voice-btn" id="xp-top-btn-mode" title="Configurar Motor de Voz (Neural PT-BR / Talk It! / Local)">Voz: Neural</button>
        <button type="button" class="ui-btn xp-top-mute-btn" id="xp-top-btn-mute" title="Ativar ou desativar áudio e efeitos foley">Áudio: ON</button>
      `;
      rightBar.prepend(wrap);

      // Banner flutuante de Reunião Convocada Automaticamente
      this.initAutoSummonMonitor();

      wrap.querySelector('#xp-top-btn-phone')?.addEventListener('click', () => {
        void this.phone.open();
      });

      wrap.querySelector('#xp-top-btn-meeting')?.addEventListener('click', () => {
        void this.meeting.open();
      });

      wrap.querySelector('#xp-top-btn-life')?.addEventListener('click', () => {
        this.life.toggleModal();
      });

      wrap.querySelector('#xp-top-btn-cutaway')?.addEventListener('click', () => {
        this.building.toggleCutaway();
      });

      wrap.querySelector('#xp-top-btn-mode')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.voicePopover.hidden = !this.voicePopover.hidden;
      });

      wrap.querySelector('#xp-top-btn-mute')?.addEventListener('click', () => {
        this.setMuted(!this.muted);
      });

      this.syncVoiceLabels();
    };

    inject();
    setTimeout(inject, 600);
  }

  private renderVoicePopover() {
    const presetsHtml = (Object.keys(TALK_IT_LABELS) as TalkItPreset[])
      .map(
        (p) => `
          <option value="${p}" ${this.talkItPreset === p ? 'selected' : ''}>${TALK_IT_LABELS[p]}</option>
        `,
      )
      .join('');

    const volPct = Math.round((this.ctx?.prefs.sounds.volume ?? 0.72) * 100);
    const foleyButtons: { kind: SoundKind; label: string }[] = [
      { kind: 'keys', label: '⌨️ Teclas' },
      { kind: 'mouse', label: '🖱️ Mouse' },
      { kind: 'step', label: '👣 Passos' },
      { kind: 'printer', label: '🖨️ Impressora' },
      { kind: 'paper', label: '📄 Papel' },
      { kind: 'coffee', label: '☕ Café' },
      { kind: 'water', label: '💧 Bebedouro' },
      { kind: 'chair', label: '🪑 Cadeira' },
      { kind: 'server', label: '🖥️ Servidor' },
      { kind: 'elevator', label: '🛗 Elevador' },
    ];
    const foleyHtml = foleyButtons
      .map((b) => `<button type="button" class="xp-foley-btn" data-sfx="${b.kind}">${b.label}</button>`)
      .join('');

    this.voicePopover.innerHTML = `
      <div class="xp-vp-head">
        <span>🎙️ Central de Vozes & Efeitos · Habblaud XP</span>
        <button type="button" class="xp-win-x" id="xp-vp-close">✕</button>
      </div>
      <div class="xp-vp-body">
        <div class="xp-vp-label">🗣️ Motor de Voz dos Agentes:</div>
        <div class="xp-vp-modes">
          <button type="button" class="xp-vp-mode ${this.voiceMode === 'neural' ? 'is-active' : ''}" data-mode="neural">
            <strong>🎙️ Neural PT-BR</strong>
            <small>Vozes fluidas</small>
          </button>
          <button type="button" class="xp-vp-mode ${this.voiceMode === 'talkit' ? 'is-active' : ''}" data-mode="talkit">
            <strong>🤖 Talk It! Retrô</strong>
            <small>Clássico 90/2000</small>
          </button>
          <button type="button" class="xp-vp-mode ${this.voiceMode === 'webspeech' ? 'is-active' : ''}" data-mode="webspeech">
            <strong>💻 Local Offline</strong>
            <small>Navegador</small>
          </button>
        </div>

        <div class="xp-vp-talkit-row" ${this.voiceMode !== 'talkit' ? 'style="opacity:0.55"' : ''}>
          <label for="xp-talkit-select">Personalidade Talk It!:</label>
          <select id="xp-talkit-select" class="xp-vp-select">${presetsHtml}</select>
        </div>

        <div class="xp-vp-divider"></div>

        <div class="xp-vp-sfx-head">
          <span class="xp-vp-label">🎧 Efeitos do Escritório (Foley):</span>
          <button type="button" class="xp-sfx-toggle ${this.sfxEnabled && !this.muted ? 'is-on' : ''}" id="xp-sfx-toggle">
            ${this.sfxEnabled && !this.muted ? 'ON' : 'OFF'}
          </button>
        </div>
        <div class="xp-vp-vol-row">
          <label for="xp-sfx-vol">Volume SFX: <strong id="xp-sfx-vol-lbl">${volPct}%</strong></label>
          <input type="range" id="xp-sfx-vol" min="0" max="100" step="5" value="${volPct}" />
        </div>
        <div class="xp-foley-grid" title="Clique para testar cada efeito sonoro do escritório">${foleyHtml}</div>

        <div class="xp-vp-actions">
          <button type="button" class="ui-btn" id="xp-vp-test">🗣️ Testar Diálogo</button>
          <button type="button" class="ui-btn ${this.muted ? 'is-muted' : ''}" id="xp-vp-mute">
            ${this.muted ? '🔇 Mudo (Ativar)' : '🔊 Silenciar Tudo'}
          </button>
        </div>
      </div>
    `;

    this.voicePopover.querySelector('#xp-vp-close')?.addEventListener('click', () => {
      this.voicePopover.hidden = true;
    });

    this.voicePopover.querySelectorAll<HTMLButtonElement>('.xp-vp-mode').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.mode as VoiceMode;
        if (m) this.setVoiceMode(m);
      });
    });

    this.voicePopover.querySelector<HTMLSelectElement>('#xp-talkit-select')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as TalkItPreset;
      this.setTalkItPreset(val);
      if (this.voiceMode !== 'talkit') this.setVoiceMode('talkit');
    });

    this.voicePopover.querySelector('#xp-sfx-toggle')?.addEventListener('click', () => {
      this.setSfxEnabled(!this.sfxEnabled);
    });

    this.voicePopover.querySelector<HTMLInputElement>('#xp-sfx-vol')?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      const lbl = this.voicePopover.querySelector('#xp-sfx-vol-lbl');
      if (lbl) lbl.textContent = `${v}%`;
      if (this.ctx) {
        this.ctx.updatePrefs({ sounds: { ...this.ctx.prefs.sounds, volume: v / 100 } });
      }
    });

    this.voicePopover.querySelectorAll<HTMLButtonElement>('.xp-foley-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.sfx as SoundKind;
        if (kind) this.playFoley(kind);
      });
    });

    this.voicePopover.querySelector('#xp-vp-test')?.addEventListener('click', () => {
      if (this.muted) this.setMuted(false);
      this.speakDialogue(
        [
          { agentKey: 'fx', text: 'Alô pessoal, testando o áudio sincronizado em zero atraso! Tá limpo aí?', pose: 'wave', emoji: '🎙️' },
          { agentKey: 'art', text: 'Perfeito! Agora o balão abre junto com a voz e ninguém atropela ninguém.', pose: 'clap', emoji: '✨', particle: '⭐' },
        ],
        'urgent',
      );
    });

    this.voicePopover.querySelector('#xp-vp-mute')?.addEventListener('click', () => {
      this.setMuted(!this.muted);
    });
  }

  private summonBanner: HTMLElement | null = null;
  private hasAnnouncedSummon = false;

  private initAutoSummonMonitor() {
    const checkSummon = async () => {
      try {
        const res = await fetch('/api/presentation/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const pending = !!data?.pendingReview;
        const meetingBtn = document.getElementById('xp-top-btn-meeting');

        if (pending) {
          meetingBtn?.classList.add('has-summon-pulse');
          if (meetingBtn) meetingBtn.textContent = 'Sala 3D (Aprovação)';
          this.showSummonBanner(data.sprintTitle || 'Entrega Concluída');
        } else {
          meetingBtn?.classList.remove('has-summon-pulse');
          if (meetingBtn) meetingBtn.textContent = 'Sala 3D';
          this.hideSummonBanner();
        }
      } catch {
        // ignore
      }
    };

    void checkSummon();
    setInterval(checkSummon, 10000);
  }

  private showSummonBanner(sprintTitle: string) {
    if (this.summonBanner) return;
    this.summonBanner = document.createElement('div');
    this.summonBanner.id = 'xp-summon-banner';
    this.summonBanner.className = 'xp-summon-banner';
    this.summonBanner.innerHTML = `
      <div class="xp-summon-icon">🏛️</div>
      <div class="xp-summon-text">
        <strong>Reunião Convocada Automaticamente:</strong> O time concluiu "${sprintTitle}" e aguarda sua aprovação no telão!
      </div>
      <button type="button" class="xp-summon-enter-btn" id="xp-summon-enter">Entrar na Sala 3D</button>
      <button type="button" class="xp-summon-close-btn" id="xp-summon-close" title="Fechar aviso">✕</button>
    `;

    document.body.appendChild(this.summonBanner);

    this.summonBanner.querySelector('#xp-summon-enter')?.addEventListener('click', () => {
      void this.meeting.open();
      this.hideSummonBanner();
    });

    this.summonBanner.querySelector('#xp-summon-close')?.addEventListener('click', () => {
      this.hideSummonBanner();
    });

    if (!this.hasAnnouncedSummon) {
      this.hasAnnouncedSummon = true;
      this.speakDialogue(
        [
          { agentKey: 'vicente', text: 'Fundador, a reunião foi convocada automaticamente! As entregas da sprint estão prontas no telão.', pose: 'wave' },
          { agentKey: 'release', text: 'Tudo compilado e sem erros! Aguardando você na sala 3D para apresentar e aprovar.', pose: 'cheer' },
        ],
        'urgent',
      );
    }
  }

  private hideSummonBanner() {
    if (this.summonBanner) {
      this.summonBanner.remove();
      this.summonBanner = null;
    }
  }

  private syncVoiceLabels() {
    const modeText = this.voiceMode === 'talkit' ? 'Talk It!' : this.voiceMode === 'webspeech' ? 'Local' : 'Voz: Neural';
    const topMode = document.getElementById('xp-top-btn-mode');
    if (topMode) topMode.textContent = modeText;

    const topMute = document.getElementById('xp-top-btn-mute');
    if (topMute) {
      topMute.textContent = this.muted ? 'Mudo' : 'Áudio: ON';
      topMute.classList.toggle('is-muted', this.muted);
    }

    const trayMode = document.getElementById('xp-tray-mode-lbl');
    if (trayMode) trayMode.textContent = modeText;

    const trayVoice = document.getElementById('voice-icon-lbl');
    if (trayVoice) trayVoice.textContent = this.muted ? 'Mudo' : 'Áudio: ON';
  }

  private injectXpTaskbar() {
    document.getElementById('xp-taskbar')?.remove();

    const taskbar = document.createElement('div');
    taskbar.id = 'xp-taskbar';
    taskbar.className = 'xp-taskbar';

    taskbar.innerHTML = `
      <div class="xp-start-btn" id="xp-start-btn" title="Abrir Corte Vertical do Prédio Corporativo">
        <span class="xp-flag">⊞</span>
        <strong>iniciar</strong>
      </div>

      <div class="xp-quick-launch">
        <button type="button" class="xp-ql-btn" id="btn-phone-modal" title="Habblaud Phone PWA: ligações e aprovações pelo celular">
          📱 Phone
        </button>
        <button type="button" class="xp-ql-btn" id="btn-meeting-3d" title="Abrir Sala de Reunião 3D com Slides e Apresentação Real">
          📊 Reunião 3D
        </button>
        <button type="button" class="xp-ql-btn" id="btn-life-modal" title="Personalidades, Amizades, Romances e Guarda-Roupa">
          💖 Vida
        </button>
        <button type="button" class="xp-ql-btn" id="btn-building-cutaway" title="Ver todos os andares/empresas do prédio">
          🏢 Prédio
        </button>
        <button type="button" class="xp-ql-btn" id="btn-elevator-toggle" title="Mostrar ou esconder o painel do elevador">
          🛗 Andares
        </button>
        <button type="button" class="xp-ql-btn" id="btn-debate-now" title="Disparar conversas paralelas inéditas entre os agentes">
          💬 Papos
        </button>
        <button type="button" class="xp-ql-btn" id="btn-toggle-team" title="Mostrar/esconder lista da equipe">
          👥 Equipe
        </button>
        <button type="button" class="xp-ql-btn" id="btn-toggle-activity" title="Mostrar/esconder log de atividades">
          📋 Log
        </button>
        <button type="button" class="xp-ql-btn" id="btn-room-overview" title="Enquadrar o escritório inteiro">
          🔭 Geral
        </button>
      </div>

      <div class="xp-taskbar-tasks">
        <div class="xp-task-btn active" id="task-win-main">
          <span class="xp-icon">🏨</span>
          <span id="xp-task-floor-lbl">Habblaud Tower · XP Luna</span>
        </div>
      </div>

      <div class="xp-systray">
        <button type="button" class="xp-tray-icon" id="btn-voice-mode-tray" title="Escolher Voz Neural PT-BR ou Talk It! Retrô">
          <span id="xp-tray-mode-lbl">🎙️ Neural</span>
        </button>
        <button type="button" class="xp-tray-icon" id="btn-toggle-voice" title="Silenciar ou ligar a voz dos agentes">
          <span id="voice-icon-lbl">🔊 Voz: ON</span>
        </button>
        <div class="xp-tray-time" id="xp-clock">12:00</div>
      </div>
    `;

    document.body.appendChild(taskbar);

    document.getElementById('xp-start-btn')?.addEventListener('click', () => {
      this.building.toggleCutaway();
    });
    document.getElementById('btn-phone-modal')?.addEventListener('click', () => {
      void this.phone.open();
    });
    document.getElementById('btn-meeting-3d')?.addEventListener('click', () => {
      void this.meeting.open();
    });
    document.getElementById('btn-life-modal')?.addEventListener('click', () => {
      this.life.toggleModal();
    });
    document.getElementById('btn-building-cutaway')?.addEventListener('click', () => {
      this.building.toggleCutaway();
    });
    document.getElementById('btn-elevator-toggle')?.addEventListener('click', () => {
      this.building.toggleElevatorPanel();
    });
    document.getElementById('btn-debate-now')?.addEventListener('click', () => {
      this.triggerManualDebate();
    });
    document.getElementById('btn-toggle-team')?.addEventListener('click', () => {
      (document.querySelector('.ui-btn-sidebar') as HTMLButtonElement | null)?.click();
    });
    document.getElementById('btn-toggle-activity')?.addEventListener('click', () => {
      (document.querySelector('.ui-btn-feed') as HTMLButtonElement | null)?.click();
    });
    document.getElementById('btn-room-overview')?.addEventListener('click', () => {
      this.world.overview();
    });
    document.getElementById('btn-voice-mode-tray')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.voicePopover.hidden = !this.voicePopover.hidden;
    });
    document.getElementById('btn-toggle-voice')?.addEventListener('click', () => {
      this.setMuted(!this.muted);
    });

    // Fecha popover ao clicar fora
    document.addEventListener('click', (e) => {
      if (!this.voicePopover.hidden && !this.voicePopover.contains(e.target as Node)) {
        this.voicePopover.hidden = true;
      }
    });

    const updateClock = () => {
      const el = document.getElementById('xp-clock');
      if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    updateClock();
    setInterval(updateClock, 10000);
    this.syncVoiceLabels();
  }

  private onFloorChanged(floor: BuildingFloorDto) {
    const lbl = document.getElementById('xp-task-floor-lbl');
    if (lbl) lbl.textContent = `${floor.floorNumber}º Andar · ${floor.companyName} (${floor.providerBadge})`;

    // Aplica o tema arquitetônico exclusivo daquele andar no escritório (iluminação, piso, atmosfera)!
    this.world.setFloorVisual?.({
      id: floor.id,
      companyName: floor.companyName,
      style: floor.style,
      daylight: floor.daylight,
      squiggly: floor.squigglyFloor,
    });

    this.speakDialogue(
      [
        { agentKey: 'vicente', text: `Chegamos no ${floor.floorNumber}º andar! Bem-vindo à ${floor.companyName}, no estilo ${floor.styleLabel}.`, pose: 'wave', emoji: '🏢' },
        { agentKey: 'ux', text: `Aqui os departamentos são ${floor.departments[0]} e ${floor.departments[1]}. Cada andar tem vida própria!`, pose: 'clap', emoji: '✨' },
      ],
      'work',
    );
    // Dispara uma conversa paralela visual na outra sala (clique em 🎧 Ouvir para sintonizar!)
    setTimeout(() => this.triggerParallelConversation(), 1400);
  }

  /**
   * Executa uma cena de vida real (amizade, flerte, romance ou papo de hobby):
   * - Se `withVoice` E estiver no Foco Espacial (ou forçada pelo usuário), usa `speakDialogue` sincronizado (`onended`!).
   * - Caso contrário, roda em Modo Paralelo Visual com botão clicável `🎧 Ouvir` para puxar o microfone na hora!
   */
  public playLifeScene(ex: GeneratedExchange, withVoice: boolean, priority: SpeechPriority = 'social') {
    if (this.meetingMode) return;
    const badge = stageBadge(ex.stage);
    const badgeTag = ex.isRomantic ? `${badge.icon} ${badge.label.split(' ')[0]}` : `${badge.icon} papo`;

    const turns: DialogueTurn[] = [
      {
        agentKey: ex.speakerAId,
        text: ex.textA,
        emotion: ex.emotionA,
        pose: ex.poseA,
        emoji: ex.emojiA,
        particle: ex.isRomantic ? '💖' : ex.poseA === 'dance' ? '🎵' : undefined,
      },
      {
        agentKey: ex.speakerBId,
        text: ex.textB,
        emotion: ex.emotionB,
        pose: ex.poseB,
        emoji: ex.emojiB,
        particle: ex.isRomantic ? '❤️' : ex.poseB === 'cheer' || ex.poseB === 'clap' ? '⭐' : undefined,
      },
    ];

    const shouldSpeak = withVoice && (priority !== 'social' || this.isInSpatialFocus([ex.speakerAId, ex.speakerBId]));

    if (shouldSpeak) {
      this.speakDialogue(turns, priority);
      return;
    }

    // Modo Paralelo Visual (sem competir no áudio; clique em 🎧 Ouvir para sintonizar!)
    this.world.playEmote?.(ex.speakerAId, ex.poseA, ex.emojiA, 3800);
    if (turns[0].particle) this.life.spawnParticle(ex.speakerAId, turns[0].particle);
    this.showParallelBalloon(ex.speakerAId, ex.textA, badgeTag, turns);

    setTimeout(() => {
      this.world.playEmote?.(ex.speakerBId, ex.poseB, ex.emojiB, 3800);
      if (turns[1].particle) this.life.spawnParticle(ex.speakerBId, turns[1].particle);
      this.showParallelBalloon(ex.speakerBId, ex.textB, badgeTag, [turns[1]]);
    }, 2600);
  }

  /** Dispara uma conversa paralela simultânea entre 2 colegas sem disputar o canal de voz! */
  public triggerParallelConversation() {
    const ex = this.life.generateUniqueExchange();
    if (!ex) return;
    this.playLifeScene(ex, false, 'social');
  }

  public triggerInitialTeamDebate() {
    const ex1 = this.life.generateUniqueExchange();
    if (ex1) {
      this.playLifeScene(ex1, true, 'work');
    } else {
      this.speak('vicente', 'Pessoal, todos os andares da torre estão vivos com áudio sincronizado!', 'work');
    }
  }

  public triggerManualDebate() {
    // Dispara DUAS conversas paralelas inéditas ao mesmo tempo (1 com voz sincronizada + 1 paralela visual clicável)!
    const voiced = this.life.generateUniqueExchange();
    if (voiced) this.playLifeScene(voiced, true, 'urgent');

    setTimeout(() => {
      const parallel = this.life.generateUniqueExchange();
      if (parallel && parallel.speakerAId !== voiced?.speakerAId) {
        this.playLifeScene(parallel, false, 'social');
      }
    }, 700);
  }

  private startPeriodicWorkInteraction() {
    // Conversa em foco espacial com voz (sincronizada por onended, sem fila acumulada!) a cada 26s
    this.workChatTimer = setInterval(() => {
      if (this.batchQueue.length === 0 && !this.isProcessingQueue) {
        const ex = this.life.generateUniqueExchange();
        if (ex) this.playLifeScene(ex, true, 'social');
      }
    }, 26000);

    // Conversa paralela visual (com botão 🎧 Ouvir) na outra sala a cada 14.5s
    this.parallelTimer = setInterval(() => {
      if (this.activeBalloons.size < 4) {
        this.triggerParallelConversation();
      }
    }, 14500);
  }

  // Escuta atividades REAIS de TODOS os agentes separadamente e traduz para falas humanas naturais!
  private listenToAgentActivities() {
    let initialized = false;
    this.store.on('snapshot', () => {
      const snap = this.store.liveSnapshot;
      if (!snap) return;

      // Na primeira carga, marca atividades iniciais como já vistas para não disparar enxurrada
      if (!initialized) {
        for (const a of snap.agents) {
          for (const act of a.recent) this.seenActivityIds.add(act.id);
        }
        initialized = true;
        return;
      }

      for (const a of snap.agents) {
        const latest = a.recent[0];
        if (!latest || this.seenActivityIds.has(latest.id)) continue;
        this.seenActivityIds.add(latest.id);
        if (this.seenActivityIds.size > 400) {
          const first = this.seenActivityIds.values().next().value;
          if (first) this.seenActivityIds.delete(first);
        }
        this.translateAndSpeakRealActivity(a, latest);
        break;
      }
    });
  }

  private mapAgentToProfileKey(agent: AgentInfo): string {
    const id = agent.id.toLowerCase();
    for (const key of Object.keys(AGENT_PROFILES)) {
      if (id === `ag_${key}` || id.includes(key)) return key;
    }
    return 'vicente';
  }

  /** Tradutor humano anti-repetição: transforma ações técnicas em falas naturais de escritório. */
  private translateAndSpeakRealActivity(agent: AgentInfo, act: Activity) {
    const text = (act.text || '').trim();
    if (!text) return;

    // Anti-repetição: ignora tópicos idênticos em menos de 25 segundos
    const topicKey = `${act.kind}:${text.slice(0, 32).toLowerCase()}`;
    const lastAt = this.recentTopics.get(topicKey) ?? 0;
    if (Date.now() - lastAt < 25000) return;
    this.recentTopics.set(topicKey, Date.now());

    const speaker = this.mapAgentToProfileKey(agent);
    const pick = <T,>(arr: T[]): T => arr[this.phraseCursor++ % arr.length];

    // Extrai nome de arquivo se houver
    const fileMatch = text.match(/([a-zA-Z0-9._-]+\.(?:ts|tsx|js|mjs|css|html|json|md))/i);
    const fileName = fileMatch?.[1];

    if (act.kind === 'edit') {
      if (!this.muted && this.sfxEnabled) this.sound?.board.play('keys', { gain: 0.9, count: 6 });
      if (fileName && /css|theme|style/i.test(fileName)) {
        this.speakDialogue([
          {
            agentKey: 'art',
            text: pick([
              `Tô ajustando o visual e o contraste lá no ${fileName} agora.`,
              `Dei um trato nas cores do ${fileName} pra nenhuma letra ficar apagada!`,
              `Salvando o refinamento de tema XP no ${fileName} (H).`,
            ]),
          },
          {
            agentKey: 'qa',
            text: pick([
              'Boa! Já vou checar aqui se o contraste passou em todos os painéis.',
              'Show, vou validar no navegador assim que compilar!',
            ]),
          },
        ], 'work');
      } else if (fileName && /voice|tts|audio/i.test(fileName)) {
        this.speak('fx', pick([
          `Tô calibrando o motor de voz no ${fileName} pros agentes falarem bem fluido!`,
          `Atualizei os timbres e o modo Talk It! lá no ${fileName}.`,
        ]), 'work');
      } else if (fileName) {
        this.speak(speaker, pick([
          `Tô editando o ${fileName} aqui pra deixar essa parte redondinha.`,
          `Apliquei uma melhoria importante no ${fileName} agora.`,
          `Salvando as mudanças novas no ${fileName} (y).`,
        ]), 'work');
      } else {
        this.speak(speaker, `Acabei de atualizar o código aqui: ${text.slice(0, 55)}.`, 'work');
      }
      return;
    }

    if (act.kind === 'run') {
      if (!this.muted && this.sfxEnabled) {
        this.sound?.board.play(/build|relat|entreg|final|qa/i.test(text) ? 'printer' : 'server', { gain: 0.85 });
      }
      if (/build|vite|compile/i.test(text)) {
        this.speakDialogue([
          {
            agentKey: 'dev',
            text: pick([
              'Rodando o build agora pra ver se tudo compilou sem nenhum erro!',
              'Compilando o projeto aqui na minha estação, já já sai o resultado.',
            ]),
          },
          {
            agentKey: 'release',
            text: 'Beleza! Se ficar verdinho eu já atualizo o servidor.',
          },
        ], 'work');
      } else if (/test|qa|audit|check/i.test(text)) {
        this.speak('qa', pick([
          'Passando o pente-fino nos testes automatizados aqui agora.',
          'Rodando a auditoria de qualidade pra garantir zero regressão (y).',
        ]), 'work');
      } else if (/tts|voice|audio|install/i.test(text)) {
        this.speak('fx', `Configurando os pacotes de áudio aqui: ${text.slice(0, 48)}.`, 'work');
      } else {
        this.speak(speaker, pick([
          `Executei uma tarefa no terminal: ${text.slice(0, 52)}.`,
          `Tô rodando um comando aqui pra conferir: ${text.slice(0, 52)}.`,
        ]), 'work');
      }
      return;
    }

    if (act.kind === 'search') {
      if (!this.muted && this.sfxEnabled) this.sound?.board.play('paper', { gain: 0.8 });
      if (fileName) {
        this.speak(speaker, pick([
          `Dei uma olhada no ${fileName} pra entender certinho como tá montado.`,
          `Tô revisando o ${fileName} aqui na minha tela antes de mexer.`,
          `Conferi o código do ${fileName} e já sei exatamente onde ajustar!`,
        ]), 'work');
      } else {
        const cleanQuery = text.replace(/^(Lendo|Pesquisando:?)\s*/i, '').slice(0, 55);
        this.speak(speaker, pick([
          `Tô conferindo aqui os detalhes sobre ${cleanQuery}.`,
          `Dei uma investigada rápida em ${cleanQuery} pra orientar o time.`,
        ]), 'work');
      }
      return;
    }

    if (act.kind === 'ask') {
      this.speakDialogue([
        { agentKey: 'vicente', text: 'Pessoal, mandei uma pergunta pro fundador pra decidir o melhor caminho!' },
        { agentKey: 'user', text: 'Assim que ele responder, a equipe inteira já parte pra execução.' },
      ], 'urgent');
      return;
    }

    if (act.kind === 'prompt') {
      this.speakDialogue([
        { agentKey: 'vicente', text: 'Chegou pedido novo do fundador! Vamos dividir as tarefas por mesa agora.' },
        { agentKey: 'dev', text: 'Tô dentro! Já puxei a parte de código aqui na minha estação (y).' },
      ], 'work');
    }
  }

  public destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.workChatTimer) clearInterval(this.workChatTimer);
    if (this.parallelTimer) clearInterval(this.parallelTimer);
    this.stopCurrentAudio();
    this.building.destroy();
    this.life.destroy();
    document.getElementById('xp-taskbar')?.remove();
    document.getElementById('xp-top-voice-wrap')?.remove();
    this.voicePopover.remove();
    this.balloonLayer.remove();
  }
}
