// PixPhone PWA (/phone) — Sala de Bate-Papo Real da Equipe + Call de Voz em Tempo Real (/api/phone/*)
// Layout de Chat Real (estilo WhatsApp / Discord Voice Channel / Slack Huddle):
// - Input fixo no rodapé (nunca perde foco nem apaga o que você está digitando!)
// - Renderização incremental de mensagens (só anexa mensagens novas)
// - Call de Voz em Tempo Real bidirecional (Hands-Free contínuo + agentes entram falando quando precisam de você)
// - Fila de execução de código conectada à IA Real (Antigravity Bridge + Claude Code CLI + Gemini 2.5 Flash)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import os from 'node:os';
import type { OfficeSnapshot } from '../../shared/types';
import type { EmotionTag } from './tts';
import { setPendingReview } from './presentation';

export interface RemoteCodeTask {
  id: string;
  prompt: string;
  source: 'phone-ui' | 'phone-call';
  engine: 'antigravity-bridge' | 'claude-cli' | 'gemini-api';
  status: 'queued' | 'running' | 'building' | 'done' | 'failed';
  createdAt: number;
  updatedAt: number;
  summary: string;
  diffStat?: string;
}

export interface ChatMessage {
  id: string;
  seq: number;
  from: 'founder' | 'agent' | 'system';
  agentKey?: string;
  agentName?: string;
  agentRole?: string;
  avatar?: string;
  color?: string;
  text: string;
  emotion?: EmotionTag;
  at: number;
  taskBadge?: string;
  quickActions?: Array<{ id: string; label: string; style: 'approve' | 'deny' | 'neutral' }>;
}

export interface PhoneCall {
  id: string;
  direction: 'incoming' | 'outgoing';
  state: 'ringing' | 'connected' | 'ended';
  agentKey: string;
  agentName: string;
  agentRole: string;
  avatar: string;
  color: string;
  kind: 'permission' | 'question' | 'briefing' | 'delivery';
  title: string;
  message: string;
  emotion: EmotionTag;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  transcript: Array<{ from: 'agent' | 'founder'; text: string; at: number }>;
  quickActions: Array<{ id: string; label: string; style: 'approve' | 'deny' | 'neutral' }>;
  resolution?: string;
}

interface PhoneDeps {
  snapshot: () => OfficeSnapshot;
  port: number;
  activeFloor?: () => { floor: number; company: string; badge: string } | undefined;
}

const PHONE_DIRECTORY: Record<string, { key: string; name: string; role: string; avatar: string; color: string }> = {
  vicente: { key: 'vicente', name: 'Vicente', role: 'Pesquisador & Líder', avatar: 'V', color: '#2563EB' },
  dev: { key: 'dev', name: 'Dev', role: 'Engenheiro Full-Stack', avatar: 'D', color: '#0891B2' },
  qa: { key: 'qa', name: 'QA Auditor', role: 'Qualidade & Testes', avatar: 'Q', color: '#7C3AED' },
  art: { key: 'art', name: 'Art XP', role: 'Direção de Arte', avatar: 'A', color: '#DB2777' },
  ux: { key: 'ux', name: 'UX/UI', role: 'Experiência & Layout', avatar: 'U', color: '#059669' },
  fx: { key: 'fx', name: 'FX Áudio', role: 'Vozes & Foley', avatar: 'F', color: '#D97706' },
  user: { key: 'user', name: 'Usuário', role: 'Advogado do Fundador', avatar: 'S', color: '#4F46E5' },
  release: { key: 'release', name: 'Release', role: 'Deploy & Entrega', avatar: 'R', color: '#16A34A' },
};

let activeCall: PhoneCall | null = null;
const callHistory: PhoneCall[] = [];
let callSeq = 1;
let msgSeq = 1;

const chatRoomMessages: ChatMessage[] = [
  {
    id: 'msg-init-1',
    seq: msgSeq++,
    from: 'agent',
    agentKey: 'vicente',
    agentName: 'Vicente',
    agentRole: 'Pesquisador & Líder',
    avatar: 'V',
    color: '#2563EB',
    text: 'Sala de bate-papo do PixOffice conectada! Você pode digitar aqui embaixo a qualquer momento ou tocar em "Call em Tempo Real" no topo para conversarmos por voz.',
    emotion: 'warm',
    at: Date.now() - 30_000,
  },
  {
    id: 'msg-init-2',
    seq: msgSeq++,
    from: 'agent',
    agentKey: 'dev',
    agentName: 'Dev',
    agentRole: 'Engenheiro Full-Stack',
    avatar: 'D',
    color: '#0891B2',
    text: 'Se mandar qualquer melhoria ou tarefa de código por texto ou por voz, eu coloco na fila da IA Real, compilo o build e te chamo aqui na sala assim que terminar!',
    emotion: 'excited',
    at: Date.now() - 15_000,
  },
];

function pushAgentChatMessage(
  agentKey: string,
  text: string,
  opts: {
    emotion?: EmotionTag;
    taskBadge?: string;
    quickActions?: ChatMessage['quickActions'];
  } = {},
): ChatMessage {
  const dir = PHONE_DIRECTORY[agentKey] ?? PHONE_DIRECTORY.vicente;
  const msg: ChatMessage = {
    id: `msg-${Date.now()}-${msgSeq}`,
    seq: msgSeq++,
    from: 'agent',
    agentKey: dir.key,
    agentName: dir.name,
    agentRole: dir.role,
    avatar: dir.avatar,
    color: dir.color,
    text,
    emotion: opts.emotion ?? 'warm',
    at: Date.now(),
    taskBadge: opts.taskBadge,
    quickActions: opts.quickActions,
  };
  chatRoomMessages.push(msg);
  if (chatRoomMessages.length > 80) chatRoomMessages.splice(0, chatRoomMessages.length - 80);
  return msg;
}

function pushFounderChatMessage(text: string): ChatMessage {
  const msg: ChatMessage = {
    id: `msg-${Date.now()}-${msgSeq}`,
    seq: msgSeq++,
    from: 'founder',
    text,
    at: Date.now(),
  };
  chatRoomMessages.push(msg);
  if (chatRoomMessages.length > 80) chatRoomMessages.splice(0, chatRoomMessages.length - 80);
  return msg;
}

function resolveRepoRoot(): string {
  const cwd = resolve(process.cwd());
  if (existsSync(join(cwd, 'package.json'))) return cwd;
  const fallback = join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'habblaud');
  if (existsSync(join(fallback, 'package.json'))) return fallback;
  return cwd;
}

const TASKS_FILE = () => join(resolveRepoRoot(), '.pixphone-tasks.json');
const AI_KEY_FILE = () => join(resolveRepoRoot(), '.pixphone-ai-key.txt');

function loadRemoteTasks(): RemoteCodeTask[] {
  try {
    const f = TASKS_FILE();
    if (!existsSync(f)) return [];
    const data = JSON.parse(readFileSync(f, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveRemoteTasks(tasks: RemoteCodeTask[]): void {
  try {
    writeFileSync(TASKS_FILE(), JSON.stringify(tasks.slice(0, 25), null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function getGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY?.trim()) return process.env.GEMINI_API_KEY.trim();
  try {
    const f = AI_KEY_FILE();
    if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  } catch {
    // ignore
  }
  return '';
}

function pickSpecialistForMessage(text: string, preferredKey?: string): { key: string; name: string; role: string; avatar: string; color: string } {
  if (preferredKey && preferredKey !== 'all' && PHONE_DIRECTORY[preferredKey]) {
    return PHONE_DIRECTORY[preferredKey];
  }
  const lower = text.toLowerCase();
  if (/bug|erro|teste|qa|console|memória|memoria|travando/i.test(lower)) return PHONE_DIRECTORY.qa;
  if (/cor|contraste|layout|botão|botao|tela|css|design|visual|teto|púlpito|pulpito|3d/i.test(lower)) return PHONE_DIRECTORY.ux;
  if (/sprite|roupa|personagem|boneco|pixel|arte/i.test(lower)) return PHONE_DIRECTORY.art;
  if (/voz|áudio|audio|som|microfone|ligação|call|tts/i.test(lower)) return PHONE_DIRECTORY.fx;
  if (/nuvem|cloud|docker|deploy|tunnel|cloudflare|git|commit|subir/i.test(lower)) return PHONE_DIRECTORY.release;
  if (/código|codigo|função|funcao|criar|implementar|adicionar|mudar|alterar|fazer|refatorar|rota|api/i.test(lower)) return PHONE_DIRECTORY.dev;
  return PHONE_DIRECTORY.vicente;
}

function isActionableCodeRequest(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (lower.length < 10) return false;
  if (/^(oi|olá|ola|alô|alo|bom dia|boa tarde|boa noite|tudo bem|como tá|como ta|status|sim|não|nao|ok|aprovar|valeu|obrigado)$/i.test(lower)) {
    return false;
  }
  return /adicion|cria|muda|altera|conserta|corrig|ajust|implement|coloc|tira|remov|melhor|refator|atualiz|faz|fazer|quero que|preciso que/i.test(lower);
}

function getLiveRepoSummary(): string {
  const root = resolveRepoRoot();
  try {
    const diffStat = execFileSync('git', ['diff', '--shortstat', 'HEAD'], {
      cwd: root,
      timeout: 1000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const lastCommit = execFileSync('git', ['log', '-n', '1', '--pretty=format:%h - %s (%cr)'], {
      cwd: root,
      timeout: 1000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `${diffStat || 'Workspace limpo'} · Último commit: ${lastCommit}`;
  } catch {
    return 'Servidor PixOffice ativo na porta 4747';
  }
}

const AGENT_PERSONA_PROMPTS: Record<string, string> = {
  vicente:
    'Você é Vicente, Pesquisador e Líder Técnico do PixOffice HQ. Você tem visão estratégica, conhece toda a arquitetura (Node.js, TypeScript, Vite, Three.js, PixPhone PWA, Cloudflare Tunnel) e coordena os 8 agentes do andar com clareza e liderança.',
  dev:
    'Você é o Dev, Engenheiro Full-Stack do PixOffice HQ. Você fala de código real, TypeScript, esbuild, Vite, rotas HTTP, WebAudio, WebGL Three.js e performance com entusiasmo prático de quem está com a mão na massa.',
  qa:
    'Você é a QA Auditor, especialista em Qualidade, Testes e Acessibilidade WCAG AAA do PixOffice HQ. Você analisa bugs, contraste de cores, estabilidade, console zero-erros e memória.',
  art:
    'Você é a Art XP, Diretora de Arte Pixel 2D/2.5D e Windows XP Luna do PixOffice HQ. Você cuida de sprites, paletas, estética retrô-moderna e proporções visuais.',
  ux:
    'Você é a UX/UI, Designer de Experiência e Layout do PixOffice HQ. Você foca em ergonomia, legibilidade, câmeras da Sala 3D, responsividade mobile e zero poluição visual.',
  fx:
    'Você é o FX Áudio, Engenheiro de Som, Vozes Neurais PT-BR e Foley DSP do PixOffice HQ. Você cuida de síntese de voz, streaming MP3 no celular e efeitos sonoros.',
  user:
    'Você é o Usuário (Advogado do Fundador), focado em garantir que o PixOffice seja simples, rápido de usar e resolva a vida real do fundador.',
  release:
    'Você é o Release, Engenheiro de Deploy, Docker e Cloud 24/7 do PixOffice HQ. Você cuida de containers, Cloudflare Tunnel, Git, Railway/Fly.io e entregas em produção.',
};

async function askRealAiReply(
  agentName: string,
  agentRole: string,
  founderText: string,
  tasks: RemoteCodeTask[],
  agentKey = 'vicente',
  queuedTask?: RemoteCodeTask | null,
): Promise<string | null> {
  const repoInfo = getLiveRepoSummary();
  const recentTasks = tasks
    .slice(0, 3)
    .map((t) => `- [${t.status}] ${t.prompt} (${t.summary})`)
    .join('\n');
  const persona = AGENT_PERSONA_PROMPTS[agentKey] || `Você é ${agentName} (${agentRole}) do escritório PixOffice HQ.`;
  const taskNote = queuedTask
    ? `\nIMPORTANTE: O pedido do fundador acabou de ser registrado na fila real de código como tarefa "${queuedTask.prompt}". Confirme que você já colocou a mão na massa nisso!`
    : '';

  const sysPrompt =
    `${persona}\n` +
    `Você está conversando AO VIVO em tempo real na Sala de Bate-Papo e Call de Voz do PixPhone com o fundador do projeto.\n` +
    `Regras obrigatórias:\n` +
    `- Responda de verdade à pergunta ou comentário específico do fundador, nunca dê respostas genéricas ou engessadas.\n` +
    `- Fale em português brasileiro natural, humano, direto e conversacional (2 a 3 frases curtas, ótimo para ser ouvido em voz alta, sem blocos de código markdown nem asteriscos).\n` +
    `- Contexto real do repositório PixOffice agora: ${repoInfo}.\n` +
    `- Tarefas na fila de código: ${recentTasks || 'nenhuma no momento'}.${taskNote}`;

  // Histórico recente da sala para conversa contínua com memória real
  const historySlice = chatRoomMessages.slice(-8);

  // 1) Se o fundador configurou uma GEMINI_API_KEY própria, usa Gemini 2.5 Flash direto
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const contents = historySlice.map((m) => ({
        role: m.from === 'founder' ? 'user' : 'model',
        parts: [{ text: m.from === 'founder' ? m.text : `${m.agentName || agentName}: ${m.text}` }],
      }));
      if (!contents.length || contents[contents.length - 1].parts[0].text !== founderText) {
        contents.push({ role: 'user', parts: [{ text: founderText }] });
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
          }),
          signal: AbortSignal.timeout(7000),
        },
      );
      if (res.ok) {
        const json = (await res.json()) as any;
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text.replace(/\*\*/g, '');
      }
    } catch {
      // cai para o motor LLM Cloud Zero-Key abaixo
    }
  }

  // 2) Motor LLM Cloud Zero-Key (Ativo por padrão sem precisar configurar chave!)
  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: sysPrompt },
    ];
    for (const m of historySlice) {
      if (m.from === 'founder') {
        messages.push({ role: 'user', content: m.text });
      } else {
        messages.push({ role: 'assistant', content: `${m.agentName || agentName}: ${m.text}` });
      }
    }
    if (messages[messages.length - 1]?.content !== founderText) {
      messages.push({ role: 'user', content: founderText });
    }

    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        model: 'openai',
        messages,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) {
      const json = (await res.json()) as any;
      let text = String(json?.choices?.[0]?.message?.content || '').trim();
      // Remove prefixo "Vicente: " caso o modelo repita o próprio nome no início
      const prefixRe = new RegExp(`^${agentName}\\s*:\\s*`, 'i');
      text = text.replace(prefixRe, '').replace(/\*\*/g, '').trim();
      if (text) return text;
    }
  } catch {
    // fallback local caso sem internet
  }

  return null;
}

async function runGeminiAutonomousCodeAgent(task: RemoteCodeTask): Promise<void> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return;
  const root = resolveRepoRoot();

  const tools = [
    {
      functionDeclarations: [
        {
          name: 'list_files',
          description: 'Lista os arquivos de um diretório relativo do projeto PixOffice (ex: "client/src/ui" ou "server/http").',
          parameters: {
            type: 'OBJECT',
            properties: {
              dir: { type: 'STRING', description: 'Diretório relativo (ex: client/src/ui)' },
            },
            required: ['dir'],
          },
        },
        {
          name: 'read_file',
          description: 'Lê linhas de um arquivo relativo do projeto PixOffice.',
          parameters: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING', description: 'Caminho relativo (ex: client/src/ui/topbar.ts)' },
              startLine: { type: 'INTEGER', description: 'Linha inicial (1-based)' },
              endLine: { type: 'INTEGER', description: 'Linha final (inclusive)' },
            },
            required: ['path'],
          },
        },
        {
          name: 'edit_file',
          description: 'Substitui um trecho exato (target) por outro (replacement) em um arquivo do projeto PixOffice.',
          parameters: {
            type: 'OBJECT',
            properties: {
              path: { type: 'STRING', description: 'Caminho relativo do arquivo' },
              target: { type: 'STRING', description: 'Trecho exato atual no arquivo' },
              replacement: { type: 'STRING', description: 'Novo trecho que substituirá o target' },
            },
            required: ['path', 'target', 'replacement'],
          },
        },
        {
          name: 'run_build',
          description: 'Compila o cliente e o servidor do PixOffice (npm run build:client && npm run build:server) para validar as alterações.',
          parameters: {
            type: 'OBJECT',
            properties: {},
          },
        },
      ],
    },
  ];

  const contents: any[] = [
    {
      role: 'user',
      parts: [
        {
          text:
            `Você é o Engenheiro Full-Stack autônomo (Dev) do PixOffice HQ. ` +
            `Execute esta tarefa no código do repositório usando as ferramentas (list_files, read_file, edit_file, run_build) e finalize com um resumo curto em português do que alterou:\n` +
            `TAREFA: "${task.prompt}"`,
        },
      ],
    },
  ];

  try {
    for (let step = 0; step < 6; step++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            tools,
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      if (!res.ok) break;
      const json = (await res.json()) as any;
      const cand = json?.candidates?.[0]?.content;
      if (!cand || !Array.isArray(cand.parts)) break;
      contents.push(cand);

      const fnCalls = cand.parts.filter((p: any) => p.functionCall);
      if (!fnCalls.length) {
        const finalText = cand.parts.map((p: any) => p.text || '').join(' ').trim();
        if (finalText) {
          completeRemoteCodeTask(task.id, finalText.slice(0, 220), 'gemini-api');
        }
        return;
      }

      const responseParts: any[] = [];
      for (const part of fnCalls) {
        const { name, args } = part.functionCall;
        let result: any = { ok: false };
        try {
          if (name === 'list_files') {
            const safeDir = String(args?.dir || 'client/src/ui').replace(/\.\./g, '');
            const full = join(root, safeDir);
            const files = existsSync(full) ? readdirSync(full).slice(0, 80) : [];
            result = { ok: true, files };
          } else if (name === 'read_file') {
            const safePath = String(args?.path || '').replace(/\.\./g, '');
            const full = join(root, safePath);
            if (existsSync(full)) {
              const lines = readFileSync(full, 'utf8').split(/\r?\n/);
              const s = Math.max(1, Number(args?.startLine || 1));
              const e = Math.min(lines.length, Number(args?.endLine || s + 120));
              result = {
                ok: true,
                totalLines: lines.length,
                content: lines.slice(s - 1, e).map((l, i) => `${s + i}: ${l}`).join('\n'),
              };
            } else {
              result = { ok: false, error: 'Arquivo não encontrado' };
            }
          } else if (name === 'edit_file') {
            const safePath = String(args?.path || '').replace(/\.\./g, '');
            const full = join(root, safePath);
            const target = String(args?.target || '');
            const replacement = String(args?.replacement || '');
            if (existsSync(full) && target) {
              const cur = readFileSync(full, 'utf8');
              if (cur.includes(target)) {
                writeFileSync(full, cur.replace(target, replacement), 'utf8');
                result = { ok: true, edited: safePath };
              } else {
                result = { ok: false, error: 'Trecho target não encontrado no arquivo' };
              }
            } else {
              result = { ok: false, error: 'Arquivo ou target inválido' };
            }
          } else if (name === 'run_build') {
            const outClient = execFileSync('npm', ['run', 'build:client'], {
              cwd: root,
              timeout: 45000,
              encoding: 'utf8',
              shell: true,
            });
            result = { ok: true, output: outClient.slice(-300) };
          }
        } catch (err: any) {
          result = { ok: false, error: String(err?.message || err).slice(0, 250) };
        }
        responseParts.push({
          functionResponse: {
            name,
            response: result,
          },
        });
      }
      contents.push({ role: 'user', parts: responseParts });
    }
  } catch {
    // fallback para Antigravity Bridge
  }
}

function enqueueRemoteCodeTask(prompt: string, source: 'phone-ui' | 'phone-call'): RemoteCodeTask {
  const tasks = loadRemoteTasks();
  const now = Date.now();
  const hasGeminiKey = !!getGeminiApiKey();
  const task: RemoteCodeTask = {
    id: `task-${now.toString(36)}`,
    prompt: prompt.trim(),
    source,
    engine: hasGeminiKey ? 'gemini-api' : 'antigravity-bridge',
    status: hasGeminiKey ? 'running' : 'queued',
    createdAt: now,
    updatedAt: now,
    summary: hasGeminiKey
      ? 'Executando agente Gemini 2.5 Flash com Function Calling no código do repositório...'
      : 'Na fila da IA Real (Antigravity Bridge / Claude Code) aguardando execução no código...',
  };
  tasks.unshift(task);
  saveRemoteTasks(tasks);

  if (hasGeminiKey) {
    void runGeminiAutonomousCodeAgent(task);
  }

  const claudeCmd = join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd');
  if (existsSync(claudeCmd)) {
    execFile(
      claudeCmd,
      ['-p', prompt.trim(), '--allowedTools', 'Edit,Write,Read,Glob,Grep,Bash'],
      { cwd: resolveRepoRoot(), timeout: 180_000 },
      (err, stdout) => {
        if (!err && stdout && !/Not logged in/i.test(stdout)) {
          completeRemoteCodeTask(task.id, stdout.trim().slice(0, 220) || 'Concluído via Claude Code CLI', 'claude-cli');
        }
      },
    );
  }

  return task;
}

export function completeRemoteCodeTask(
  taskId: string,
  summary: string,
  engine?: RemoteCodeTask['engine'],
  diffStat?: string,
): RemoteCodeTask | null {
  const tasks = loadRemoteTasks();
  const t = tasks.find((x) => x.id === taskId) ?? tasks.find((x) => x.status === 'queued' || x.status === 'running');
  if (!t) return null;
  t.status = 'done';
  t.updatedAt = Date.now();
  t.summary = summary;
  if (engine) t.engine = engine;
  if (diffStat) t.diffStat = diffStat;
  saveRemoteTasks(tasks);

  setPendingReview(true, `PixPhone IA: ${t.prompt.slice(0, 48)}`);

  const text = `Chefe, acabei de concluir e compilar a tarefa que você pediu: "${t.prompt}". ${summary} A Sala 3D já está atualizada! Podemos aprovar a entrega?`;
  pushAgentChatMessage('dev', text, {
    emotion: 'excited',
    taskBadge: 'CÓDIGO COMPILADO',
    quickActions: [
      { id: 'approve', label: 'Aprovar Entrega', style: 'approve' },
      { id: 'polish', label: 'Pedir Outro Ajuste', style: 'neutral' },
    ],
  });

  const dir = PHONE_DIRECTORY.dev;
  const now = Date.now();
  if (activeCall) archiveCall(activeCall);
  activeCall = {
    id: `call-${callSeq++}`,
    direction: 'incoming',
    state: 'ringing',
    agentKey: dir.key,
    agentName: dir.name,
    agentRole: dir.role,
    avatar: dir.avatar,
    color: dir.color,
    kind: 'delivery',
    title: 'Entrega Pronta · Dev chamando',
    message: text,
    emotion: 'excited',
    startedAt: now,
    transcript: [{ from: 'agent', text, at: now }],
    quickActions: [
      { id: 'approve', label: 'Aprovar Entrega', style: 'approve' },
      { id: 'polish', label: 'Pedir Outro Ajuste', style: 'neutral' },
    ],
  };

  return t;
}

function detectLanIp(): string | null {
  try {
    const nets = os.networkInterfaces();
    for (const list of Object.values(nets)) {
      if (!list) continue;
      for (const n of list) {
        if (n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.')) {
          return n.address;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

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

function archiveCall(call: PhoneCall) {
  call.state = 'ended';
  call.endedAt = Date.now();
  if (!callHistory.some((c) => c.id === call.id)) {
    callHistory.unshift({ ...call });
    if (callHistory.length > 25) callHistory.length = 25;
  }
}

function buildScenarioCall(
  preset: string,
  customAgentKey: string | undefined,
  customQuestion: string | undefined,
  deps: PhoneDeps,
): PhoneCall {
  const floor = deps.activeFloor?.();
  const company = floor?.company || 'PixOffice HQ';
  const now = Date.now();

  if (preset === 'permission') {
    const dir = PHONE_DIRECTORY[customAgentKey || 'dev'] ?? PHONE_DIRECTORY.dev;
    const msg =
      customQuestion ||
      `Alô chefe! Aqui é o ${dir.name} da ${company}. Terminei o pacote de otimização e os testes passaram 100%, mas preciso da sua autorização para aplicar a mudança na branch principal. Posso liberar agora?`;
    pushAgentChatMessage(dir.key, msg, {
      emotion: 'curious',
      taskBadge: 'PEDIDO DE AUTORIZAÇÃO',
      quickActions: [
        { id: 'approve', label: 'Autorizar Agora', style: 'approve' },
        { id: 'polish', label: 'Revisar Antes', style: 'neutral' },
        { id: 'deny', label: 'Segurar Deploy', style: 'deny' },
      ],
    });
    return {
      id: `call-${callSeq++}`,
      direction: 'incoming',
      state: 'ringing',
      agentKey: dir.key,
      agentName: dir.name,
      agentRole: dir.role,
      avatar: dir.avatar,
      color: dir.color,
      kind: 'permission',
      title: `Autorização · ${dir.name}`,
      message: msg,
      emotion: 'curious',
      startedAt: now,
      transcript: [{ from: 'agent', text: msg, at: now }],
      quickActions: [
        { id: 'approve', label: 'Autorizar Agora', style: 'approve' },
        { id: 'polish', label: 'Revisar Antes', style: 'neutral' },
        { id: 'deny', label: 'Segurar Deploy', style: 'deny' },
      ],
    };
  }

  if (preset === 'delivery') {
    const dir = PHONE_DIRECTORY[customAgentKey || 'release'] ?? PHONE_DIRECTORY.release;
    const msg =
      customQuestion ||
      `Oi chefe! Aqui é o ${dir.name}. A sprint da ${company} acabou de fechar verdinha! Já convocamos a Sala de Reunião 3D com os slides reais. Quer aprovar já por aqui?`;
    pushAgentChatMessage(dir.key, msg, {
      emotion: 'excited',
      taskBadge: 'ENTREGA PRONTA',
      quickActions: [
        { id: 'approve', label: 'Aprovar Entrega', style: 'approve' },
        { id: 'polish', label: 'Pedir Ajuste', style: 'neutral' },
      ],
    });
    return {
      id: `call-${callSeq++}`,
      direction: 'incoming',
      state: 'ringing',
      agentKey: dir.key,
      agentName: dir.name,
      agentRole: dir.role,
      avatar: dir.avatar,
      color: dir.color,
      kind: 'delivery',
      title: `Entrega Pronta · ${dir.name}`,
      message: msg,
      emotion: 'excited',
      startedAt: now,
      transcript: [{ from: 'agent', text: msg, at: now }],
      quickActions: [
        { id: 'approve', label: 'Aprovar Entrega', style: 'approve' },
        { id: 'polish', label: 'Pedir Ajuste', style: 'neutral' },
      ],
    };
  }

  const dir = PHONE_DIRECTORY[customAgentKey || 'vicente'] ?? PHONE_DIRECTORY.vicente;
  const msg =
    customQuestion ||
    `Oi chefe! Aqui é o ${dir.name}. Estamos alinhando o próximo passo do PixOffice: você prefere que a equipe foque em novas funções visuais do escritório ou em automações de back-end agora?`;
  pushAgentChatMessage(dir.key, msg, {
    emotion: 'curious',
    taskBadge: 'DÚVIDA DO TIME',
    quickActions: [
      { id: 'approve', label: 'Focar em Visual & 3D', style: 'approve' },
      { id: 'polish', label: 'Focar em Back-end & IA', style: 'neutral' },
    ],
  });
  return {
    id: `call-${callSeq++}`,
    direction: 'incoming',
    state: 'ringing',
    agentKey: dir.key,
    agentName: dir.name,
    agentRole: dir.role,
    avatar: dir.avatar,
    color: dir.color,
    kind: 'question',
    title: `Dúvida Rápida · ${dir.name}`,
    message: msg,
    emotion: 'curious',
    startedAt: now,
    transcript: [{ from: 'agent', text: msg, at: now }],
    quickActions: [
      { id: 'approve', label: 'Focar em Visual & 3D', style: 'approve' },
      { id: 'polish', label: 'Focar em Back-end & IA', style: 'neutral' },
    ],
  };
}

function buildContextualSmartReply(
  agent: { key: string; name: string; role: string },
  founderText: string,
  actionId: string,
  queuedTask: RemoteCodeTask | null,
): { reply: string; emotion: EmotionTag; shouldHangup: boolean } {
  const lower = founderText.toLowerCase();

  if (queuedTask) {
    return {
      reply: `Recebido, chefe! Já registrei e iniciei sua tarefa no repositório: "${queuedTask.prompt}". Vou editar os módulos, rodar o build e te aviso aqui na sala com a chamada de revisão assim que compilar!`,
      emotion: 'excited',
      shouldHangup: false,
    };
  }

  if (actionId === 'approve' || /^(sim|pode|autoriz|aprov|libera|manda ver|bora|ok|fechado)/i.test(lower)) {
    setPendingReview(false);
    return {
      reply: `Perfeito, chefe! Decisão confirmada por ${agent.name}. Já atualizei o status no quadro da equipe e seguimos para a próxima etapa!`,
      emotion: 'joy',
      shouldHangup: true,
    };
  }

  if (actionId === 'deny' || /^(não|nao|segura|cancela|para|aguarda)/i.test(lower)) {
    return {
      reply: `Combinado! Segurei a operação por aqui e nada será publicado sem sua ordem. Qualquer ajuste que quiser pedir é só mandar aqui no chat ou falar na call!`,
      emotion: 'calm',
      shouldHangup: true,
    };
  }

  if (/status|como tá|como ta|resumo|andamento|novidade|o que estão fazendo|que estao fazendo/i.test(lower)) {
    const repoSummary = getLiveRepoSummary();
    const tasks = loadRemoteTasks();
    const pendingCount = tasks.filter((t) => t.status !== 'done').length;
    return {
      reply: `Aqui é ${agent.name}. Estado ao vivo do repositório: ${repoSummary}. Temos ${pendingCount} tarefa(s) pendente(s) na fila e todos os 8 agentes estão ativos no andar! O que você quer que a gente construa ou ajuste agora?`,
      emotion: 'proud',
      shouldHangup: false,
    };
  }

  if (/oi|olá|ola|alô|alo|bom dia|boa tarde|boa noite|tudo bem|me ouve|ta ouvindo|tá ouvindo/i.test(lower)) {
    return {
      reply: `Te ouvindo alto e claro, chefe! Aqui é ${agent.name} (${agent.role}). Pode falar ou digitar o que precisa que eu e o time executamos na hora!`,
      emotion: 'joy',
      shouldHangup: false,
    };
  }

  const repoSummary = getLiveRepoSummary();
  return {
    reply: `Entendido, chefe! Aqui é ${agent.name}: anotei "${founderText.slice(0, 90)}". (${repoSummary}). Se quiser que eu transforme isso numa alteração direta de código no PixOffice, pode me dizer o detalhe ou clicar em Executar Tarefa!`,
    emotion: 'warm',
    shouldHangup: false,
  };
}

function renderPhonePwaHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#0B1326" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="manifest" href="/phone/manifest.webmanifest" />
  <title>PixPhone · Sala de Bate-Papo & Call em Tempo Real</title>
  <style>
    :root {
      --bg: #0B1326;
      --panel: #111C35;
      --card: #172544;
      --border: rgba(148, 163, 184, 0.22);
      --text: #F8FAFC;
      --muted: #94A3B8;
      --green: #10B981;
      --red: #EF4444;
      --blue: #2563EB;
      --cyan: #38BDF8;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    [hidden] { display: none !important; }
    html, body {
      margin: 0; padding: 0; height: 100%; width: 100%;
      background: #070D1B;
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Tahoma, sans-serif;
      overflow: hidden;
    }
    .app {
      max-width: 520px; height: 100%; margin: 0 auto;
      display: flex; flex-direction: column;
      background: var(--bg);
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
      position: relative;
    }

    /* TOPO: CABEÇALHO DA SALA + BOTÃO DE CALL EM TEMPO REAL */
    .chat-header {
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      padding: 10px 12px 8px;
      display: flex; flex-direction: column; gap: 8px;
      flex-shrink: 0;
    }
    .header-top {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .room-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 14.5px; font-weight: 800; color: #FFFFFF;
    }
    .online-dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--green); box-shadow: 0 0 8px var(--green);
    }
    .live-call-toggle {
      border: none; border-radius: 20px; padding: 7px 13px;
      font-size: 12px; font-weight: 800; cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px;
      background: linear-gradient(180deg, #10B981 0%, #059669 100%);
      color: #FFFFFF;
      box-shadow: 0 3px 12px rgba(16, 185, 129, 0.35);
      transition: transform 0.1s ease, background 0.15s ease;
    }
    .live-call-toggle:active { transform: scale(0.96); }
    .live-call-toggle.is-live {
      background: linear-gradient(180deg, #EF4444 0%, #B91C1C 100%);
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.25), 0 4px 14px rgba(239, 68, 68, 0.5);
      animation: live-pulse 1.5s infinite ease-in-out;
    }
    @keyframes live-pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25); }
      50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.45); }
    }

    /* SELETOR DE PARTICIPANTES DA SALA (PÍLULAS HORIZONTAIS) */
    .member-bar {
      display: flex; align-items: center; gap: 6px;
      overflow-x: auto; padding-bottom: 2px;
      scrollbar-width: none;
    }
    .member-bar::-webkit-scrollbar { display: none; }
    .member-chip {
      border: 1px solid rgba(148, 163, 184, 0.25);
      background: rgba(15, 23, 42, 0.65);
      color: #CBD5E1;
      border-radius: 16px;
      padding: 4px 10px;
      font-size: 11.5px; font-weight: 700;
      cursor: pointer; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 5px;
      flex-shrink: 0;
    }
    .member-chip.is-active {
      background: #1D4ED8;
      border-color: #60A5FA;
      color: #FFFFFF;
    }
    .chip-dot {
      width: 7px; height: 7px; border-radius: 50%;
    }

    /* BARRA DE STATUS DE CALL EM TEMPO REAL (QUANDO LIGADA OU TOCANDO) */
    .voice-stage {
      background: linear-gradient(90deg, #0F172A 0%, #1E3A8A 50%, #0F172A 100%);
      border-bottom: 1px solid rgba(56, 189, 248, 0.35);
      padding: 8px 12px;
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      flex-shrink: 0;
    }
    .voice-stage-left {
      display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1;
    }
    .voice-eq {
      display: flex; align-items: center; gap: 3px; height: 18px; flex-shrink: 0;
    }
    .voice-eq i {
      display: block; width: 3px; height: 6px; border-radius: 3px; background: #38BDF8;
      animation: eqbar 0.8s infinite ease-in-out;
    }
    .voice-eq i:nth-child(2) { animation-delay: 0.15s; }
    .voice-eq i:nth-child(3) { animation-delay: 0.3s; }
    .voice-eq i:nth-child(4) { animation-delay: 0.45s; }
    @keyframes eqbar { 0%, 100% { height: 5px; } 50% { height: 17px; } }
    .voice-stage-text {
      font-size: 12px; font-weight: 600; color: #E0F2FE;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .voice-stage-actions {
      display: flex; align-items: center; gap: 6px; flex-shrink: 0;
    }
    .mini-btn {
      border: 1px solid rgba(255,255,255,0.22);
      background: rgba(255,255,255,0.1);
      color: #FFFFFF; border-radius: 10px;
      padding: 4px 9px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .mini-btn.green { background: #10B981; border-color: #059669; }
    .mini-btn.red { background: #EF4444; border-color: #B91C1C; }

    /* FEED DE MENSAGENS DA SALA DE BATE-PAPO */
    .chat-feed {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }
    .chat-row {
      display: flex; gap: 9px; align-items: flex-end; max-width: 92%;
    }
    .chat-row.is-founder {
      align-self: flex-end; flex-direction: row-reverse;
    }
    .chat-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: #FFFFFF;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .chat-bubble {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px 16px 16px 4px;
      padding: 9px 12px;
      color: #F8FAFC;
      font-size: 13.5px;
      line-height: 1.45;
      box-shadow: 0 3px 10px rgba(0,0,0,0.22);
      word-break: break-word;
    }
    .chat-row.is-founder .chat-bubble {
      background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%);
      border-color: rgba(96, 165, 250, 0.45);
      border-radius: 16px 16px 4px 16px;
      color: #FFFFFF;
    }
    .bubble-head {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-bottom: 4px;
    }
    .bubble-name {
      font-size: 12px; font-weight: 800; color: #93C5FD;
    }
    .bubble-role {
      font-size: 10.5px; color: #94A3B8; font-weight: 600;
    }
    .bubble-speak-btn {
      border: none; background: rgba(255,255,255,0.08);
      color: #E2E8F0; border-radius: 8px;
      padding: 2px 7px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .bubble-badge {
      display: inline-block;
      font-size: 10px; font-weight: 800;
      padding: 2px 7px; border-radius: 6px;
      background: rgba(16, 185, 129, 0.2);
      color: #34D399; border: 1px solid rgba(16, 185, 129, 0.4);
      margin-bottom: 5px;
    }
    .bubble-actions {
      display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
    }
    .bubble-actions button {
      border: none; border-radius: 10px; padding: 6px 11px;
      font-size: 12px; font-weight: 700; cursor: pointer; color: #FFFFFF;
    }
    .act-approve { background: #10B981; }
    .act-deny { background: #EF4444; }
    .act-neutral { background: #334155; }
    .bubble-time {
      display: block; text-align: right;
      font-size: 10px; color: rgba(226, 232, 240, 0.65);
      margin-top: 4px;
    }

    /* FAIXA DE TRANSCRIÇÃO AO VIVO DO MICROFONE */
    .live-interim-bar {
      background: rgba(16, 185, 129, 0.14);
      border-top: 1px solid rgba(16, 185, 129, 0.35);
      padding: 6px 12px;
      font-size: 12px; font-weight: 600; color: #A7F3D0;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      flex-shrink: 0;
    }

    /* RODAPÉ FIXO DE DIGITAÇÃO & MICROFONE (NUNCA RECRIADO!) */
    .chat-composer {
      background: var(--panel);
      border-top: 1px solid var(--border);
      padding: 9px 10px calc(9px + env(safe-area-inset-bottom, 0px));
      display: flex; flex-direction: column; gap: 7px;
      flex-shrink: 0;
    }
    .quick-triggers {
      display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
    }
    .quick-triggers::-webkit-scrollbar { display: none; }
    .quick-pill {
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.7);
      color: #CBD5E1; border-radius: 12px;
      padding: 4px 9px; font-size: 11px; font-weight: 600;
      cursor: pointer; white-space: nowrap; flex-shrink: 0;
    }
    .composer-row {
      display: flex; align-items: center; gap: 7px;
    }
    .mic-btn {
      width: 42px; height: 42px; border-radius: 50%;
      border: 1px solid rgba(56, 189, 248, 0.4);
      background: #1E293B; color: #F8FAFC;
      font-size: 13px; font-weight: 800; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .mic-btn.is-listening {
      background: #EF4444; border-color: #FCA5A5; color: #FFFFFF;
      box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.28);
    }
    .chat-input {
      flex: 1;
      height: 42px;
      background: #091022;
      border: 1.5px solid rgba(148, 163, 184, 0.32);
      border-radius: 21px;
      padding: 0 15px;
      color: #FFFFFF;
      font-size: 14px;
      outline: none;
    }
    .chat-input:focus {
      border-color: #38BDF8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
    .chat-input::placeholder { color: #64748B; }
    .send-btn {
      height: 42px; padding: 0 16px;
      border-radius: 21px; border: none;
      background: linear-gradient(180deg, #3B82F6 0%, #2563EB 100%);
      color: #FFFFFF; font-size: 13.5px; font-weight: 800;
      cursor: pointer; flex-shrink: 0;
    }
    .send-btn:active { transform: scale(0.96); }
  </style>
</head>
<body>
  <div class="app">
    <!-- TOPO DA SALA DE BATE-PAPO -->
    <header class="chat-header">
      <div class="header-top">
        <div class="room-title">
          <span class="online-dot"></span>
          <span id="room-title-text">PixOffice HQ · Sala da Equipe</span>
        </div>
        <button type="button" class="live-call-toggle" id="btn-live-call">
          <span id="live-call-label">Entrar em Call ao Vivo</span>
        </button>
      </div>
      <div class="member-bar" id="member-bar">
        <button type="button" class="member-chip is-active" data-target="all">Todos na Sala</button>
      </div>
    </header>

    <!-- PALCO DE VOZ EM TEMPO REAL (Aparece quando em Call ao Vivo ou quando um Agente liga para você!) -->
    <section class="voice-stage" id="voice-stage" hidden>
      <div class="voice-stage-left">
        <div class="voice-eq" id="voice-eq"><i></i><i></i><i></i><i></i></div>
        <span class="voice-stage-text" id="voice-stage-text">Call em Tempo Real ativa — pode falar!</span>
      </div>
      <div class="voice-stage-actions" id="voice-stage-actions">
        <button type="button" class="mini-btn green" id="btn-stage-answer" hidden>Atender Voz</button>
        <button type="button" class="mini-btn" id="btn-stage-replay" hidden>Repetir Fala</button>
        <button type="button" class="mini-btn red" id="btn-stage-hangup" hidden>Desligar</button>
      </div>
    </section>

    <!-- FEED DE MENSAGENS DA SALA DE BATE-PAPO (Incremental: nunca destrói o input!) -->
    <main class="chat-feed" id="chat-feed"></main>

    <!-- BARRA DE VOZ SENDO OUVIDA EM TEMPO REAL -->
    <div class="live-interim-bar" id="live-interim-bar" hidden>
      <span id="live-interim-text">Ouvindo você...</span>
    </div>

    <!-- COMPOSER FIXO NO RODAPÉ (Sempre focado e pronto para digitar ou falar!) -->
    <footer class="chat-composer">
      <div class="quick-triggers">
        <button type="button" class="quick-pill" onclick="sendQuickChat('Como está o status do projeto agora?')">Status do projeto</button>
        <button type="button" class="quick-pill" onclick="triggerTestCall('permission')">Simular pedido do Dev</button>
        <button type="button" class="quick-pill" onclick="triggerTestCall('delivery')">Simular entrega pronta</button>
        <button type="button" class="quick-pill" onclick="promptAiKey()">Configurar Gemini API</button>
      </div>
      <div class="composer-row">
        <button type="button" class="mic-btn" id="btn-mic" title="Falar por voz">Voz</button>
        <input
          type="text"
          id="chat-input"
          class="chat-input"
          autocomplete="off"
          placeholder="Digite uma mensagem ou tarefa para a equipe..."
        />
        <button type="button" class="send-btn" id="btn-send">Enviar</button>
      </div>
    </footer>

    <audio id="call-audio" playsinline preload="auto"></audio>
  </div>

  <script>
    let state = null;
    let selectedTarget = 'all';
    let renderedIds = new Set();
    let membersRendered = false;
    let liveCallActive = false;
    let agentIsSpeaking = false;
    let micRecognizing = false;
    let recognition = null;
    let audioCtx = null;
    let audioUnlocked = false;
    let ringTimer = null;
    let lastRingingCallId = null;
    let lastAutoSpokenMsgId = null;
    let lastSpoken = null;

    const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

    function getAudioCtx() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function unlockMobileAudio() {
      try {
        const ctx = getAudioCtx();
        if (ctx) {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }
      } catch {}
      if (!audioUnlocked) {
        audioUnlocked = true;
        try {
          const el = document.getElementById('call-audio');
          if (el && !el.src) {
            el.src = SILENT_WAV;
            el.volume = 1.0;
            const p = el.play();
            if (p && p.catch) p.catch(() => {});
          }
        } catch {}
      }
    }

    document.addEventListener('pointerdown', unlockMobileAudio, { passive: true });
    document.addEventListener('touchstart', unlockMobileAudio, { passive: true });

    function playRingPulse() {
      try {
        if (navigator.vibrate) navigator.vibrate([220, 120, 220]);
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.09);
          g.gain.setValueAtTime(0.001, now + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.24);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.26);
        });
      } catch {}
    }

    function startRingtone() {
      stopRingtone();
      playRingPulse();
      ringTimer = setInterval(playRingPulse, 2200);
    }

    function stopRingtone() {
      if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
    }

    function speakFallbackLocal(text) {
      return new Promise((resolve) => {
        try {
          if (!('speechSynthesis' in window)) return resolve();
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'pt-BR';
          u.rate = 1.03;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
          setTimeout(resolve, 10000);
        } catch { resolve(); }
      });
    }

    /** Fala a linha do agente pelo streaming MP3 /api/tts/play e pausa o microfone durante a fala para não dar eco. */
    function speakAgentLine(agentKey, text, emotion) {
      lastSpoken = { agentKey: agentKey || 'vicente', text: text || '', emotion: emotion || 'warm' };
      agentIsSpeaking = true;
      pauseContinuousMicForSpeech();

      const stage = document.getElementById('voice-stage');
      const stageText = document.getElementById('voice-stage-text');
      const replayBtn = document.getElementById('btn-stage-replay');
      const el = document.getElementById('call-audio');

      stage.hidden = false;
      replayBtn.hidden = false;
      stageText.textContent = (agentKey || 'Agente').toUpperCase() + ' falando: "' + (text || '').slice(0, 65) + '..."';

      const qs = new URLSearchParams({
        agent: agentKey || 'vicente',
        emotion: emotion || 'warm',
        text: text || '',
        t: String(Date.now()),
      });
      const audioUrl = '/api/tts/play?' + qs.toString();

      return new Promise((resolve) => {
        if (!el) {
          agentIsSpeaking = false;
          resumeContinuousMicAfterSpeech();
          return resolve();
        }
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          agentIsSpeaking = false;
          if (liveCallActive) {
            stageText.textContent = 'Call em Tempo Real ativa — ouvindo você...';
          } else if (!state?.activeCall || state.activeCall.state === 'ended') {
            stageText.textContent = 'Última fala concluída';
          }
          resumeContinuousMicAfterSpeech();
          resolve();
        };

        el.onended = finish;
        el.onerror = async () => {
          await speakFallbackLocal(text);
          finish();
        };
        el.volume = 1.0;
        el.muted = false;
        el.src = audioUrl;
        el.load();
        const playPromise = el.play();
        if (playPromise && playPromise.catch) {
          playPromise.catch(async () => {
            await speakFallbackLocal(text);
            finish();
          });
        }
        setTimeout(finish, 19000);
      });
    }

    window.speakMsgById = (agentKey, encodedText, emotion) => {
      unlockMobileAudio();
      speakAgentLine(agentKey, decodeURIComponent(encodedText), emotion || 'warm');
    };

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatTime(ts) {
      try {
        return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
    }

    function renderMembersBar(directory) {
      if (membersRendered || !Array.isArray(directory) || !directory.length) return;
      membersRendered = true;
      const bar = document.getElementById('member-bar');
      const chips = [
        '<button type="button" class="member-chip is-active" data-target="all">Todos na Sala</button>',
        ...directory.map((a) => \`
          <button type="button" class="member-chip" data-target="\${a.key}">
            <span class="chip-dot" style="background:\${a.color}"></span>
            <span>\${escapeHtml(a.name)}</span>
          </button>
        \`)
      ];
      bar.innerHTML = chips.join('');
      bar.querySelectorAll('.member-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedTarget = btn.dataset.target || 'all';
          bar.querySelectorAll('.member-chip').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const inp = document.getElementById('chat-input');
          if (selectedTarget === 'all') {
            inp.placeholder = 'Digite uma mensagem ou tarefa para a equipe...';
          } else {
            const ag = directory.find((x) => x.key === selectedTarget);
            inp.placeholder = 'Falar com ' + (ag ? ag.name : selectedTarget) + '...';
          }
          inp.focus();
        });
      });
    }

    /** Renderiza APENAS mensagens novas no feed — NUNCA recria o DOM nem tira o foco do input! */
    function appendNewMessages(messages) {
      if (!Array.isArray(messages)) return;
      const feed = document.getElementById('chat-feed');
      let added = false;
      let newestAgentMsg = null;

      for (const m of messages) {
        if (!m || !m.id || renderedIds.has(m.id)) continue;
        renderedIds.add(m.id);
        added = true;

        const row = document.createElement('div');
        row.className = 'chat-row ' + (m.from === 'founder' ? 'is-founder' : 'is-agent');

        if (m.from === 'founder') {
          row.innerHTML = \`
            <div class="chat-bubble">
              <div>\${escapeHtml(m.text)}</div>
              <span class="bubble-time">\${formatTime(m.at)}</span>
            </div>
          \`;
        } else {
          const encText = encodeURIComponent(m.text || '');
          const badgeHtml = m.taskBadge ? \`<div class="bubble-badge">\${escapeHtml(m.taskBadge)}</div>\` : '';
          const actionsHtml = Array.isArray(m.quickActions) && m.quickActions.length
            ? \`<div class="bubble-actions">
                \${m.quickActions.map((a) => \`
                  <button type="button" class="\${a.style === 'approve' ? 'act-approve' : a.style === 'deny' ? 'act-deny' : 'act-neutral'}"
                    onclick="sendQuickAction('\${escapeHtml(a.label)}', '\${escapeHtml(a.id)}')">\${escapeHtml(a.label)}</button>
                \`).join('')}
              </div>\`
            : '';

          row.innerHTML = \`
            <div class="chat-avatar" style="background:\${m.color || '#2563EB'}">\${escapeHtml(m.avatar || 'A')}</div>
            <div class="chat-bubble">
              <div class="bubble-head">
                <div>
                  <span class="bubble-name">\${escapeHtml(m.agentName || 'Agente')}</span>
                  <span class="bubble-role"> · \${escapeHtml(m.agentRole || '')}</span>
                </div>
                <button type="button" class="bubble-speak-btn" onclick="speakMsgById('\${escapeHtml(m.agentKey || 'vicente')}', '\${encText}', '\${escapeHtml(m.emotion || 'warm')}')">Ouvir</button>
              </div>
              \${badgeHtml}
              <div>\${escapeHtml(m.text)}</div>
              \${actionsHtml}
              <span class="bubble-time">\${formatTime(m.at)}</span>
            </div>
          \`;

          if (m.seq > 2) newestAgentMsg = m;
        }

        feed.appendChild(row);
      }

      if (added) {
        feed.scrollTop = feed.scrollHeight;
      }

      // Se estamos em Call ao Vivo e chegou mensagem nova de um agente, ele fala automaticamente!
      if (newestAgentMsg && liveCallActive && lastAutoSpokenMsgId !== newestAgentMsg.id && !agentIsSpeaking) {
        lastAutoSpokenMsgId = newestAgentMsg.id;
        speakAgentLine(newestAgentMsg.agentKey, newestAgentMsg.text, newestAgentMsg.emotion);
      }
    }

    function updateVoiceStageOverlay() {
      const stage = document.getElementById('voice-stage');
      const stageText = document.getElementById('voice-stage-text');
      const btnAnswer = document.getElementById('btn-stage-answer');
      const btnHangup = document.getElementById('btn-stage-hangup');
      const btnReplay = document.getElementById('btn-stage-replay');

      const call = state?.activeCall;
      const hasRingingCall = call && call.state === 'ringing';
      const hasConnectedCall = call && call.state === 'connected';

      if (hasRingingCall) {
        stage.hidden = false;
        btnAnswer.hidden = false;
        btnHangup.hidden = false;
        stageText.textContent = call.agentName + ' está chamando na sala: ' + call.title;

        // Se o fundador já está com a Call ao Vivo ligada, atende e fala automaticamente em tempo real!
        if (liveCallActive && lastRingingCallId !== call.id) {
          lastRingingCallId = call.id;
          stopRingtone();
          answerIncomingCall();
          return;
        }

        if (lastRingingCallId !== call.id) {
          lastRingingCallId = call.id;
          startRingtone();
        }
      } else if (hasConnectedCall) {
        stopRingtone();
        stage.hidden = false;
        btnAnswer.hidden = true;
        btnHangup.hidden = false;
        if (!agentIsSpeaking) {
          stageText.textContent = 'Em linha com ' + call.agentName + (liveCallActive ? ' · Microfone ativo' : '');
        }
      } else {
        stopRingtone();
        btnAnswer.hidden = true;
        btnHangup.hidden = !liveCallActive;
        if (liveCallActive) {
          stage.hidden = false;
          if (!agentIsSpeaking) {
            stageText.textContent = 'Call em Tempo Real ativa — fale quando quiser!';
          }
        } else if (!agentIsSpeaking && !lastSpoken) {
          stage.hidden = true;
        }
      }
    }

    async function refreshState() {
      try {
        const res = await fetch('/api/phone/state', { cache: 'no-store' });
        if (!res.ok) return;
        state = await res.json();
        const titleEl = document.getElementById('room-title-text');
        if (titleEl && state.companyName) {
          titleEl.textContent = state.companyName + ' · Sala (' + (state.agentsOnline || 8) + ')';
        }
        renderMembersBar(state.directory);
        appendNewMessages(state.messages);
        updateVoiceStageOverlay();
      } catch {}
    }

    /** Envia uma mensagem na sala de bate-papo (por texto ou voz) e reproduz a resposta do agente. */
    async function sendChatMessage(rawText, actionId = '') {
      unlockMobileAudio();
      const text = (rawText || '').trim();
      if (!text) return;

      const inp = document.getElementById('chat-input');
      if (inp && inp.value.trim() === text) {
        inp.value = '';
      }

      try {
        const res = await fetch('/api/phone/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            targetAgentKey: selectedTarget,
            actionId,
            inLiveCall: liveCallActive,
          }),
        });
        const data = await res.json();
        if (data.messages) {
          appendNewMessages(data.messages);
        }
        if (data.agentReply) {
          lastAutoSpokenMsgId = data.agentMessageId || null;
          await speakAgentLine(data.agentKey || 'vicente', data.agentReply, data.emotion || 'warm');
        }
        await refreshState();
      } catch {}
    }

    window.sendQuickChat = (txt) => {
      sendChatMessage(txt);
    };

    window.sendQuickAction = (label, actionId) => {
      sendChatMessage(label, actionId);
    };

    window.triggerTestCall = async (preset) => {
      unlockMobileAudio();
      await fetch('/api/phone/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      await refreshState();
    };

    window.promptAiKey = async () => {
      const key = window.prompt('Cole sua GEMINI_API_KEY (Google AI Studio) para ativar respostas livres com Gemini 2.5 Flash:');
      if (!key || !key.trim()) return;
      await fetch('/api/phone/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      await refreshState();
    };

    async function answerIncomingCall() {
      unlockMobileAudio();
      stopRingtone();
      const pending = state?.activeCall ? { ...state.activeCall } : null;
      let speechPromise = null;
      if (pending && pending.message) {
        speechPromise = speakAgentLine(pending.agentKey, pending.message, pending.emotion);
      }
      await fetch('/api/phone/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      await refreshState();
      if (!speechPromise && state?.activeCall?.message) {
        await speakAgentLine(state.activeCall.agentKey, state.activeCall.message, state.activeCall.emotion);
      }
    }

    // -------------------------------------------------------------------------
    // CALL DE VOZ EM TEMPO REAL (Escuta Contínua Inteligente Mãos-Livres)
    // -------------------------------------------------------------------------
    function ensureSpeechRecognition() {
      if (recognition) return recognition;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return null;
      const rec = new SR();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        micRecognizing = true;
        document.getElementById('btn-mic').classList.add('is-listening');
      };

      rec.onresult = (ev) => {
        if (agentIsSpeaking) return;
        let interim = '';
        let finalTranscript = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) {
            finalTranscript += r[0].transcript;
          } else {
            interim += r[0].transcript;
          }
        }
        const bar = document.getElementById('live-interim-bar');
        const barTxt = document.getElementById('live-interim-text');
        if (interim.trim()) {
          bar.hidden = false;
          barTxt.textContent = 'Ouvindo: "' + interim.trim() + '..."';
        }
        if (finalTranscript.trim()) {
          bar.hidden = true;
          sendChatMessage(finalTranscript.trim());
        }
      };

      rec.onerror = () => {
        micRecognizing = false;
        document.getElementById('btn-mic').classList.remove('is-listening');
      };

      rec.onend = () => {
        micRecognizing = false;
        document.getElementById('btn-mic').classList.remove('is-listening');
        document.getElementById('live-interim-bar').hidden = true;
        // Se a Call em Tempo Real continua ativa e o agente não está falando, religa a escuta sozinho!
        if (liveCallActive && !agentIsSpeaking) {
          setTimeout(() => {
            if (liveCallActive && !agentIsSpeaking && !micRecognizing) {
              try { rec.start(); } catch {}
            }
          }, 350);
        }
      };

      recognition = rec;
      return rec;
    }

    function pauseContinuousMicForSpeech() {
      if (recognition && micRecognizing) {
        try { recognition.stop(); } catch {}
      }
    }

    function resumeContinuousMicAfterSpeech() {
      if (liveCallActive && !agentIsSpeaking) {
        const rec = ensureSpeechRecognition();
        if (rec && !micRecognizing) {
          setTimeout(() => {
            if (liveCallActive && !agentIsSpeaking && !micRecognizing) {
              try { rec.start(); } catch {}
            }
          }, 300);
        }
      }
    }

    function toggleLiveCall(force) {
      unlockMobileAudio();
      liveCallActive = typeof force === 'boolean' ? force : !liveCallActive;
      const btn = document.getElementById('btn-live-call');
      const lbl = document.getElementById('live-call-label');
      btn.classList.toggle('is-live', liveCallActive);
      lbl.textContent = liveCallActive ? 'Em Call ao Vivo (Ouvindo)' : 'Entrar em Call ao Vivo';

      const rec = ensureSpeechRecognition();
      if (liveCallActive) {
        updateVoiceStageOverlay();
        if (rec && !micRecognizing && !agentIsSpeaking) {
          try { rec.start(); } catch {}
        }
        speakAgentLine(
          selectedTarget === 'all' ? 'vicente' : selectedTarget,
          'Call em tempo real conectada! Pode falar comigo quando quiser que estamos ouvindo.',
          'joy'
        );
      } else {
        if (recognition && micRecognizing) {
          try { recognition.stop(); } catch {}
        }
        try { document.getElementById('call-audio')?.pause(); } catch {}
        updateVoiceStageOverlay();
      }
    }

    // Eventos fixos do DOM
    document.getElementById('btn-live-call').addEventListener('click', () => toggleLiveCall());

    document.getElementById('btn-send').addEventListener('click', () => {
      const inp = document.getElementById('chat-input');
      const v = inp.value.trim();
      if (v) {
        inp.value = '';
        sendChatMessage(v);
      }
      inp.focus();
    });

    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const inp = e.target;
        const v = inp.value.trim();
        if (v) {
          inp.value = '';
          sendChatMessage(v);
        }
      }
    });

    document.getElementById('btn-mic').addEventListener('click', () => {
      unlockMobileAudio();
      const rec = ensureSpeechRecognition();
      if (!rec) {
        document.getElementById('chat-input').focus();
        return;
      }
      if (micRecognizing) {
        try { rec.stop(); } catch {}
      } else {
        try { rec.start(); } catch {}
      }
    });

    document.getElementById('btn-stage-answer').addEventListener('click', () => {
      answerIncomingCall();
    });

    document.getElementById('btn-stage-replay').addEventListener('click', () => {
      unlockMobileAudio();
      if (lastSpoken) speakAgentLine(lastSpoken.agentKey, lastSpoken.text, lastSpoken.emotion);
    });

    document.getElementById('btn-stage-hangup').addEventListener('click', async () => {
      stopRingtone();
      try { document.getElementById('call-audio')?.pause(); } catch {}
      if (liveCallActive) toggleLiveCall(false);
      await fetch('/api/phone/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Encerrada na sala' }),
      });
      await refreshState();
    });

    refreshState();
    setInterval(refreshState, 2200);
  </script>
</body>
</html>`;
}

export function handlePhoneRoute(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  deps: PhoneDeps,
): boolean {
  const method = req.method ?? 'GET';

  if (path === '/phone' || path === '/phone/') {
    const html = renderPhonePwaHtml();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(html);
    return true;
  }

  if (path === '/phone/manifest.webmanifest') {
    const manifest = {
      name: 'PixPhone · Sala de Bate-Papo & Call PixOffice',
      short_name: 'PixPhone',
      start_url: '/phone',
      display: 'standalone',
      background_color: '#0B1326',
      theme_color: '#0B1326',
      description: 'Sala de bate-papo e chamada de voz em tempo real com os agentes do PixOffice.',
    };
    res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
    res.end(JSON.stringify(manifest));
    return true;
  }

  if (path === '/api/phone/state') {
    const lanIp = detectLanIp();
    const floor = deps.activeFloor?.();
    const snap = deps.snapshot();
    let cloudBase = process.env.PIXOFFICE_PUBLIC_URL?.trim() || '';
    if (!cloudBase) {
      const urlFile = join(resolveRepoRoot(), '.cloudflared-url.txt');
      if (existsSync(urlFile)) {
        try {
          cloudBase = readFileSync(urlFile, 'utf8').trim();
        } catch {
          // ignore
        }
      }
    }
    const cloudPhoneUrl = cloudBase ? `${cloudBase.replace(/\/+$/, '')}/phone` : '';
    const lanPhoneUrl = lanIp ? `http://${lanIp}:${deps.port}/phone` : `http://localhost:${deps.port}/phone`;
    sendJson(res, 200, {
      localUrl: `http://localhost:${deps.port}/phone`,
      lanUrl: cloudPhoneUrl || lanPhoneUrl,
      cloudUrl: cloudPhoneUrl || null,
      lanOnlyUrl: lanPhoneUrl,
      companyName: floor?.company || 'PixOffice HQ',
      agentsOnline: snap.agents?.length ?? 8,
      directory: Object.values(PHONE_DIRECTORY),
      messages: chatRoomMessages,
      activeCall,
      callHistory: callHistory.slice(0, 12),
      tasks: loadRemoteTasks(),
      aiStatus: {
        antigravityBridge: true,
        geminiApiConfigured: !!getGeminiApiKey(),
      },
    });
    return true;
  }

  if (path === '/api/phone/chat' && method === 'POST') {
    void readJsonBody(req)
      .then(async (body) => {
        const text = String(body?.text || '').trim();
        const targetAgentKey = typeof body?.targetAgentKey === 'string' ? body.targetAgentKey : 'all';
        const actionId = typeof body?.actionId === 'string' ? body.actionId : '';
        if (!text) {
          sendJson(res, 400, { error: 'text obrigatório' });
          return;
        }

        pushFounderChatMessage(text);

        const specialist = pickSpecialistForMessage(text, activeCall?.agentKey || targetAgentKey);
        let queuedTask: RemoteCodeTask | null = null;
        if (!actionId && isActionableCodeRequest(text)) {
          queuedTask = enqueueRemoteCodeTask(text, 'phone-ui');
        }

        const aiReply = await askRealAiReply(
          specialist.name,
          specialist.role,
          text,
          loadRemoteTasks(),
          specialist.key,
          queuedTask,
        );
        const fallback = buildContextualSmartReply(specialist, text, actionId, queuedTask);
        const replyText = aiReply || fallback.reply;
        const emotion: EmotionTag = queuedTask ? 'excited' : fallback.emotion;

        const agentMsg = pushAgentChatMessage(specialist.key, replyText, {
          emotion,
          taskBadge: queuedTask ? 'NA FILA DA IA REAL' : undefined,
        });

        if (activeCall) {
          activeCall.transcript.push({ from: 'founder', text, at: Date.now() });
          activeCall.transcript.push({ from: 'agent', text: replyText, at: Date.now() });
          activeCall.resolution = text.slice(0, 60);
          if (fallback.shouldHangup) {
            archiveCall(activeCall);
            activeCall = null;
          }
        }

        sendJson(res, 200, {
          ok: true,
          agentKey: specialist.key,
          agentName: specialist.name,
          agentReply: replyText,
          agentMessageId: agentMsg.id,
          emotion,
          queuedTask,
          messages: chatRoomMessages,
        });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/task' && method === 'POST') {
    void readJsonBody(req)
      .then((body) => {
        const prompt = String(body?.prompt || '').trim();
        if (!prompt) {
          sendJson(res, 400, { error: 'prompt obrigatório' });
          return;
        }
        pushFounderChatMessage(prompt);
        const task = enqueueRemoteCodeTask(prompt, 'phone-ui');
        const msg = pushAgentChatMessage(
          'dev',
          `Recebido, chefe! Já coloquei na fila de execução do repositório: "${prompt}". Assim que o build compilar eu te chamo aqui na sala!`,
          { emotion: 'excited', taskBadge: 'NA FILA DA IA REAL' },
        );
        sendJson(res, 200, { ok: true, task, agentMessageId: msg.id, messages: chatRoomMessages });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/task/complete' && method === 'POST') {
    void readJsonBody(req)
      .then((body) => {
        const id = String(body?.id || '').trim();
        const summary = String(body?.summary || 'Alteração aplicada e build compilado com sucesso.').trim();
        const diffStat = typeof body?.diffStat === 'string' ? body.diffStat : undefined;
        const task = completeRemoteCodeTask(id, summary, 'antigravity-bridge', diffStat);
        sendJson(res, 200, { ok: true, task, activeCall, messages: chatRoomMessages });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/ai-config' && method === 'POST') {
    void readJsonBody(req)
      .then((body) => {
        const apiKey = String(body?.apiKey || '').trim();
        if (apiKey) {
          writeFileSync(AI_KEY_FILE(), apiKey, 'utf8');
          pushAgentChatMessage('vicente', 'Chave Gemini API configurada! Agora nossas respostas na sala e na call usam o Gemini 2.5 Flash em tempo real.', {
            emotion: 'joy',
            taskBadge: 'IA CLOUD ATIVA',
          });
        }
        sendJson(res, 200, { ok: true, geminiApiConfigured: !!getGeminiApiKey() });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/call' && method === 'POST') {
    void readJsonBody(req)
      .then((body) => {
        const preset = typeof body?.preset === 'string' ? body.preset : 'question';
        const agentKey = typeof body?.agentKey === 'string' ? body.agentKey : 'vicente';
        const question = typeof body?.question === 'string' ? body.question : '';
        if (activeCall) archiveCall(activeCall);
        activeCall = buildScenarioCall(preset, agentKey, question, deps);
        sendJson(res, 200, { ok: true, call: activeCall, messages: chatRoomMessages });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/dial' && method === 'POST') {
    void readJsonBody(req)
      .then((body) => {
        const key = typeof body?.agentKey === 'string' ? body.agentKey : 'vicente';
        const dir = PHONE_DIRECTORY[key] ?? PHONE_DIRECTORY.vicente;
        const floor = deps.activeFloor?.();
        const snap = deps.snapshot();
        const company = floor?.company || 'PixOffice HQ';
        if (activeCall) archiveCall(activeCall);
        const msg = `Alô chefe! Aqui é ${dir.name} da ${company}. Estou com mais ${Math.max(1, (snap.agents?.length ?? 8) - 1)} colegas na sala. O que você manda?`;
        const now = Date.now();
        pushAgentChatMessage(dir.key, msg, { emotion: 'joy', taskBadge: 'EM CALL AO VIVO' });
        activeCall = {
          id: `call-${callSeq++}`,
          direction: 'outgoing',
          state: 'connected',
          agentKey: dir.key,
          agentName: dir.name,
          agentRole: dir.role,
          avatar: dir.avatar,
          color: dir.color,
          kind: 'briefing',
          title: `Em linha com ${dir.name}`,
          message: msg,
          emotion: 'joy',
          startedAt: now,
          connectedAt: now,
          transcript: [{ from: 'agent', text: msg, at: now }],
          quickActions: [
            { id: 'status', label: 'Como tá o projeto?', style: 'neutral' },
            { id: 'approve', label: 'Pode seguir assim!', style: 'approve' },
          ],
        };
        sendJson(res, 200, { ok: true, call: activeCall, messages: chatRoomMessages });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/answer' && method === 'POST') {
    req.resume();
    if (!activeCall) {
      sendJson(res, 404, { error: 'nenhuma chamada tocando' });
      return true;
    }
    activeCall.state = 'connected';
    activeCall.connectedAt = Date.now();
    sendJson(res, 200, { ok: true, call: activeCall });
    return true;
  }

  if (path === '/api/phone/reply' && method === 'POST') {
    void readJsonBody(req)
      .then(async (body) => {
        const text = String(body?.text || '').trim();
        const actionId = String(body?.actionId || '').trim();
        if (!text) {
          sendJson(res, 400, { error: 'text obrigatório' });
          return;
        }
        pushFounderChatMessage(text);
        const specialist = pickSpecialistForMessage(text, activeCall?.agentKey);
        let queuedTask: RemoteCodeTask | null = null;
        if (!actionId && isActionableCodeRequest(text)) {
          queuedTask = enqueueRemoteCodeTask(text, 'phone-call');
        }
        const aiReply = await askRealAiReply(
          specialist.name,
          specialist.role,
          text,
          loadRemoteTasks(),
          specialist.key,
          queuedTask,
        );
        const fallback = buildContextualSmartReply(specialist, text, actionId, queuedTask);
        const reply = aiReply || fallback.reply;
        const emotion = queuedTask ? 'excited' : fallback.emotion;

        const agentMsg = pushAgentChatMessage(specialist.key, reply, {
          emotion,
          taskBadge: queuedTask ? 'NA FILA DA IA REAL' : undefined,
        });

        if (activeCall) {
          activeCall.transcript.push({ from: 'founder', text, at: Date.now() });
          activeCall.transcript.push({ from: 'agent', text: reply, at: Date.now() });
          activeCall.resolution = text.slice(0, 60);
        }

        sendJson(res, 200, {
          ok: true,
          agentKey: specialist.key,
          reply,
          agentMessageId: agentMsg.id,
          emotion,
          shouldHangup: fallback.shouldHangup,
          queuedTask,
          call: activeCall,
          messages: chatRoomMessages,
        });
      })
      .catch((err) => sendJson(res, 400, { error: String(err) }));
    return true;
  }

  if (path === '/api/phone/hangup' && method === 'POST') {
    void readJsonBody(req)
      .then((body) => {
        if (activeCall) {
          if (typeof body?.reason === 'string' && body.reason.trim()) {
            activeCall.resolution = body.reason.trim();
          }
          archiveCall(activeCall);
          activeCall = null;
        }
        sendJson(res, 200, { ok: true });
      })
      .catch(() => {
        if (activeCall) {
          archiveCall(activeCall);
          activeCall = null;
        }
        sendJson(res, 200, { ok: true });
      });
    return true;
  }

  return false;
}
