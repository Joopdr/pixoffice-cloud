// Fonte multi-andar de agentes do Antigravity para o Habblaud (AgentSource).
// Cada conversa (Antigravity, Claude Code ou Codex) vira um ANDAR / EMPRESA único,
// com tema arquitetônico próprio, iluminação, departamentos e ritmo real de trabalho e pausas.
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync, watchFile, unwatchFile } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import type { Activity, OfficeSnapshot, SourceInfo, Provider } from '../../../shared/types';
import type { AccountsService } from '../../accounts/service';
import type { Office } from '../../model/office';
import type { AgentSource } from '../source';
import { log } from '../../log';

export interface AntigravitySourceOptions {
  accounts: AccountsService;
  office: Office;
  brainDir?: string;
  pollMs?: number;
}

export type FloorArchStyle = 'luna_tech' | 'retro_studio' | 'warm_loft' | 'cyber_neon' | 'sunset_lounge';

export interface BuildingFloorInfo {
  id: string;
  floorNumber: number;
  companyName: string;
  subtitle: string;
  provider: 'antigravity' | 'claude' | 'codex';
  providerLabel: string;
  providerBadge: 'AG' | 'CC' | 'CX';
  providerColor: string;
  style: FloorArchStyle;
  styleLabel: string;
  daylight: 'day' | 'night' | 'auto';
  squigglyFloor: boolean;
  accentColor: string;
  floorBg: string;
  departments: [string, string];
  sessionId: string;
  cwd: string;
  lastActivityAt: number;
  activeAgents: number;
  workingCount: number;
  isSelected: boolean;
  agents: {
    id: string;
    name: string;
    role: string;
    status: string;
    lastText: string;
  }[];
}

interface FloorPreset {
  style: FloorArchStyle;
  styleLabel: string;
  daylight: 'day' | 'night' | 'auto';
  squigglyFloor: boolean;
  accentColor: string;
  floorBg: string;
  departments: [string, string];
}

const FLOOR_PRESETS: FloorPreset[] = [
  {
    style: 'luna_tech',
    styleLabel: 'Startup Tech · Azul Luna',
    daylight: 'day',
    squigglyFloor: false,
    accentColor: '#0054E3',
    floorBg: 'linear-gradient(180deg, #E8F1FF 0%, #D4E4FC 65%, #BACFEF 65%, #BACFEF 100%)',
    departments: ['habblaud', 'wigglypaint-pro'],
  },
  {
    style: 'retro_studio',
    styleLabel: 'Ateliê Criativo · Habbo Club',
    daylight: 'day',
    squigglyFloor: true,
    accentColor: '#C026D3',
    floorBg: 'linear-gradient(180deg, #FDF2F8 0%, #FCE7F3 65%, #FBCFE8 65%, #FBCFE8 100%)',
    departments: ['squiggly-atelier', 'pixel-design'],
  },
  {
    style: 'warm_loft',
    styleLabel: 'Loft Industrial · Madeira Âmbar',
    daylight: 'day',
    squigglyFloor: false,
    accentColor: '#D97706',
    floorBg: 'linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 65%, #FDE68A 65%, #FDE68A 100%)',
    departments: ['arquitetura-hq', 'pesquisa-lab'],
  },
  {
    style: 'cyber_neon',
    styleLabel: 'Cyber Lab Noturno · Esmeralda',
    daylight: 'night',
    squigglyFloor: false,
    accentColor: '#059669',
    floorBg: 'linear-gradient(180deg, #0F172A 0%, #1E293B 65%, #0F3D3E 65%, #0F3D3E 100%)',
    departments: ['cyber-core', 'audio-synth'],
  },
  {
    style: 'sunset_lounge',
    styleLabel: 'Cobertura Pôr do Sol · Studio',
    daylight: 'auto',
    squigglyFloor: true,
    accentColor: '#E11D48',
    floorBg: 'linear-gradient(180deg, #FFF1F2 0%, #FFE4E6 65%, #FECDD3 65%, #FECDD3 100%)',
    departments: ['produto-vip', 'lounge-criativo'],
  },
];

interface MonitoredSession {
  id: string;
  transcriptFile: string;
  lastReadByte: number;
  cwd: string;
  companyName: string;
  subtitle: string;
  mtimeMs: number;
  tokensIn: number;
  tokensOut: number;
  toolCalls: number;
}

interface SquigglyTeamMember {
  id: string;
  name: string;
  role: string;
  deptIdx: 0 | 1;
  initialActivity: string;
  look: 'm' | 'f';
}

const TEAM_MEMBERS: SquigglyTeamMember[] = [
  { id: 'ag_vicente', name: 'Vicente', role: '00 @researcher · Arquiteto Líder', deptIdx: 0, initialActivity: 'Coordenando arquitetura e entregas do andar', look: 'm' },
  { id: 'ag_dev', name: 'Dev', role: '01 @dev · Engine & Full-Stack', deptIdx: 1, initialActivity: 'Codificando motores e otimizando builds', look: 'm' },
  { id: 'ag_fx', name: 'FX & Áudio', role: '02 @fx-audio · Vozes & Foley', deptIdx: 1, initialActivity: 'Afinando timbres neurais, Talk It! e Foley', look: 'm' },
  { id: 'ag_qa', name: 'QA Auditor', role: '03 @qa · Qualidade & Contraste', deptIdx: 0, initialActivity: 'Testando fluxos, memória e acessibilidade', look: 'f' },
  { id: 'ag_user', name: 'User', role: '04 @user · Usabilidade & Vida', deptIdx: 1, initialActivity: 'Avaliando fluidez, humor e diversão da UI', look: 'f' },
  { id: 'ag_art', name: 'Art XP', role: '05 @art-designer · Moda & Habbo', deptIdx: 1, initialActivity: 'Desenhando roupas, acessórios e móveis retrô', look: 'f' },
  { id: 'ag_ux', name: 'UX/UI', role: '06 @ux-ui · Layout & Prédio', deptIdx: 0, initialActivity: 'Refinando cada andar e câmera do prédio', look: 'f' },
  { id: 'ag_release', name: 'Release', role: '07 @release · Entregas & Esteira', deptIdx: 0, initialActivity: 'Sincronizando versões e subindo atualizações', look: 'm' },
];

function inferCompanyMeta(sessionId: string, transcriptFile: string, idx: number): { companyName: string; subtitle: string; cwd: string } {
  const defaultCwd = join(homedir(), '.gemini', 'antigravity', 'scratch', 'habblaud');
  const fallbackNames = [
    'PixOffice HQ',
    'Antigravity Labs',
    'Pixel & Synth Co.',
    'Neon Cloud Systems',
    'Retro Web Ventures',
    'Luna Desktop Studio',
  ];
  let companyName = fallbackNames[idx % fallbackNames.length];
  let subtitle = 'Conversa ativa no Antigravity';
  let cwd = defaultCwd;

  try {
    const fd = openSync(transcriptFile, 'r');
    const chunk = Buffer.alloc(16384);
    const bytes = readSync(fd, chunk, 0, chunk.length, 0);
    closeSync(fd);
    const head = chunk.subarray(0, bytes).toString('utf8');

    const projMatch = head.match(/scratch[\\/]([a-zA-Z0-9._-]+)/i);
    if (projMatch?.[1]) {
      const folder = projMatch[1];
      cwd = join(homedir(), '.gemini', 'antigravity', 'scratch', folder);
      if (/habblaud/i.test(folder)) companyName = 'PixOffice HQ';
      else if (/wiggly|squiggly/i.test(folder)) companyName = 'PixOffice HQ';
      else companyName = `${folder.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Labs`;
    }

    const lines = head.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'USER_INPUT' && typeof obj.content === 'string') {
          const clean = obj.content
            .replace(/<[^>]*>/g, '')
            .replace(/https?:\/\/\S+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (clean.length > 4) {
            subtitle = clean.slice(0, 68);
            if (/habblaud/i.test(clean)) companyName = 'PixOffice HQ';
            break;
          }
        }
      } catch {
        // ignore partial
      }
    }
  } catch {
    // ignore
  }

  return { companyName, subtitle, cwd };
}

function hashIdx(str: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

export class AntigravitySource implements AgentSource {
  readonly provider: Provider = 'codex';
  private readonly accounts: AccountsService;
  private readonly office: Office;
  private readonly brainDir: string;
  private accountId = 'antigravity';
  private sessions = new Map<string, MonitoredSession>();
  private discoveredFloors: MonitoredSession[] = [];
  private selectedFloorId: string | null = null;
  private scanTimer: NodeJS.Timeout | null = null;
  private lifeTimer: NodeJS.Timeout | null = null;
  private running = false;
  private currentFloorAgentIds: string[] = [];
  private breakCursor = 0;

  constructor(options: AntigravitySourceOptions) {
    this.accounts = options.accounts;
    this.office = options.office;
    this.brainDir = options.brainDir || join(homedir(), '.gemini', 'antigravity', 'brain');
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    try {
      const entries = this.accounts.setProviderAccounts('codex', [
        {
          dir: this.brainDir,
          detected: {
            id: 'antigravity',
            configDir: this.brainDir,
            short: 'AG',
            name: 'Google Antigravity',
            color: '#0078D7',
            plan: 'Gemini 4 Neon',
          },
        },
      ]);
      if (entries.length > 0) this.accountId = entries[0].id;
    } catch (e: any) {
      log.warn(`[antigravity] Falha ao registrar conta: ${e.message}`);
    }

    log.info(`[antigravity] Fonte Antigravity multi-andar conectada em: ${this.brainDir}`);

    this.spawnFloorTeam(FLOOR_PRESETS[0]);
    this.scanSessions();
    this.scanTimer = setInterval(() => this.scanSessions(), 2500);

    // Ritmo vivo do escritório: a cada 18s, 2 agentes levantam para tomar café, jogar ping-pong ou passear!
    this.lifeTimer = setInterval(() => this.tickOfficeBreaks(), 18_000);
  }

  stop(): void {
    this.running = false;
    if (this.scanTimer) clearInterval(this.scanTimer);
    if (this.lifeTimer) clearInterval(this.lifeTimer);
    this.scanTimer = null;
    this.lifeTimer = null;
    for (const s of this.sessions.values()) unwatchFile(s.transcriptFile);
    this.sessions.clear();
  }

  sources(): SourceInfo[] {
    return [
      {
        label: 'Antigravity (Prédio Multi-Andar · Vida Real)',
        provider: 'codex',
        path: this.brainDir,
        sessions: this.discoveredFloors.length || 1,
        ok: true,
      },
    ];
  }

  transcriptPathOf(agentId: string): string | undefined {
    const active = this.getActiveSession();
    if (active && agentId.startsWith('ag_')) return active.transcriptFile;
    return undefined;
  }

  private getActiveSession(): MonitoredSession | undefined {
    if (this.selectedFloorId) {
      const found = this.discoveredFloors.find((f) => `floor_${f.id}` === this.selectedFloorId);
      if (found) return found;
    }
    return this.discoveredFloors[0];
  }

  /** Registra a equipe física do andar nas salas/departamentos daquela empresa. */
  private spawnFloorTeam(preset: FloorPreset): void {
    const base = join(homedir(), '.gemini', 'antigravity', 'scratch');
    const roomA = join(base, preset.departments[0]);
    const roomB = join(base, preset.departments[1]);

    // Se já existiam agentes de outro andar em salas diferentes, marca-os como offline para trocarem de andar
    const newIds: string[] = [];
    for (const member of TEAM_MEMBERS) {
      const targetCwd = member.deptIdx === 0 ? roomA : roomB;
      newIds.push(member.id);
      try {
        // Alterna 2 agentes inicialmente em pausa ('idle') para o escritório já começar com gente passeando/pegando café!
        const initialStatus = member.id === 'ag_fx' || member.id === 'ag_user' ? 'idle' : 'working';
        this.office.addMain({
          id: member.id,
          name: member.name,
          look: member.look,
          provider: 'codex',
          account: this.accountId,
          sessionId: `sess_${member.id}_${preset.style}`,
          cwd: targetCwd,
          role: member.role,
          startedAt: Date.now() - 1800_000,
          status: initialStatus,
        });

        this.office.addActivity(member.id, {
          id: `act_init_${member.id}_${Date.now()}`,
          kind: 'think',
          text: member.initialActivity,
          at: Date.now(),
        });
      } catch (err: any) {
        log.warn(`[antigravity] Falha ao adicionar agente ${member.id}: ${err.message}`);
      }
    }
    this.currentFloorAgentIds = newIds;
  }

  /** Faz rodízio orgânico de pausas: 2 agentes vão ao café/lounge/fliperama enquanto 6 trabalham nas mesas. */
  private tickOfficeBreaks(): void {
    if (!this.currentFloorAgentIds.length) return;
    const n = this.currentFloorAgentIds.length;
    const idleA = this.breakCursor % n;
    const idleB = (this.breakCursor + 3) % n;
    this.breakCursor++;

    this.currentFloorAgentIds.forEach((id, i) => {
      const nextStatus = i === idleA || i === idleB ? 'idle' : 'working';
      this.office.setStatus(id, nextStatus);
    });
  }

  private presetForFloor(idx: number, companyName: string, sessionId: string): FloorPreset {
    if (idx === 0) return FLOOR_PRESETS[0];
    if (/squiggly|wiggly|studio/i.test(companyName)) return FLOOR_PRESETS[1];
    if (/codex|cyber|neon/i.test(companyName)) return FLOOR_PRESETS[3];
    return FLOOR_PRESETS[(idx + hashIdx(sessionId, FLOOR_PRESETS.length - 1)) % FLOOR_PRESETS.length];
  }

  /** Lista todos os andares (empresas/conversas) do prédio corporativo, cada um com identidade própria! */
  getBuildingFloors(snap?: OfficeSnapshot): BuildingFloorInfo[] {
    const snapAgents = snap?.agents ?? [];
    const snapRooms = snap?.rooms ?? [];
    const floors: BuildingFloorInfo[] = [];

    const agFloors = this.discoveredFloors.slice(0, 6);
    const activeId = this.selectedFloorId ?? (agFloors[0] ? `floor_${agFloors[0].id}` : null);

    // 1. Andares externos reais (Claude Code / Codex)
    const externalRooms = new Map<string, { provider: 'claude' | 'codex'; name: string; agents: typeof snapAgents }>();
    for (const a of snapAgents) {
      if (a.account === this.accountId || a.id.startsWith('ag_')) continue;
      const prov: 'claude' | 'codex' = a.provider === 'codex' ? 'codex' : 'claude';
      const room = snapRooms.find((r) => r.id === a.roomId);
      const key = `${prov}:${a.roomId}`;
      const existing = externalRooms.get(key);
      if (existing) existing.agents.push(a);
      else externalRooms.set(key, { provider: prov, name: room?.name ?? 'Projeto', agents: [a] });
    }

    for (const [key, ext] of externalRooms.entries()) {
      const floorId = `floor_ext_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const preset = ext.provider === 'codex' ? FLOOR_PRESETS[3] : FLOOR_PRESETS[2];
      floors.push({
        id: floorId,
        floorNumber: 0,
        companyName: ext.name,
        subtitle: ext.agents[0]?.recent[0]?.text ?? `Conversa ativa no ${ext.provider === 'claude' ? 'Claude Code' : 'Codex'}`,
        provider: ext.provider,
        providerLabel: ext.provider === 'claude' ? 'Claude Code' : 'Codex',
        providerBadge: ext.provider === 'claude' ? 'CC' : 'CX',
        providerColor: ext.provider === 'claude' ? '#D97706' : '#059669',
        style: preset.style,
        styleLabel: preset.styleLabel,
        daylight: preset.daylight,
        squigglyFloor: preset.squigglyFloor,
        accentColor: preset.accentColor,
        floorBg: preset.floorBg,
        departments: [ext.name, `${ext.name}-lab`],
        sessionId: ext.agents[0]?.sessionId ?? floorId,
        cwd: ext.name,
        lastActivityAt: Math.max(...ext.agents.map((a) => a.lastEventAt || Date.now())),
        activeAgents: ext.agents.length,
        workingCount: ext.agents.filter((a) => a.status === 'working').length,
        isSelected: activeId === floorId,
        agents: ext.agents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          status: a.status,
          lastText: a.recent[0]?.text ?? 'Em serviço',
        })),
      });
    }

    // 2. Andares reais do Antigravity — cada andar com seu próprio tema arquitetônico!
    const teamAgentsSnap = snapAgents.filter((a) => a.id.startsWith('ag_'));
    agFloors.forEach((sess, idx) => {
      const floorId = `floor_${sess.id}`;
      const isSelected = activeId === floorId;
      const preset = this.presetForFloor(idx, sess.companyName, sess.id);

      const floorAgents =
        isSelected && teamAgentsSnap.length > 0
          ? teamAgentsSnap.map((a) => ({
              id: a.id,
              name: a.name,
              role: a.role,
              status: a.status,
              lastText: a.recent[0]?.text ?? 'Ativo na mesa',
            }))
          : TEAM_MEMBERS.slice(0, Math.max(4, 8 - idx)).map((m) => ({
              id: `${m.id}_${sess.id.slice(0, 4)}`,
              name: m.name,
              role: m.role,
              status: idx === 0 ? 'working' : 'idle',
              lastText: m.initialActivity,
            }));

      floors.push({
        id: floorId,
        floorNumber: 0,
        companyName: idx === 0 ? sess.companyName : `${sess.companyName} · #${sess.id.slice(0, 4).toUpperCase()}`,
        subtitle: sess.subtitle,
        provider: 'antigravity',
        providerLabel: 'Antigravity',
        providerBadge: 'AG',
        providerColor: '#0054E3',
        style: preset.style,
        styleLabel: preset.styleLabel,
        daylight: preset.daylight,
        squigglyFloor: preset.squigglyFloor,
        accentColor: preset.accentColor,
        floorBg: preset.floorBg,
        departments: preset.departments,
        sessionId: sess.id,
        cwd: sess.cwd,
        lastActivityAt: sess.mtimeMs,
        activeAgents: floorAgents.length,
        workingCount: floorAgents.filter((a) => a.status === 'working').length,
        isSelected,
        agents: floorAgents,
      });
    });

    const total = floors.length;
    floors.forEach((f, i) => {
      f.floorNumber = total - i;
    });

    return floors;
  }

  /** Seleciona o andar ativo no elevador, trocando tema e departamentos no escritório! */
  selectFloor(floorId: string, snap?: OfficeSnapshot): BuildingFloorInfo | undefined {
    const floors = this.getBuildingFloors(snap);
    const target = floors.find((f) => f.id === floorId);
    if (!target) return undefined;

    this.selectedFloorId = target.id;

    // Atualiza departamentos reais para que cada andar tenha salas e disposição diferentes!
    const base = join(homedir(), '.gemini', 'antigravity', 'scratch');
    const deptA = join(base, target.departments[0]);
    const deptB = join(base, target.departments[1]);

    // Move os agentes para as novas salas exclusivas deste andar (preservando aparência/roupas!)
    TEAM_MEMBERS.forEach((member, idx) => {
      const targetCwd = idx % 2 === 0 ? deptA : deptB;
      this.office.moveMainRoom(member.id, targetCwd);
      this.office.setStatus(member.id, idx === 2 || idx === 4 ? 'idle' : 'working');
    });

    this.office.addActivity('ag_vicente', {
      id: `act_floor_${Date.now()}`,
      kind: 'think',
      text: `Chegamos no ${target.floorNumber}º Andar · ${target.companyName} (${target.styleLabel})`,
      at: Date.now(),
    });

    return this.getBuildingFloors(snap).find((f) => f.id === floorId);
  }

  private scanSessions(): void {
    if (!existsSync(this.brainDir)) return;

    try {
      const entries = readdirSync(this.brainDir, { withFileTypes: true });
      const candidates: { id: string; file: string; mtime: number }[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const transcriptFile = join(this.brainDir, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
        if (existsSync(transcriptFile)) {
          try {
            const st = statSync(transcriptFile);
            candidates.push({ id: entry.name, file: transcriptFile, mtime: st.mtimeMs });
          } catch {
            // ignore
          }
        }
      }

      candidates.sort((a, b) => b.mtime - a.mtime);
      const top = candidates.slice(0, 6);
      const updatedFloors: MonitoredSession[] = [];

      top.forEach((cand, idx) => {
        let sess = this.sessions.get(cand.id);
        if (!sess) {
          const meta = inferCompanyMeta(cand.id, cand.file, idx);
          sess = {
            id: cand.id,
            transcriptFile: cand.file,
            lastReadByte: 0,
            cwd: meta.cwd,
            companyName: meta.companyName,
            subtitle: meta.subtitle,
            mtimeMs: cand.mtime,
            tokensIn: 0,
            tokensOut: 0,
            toolCalls: 0,
          };
          this.sessions.set(cand.id, sess);
          if (idx === 0) this.attachLiveTail(sess);
        } else {
          sess.mtimeMs = cand.mtime;
        }
        updatedFloors.push(sess);
      });

      this.discoveredFloors = updatedFloors;
      if (!this.selectedFloorId && updatedFloors[0]) {
        this.selectedFloorId = `floor_${updatedFloors[0].id}`;
      }
    } catch (err: any) {
      log.warn(`[antigravity] Erro ao varrer sessões/andares: ${err.message}`);
    }
  }

  private attachLiveTail(session: MonitoredSession): void {
    try {
      session.lastReadByte = statSync(session.transcriptFile).size;
    } catch {
      session.lastReadByte = 0;
    }

    watchFile(session.transcriptFile, { interval: 350 }, (curr, prev) => {
      if (curr.size !== prev.size || curr.mtimeMs !== prev.mtimeMs) {
        session.mtimeMs = curr.mtimeMs;
        this.readNewTranscriptLines(session);
      }
    });
  }

  private readNewTranscriptLines(session: MonitoredSession): void {
    if (!existsSync(session.transcriptFile)) return;
    try {
      const st = statSync(session.transcriptFile);
      if (st.size < session.lastReadByte) session.lastReadByte = 0;
      const bytesToRead = st.size - session.lastReadByte;
      if (bytesToRead <= 0) return;

      const fd = openSync(session.transcriptFile, 'r');
      const buf = Buffer.alloc(bytesToRead);
      readSync(fd, buf, 0, bytesToRead, session.lastReadByte);
      closeSync(fd);
      session.lastReadByte = st.size;

      const lines = buf.toString('utf8').split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          this.processEvent(session, JSON.parse(line));
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      log.warn(`[antigravity] Erro ao ler transcript: ${err.message}`);
    }
  }

  private processEvent(session: MonitoredSession, item: any): void {
    if (item.input_tokens) session.tokensIn += item.input_tokens;
    if (item.output_tokens) session.tokensOut += item.output_tokens;

    if (item.type === 'USER_INPUT' && item.content) {
      const clean = item.content.replace(/<[^>]*>/g, '').trim().split('\n')[0];
      if (clean) {
        session.subtitle = clean.slice(0, 68);
        this.office.setStatus('ag_vicente', 'working');
        this.office.addActivity('ag_vicente', {
          id: `act_${Date.now()}_prompt`,
          kind: 'prompt',
          text: clean.slice(0, 120),
          at: Date.now(),
        });
      }
      return;
    }

    if (item.tool_calls && Array.isArray(item.tool_calls) && item.tool_calls.length > 0) {
      for (const tool of item.tool_calls) {
        session.toolCalls++;
        const toolName = String(tool.name || '');
        const args = tool.args || {};

        let targetAgent = 'ag_dev';
        let kind: Activity['kind'] = 'run';
        let desc = toolName;

        if (toolName === 'run_command') {
          const cmd = String(args.toolSummary || args.CommandLine || 'terminal');
          targetAgent = /test|qa|check|audit/i.test(cmd) ? 'ag_qa' : /audio|tts|voice/i.test(cmd) ? 'ag_fx' : 'ag_dev';
          kind = 'run';
          desc = cmd;
        } else if (toolName === 'write_file' || toolName === 'edit_file') {
          const file = basename(String(args.Path || 'arquivo'));
          if (/css|theme|style|furniture|art|character/i.test(file)) targetAgent = 'ag_art';
          else if (/layout|building|room|sidebar|topbar/i.test(file)) targetAgent = 'ag_ux';
          else if (/voice|tts|audio|sound|synth/i.test(file)) targetAgent = 'ag_fx';
          else if (/life/i.test(file)) targetAgent = 'ag_user';
          else targetAgent = 'ag_dev';
          kind = 'edit';
          desc = `Editando ${file}`;
        } else if (toolName === 'read_file' || toolName === 'search_web' || toolName.includes('docs')) {
          const file = args.Path ? basename(String(args.Path)) : '';
          targetAgent = /css|art|furniture|character/i.test(file) ? 'ag_art' : 'ag_vicente';
          kind = 'search';
          desc = args.query ? `Pesquisando: ${args.query}` : `Lendo ${file || 'código'}`;
        } else if (toolName === 'ask_question') {
          targetAgent = 'ag_user';
          kind = 'ask';
          desc = String(args.questions?.[0]?.question || 'Alinhando decisão com o fundador');
        } else if (toolName === 'invoke_subagent') {
          targetAgent = 'ag_qa';
          kind = 'run';
          desc = `Acionando especialista: ${args.Role || args.TypeName || 'Browser QA'}`;
        }

        this.office.setStatus(targetAgent, 'working');
        this.office.addActivity(targetAgent, {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind,
          text: desc.slice(0, 130),
          at: Date.now(),
        });
      }
    }

    if (item.status === 'DONE' && item.source === 'MODEL' && (!item.tool_calls || item.tool_calls.length === 0)) {
      this.office.setStatus('ag_qa', 'working');
      this.office.addActivity('ag_qa', {
        id: `act_${Date.now()}_qa_done`,
        kind: 'run',
        text: 'Etapa revisada e validada no Gate de QA',
        at: Date.now(),
      });
      this.office.setStatus('ag_release', 'working');
      this.office.addActivity('ag_release', {
        id: `act_${Date.now()}_rel_done`,
        kind: 'run',
        text: 'Atualização pronta e publicada no andar ativo',
        at: Date.now(),
      });
    }
  }
}
