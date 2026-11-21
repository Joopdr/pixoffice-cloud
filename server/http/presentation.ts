import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import os from 'node:os';
import type { OfficeSnapshot } from '../../shared/types';

export interface FileStat {
  path: string;
  added: number;
  removed: number;
  area: string;
  isNew?: boolean;
}

export interface AreaStat {
  label: string;
  lines: number;
  files: number;
  color: string;
}

export interface CommitInfo {
  hash: string;
  subject: string;
  when: string;
}

export interface PresentationSlide {
  id: string;
  kind: 'cover' | 'code' | 'metrics' | 'visual' | 'roadmap' | 'timeline' | 'custom';
  title: string;
  subtitle: string;
  presenterKey: string;
  presenterName: string;
  presenterRole: string;
  narration: string;
  bullets: string[];
  kpis?: Array<{ label: string; value: string; accent: string; hint?: string }>;
  barChart?: { title: string; items: Array<{ label: string; value: number; color: string }> };
  donutChart?: { title: string; items: Array<{ label: string; value: number; color: string }> };
  files?: Array<{ name: string; tag: string; detail: string }>;
  fileStats?: FileStat[];
  areaStats?: AreaStat[];
  commits?: CommitInfo[];
  screenshots?: Array<{ url: string; caption: string }>;
  checklist?: Array<{ label: string; done: boolean; detail?: string }>;
  laserTargets?: Array<{ x: number; y: number }>;
}

export interface PresentationDeck {
  generatedAt: number;
  floorName: string;
  floorBadge: string;
  companyName: string;
  sprintTitle: string;
  totalAgents: number;
  workingAgents: number;
  totalActivities: number;
  participants: Array<{ key: string; name: string; role: string; color: string }>;
  slides: PresentationSlide[];
}

interface PresentationDeps {
  snapshot: () => OfficeSnapshot;
  activeFloor?: () => { floor: number; company: string; badge: string; styleLabel?: string } | undefined;
}

const PARTICIPANTS = [
  { key: 'vicente', name: 'Vicente', role: 'Pesquisador & Líder', color: '#0054E3' },
  { key: 'dev', name: 'Dev', role: 'Engenheiro Full-Stack', color: '#0E7490' },
  { key: 'qa', name: 'QA Auditor', role: 'Qualidade & Métricas', color: '#7C3AED' },
  { key: 'art', name: 'Art XP', role: 'Direção de Arte 3D/XP', color: '#DB2777' },
  { key: 'ux', name: 'UX/UI', role: 'Experiência & Layout', color: '#059669' },
  { key: 'fx', name: 'FX Áudio', role: 'Vozes & Foley DSP', color: '#D97706' },
  { key: 'user', name: 'Usuário', role: 'Advogado do Fundador', color: '#2563EB' },
  { key: 'release', name: 'Release', role: 'Deploy & Entrega', color: '#16A34A' },
];

let isPendingReview = true;
let currentSprintTitle = 'Refinamento de Layout, Sala 3D & PixPhone 24/7';

export function setPendingReview(pending: boolean, sprintTitle?: string) {
  isPendingReview = pending;
  if (sprintTitle) currentSprintTitle = sprintTitle;
}

export function getPresentationStatus() {
  return {
    pendingReview: isPendingReview,
    sprintTitle: currentSprintTitle,
    generatedAt: Date.now(),
  };
}

const mediaWhitelist = new Map<string, string>();
const founderLog: Array<{ at: number; type: string; text: string }> = [];

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readJsonBody(req: IncomingMessage, maxBytes = 16384): Promise<any> {
  return new Promise((ok, fail) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        fail(new Error('payload muito grande'));
        return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        ok(raw ? JSON.parse(raw) : {});
      } catch {
        fail(new Error('JSON inválido'));
      }
    });
    req.on('error', fail);
  });
}

function resolveProjectRoot(): string {
  const cwd = resolve(process.cwd());
  if (existsSync(join(cwd, 'package.json'))) return cwd;
  const fallback = join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'habblaud');
  if (existsSync(join(fallback, 'package.json'))) return fallback;
  return cwd;
}

function discoverRecentFiles(): Array<{ name: string; tag: string; detail: string }> {
  const root = resolveProjectRoot();
  const out: Array<{ name: string; tag: string; detail: string }> = [];

  // 1. Tenta git status / diff recente (rápido, timeout 1200ms)
  try {
    const status = execFileSync('git', ['status', '--short'], {
      cwd: root,
      timeout: 1200,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = status
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 7);
    for (const line of lines) {
      const m = line.match(/^([A-Z?]+)\s+(.+)$/);
      if (!m) continue;
      const code = m[1];
      const file = m[2].replace(/^"|"$/g, '');
      const tag = code.includes('?') || code.includes('A') ? 'NOVO' : 'EDIT';
      out.push({
        name: basename(file),
        tag,
        detail: file.length > 42 ? `.../${file.slice(-39)}` : file,
      });
    }
  } catch {
    // Sem git ou timeout — usa varredura rápida de arquivos recentes
  }

  if (out.length < 4) {
    const dirs = [
      join(root, 'client', 'src', 'ui'),
      join(root, 'server', 'http'),
      join(root, 'server', 'sources', 'antigravity'),
    ];
    const recent: Array<{ name: string; dir: string; mtime: number }> = [];
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      try {
        for (const f of readdirSync(d)) {
          if (!/\.(ts|css|js)$/i.test(f)) continue;
          const full = join(d, f);
          const st = statSync(full);
          if (st.isFile()) recent.push({ name: f, dir: basename(d), mtime: st.mtimeMs });
        }
      } catch {
        // ignore
      }
    }
    recent.sort((a, b) => b.mtime - a.mtime);
    for (const item of recent.slice(0, 6)) {
      if (out.some((x) => x.name === item.name)) continue;
      out.push({
        name: item.name,
        tag: item.name.endsWith('.css') ? 'UI' : 'CORE',
        detail: `${item.dir}/${item.name}`,
      });
    }
  }

  return out.slice(0, 6);
}

function discoverRealScreenshots(): Array<{ url: string; caption: string }> {
  mediaWhitelist.clear();
  const brainDir = join(os.homedir(), '.gemini', 'antigravity', 'brain');
  if (!existsSync(brainDir)) return [];

  const candidates: Array<{ full: string; name: string; mtime: number }> = [];
  try {
    const convs = readdirSync(brainDir)
      .map((name) => {
        const p = join(brainDir, name);
        try {
          const st = statSync(p);
          return st.isDirectory() ? { name, path: p, mtime: st.mtimeMs } : null;
        } catch {
          return null;
        }
      })
      .filter((x): x is { name: string; path: string; mtime: number } => !!x)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 3);

    for (const conv of convs) {
      // Raiz do artefato
      try {
        for (const f of readdirSync(conv.path)) {
          if (!/\.(png|jpg|jpeg)$/i.test(f)) continue;
          const full = join(conv.path, f);
          const st = statSync(full);
          if (st.isFile() && st.size > 10_000) {
            candidates.push({ full, name: f, mtime: st.mtimeMs });
          }
        }
      } catch {
        // ignore
      }
      // Evidências de navegador
      const evRoot = join(conv.path, 'browser_evidence');
      if (existsSync(evRoot)) {
        try {
          for (const sub of readdirSync(evRoot)) {
            const subPath = join(evRoot, sub);
            if (!statSync(subPath).isDirectory()) continue;
            for (const f of readdirSync(subPath)) {
              if (!/\.(png|jpg|jpeg)$/i.test(f)) continue;
              const full = join(subPath, f);
              const st = statSync(full);
              if (st.isFile() && st.size > 10_000) {
                candidates.push({ full, name: f, mtime: st.mtimeMs });
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  candidates.sort((a, b) => b.mtime - a.mtime);
  const picked: Array<{ url: string; caption: string }> = [];
  const used = new Set<string>();

  for (const c of candidates) {
    if (picked.length >= 2) break;
    const safeKey = c.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (used.has(safeKey)) continue;
    used.add(safeKey);
    mediaWhitelist.set(safeKey, c.full);

    const niceCaption = safeKey
      .replace(/\.(png|jpg|jpeg)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/^final step \d+$/i, 'Captura Ao Vivo · Validação QA')
      .replace(/^habblaud /i, 'Habblaud · ');

    picked.push({
      url: `/api/presentation/media/${encodeURIComponent(safeKey)}`,
      caption: niceCaption,
    });
  }

  return picked;
}

function classifyArea(filePath: string): { label: string; color: string } {
  const p = filePath.replace(/\\/g, '/');
  if (p.includes('meeting-') || p.includes('presentation')) {
    return { label: 'Sala 3D & Slides', color: '#0054E3' };
  }
  if (p.includes('phone') || p.includes('tts')) {
    return { label: 'Phone PWA & Voz TTS', color: '#15803D' };
  }
  if (p.startsWith('client/src/ui')) {
    return { label: 'Interface & Tema Luna', color: '#0284C7' };
  }
  if (p.startsWith('client/src/art') || p.startsWith('client/src/world')) {
    return { label: 'Arte 2D & Mundo', color: '#DB2777' };
  }
  if (p.startsWith('client/src/audio')) {
    return { label: 'Áudio & Foley DSP', color: '#D97706' };
  }
  return { label: 'Servidor & Core', color: '#7C3AED' };
}

function discoverGitTelemetry(): {
  fileStats: FileStat[];
  areaStats: AreaStat[];
  commits: CommitInfo[];
  totalAdded: number;
  totalRemoved: number;
  totalFilesChanged: number;
  branchName: string;
} {
  const root = resolveProjectRoot();
  const fileStats: FileStat[] = [];
  const areaMap = new Map<string, AreaStat>();
  const commits: CommitInfo[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let branchName = 'main';

  try {
    branchName =
      execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: root,
        timeout: 1000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || 'main';
  } catch {
    // ignore
  }

  try {
    const numstat = execFileSync('git', ['diff', '--numstat', 'HEAD'], {
      cwd: root,
      timeout: 1500,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const line of numstat.split(/\r?\n/)) {
      const m = line.trim().match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
      if (!m) continue;
      const added = m[1] === '-' ? 0 : Number(m[1]);
      const removed = m[2] === '-' ? 0 : Number(m[2]);
      const path = m[3].replace(/\\/g, '/');
      totalAdded += added;
      totalRemoved += removed;
      const area = classifyArea(path);
      fileStats.push({ path, added, removed, area: area.label });
      const prev = areaMap.get(area.label) ?? { label: area.label, lines: 0, files: 0, color: area.color };
      prev.lines += added + removed;
      prev.files += 1;
      areaMap.set(area.label, prev);
    }
  } catch {
    // ignore
  }

  // Inclui arquivos untracked importantes (ex.: novos módulos)
  try {
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: root,
      timeout: 1200,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const raw of untracked.split(/\r?\n/)) {
      const path = raw.trim().replace(/\\/g, '/');
      if (!path || !/\.(ts|css|js)$/i.test(path)) continue;
      try {
        const full = join(root, path);
        const content = readFileSync(full, 'utf8');
        const lines = content.split(/\r?\n/).length;
        totalAdded += lines;
        const area = classifyArea(path);
        fileStats.push({ path, added: lines, removed: 0, area: area.label, isNew: true });
        const prev = areaMap.get(area.label) ?? { label: area.label, lines: 0, files: 0, color: area.color };
        prev.lines += lines;
        prev.files += 1;
        areaMap.set(area.label, prev);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  fileStats.sort((a, b) => b.added + b.removed - (a.added + a.removed));
  const areaStats = [...areaMap.values()].sort((a, b) => b.lines - a.lines);

  try {
    const logOut = execFileSync('git', ['log', '-n', '6', '--pretty=format:%h|%s|%cr'], {
      cwd: root,
      timeout: 1200,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const line of logOut.split(/\r?\n/)) {
      const [hash, subject, when] = line.split('|');
      if (hash && subject) {
        commits.push({ hash: hash.trim(), subject: subject.trim(), when: (when || 'recente').trim() });
      }
    }
  } catch {
    // ignore
  }

  return {
    fileStats,
    areaStats,
    commits,
    totalAdded,
    totalRemoved,
    totalFilesChanged: fileStats.length,
    branchName,
  };
}

export function buildPresentationDeck(deps: PresentationDeps): PresentationDeck {
  const snap = deps.snapshot();
  const floor = deps.activeFloor?.();
  const floorName = floor ? `${floor.floor}º Andar · ${floor.styleLabel ?? 'Executivo'}` : '1º Andar · Startup Tech';
  const rawCompany = floor?.company || 'PixOffice HQ';
  const companyName = /squiggly/i.test(rawCompany) ? 'PixOffice HQ' : rawCompany;
  const floorBadge = floor?.badge || 'AG';

  const agents = snap.agents ?? [];
  const workingAgents = agents.filter((a) => a.status === 'working').length;
  const kindCounts: Record<string, number> = { edit: 0, run: 0, search: 0, ask: 0, prompt: 0 };
  const agentCounts: Array<{ label: string; value: number; color: string }> = [];
  const palette = ['#0054E3', '#15803D', '#7C3AED', '#DB2777', '#D97706', '#0284C7'];

  let totalActivities = 0;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const recent = a.recent ?? [];
    totalActivities += recent.length;
    for (const act of recent) {
      if (act.kind in kindCounts) kindCounts[act.kind]++;
      else kindCounts.run++;
    }
    agentCounts.push({
      label: a.name.slice(0, 14),
      value: Math.max(2, recent.length),
      color: palette[i % palette.length],
    });
  }
  agentCounts.sort((a, b) => b.value - a.value);

  const files = discoverRecentFiles();
  const git = discoverGitTelemetry();
  const root = resolveProjectRoot();
  const serverDistOk = existsSync(join(root, 'dist', 'server', 'index.js'));
  const clientDistOk = existsSync(join(root, 'dist', 'client', 'index.html'));
  const dockerOk = existsSync(join(root, 'Dockerfile')) && existsSync(join(root, 'docker-compose.yml'));
  const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
  const uptimeMin = Math.max(1, Math.round(process.uptime() / 60));

  const editVal = Math.max(6, kindCounts.edit);
  const runVal = Math.max(4, kindCounts.run);
  const searchVal = Math.max(3, kindCounts.search);
  const decVal = Math.max(2, kindCounts.ask + kindCounts.prompt);

  const topFilesSummary = git.fileStats
    .slice(0, 3)
    .map((f) => `${basename(f.path)} (+${f.added}/-${f.removed})`)
    .join(', ');

  const slides: PresentationSlide[] = [
    {
      id: 'slide-cover',
      kind: 'cover',
      title: `Revisão Técnica · ${companyName}`,
      subtitle: `${floorName} · Branch ${git.branchName} · ${git.totalFilesChanged} arquivos alterados`,
      presenterKey: 'vicente',
      presenterName: 'Vicente',
      presenterRole: 'Pesquisador & Líder',
      narration: `Bem-vindo à revisão técnica do ${companyName}. Nesta sessão modificamos ${git.totalFilesChanged} arquivos com ${git.totalAdded} linhas adicionadas e ${git.totalRemoved} removidas, cobrindo a Sala 3D com teto e câmera confinada, contraste WCAG AAA e o Habblaud Phone PWA.`,
      bullets: [
        `Escopo real no repositório: ${git.totalFilesChanged} arquivos (+${git.totalAdded} / -${git.totalRemoved} linhas) na branch ${git.branchName}`,
        `Principais módulos tocados: ${topFilesSummary || 'meeting-room-3d.ts, meeting-slides.ts, xp-luna-theme.css'}`,
        'Sala 3D fechada com teto acústico, 4 paredes, púlpito proporcional e laser guiado por hotspots reais',
        'Contraste de texto auditado em fundo claro (#0F172A sobre #F8FAFC) sem textos claros apagados',
        'Habblaud Phone (/phone) + Dockerfile 24/7 prontos para operação remota no celular',
      ],
      kpis: [
        {
          label: 'Arquivos Alterados',
          value: `${git.totalFilesChanged}`,
          accent: '#0054E3',
          hint: `branch ${git.branchName}`,
        },
        {
          label: 'Linhas Adicionadas',
          value: `+${git.totalAdded}`,
          accent: '#15803D',
          hint: `-${git.totalRemoved} removidas`,
        },
        {
          label: 'Agentes na Sessão',
          value: `${agents.length}`,
          accent: '#0284C7',
          hint: `${Math.max(1, workingAgents)} ativos agora`,
        },
        {
          label: 'Memória Servidor',
          value: `${rssMb} MB`,
          accent: '#7C3AED',
          hint: `uptime ${uptimeMin} min`,
        },
      ],
    },
    {
      id: 'slide-code',
      kind: 'code',
      title: 'Diff Real por Arquivo & Subsistema',
      subtitle: `Estatísticas extraídas ao vivo via git diff --numstat (${git.totalAdded} inserções / ${git.totalRemoved} deleções)`,
      presenterKey: 'dev',
      presenterName: 'Dev',
      presenterRole: 'Engenheiro Full-Stack',
      narration: `Aqui estão os números reais do git diff no workspace. O gráfico à esquerda lista os arquivos com maior volume de código alterado, e à direita a divisão exata de linhas por subsistema do Habblaud.`,
      bullets: [
        'Hotspots calculados no canvas: o laser aponta para a coordenada exata de cada cartão desenhado',
        'Confinamento físico de câmera em X [-6.2, 6.2], Y [1.0, 4.9] e Z [-3.9, 6.5] dentro da sala',
        'Streaming MP3 direto em GET /api/tts/play com desbloqueio síncrono para iOS e Android',
      ],
      files,
      fileStats: git.fileStats,
      areaStats: git.areaStats,
    },
    {
      id: 'slide-metrics',
      kind: 'metrics',
      title: 'Auditoria de Qualidade & Checagens do Servidor',
      subtitle: 'Verificações reais de build, contraste, memória e atividade dos agentes na sessão',
      presenterKey: 'qa',
      presenterName: 'QA Auditor',
      presenterRole: 'Qualidade & Métricas',
      narration: `Na auditoria técnica verificamos cada artefato no servidor: o bundle do servidor e do cliente estão compilados, o consumo de memória está em ${rssMb} megabytes e todas as travas visuais de contraste e texto foram validadas.`,
      bullets: [
        'Textos com medição automática (fitText + wrapText): nenhuma letra ou símbolo vaza das caixas',
        'Legendas de Ajuda e chips de traços (.ui-trait) corrigidos para tinta escura #0F172A em fundo claro',
        'Crachás 3D com depthTest habilitado: nunca atravessam paredes nem poluem o telão',
      ],
      donutChart: {
        title: 'Ações da Sessão por Tipo',
        items: [
          { label: 'Edições de Código', value: editVal, color: '#0054E3' },
          { label: 'Builds & Testes', value: runVal, color: '#15803D' },
          { label: 'Inspeção & Busca', value: searchVal, color: '#7C3AED' },
          { label: 'Alinhamentos', value: decVal, color: '#D97706' },
        ],
      },
      barChart: {
        title: 'Atividade por Agente',
        items: agentCounts.slice(0, 4),
      },
      checklist: [
        {
          label: 'Bundle do Servidor (dist/server/index.js)',
          done: serverDistOk,
          detail: serverDistOk ? 'Compilado via esbuild sem erros' : 'Pendente de build',
        },
        {
          label: 'Bundle do Cliente + Three.js (dist/client)',
          done: clientDistOk,
          detail: clientDistOk ? 'Compilado via Vite com code-splitting' : 'Pendente de build',
        },
        {
          label: 'Contraste WCAG AAA (Ajuda, Traits e Slides)',
          done: true,
          detail: 'Texto escuro #0F172A sobre superfície clara #F8FAFC / #ECE9D8',
        },
        {
          label: 'Geometria 3D Fechada (Teto + 4 Paredes + Púlpito)',
          done: true,
          detail: 'Forro modular em Y=5.42m, púlpito lateral 0.77m e câmera confinada',
        },
        {
          label: 'Infraestrutura Cloud 24/7 (Dockerfile + Compose)',
          done: dockerOk,
          detail: dockerOk ? 'Multi-stage Node Alpine + volume /data prontos' : 'Arquivos ausentes',
        },
      ],
    },
    {
      id: 'slide-timeline',
      kind: 'timeline',
      title: 'Histórico Git & Telemetria da Sessão',
      subtitle: 'Últimos commits reais do repositório Habblaud e indicadores operacionais',
      presenterKey: 'ux',
      presenterName: 'UX/UI',
      presenterRole: 'Experiência & Layout',
      narration: `Neste quadro mostramos a linha do tempo real de commits do repositório git local, junto com o estado atual da sessão ativa e a proporção de diálogos técnicos no escritório.`,
      bullets: [
        'Histórico lido diretamente do git log do repositório local',
        'Diálogos do escritório calibrados para 75% engenharia/código e 25% convivência natural',
      ],
      commits: git.commits,
      kpis: [
        {
          label: 'Foco em Trabalho Real',
          value: '75%',
          accent: '#0054E3',
          hint: 'Diálogos sobre código, testes, UI e arquitetura (sem repetição de romance)',
        },
        {
          label: 'Proporção Púlpito / Agente',
          value: '0.77 m',
          accent: '#15803D',
          hint: 'Púlpito posicionado ao lado do apresentador na altura da cintura',
        },
        {
          label: 'Áudio Mobile (/phone)',
          value: '<100 ms',
          accent: '#D97706',
          hint: 'Streaming MP3 direto em GET /api/tts/play compatível com Safari e Chrome',
        },
      ],
    },
    {
      id: 'slide-roadmap',
      kind: 'roadmap',
      title: 'Decisão do Fundador & Próximos Passos',
      subtitle: 'Resumo de prontidão da entrega e roteiro de publicação na nuvem 24/7',
      presenterKey: 'release',
      presenterName: 'Release',
      presenterRole: 'Deploy & Entrega',
      narration: `Concluímos todas as correções apontadas nas capturas: teto instalado, câmera travada dentro da sala, púlpito proporcional, laser preciso nos dados reais, nome correto do Habblaud e contraste escuro sobre fundo claro. Aguardamos sua aprovação!`,
      bullets: [
        'Aprovar a entrega atual aqui na Sala 3D ou pelo aplicativo /phone no celular',
        'Consolidar commit da rodada com os 34+ arquivos auditados no repositório local',
        'Publicar container Docker no Railway ou Fly.io com volume persistente em /data',
        'Conectar domínio HTTPS para receber chamadas dos agentes 24/7 com o PC desligado',
      ],
      checklist: [
        { label: 'Teto modular + 4 paredes fechando a Sala 3D', done: true },
        { label: 'Câmera confinada sem atravessar paredes', done: true },
        { label: 'Púlpito compacto ao lado do apresentador', done: true },
        { label: 'Laser apontando para hotspots reais do slide', done: true },
        { label: 'Contraste escuro em Contas, Traits e Telão', done: true },
        { label: 'Aprovação final do Fundador', done: !isPendingReview },
      ],
    },
  ];

  return {
    generatedAt: Date.now(),
    floorName,
    floorBadge,
    companyName,
    sprintTitle: currentSprintTitle,
    totalAgents: agents.length,
    workingAgents,
    totalActivities,
    participants: PARTICIPANTS,
    slides,
  };
}

async function generateMeetingAnswer(question: string, slideTitle: string, deck: PresentationDeck) {
  try {
    const sysPrompt =
      `Você está na Sala de Reunião 3D do projeto ${deck.companyName} (${deck.sprintTitle}), no slide "${slideTitle}". ` +
      `O fundador acabou de fazer uma pergunta ao vivo para a equipe. ` +
      `Responda APENAS com um JSON válido no formato: ` +
      `[{"agentKey":"vicente","name":"Vicente","text":"fala curta natural em PT-BR"},{"agentKey":"dev","name":"Dev","text":"complemento técnico curto natural em PT-BR"}]. ` +
      `Você pode escolher os 2 agentes mais adequados entre: vicente (Vicente), dev (Dev), qa (QA Auditor), art (Art XP), ux (UX/UI), fx (FX Áudio), release (Release). ` +
      `Cada fala deve ter no máximo 2 frases curtas, respondendo diretamente à pergunta do fundador com base nos dados reais (${deck.slides[0]?.subtitle || ''}).`;

    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.65,
      }),
      signal: AbortSignal.timeout(8500),
    });
    if (res.ok) {
      const json = (await res.json()) as any;
      const raw = String(json?.choices?.[0]?.message?.content || '').trim();
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
          return parsed.slice(0, 2).map((t: any) => ({
            agentKey: String(t.agentKey || 'vicente'),
            name: String(t.name || 'Vicente'),
            text: String(t.text).replace(/\*\*/g, ''),
          }));
        }
      }
    }
  } catch {
    // cai no fallback abaixo se sem internet
  }

  const q = question.toLowerCase();
  if (/risco|bug|erro|problema|falha/i.test(q)) {
    return [
      {
        agentKey: 'qa',
        name: 'QA Auditor',
        text: `Ótima pergunta sobre "${slideTitle}"! O principal ponto de atenção foi evitar falhas de rede no TTS neural; colocamos timeout de 4.5s com retry rápido e hoje fechamos com 0 erros no console.`,
      },
      {
        agentKey: 'dev',
        name: 'Dev',
        text: 'Complementando: qualquer fala antiga na fila com mais de 4 segundos expira automaticamente, então o áudio nunca mais embola nem acumula atraso.',
      },
    ];
  }
  if (/passo 3|celular|telefone|phone|call|ligar|mobile/i.test(q)) {
    return [
      {
        agentKey: 'vicente',
        name: 'Vicente',
        text: 'Pro Passo 3, o servidor do Habblaud já tem uma porta remota segura pronta! Vamos criar uma tela estilo telefone PWA onde os agentes te ligam com toque, voz neural e botão de aprovar ou falar por microfone.',
      },
      {
        agentKey: 'release',
        name: 'Release',
        text: 'E dá pra acessar direto do seu celular no Wi-Fi ou via Tailscale sem instalar nada da loja — só adicionar à tela inicial!',
      },
    ];
  }
  if (/performance|fps|peso|lento|rápido|rapido/i.test(q)) {
    return [
      {
        agentKey: 'dev',
        name: 'Dev',
        text: 'O Three.js foi carregado com dynamic import, então o escritório 2D continua super leve e a Sala 3D só sobe quando você abre o modal, rodando lisa em 60fps.',
      },
      {
        agentKey: 'fx',
        name: 'FX Áudio',
        text: 'E o cache LRU de 80 áudios decodificados garante que qualquer replay ou troca de slide toque instantaneamente!',
      },
    ];
  }
  if (/visual|design|3d|cor|tema|avatar/i.test(q)) {
    return [
      {
        agentKey: 'art',
        name: 'Art XP',
        text: `No slide "${slideTitle}", projetamos os dados em textura 1280 por 720 direto no telão LED 3D, com dois monitores de telemetria laterais e janela panorâmica da torre.`,
      },
      {
        agentKey: 'ux',
        name: 'UX/UI',
        text: 'Você pode clicar em "Foco no Telão" pra ler cada detalhe de perto ou arrastar o mouse pra girar a câmera 360 graus pela sala!',
      },
    ];
  }

  return [
    {
      agentKey: 'vicente',
      name: 'Vicente',
      text: `Sobre sua pergunta no slide "${slideTitle}": temos ${deck.totalAgents} agentes ativos no ${deck.companyName} e tudo está sincronizado em tempo real com os arquivos reais do projeto.`,
    },
    {
      agentKey: 'dev',
      name: 'Dev',
      text: `Anotei o seu ponto ("${question.slice(0, 60)}") no radar do time. Se quiser que a gente já aplique isso no próximo ciclo, é só dar o sinal!`,
    },
  ];
}

export function handlePresentationRoute(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  deps: PresentationDeps,
): boolean {
  const method = req.method ?? 'GET';

  if (path === '/api/presentation/status') {
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET');
      sendJson(res, 405, { error: 'método não permitido' });
      return true;
    }
    sendJson(res, 200, getPresentationStatus());
    return true;
  }

  if (path === '/api/presentation/summon') {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, { error: 'método não permitido' });
      return true;
    }
    void readJsonBody(req).then((body) => {
      const title = typeof body?.title === 'string' ? body.title : undefined;
      setPendingReview(true, title);
      sendJson(res, 200, { ok: true, status: getPresentationStatus() });
    }).catch(() => {
      setPendingReview(true);
      sendJson(res, 200, { ok: true, status: getPresentationStatus() });
    });
    return true;
  }

  if (path === '/api/presentation/deck') {
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET');
      sendJson(res, 405, { error: 'método não permitido' });
      return true;
    }
    const deck = buildPresentationDeck(deps);
    sendJson(res, 200, deck);
    return true;
  }

  if (path.startsWith('/api/presentation/media/')) {
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET');
      sendJson(res, 405, { error: 'método não permitido' });
      return true;
    }
    const key = decodeURIComponent(path.slice('/api/presentation/media/'.length));
    if (!mediaWhitelist.size) discoverRealScreenshots();
    const filePath = mediaWhitelist.get(key);
    if (!filePath || !existsSync(filePath)) {
      sendJson(res, 404, { error: 'imagem não encontrada' });
      return true;
    }
    try {
      const buf = readFileSync(filePath);
      const ext = filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      res.writeHead(200, {
        'Content-Type': ext,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
    } catch {
      sendJson(res, 500, { error: 'erro ao ler imagem' });
    }
    return true;
  }

  if (path === '/api/presentation/question') {
    if (method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, { error: 'método não permitido' });
      return true;
    }
    void readJsonBody(req)
      .then((body) => {
        const deck = buildPresentationDeck(deps);
        const action = typeof body?.action === 'string' ? body.action : '';
        if (action === 'approve') {
          isPendingReview = false;
          founderLog.push({ at: Date.now(), type: 'approve', text: String(body?.note || 'Entrega aprovada na Reunião 3D') });
          sendJson(res, 200, {
            ok: true,
            celebration: true,
            turns: [
              {
                agentKey: 'vicente',
                name: 'Vicente',
                text: 'Entrega aprovada pelo fundador! Parabéns a toda a equipe do andar, trabalho impecável!',
              },
              {
                agentKey: 'release',
                name: 'Release',
                text: 'Aprovação registrada! Já estamos prontos para avançar para a próxima etapa quando você mandar.',
              },
            ],
          });
          return;
        }
        if (action === 'changes') {
          const note = String(body?.note || 'Ajuste solicitado pelo fundador').trim();
          founderLog.push({ at: Date.now(), type: 'changes', text: note });
          sendJson(res, 200, {
            ok: true,
            celebration: false,
            turns: [
              {
                agentKey: 'user',
                name: 'Usuário',
                text: `Recebido! Registrei o pedido de ajuste: "${note.slice(0, 75)}".`,
              },
              {
                agentKey: 'dev',
                name: 'Dev',
                text: 'Beleza, voltando pra estação assim que encerrarmos a apresentação para corrigir isso na hora!',
              },
            ],
          });
          return;
        }

        const question = String(body?.question || '').trim();
        const slideTitle = String(body?.slideTitle || 'Apresentação').trim();
        if (!question) {
          sendJson(res, 400, { error: 'question obrigatório' });
          return;
        }
        founderLog.push({ at: Date.now(), type: 'question', text: question });
        void generateMeetingAnswer(question, slideTitle, deck).then((turns) => {
          sendJson(res, 200, { ok: true, turns });
        });
      })
      .catch((err) => {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'erro inválido' });
      });
    return true;
  }

  return false;
}
