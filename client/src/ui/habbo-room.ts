// PixHotel Isometric Room Engine (Plano B — 100% Autoral & Comercializável)
// Projeção isométrica 2:1 (ladrilhos 64x32 px), paredes em "L" chanfradas,
// 2 níveis de piso com escadinha (Salão Dev + Mezanino VIP + Cafeteria),
// coleção de Mobis Corporativos (PixFurni) com Catálogo + Arrastar/Girar,
// Avatares Isométricos (PixAvatars) para os 8 agentes + Dono do Quarto (pathfinding BFS),
// e Balões de Chat em Cascata no teto integrados à IA real (/api/phone/message) e Voz Neural.

import type { OfficeStore } from '../net/store';

function triggerMeetingModal(): void {
  const btn = document.getElementById('xp-top-btn-meeting') as HTMLButtonElement | null;
  if (btn) btn.click();
}

function triggerPhoneModal(): void {
  const btn = document.getElementById('xp-top-btn-phone') as HTMLButtonElement | null;
  if (btn) btn.click();
}

function speakNeuralLine(agentId: string, text: string): void {
  const female = /user|art|ux/i.test(agentId);
  const voice = female ? 'pt-BR-FranciscaNeural' : 'pt-BR-AntonioNeural';
  const audio = new Audio(`/api/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text.slice(0, 220))}`);
  audio.volume = 0.85;
  audio.play().catch(() => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text.slice(0, 220));
      u.lang = 'pt-BR';
      window.speechSynthesis.speak(u);
    }
  });
}

export type FurniType =
  | 'club_sofa'
  | 'dev_desk'
  | 'exec_chair'
  | 'espresso_bar'
  | 'vending_drinks'
  | 'server_rack'
  | 'holo_screen'
  | 'palm_plant'
  | 'arcade_cab'
  | 'conf_table'
  | 'rug_vip';

export interface FurniCatalogMeta {
  type: FurniType;
  name: string;
  desc: string;
  category: 'Assentos' | 'Tecnologia' | 'Café & Lounge' | 'Decoração';
  priceCoins: number;
  sizeX: number;
  sizeY: number;
  canSit?: boolean;
  isWalkable?: boolean;
}

export const PIX_FURNI_CATALOG: FurniCatalogMeta[] = [
  {
    type: 'club_sofa',
    name: 'Sofá PixClub VIP',
    desc: 'Estofado bordô imperial com frisos dourados. Ícone dos quartos VIP.',
    category: 'Assentos',
    priceCoins: 25,
    sizeX: 2,
    sizeY: 1,
    canSit: true,
  },
  {
    type: 'dev_desk',
    name: 'Bancada Dual-Monitor Dev',
    desc: 'Estação isométrica com 2 monitores compilando código em tempo real.',
    category: 'Tecnologia',
    priceCoins: 30,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'exec_chair',
    name: 'Poltrona Executiva Mesh',
    desc: 'Cadeira ergonômica giratória para longas sprints de código.',
    category: 'Assentos',
    priceCoins: 15,
    sizeX: 1,
    sizeY: 1,
    canSit: true,
  },
  {
    type: 'espresso_bar',
    name: 'Máquina Espresso Barista',
    desc: 'Extrai café gourmet com vapor pixelado para recarregar os agentes.',
    category: 'Café & Lounge',
    priceCoins: 20,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'vending_drinks',
    name: 'Máquina PixCola Neon',
    desc: 'Bebidas geladas iluminadas por vitrine neon 24/7.',
    category: 'Café & Lounge',
    priceCoins: 20,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'server_rack',
    name: 'Rack Cloud 24/7',
    desc: 'Torre de servidores com LEDs de telemetria piscando em tempo real.',
    category: 'Tecnologia',
    priceCoins: 35,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'holo_screen',
    name: 'Telão Executivo de Sprint',
    desc: 'Painel panorâmico no mezanino conectado ao status real do repositório.',
    category: 'Tecnologia',
    priceCoins: 45,
    sizeX: 2,
    sizeY: 1,
  },
  {
    type: 'conf_table',
    name: 'Mesa de Reunião Mogno',
    desc: 'Mesa executiva polida para decisões da Mesa Redonda.',
    category: 'Assentos',
    priceCoins: 30,
    sizeX: 2,
    sizeY: 1,
  },
  {
    type: 'arcade_cab',
    name: 'Fliperama PixArcade 16-Bit',
    desc: 'Gabinete retrô para descomprimir entre um deploy e outro.',
    category: 'Café & Lounge',
    priceCoins: 28,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'palm_plant',
    name: 'Palmeira Imperial em Vaso',
    desc: 'Vaso cerâmico quadrado com folhagem pixel-art exuberante.',
    category: 'Decoração',
    priceCoins: 10,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'rug_vip',
    name: 'Tapete Persa PixRoyal',
    desc: 'Tapete tecido pixel a pixel com brasão dourado (caminhável).',
    category: 'Decoração',
    priceCoins: 18,
    sizeX: 2,
    sizeY: 2,
    isWalkable: true,
  },
];

export interface PlacedFurni {
  id: string;
  type: FurniType;
  gx: number;
  gy: number;
  rot: 0 | 1; // 0 = orientação SE, 1 = orientação SW
  state?: number; // 0 = normal, 1 = ativo/alternativo
}

export interface IsoAvatar {
  id: string;
  name: string;
  role: string;
  isFounder?: boolean;
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  path: Array<{ gx: number; gy: number }>;
  dir: 'SE' | 'SW' | 'NW' | 'NE';
  shirtColor: string;
  shirtDark: string;
  hairColor: string;
  skinColor: string;
  accessory: 'crown' | 'glasses' | 'headset' | 'beret' | 'cap' | 'visor' | 'none';
  action: 'idle' | 'walk' | 'sit' | 'type' | 'coffee' | 'wave';
  talkUntil: number;
  waveUntil: number;
  statusText: string;
  nextRoamAt: number;
}

export interface CascadeBubble {
  id: string;
  speakerId: string;
  speakerName: string;
  shirtColor: string;
  hairColor: string;
  text: string;
  anchorScreenX: number;
  currentY: number;
  createdAt: number;
  isImportant?: boolean;
}

const STORAGE_KEY_FURNI = 'pixoffice-habbo-furni-v1';
const STORAGE_KEY_MODE = 'pixoffice-habbo-mode-v1';

const GRID_W = 14;
const GRID_H = 14;
const TILE_W = 64;
const TILE_H = 32;
const LEVEL_H = 26;

function getCatalogMeta(type: FurniType): FurniCatalogMeta {
  return PIX_FURNI_CATALOG.find((c) => c.type === type) || PIX_FURNI_CATALOG[0];
}

function defaultFurniLayout(): PlacedFurni[] {
  return [
    // Mezanino VIP (gy = 0..3)
    { id: 'f-screen-1', type: 'holo_screen', gx: 2, gy: 0, rot: 0, state: 1 },
    { id: 'f-sofa-vip1', type: 'club_sofa', gx: 2, gy: 1, rot: 0 },
    { id: 'f-sofa-vip2', type: 'club_sofa', gx: 5, gy: 1, rot: 0 },
    { id: 'f-table-vip', type: 'conf_table', gx: 3, gy: 2, rot: 0 },
    { id: 'f-rack-1', type: 'server_rack', gx: 9, gy: 0, rot: 0, state: 1 },
    { id: 'f-rack-2', type: 'server_rack', gx: 10, gy: 0, rot: 0, state: 1 },
    { id: 'f-plant-vip1', type: 'palm_plant', gx: 0, gy: 0, rot: 0 },
    { id: 'f-plant-vip2', type: 'palm_plant', gx: 12, gy: 0, rot: 0 },

    // Salão Principal Dev (gy = 5..12, gx = 1..8)
    { id: 'f-desk-1', type: 'dev_desk', gx: 2, gy: 6, rot: 0, state: 1 },
    { id: 'f-chair-1', type: 'exec_chair', gx: 2, gy: 7, rot: 0 },
    { id: 'f-desk-2', type: 'dev_desk', gx: 4, gy: 6, rot: 0, state: 1 },
    { id: 'f-chair-2', type: 'exec_chair', gx: 4, gy: 7, rot: 0 },
    { id: 'f-desk-3', type: 'dev_desk', gx: 6, gy: 6, rot: 0, state: 1 },
    { id: 'f-chair-3', type: 'exec_chair', gx: 6, gy: 7, rot: 0 },

    { id: 'f-desk-4', type: 'dev_desk', gx: 2, gy: 10, rot: 0, state: 1 },
    { id: 'f-chair-4', type: 'exec_chair', gx: 2, gy: 11, rot: 0 },
    { id: 'f-desk-5', type: 'dev_desk', gx: 4, gy: 10, rot: 0, state: 1 },
    { id: 'f-chair-5', type: 'exec_chair', gx: 4, gy: 11, rot: 0 },
    { id: 'f-desk-6', type: 'dev_desk', gx: 6, gy: 10, rot: 0, state: 1 },
    { id: 'f-chair-6', type: 'exec_chair', gx: 6, gy: 11, rot: 0 },

    // Tapete Central + Lounge & Café (gx = 9..13, gy = 5..12)
    { id: 'f-rug-1', type: 'rug_vip', gx: 8, gy: 8, rot: 0 },
    { id: 'f-espresso', type: 'espresso_bar', gx: 11, gy: 5, rot: 1, state: 1 },
    { id: 'f-vending', type: 'vending_drinks', gx: 12, gy: 5, rot: 1, state: 1 },
    { id: 'f-arcade', type: 'arcade_cab', gx: 12, gy: 7, rot: 1, state: 1 },
    { id: 'f-sofa-lounge', type: 'club_sofa', gx: 10, gy: 10, rot: 0 },
    { id: 'f-plant-lounge1', type: 'palm_plant', gx: 12, gy: 12, rot: 0 },
    { id: 'f-plant-door', type: 'palm_plant', gx: 0, gy: 6, rot: 0 },
  ];
}

export class HabboRoomController {
  private hostEl: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private active = true;
  private rafId = 0;

  // Câmera pan & zoom
  private camX = 0;
  private camY = -40;
  private zoom = 1.05;
  private isDraggingCam = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private pointerDownDist = 0;

  // Estado do quarto
  private furni: PlacedFurni[] = [];
  private avatars: IsoAvatar[] = [];
  private bubbles: CascadeBubble[] = [];
  private hoverTile: { gx: number; gy: number } | null = null;
  private selectedFurniId: string | null = null;
  private selectedAvatarId: string | null = 'agent-01-dev';
  private moveMode = false;
  private placingType: FurniType | null = null;
  private placingRot: 0 | 1 = 0;
  private pixelCoins = 1250;

  // Elementos DOM de UI do Hotel
  private cornerCardEl!: HTMLElement;
  private catalogModalEl!: HTMLElement;
  private chatInputEl!: HTMLInputElement;
  private targetSelectEl!: HTMLSelectElement;
  private moveBtnEl!: HTMLButtonElement;

  constructor(private readonly root: HTMLElement, private readonly store: OfficeStore) {
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY_MODE);
      if (savedMode === '0') this.active = false;
    } catch {
      // default true
    }

    this.furni = this.loadFurni();
    this.initAvatars();

    this.hostEl = document.createElement('div');
    this.hostEl.id = 'pixhotel-iso-stage';
    this.hostEl.className = 'pixhotel-stage';
    if (!this.active) this.hostEl.style.display = 'none';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pixhotel-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.hostEl.appendChild(this.canvas);

    this.buildHotelInterface();
    document.body.appendChild(this.hostEl);

    this.bindEvents();
    this.resize();
    this.startLoop();

    // Mensagem inicial de boas-vindas em cascata
    setTimeout(() => {
      this.pushBubble('agent-00-researcher', 'Bem-vindo ao Quarto Isométrico do PixOffice! Clique no chão para andar ou fale conosco.', false);
    }, 900);
    setTimeout(() => {
      this.pushBubble('agent-01-dev', 'Compilação limpa e 8 agentes sincronizados no quarto. Qual a próxima feature?', false);
    }, 2400);
  }

  private loadFurni(): PlacedFurni[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FURNI);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return defaultFurniLayout();
  }

  private saveFurni(): void {
    try {
      localStorage.setItem(STORAGE_KEY_FURNI, JSON.stringify(this.furni));
    } catch {
      // ignore
    }
  }

  private initAvatars(): void {
    this.avatars = [
      {
        id: 'founder-you',
        name: 'Você (Founder)',
        role: 'Dono do Quarto · CEO',
        isFounder: true,
        gx: 1,
        gy: 8,
        targetGx: 1,
        targetGy: 8,
        path: [],
        dir: 'SE',
        shirtColor: '#f59e0b',
        shirtDark: '#b45309',
        hairColor: '#1e293b',
        skinColor: '#fcd34d',
        accessory: 'crown',
        action: 'idle',
        talkUntil: 0,
        waveUntil: Date.now() + 2500,
        statusText: 'Comandando o PixOffice HQ',
        nextRoamAt: Infinity,
      },
      {
        id: 'agent-00-researcher',
        name: '00 Vicente',
        role: 'Pesquisador & Arquiteto',
        gx: 3,
        gy: 1,
        targetGx: 3,
        targetGy: 1,
        path: [],
        dir: 'SE',
        shirtColor: '#2563eb',
        shirtDark: '#1d4ed8',
        hairColor: '#475569',
        skinColor: '#fde68a',
        accessory: 'glasses',
        action: 'sit',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Mapeando referências no Mezanino VIP',
        nextRoamAt: Date.now() + 14000,
      },
      {
        id: 'agent-01-dev',
        name: '01 Dev',
        role: 'Engenheiro Full-Stack',
        gx: 2,
        gy: 7,
        targetGx: 2,
        targetGy: 7,
        path: [],
        dir: 'NW',
        shirtColor: '#10b981',
        shirtDark: '#047857',
        hairColor: '#0f172a',
        skinColor: '#fcd34d',
        accessory: 'headset',
        action: 'type',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Codificando TypeScript & WebGL na Bancada 1',
        nextRoamAt: Date.now() + 19000,
      },
      {
        id: 'agent-02-fx-audio',
        name: '02 FX & Áudio',
        role: 'Especialista DSP & Shaders',
        gx: 4,
        gy: 7,
        targetGx: 4,
        targetGy: 7,
        path: [],
        dir: 'NW',
        shirtColor: '#8b5cf6',
        shirtDark: '#6d28d9',
        hairColor: '#312e81',
        skinColor: '#fed7aa',
        accessory: 'headset',
        action: 'type',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Calibrando síntese de voz neural PT-BR',
        nextRoamAt: Date.now() + 22000,
      },
      {
        id: 'agent-03-qa',
        name: '03 QA Auditor',
        role: 'Gatekeeper de Qualidade',
        gx: 6,
        gy: 7,
        targetGx: 6,
        targetGy: 7,
        path: [],
        dir: 'NW',
        shirtColor: '#ef4444',
        shirtDark: '#b91c1c',
        hairColor: '#1f2937',
        skinColor: '#fde68a',
        accessory: 'visor',
        action: 'type',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Auditando zero erros de build e performance',
        nextRoamAt: Date.now() + 16000,
      },
      {
        id: 'agent-04-user',
        name: '04 User',
        role: 'Advogado do Usuário',
        gx: 10,
        gy: 6,
        targetGx: 10,
        targetGy: 6,
        path: [],
        dir: 'NE',
        shirtColor: '#06b6d4',
        shirtDark: '#0e7490',
        hairColor: '#78350f',
        skinColor: '#fcd34d',
        accessory: 'cap',
        action: 'coffee',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Tomando espresso e testando ergonomia',
        nextRoamAt: Date.now() + 12000,
      },
      {
        id: 'agent-05-art',
        name: '05 Art XP',
        role: 'Diretor de Pixel Art',
        gx: 2,
        gy: 11,
        targetGx: 2,
        targetGy: 11,
        path: [],
        dir: 'NW',
        shirtColor: '#ec4899',
        shirtDark: '#be185d',
        hairColor: '#581c87',
        skinColor: '#fed7aa',
        accessory: 'beret',
        action: 'type',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Polindo sprites isométricos 2:1 (64x32)',
        nextRoamAt: Date.now() + 21000,
      },
      {
        id: 'agent-06-ux-ui',
        name: '06 UX/UI',
        role: 'Arquiteto de Interfaces',
        gx: 4,
        gy: 11,
        targetGx: 4,
        targetGy: 11,
        path: [],
        dir: 'NW',
        shirtColor: '#14b8a6',
        shirtDark: '#0f766e',
        hairColor: '#1e293b',
        skinColor: '#fde68a',
        accessory: 'glasses',
        action: 'type',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Testando contraste WCAG e layout responsivo',
        nextRoamAt: Date.now() + 17000,
      },
      {
        id: 'agent-07-release',
        name: '07 Release',
        role: 'Engenheiro Cloud & Deploy',
        gx: 6,
        gy: 11,
        targetGx: 6,
        targetGy: 11,
        path: [],
        dir: 'NW',
        shirtColor: '#f97316',
        shirtDark: '#c2410c',
        hairColor: '#27272a',
        skinColor: '#fcd34d',
        accessory: 'headset',
        action: 'type',
        talkUntil: 0,
        waveUntil: 0,
        statusText: 'Monitorando container Docker 24/7 na nuvem',
        nextRoamAt: Date.now() + 24000,
      },
    ];
  }

  private getTileLevel(gx: number, gy: number): number {
    if (gy >= 0 && gy <= 3) return 1; // Mezanino VIP elevado
    if (gy === 4 && gx >= 4 && gx <= 6) return 0.5; // Escadinha central
    return 0;
  }

  private isTileValid(gx: number, gy: number): boolean {
    if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return false;
    // Parede divisória do mezanino em gy === 4 exceto na escadinha (gx 4..6)
    if (gy === 4 && (gx < 4 || gx > 6)) return false;
    return true;
  }

  private isTileBlockedForWalk(gx: number, gy: number, ignoreAvatarId?: string): boolean {
    if (!this.isTileValid(gx, gy)) return true;
    for (const f of this.furni) {
      const meta = getCatalogMeta(f.type);
      if (meta.isWalkable) continue;
      const sx = f.rot === 0 ? meta.sizeX : meta.sizeY;
      const sy = f.rot === 0 ? meta.sizeY : meta.sizeX;
      if (gx >= f.gx && gx < f.gx + sx && gy >= f.gy && gy < f.gy + sy) {
        if (meta.canSit) return false; // Permite andar até assentos para sentar!
        return true;
      }
    }
    for (const av of this.avatars) {
      if (av.id === ignoreAvatarId) continue;
      if (Math.round(av.gx) === gx && Math.round(av.gy) === gy) return false;
    }
    return false;
  }

  private isSeatTile(gx: number, gy: number): PlacedFurni | null {
    for (const f of this.furni) {
      const meta = getCatalogMeta(f.type);
      if (!meta.canSit) continue;
      const sx = f.rot === 0 ? meta.sizeX : meta.sizeY;
      const sy = f.rot === 0 ? meta.sizeY : meta.sizeX;
      if (gx >= f.gx && gx < f.gx + sx && gy >= f.gy && gy < f.gy + sy) {
        return f;
      }
    }
    return null;
  }

  private hasDeskInFront(gx: number, gy: number): boolean {
    return this.furni.some((f) => f.type === 'dev_desk' && f.gx === gx && f.gy === gy - 1);
  }

  private findPath(startGx: number, startGy: number, goalGx: number, goalGy: number, avatarId: string): Array<{ gx: number; gy: number }> {
    const sx = Math.round(startGx);
    const sy = Math.round(startGy);
    if (sx === goalGx && sy === goalGy) return [];
    if (this.isTileBlockedForWalk(goalGx, goalGy, avatarId)) return [];

    const queue: Array<{ gx: number; gy: number; path: Array<{ gx: number; gy: number }> }> = [{ gx: sx, gy: sy, path: [] }];
    const visited = new Set<string>([`${sx},${sy}`]);
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const d of dirs) {
        const nx = cur.gx + d.dx;
        const ny = cur.gy + d.dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (this.isTileBlockedForWalk(nx, ny, avatarId)) continue;
        const nextPath = [...cur.path, { gx: nx, gy: ny }];
        if (nx === goalGx && ny === goalGy) return nextPath;
        visited.add(key);
        if (nextPath.length <= 28) {
          queue.push({ gx: nx, gy: ny, path: nextPath });
        }
      }
    }
    return [];
  }

  private isoToScreen(gx: number, gy: number, gz = 0): { x: number; y: number } {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const originX = w * 0.5 + this.camX;
    const originY = h * 0.22 + this.camY;
    const ix = (gx - gy) * (TILE_W * 0.5) * this.zoom;
    const iy = ((gx + gy) * (TILE_H * 0.5) - gz * LEVEL_H) * this.zoom;
    return { x: originX + ix, y: originY + iy };
  }

  private screenToIso(screenX: number, screenY: number): { gx: number; gy: number } | null {
    // Testa primeiro o nível 1 (Mezanino gy 0..3), depois escada, depois nível 0
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (!this.isTileValid(gx, gy)) continue;
        const gz = this.getTileLevel(gx, gy);
        const c = this.isoToScreen(gx + 0.5, gy + 0.5, gz);
        const dx = Math.abs(screenX - c.x) / ((TILE_W * 0.5) * this.zoom);
        const dy = Math.abs(screenY - c.y) / ((TILE_H * 0.5) * this.zoom);
        if (dx + dy <= 1.0) {
          return { gx, gy };
        }
      }
    }
    return null;
  }

  public pushBubble(speakerId: string, text: string, isImportant = false): void {
    const clean = text.trim();
    if (!clean) return;
    const av = this.avatars.find((a) => a.id === speakerId) || this.avatars[0];
    av.talkUntil = Date.now() + Math.min(7000, Math.max(2200, clean.length * 60));

    // Sobe todos os balões existentes em 38px (efeito cascata do Habbo!)
    for (const b of this.bubbles) {
      b.currentY -= 40;
    }

    const pos = this.isoToScreen(av.gx + 0.5, av.gy + 0.5, this.getTileLevel(Math.round(av.gx), Math.round(av.gy)));
    const w = this.canvas.clientWidth || window.innerWidth;
    const clampedX = Math.max(180, Math.min(w - 180, pos.x));

    this.bubbles.push({
      id: `bub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      speakerId: av.id,
      speakerName: av.name,
      shirtColor: av.shirtColor,
      hairColor: av.hairColor,
      text: clean.slice(0, 175),
      anchorScreenX: clampedX,
      currentY: Math.max(85, pos.y - 78 * this.zoom),
      createdAt: Date.now(),
      isImportant,
    });

    if (this.bubbles.length > 9) {
      this.bubbles.shift();
    }
  }

  private buildHotelInterface(): void {
    // Botão flutuante no topo direito para alternar entre Quarto Isométrico Habbo e Planta 2D Clássica
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'pixhotel-mode-toggle';
    toggleBtn.className = 'pixhotel-mode-toggle-btn';
    const syncToggleText = () => {
      toggleBtn.innerHTML = this.active
        ? `<span class="pixhotel-badge-dot"></span> 🏨 Quarto Habbo (Ativo) · Ver Planta 2D`
        : `🏨 Entrar no Quarto Habbo Isométrico`;
    };
    syncToggleText();
    toggleBtn.addEventListener('click', () => {
      this.active = !this.active;
      this.hostEl.style.display = this.active ? 'block' : 'none';
      try {
        localStorage.setItem(STORAGE_KEY_MODE, this.active ? '1' : '0');
      } catch {
        // ignore
      }
      syncToggleText();
      if (this.active) this.resize();
    });
    document.body.appendChild(toggleBtn);

    // Plaquinha de informações do quarto no canto superior esquerdo (estilo Navigator Habbo)
    const roomInfo = document.createElement('div');
    roomInfo.className = 'pixhotel-room-badge';
    roomInfo.innerHTML = `
      <div class="pixhotel-room-badge__icon">🏨</div>
      <div class="pixhotel-room-badge__body">
        <div class="pixhotel-room-badge__title">PixOffice HQ · Salão & Mezanino VIP</div>
        <div class="pixhotel-room-badge__sub">Dono: <b>Você (Founder)</b> · <span id="pixhotel-pop-count">9/16 no quarto</span> · ⭐ 998</div>
      </div>
      <div class="pixhotel-room-badge__actions">
        <button type="button" class="pixhotel-mini-btn" id="pixhotel-preset-work" title="Equipe nas bancadas">💻 Bancadas</button>
        <button type="button" class="pixhotel-mini-btn" id="pixhotel-preset-vip" title="Chamar todos para o Mezanino VIP">🛋️ Reunião VIP</button>
        <button type="button" class="pixhotel-mini-btn" id="pixhotel-preset-cafe" title="Hora do café">☕ Hora do Café</button>
      </div>
    `;
    this.hostEl.appendChild(roomInfo);

    // Card de Inspeção no canto inferior direito (quando clica em um Mobi ou Agente, igual ao Habbo!)
    this.cornerCardEl = document.createElement('div');
    this.cornerCardEl.className = 'pixhotel-inspector-card';
    this.hostEl.appendChild(this.cornerCardEl);
    this.updateInspectorCard();

    // Modal do Catálogo de Mobis (PixFurni Shop)
    this.catalogModalEl = document.createElement('div');
    this.catalogModalEl.className = 'pixhotel-catalog-modal';
    this.catalogModalEl.style.display = 'none';
    this.renderCatalogModal();
    this.hostEl.appendChild(this.catalogModalEl);

    // Barra Inferior de Hotel Virtual (Avatar + Barra de Chat + Botões de Catálogo, Mover, Sala 3D e Console PixPhone)
    const dock = document.createElement('div');
    dock.className = 'pixhotel-bottom-dock';
    dock.innerHTML = `
      <div class="pixhotel-dock-left">
        <button type="button" class="pixhotel-dock-btn pixhotel-dock-btn--me" id="pixhotel-btn-wave" title="Acenar no quarto (o/)">
          👋 <span>Acenar</span>
        </button>
        <select class="pixhotel-target-select" id="pixhotel-chat-target" title="Escolher com quem falar">
          <option value="agent-00-researcher">🗣️ 00 Vicente (Pesquisador)</option>
          <option value="agent-01-dev" selected>🗣️ 01 Dev (Full-Stack)</option>
          <option value="agent-02-fx-audio">🗣️ 02 FX & Áudio</option>
          <option value="agent-03-qa">🗣️ 03 QA Auditor</option>
          <option value="agent-04-user">🗣️ 04 User</option>
          <option value="agent-05-art">🗣️ 05 Art XP</option>
          <option value="agent-06-ux-ui">🗣️ 06 UX/UI</option>
          <option value="agent-07-release">🗣️ 07 Release (Cloud)</option>
        </select>
      </div>
      <form class="pixhotel-chat-form" id="pixhotel-chat-form">
        <input
          type="text"
          id="pixhotel-chat-input"
          class="pixhotel-chat-input"
          placeholder="Digite aqui para falar no quarto (a IA responde em balão + voz)..."
          autocomplete="off"
        />
        <button type="submit" class="pixhotel-chat-send">Dizer</button>
      </form>
      <div class="pixhotel-dock-right">
        <button type="button" class="pixhotel-dock-btn pixhotel-dock-btn--catalog" id="pixhotel-btn-catalog">
          🛒 <span>Catálogo Mobis</span>
        </button>
        <button type="button" class="pixhotel-dock-btn" id="pixhotel-btn-move">
          ✋ <span>Mover Mobis</span>
        </button>
        <button type="button" class="pixhotel-dock-btn pixhotel-dock-btn--3d" id="pixhotel-btn-3d">
          📽️ <span>Telão 3D</span>
        </button>
        <button type="button" class="pixhotel-dock-btn pixhotel-dock-btn--console" id="pixhotel-btn-phone">
          📱 <span>Console PixPhone</span>
        </button>
      </div>
    `;
    this.hostEl.appendChild(dock);

    this.chatInputEl = dock.querySelector('#pixhotel-chat-input') as HTMLInputElement;
    this.targetSelectEl = dock.querySelector('#pixhotel-chat-target') as HTMLSelectElement;
    this.moveBtnEl = dock.querySelector('#pixhotel-btn-move') as HTMLButtonElement;

    // Eventos dos botões da barra
    dock.querySelector('#pixhotel-btn-wave')?.addEventListener('click', () => {
      const me = this.avatars.find((a) => a.isFounder);
      if (me) {
        me.waveUntil = Date.now() + 3000;
        this.pushBubble(me.id, 'o/ Olá equipe!', false);
      }
    });

    dock.querySelector('#pixhotel-btn-catalog')?.addEventListener('click', () => {
      const open = this.catalogModalEl.style.display === 'none';
      this.catalogModalEl.style.display = open ? 'flex' : 'none';
    });

    this.moveBtnEl.addEventListener('click', () => {
      this.moveMode = !this.moveMode;
      this.placingType = null;
      this.moveBtnEl.classList.toggle('is-active', this.moveMode);
      this.updateInspectorCard();
    });

    dock.querySelector('#pixhotel-btn-3d')?.addEventListener('click', () => {
      triggerMeetingModal();
    });

    dock.querySelector('#pixhotel-btn-phone')?.addEventListener('click', () => {
      triggerPhoneModal();
    });

    // Presets de movimentação da equipe no quarto
    roomInfo.querySelector('#pixhotel-preset-work')?.addEventListener('click', () => this.sendTeamToPreset('work'));
    roomInfo.querySelector('#pixhotel-preset-vip')?.addEventListener('click', () => this.sendTeamToPreset('vip'));
    roomInfo.querySelector('#pixhotel-preset-cafe')?.addEventListener('click', () => this.sendTeamToPreset('cafe'));

    // Envio de mensagem no chat do quarto -> Balão em Cascata + IA Real (/api/phone/message) + Voz Neural
    const form = dock.querySelector('#pixhotel-chat-form') as HTMLFormElement;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const text = this.chatInputEl.value.trim();
      if (!text) return;
      this.chatInputEl.value = '';

      const me = this.avatars.find((a) => a.isFounder);
      if (me) {
        this.pushBubble(me.id, text, true);
      }

      const targetId = this.targetSelectEl.value || 'agent-01-dev';
      const targetAv = this.avatars.find((a) => a.id === targetId) || this.avatars[1];

      try {
        const res = await fetch('/api/phone/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            target: targetAv.id,
            author: 'Você (Quarto Habbo)',
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          replyMessage?: { authorId?: string; text?: string };
        };
        if (data?.replyMessage?.text) {
          const replyAuthorId = data.replyMessage.authorId || targetAv.id;
          this.pushBubble(replyAuthorId, data.replyMessage.text, true);
          speakNeuralLine(replyAuthorId, data.replyMessage.text);
        }
      } catch {
        this.pushBubble(targetAv.id, 'Recebido! Estou processando sua solicitação aqui na bancada.', false);
      }
    });
  }

  private sendTeamToPreset(mode: 'work' | 'vip' | 'cafe'): void {
    const spots: Record<'work' | 'vip' | 'cafe', Array<{ gx: number; gy: number }>> = {
      work: [
        { gx: 3, gy: 1 },
        { gx: 2, gy: 7 },
        { gx: 4, gy: 7 },
        { gx: 6, gy: 7 },
        { gx: 10, gy: 6 },
        { gx: 2, gy: 11 },
        { gx: 4, gy: 11 },
        { gx: 6, gy: 11 },
      ],
      vip: [
        { gx: 2, gy: 1 },
        { gx: 3, gy: 1 },
        { gx: 5, gy: 1 },
        { gx: 6, gy: 1 },
        { gx: 2, gy: 3 },
        { gx: 4, gy: 3 },
        { gx: 6, gy: 3 },
        { gx: 7, gy: 2 },
      ],
      cafe: [
        { gx: 10, gy: 6 },
        { gx: 11, gy: 6 },
        { gx: 10, gy: 7 },
        { gx: 11, gy: 8 },
        { gx: 10, gy: 10 },
        { gx: 11, gy: 10 },
        { gx: 9, gy: 9 },
        { gx: 8, gy: 9 },
      ],
    };

    const list = spots[mode];
    const agents = this.avatars.filter((a) => !a.isFounder);
    agents.forEach((av, idx) => {
      const target = list[idx % list.length];
      const path = this.findPath(av.gx, av.gy, target.gx, target.gy, av.id);
      if (path.length > 0) {
        av.path = path;
        av.nextRoamAt = Date.now() + 25000;
      } else {
        av.gx = target.gx;
        av.gy = target.gy;
      }
    });

    if (mode === 'vip') {
      this.pushBubble('agent-00-researcher', 'Pessoal, subam a escada para o Mezanino VIP! Mesa Redonda iniciando.', true);
    } else if (mode === 'cafe') {
      this.pushBubble('agent-04-user', 'Pausa para o espresso e PixCola no lounge!', false);
    } else {
      this.pushBubble('agent-01-dev', 'De volta às bancadas dual-monitor! Foco total no código.', false);
    }
  }

  private renderCatalogModal(): void {
    this.catalogModalEl.innerHTML = `
      <div class="pixhotel-catalog-window">
        <div class="pixhotel-catalog-header">
          <div>
            <div class="pixhotel-catalog-title">🛒 Catálogo PixFurni · Decorar Escritório</div>
            <div class="pixhotel-catalog-sub">Todos os mobis são 100% autorais (Plano B comercializável) · Clique para posicionar no quarto</div>
          </div>
          <div class="pixhotel-catalog-coins">🪙 <span id="pixhotel-coins-val">${this.pixelCoins}</span> PixCoins</div>
          <button type="button" class="pixhotel-catalog-close" id="pixhotel-cat-close">✕</button>
        </div>
        <div class="pixhotel-catalog-grid">
          ${PIX_FURNI_CATALOG.map(
            (item) => `
            <div class="pixhotel-cat-item" data-furni-type="${item.type}">
              <div class="pixhotel-cat-item__head">
                <span class="pixhotel-cat-item__cat">${item.category}</span>
                <span class="pixhotel-cat-item__price">🪙 ${item.priceCoins}</span>
              </div>
              <div class="pixhotel-cat-item__name">${item.name}</div>
              <div class="pixhotel-cat-item__desc">${item.desc}</div>
              <button type="button" class="pixhotel-cat-item__buy" data-buy-type="${item.type}">
                Colocar no Quarto (${item.sizeX}x${item.sizeY})
              </button>
            </div>
          `,
          ).join('')}
        </div>
        <div class="pixhotel-catalog-footer">
          <button type="button" class="pixhotel-mini-btn" id="pixhotel-reset-furni">🔄 Restaurar Decoração Padrão</button>
          <span>Dica: Com um mobi selecionado no quarto, você pode Girar, Mover ou Guardar.</span>
        </div>
      </div>
    `;

    this.catalogModalEl.querySelector('#pixhotel-cat-close')?.addEventListener('click', () => {
      this.catalogModalEl.style.display = 'none';
    });

    this.catalogModalEl.querySelector('#pixhotel-reset-furni')?.addEventListener('click', () => {
      this.furni = defaultFurniLayout();
      this.saveFurni();
      this.catalogModalEl.style.display = 'none';
    });

    this.catalogModalEl.querySelectorAll('[data-buy-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = (btn as HTMLElement).getAttribute('data-buy-type') as FurniType;
        this.placingType = t;
        this.moveMode = true;
        this.moveBtnEl?.classList.add('is-active');
        this.catalogModalEl.style.display = 'none';
        this.updateInspectorCard();
      });
    });
  }

  private updateInspectorCard(): void {
    if (!this.cornerCardEl) return;

    if (this.placingType) {
      const meta = getCatalogMeta(this.placingType);
      this.cornerCardEl.innerHTML = `
        <div class="pixhotel-card__tag">MODO CONSTRUÇÃO · POSICIONAR MOBI</div>
        <div class="pixhotel-card__title">📦 ${meta.name}</div>
        <div class="pixhotel-card__desc">Clique em qualquer ladrilho livre do chão para colocar este mobi.</div>
        <div class="pixhotel-card__actions">
          <button type="button" class="pixhotel-card__btn" id="pixhotel-act-rot-place">🔄 Girar (${this.placingRot === 0 ? 'SE' : 'SW'})</button>
          <button type="button" class="pixhotel-card__btn pixhotel-card__btn--danger" id="pixhotel-act-cancel-place">Cancelar</button>
        </div>
      `;
      this.cornerCardEl.querySelector('#pixhotel-act-rot-place')?.addEventListener('click', () => {
        this.placingRot = this.placingRot === 0 ? 1 : 0;
        this.updateInspectorCard();
      });
      this.cornerCardEl.querySelector('#pixhotel-act-cancel-place')?.addEventListener('click', () => {
        this.placingType = null;
        this.moveMode = false;
        this.moveBtnEl?.classList.remove('is-active');
        this.updateInspectorCard();
      });
      return;
    }

    if (this.selectedFurniId) {
      const f = this.furni.find((item) => item.id === this.selectedFurniId);
      if (f) {
        const meta = getCatalogMeta(f.type);
        this.cornerCardEl.innerHTML = `
          <div class="pixhotel-card__tag">MOBI SELECIONADO · [${f.gx}, ${f.gy}]</div>
          <div class="pixhotel-card__title">🪑 ${meta.name}</div>
          <div class="pixhotel-card__desc">${meta.desc}</div>
          <div class="pixhotel-card__actions">
            <button type="button" class="pixhotel-card__btn" id="pixhotel-act-rotate">🔄 Girar</button>
            <button type="button" class="pixhotel-card__btn" id="pixhotel-act-move">${this.moveMode ? '✅ Soltar' : '✋ Mover'}</button>
            <button type="button" class="pixhotel-card__btn" id="pixhotel-act-use">⚡ Usar</button>
            <button type="button" class="pixhotel-card__btn pixhotel-card__btn--danger" id="pixhotel-act-del">🗑️ Guardar</button>
          </div>
        `;
        this.cornerCardEl.querySelector('#pixhotel-act-rotate')?.addEventListener('click', () => {
          f.rot = f.rot === 0 ? 1 : 0;
          this.saveFurni();
        });
        this.cornerCardEl.querySelector('#pixhotel-act-move')?.addEventListener('click', () => {
          this.moveMode = !this.moveMode;
          this.moveBtnEl?.classList.toggle('is-active', this.moveMode);
          this.updateInspectorCard();
        });
        this.cornerCardEl.querySelector('#pixhotel-act-use')?.addEventListener('click', () => {
          f.state = f.state ? 0 : 1;
          this.saveFurni();
          if (f.type === 'holo_screen') triggerMeetingModal();
        });
        this.cornerCardEl.querySelector('#pixhotel-act-del')?.addEventListener('click', () => {
          this.furni = this.furni.filter((item) => item.id !== f.id);
          this.selectedFurniId = null;
          this.saveFurni();
          this.updateInspectorCard();
        });
        return;
      }
    }

    const av = this.avatars.find((a) => a.id === this.selectedAvatarId) || this.avatars[0];
    this.cornerCardEl.innerHTML = `
      <div class="pixhotel-card__tag">HABITANTE DO QUARTO · ${av.role.toUpperCase()}</div>
      <div class="pixhotel-card__title">👤 ${av.name}</div>
      <div class="pixhotel-card__desc">${av.statusText}</div>
      <div class="pixhotel-card__actions">
        <button type="button" class="pixhotel-card__btn" id="pixhotel-act-talk">💬 Falar com ${av.name.split(' ').pop()}</button>
        <button type="button" class="pixhotel-card__btn" id="pixhotel-act-call">📞 Call de Voz</button>
      </div>
    `;
    this.cornerCardEl.querySelector('#pixhotel-act-talk')?.addEventListener('click', () => {
      if (!av.isFounder && this.targetSelectEl) {
        this.targetSelectEl.value = av.id;
      }
      this.chatInputEl?.focus();
    });
    this.cornerCardEl.querySelector('#pixhotel-act-call')?.addEventListener('click', () => {
      triggerPhoneModal();
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDraggingCam = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.camStartX = this.camX;
      this.camStartY = this.camY;
      this.pointerDownDist = 0;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isDraggingCam) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.pointerDownDist = Math.hypot(dx, dy);
        if (this.pointerDownDist > 5) {
          this.camX = this.camStartX + dx;
          this.camY = this.camStartY + dy;
        }
      }

      this.hoverTile = this.screenToIso(mx, my);
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.active || !this.isDraggingCam) return;
      this.isDraggingCam = false;
      if (this.pointerDownDist > 7) return; // Foi um arrasto de câmera, não um clique

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.handleCanvasClick(mx, my);
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.active) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        this.zoom = Math.max(0.65, Math.min(1.85, this.zoom * factor));
      },
      { passive: false },
    );
  }

  private handleCanvasClick(mx: number, my: number): void {
    const tile = this.screenToIso(mx, my);

    // 1. Se estiver posicionando um novo mobi do Catálogo
    if (this.placingType && tile) {
      this.furni.push({
        id: `f-custom-${Date.now()}`,
        type: this.placingType,
        gx: tile.gx,
        gy: tile.gy,
        rot: this.placingRot,
        state: 1,
      });
      this.saveFurni();
      this.placingType = null;
      this.moveMode = false;
      this.moveBtnEl?.classList.remove('is-active');
      this.updateInspectorCard();
      return;
    }

    // 2. Se estiver no modo Mover com um Mobi selecionado
    if (this.moveMode && this.selectedFurniId && tile) {
      const f = this.furni.find((item) => item.id === this.selectedFurniId);
      if (f) {
        f.gx = tile.gx;
        f.gy = tile.gy;
        this.saveFurni();
        this.updateInspectorCard();
        return;
      }
    }

    // 3. Verifica se clicou em cima de um Avatar
    for (const av of [...this.avatars].reverse()) {
      const gz = this.getTileLevel(Math.round(av.gx), Math.round(av.gy));
      const p = this.isoToScreen(av.gx + 0.5, av.gy + 0.5, gz);
      if (Math.abs(mx - p.x) <= 22 * this.zoom && my >= p.y - 62 * this.zoom && my <= p.y + 8 * this.zoom) {
        this.selectedAvatarId = av.id;
        this.selectedFurniId = null;
        av.waveUntil = Date.now() + 2000;
        if (!av.isFounder && this.targetSelectEl) {
          this.targetSelectEl.value = av.id;
        }
        this.updateInspectorCard();
        return;
      }
    }

    if (!tile) return;

    // 4. Verifica se clicou em um Mobi naquele ladrilho
    const clickedFurni = this.furni.find((f) => {
      const meta = getCatalogMeta(f.type);
      const sx = f.rot === 0 ? meta.sizeX : meta.sizeY;
      const sy = f.rot === 0 ? meta.sizeY : meta.sizeX;
      return tile.gx >= f.gx && tile.gx < f.gx + sx && tile.gy >= f.gy && tile.gy < f.gy + sy;
    });

    if (clickedFurni) {
      this.selectedFurniId = clickedFurni.id;
      this.updateInspectorCard();
      // Se for uma cadeira ou sofá, o seu avatar Founder também anda até lá para sentar!
      const meta = getCatalogMeta(clickedFurni.type);
      if (!meta.canSit && !meta.isWalkable) {
        if (clickedFurni.type === 'holo_screen') {
          triggerMeetingModal();
        }
        return;
      }
    } else {
      this.selectedFurniId = null;
      this.updateInspectorCard();
    }

    // 5. Anda com o seu Avatar Founder ("Você") até o ladrilho clicado!
    const me = this.avatars.find((a) => a.isFounder);
    if (me) {
      const path = this.findPath(me.gx, me.gy, tile.gx, tile.gy, me.id);
      if (path.length > 0) {
        me.path = path;
      }
    }
  }

  private resize(): void {
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private startLoop(): void {
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.active) {
        this.updateSimulation(dt, now);
        this.renderScene(now);
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private updateSimulation(dt: number, now: number): void {
    const wallNow = Date.now();

    // Sincroniza status real dos agentes do store (se disponível)
    const snapAgents = this.store.snapshot?.agents || [];
    for (const sa of snapAgents) {
      const match = this.avatars.find((av) => av.id === sa.id || av.name.toLowerCase().includes(sa.name.toLowerCase()));
      if (match && sa.task) {
        match.statusText = sa.task;
      }
    }

    // Atualiza caminhada e comportamento autônomo dos 8 agentes
    for (const av of this.avatars) {
      if (av.path.length > 0) {
        av.action = 'walk';
        const next = av.path[0];
        const dx = next.gx - av.gx;
        const dy = next.gy - av.gy;
        const dist = Math.hypot(dx, dy);
        const speed = 3.2 * dt;

        if (Math.abs(dx) > Math.abs(dy)) {
          av.dir = dx > 0 ? 'SE' : 'NW';
        } else {
          av.dir = dy > 0 ? 'SW' : 'NE';
        }

        if (dist <= speed) {
          av.gx = next.gx;
          av.gy = next.gy;
          av.path.shift();
        } else {
          av.gx += (dx / dist) * speed;
          av.gy += (dy / dist) * speed;
        }
      } else {
        const rx = Math.round(av.gx);
        const ry = Math.round(av.gy);
        av.gx = rx;
        av.gy = ry;

        const seat = this.isSeatTile(rx, ry);
        if (seat) {
          if (this.hasDeskInFront(rx, ry)) {
            av.action = 'type';
            av.dir = 'NW';
          } else {
            av.action = 'sit';
            av.dir = seat.rot === 0 ? 'SE' : 'SW';
          }
        } else if (rx >= 10 && ry >= 5 && ry <= 8) {
          av.action = 'coffee';
          av.dir = 'SW';
        } else {
          av.action = 'idle';
        }

        // Agentes caminham ocasionalmente entre bancada, café e mezanino para dar vida ao quarto
        if (!av.isFounder && wallNow >= av.nextRoamAt) {
          av.nextRoamAt = wallNow + 16000 + Math.random() * 18000;
          if (Math.random() < 0.35) {
            const candidateSpots = [
              { gx: 10, gy: 6 },
              { gx: 11, gy: 7 },
              { gx: 3, gy: 1 },
              { gx: 5, gy: 1 },
              { gx: 2, gy: 7 },
              { gx: 4, gy: 7 },
              { gx: 6, gy: 7 },
              { gx: 2, gy: 11 },
              { gx: 4, gy: 11 },
              { gx: 6, gy: 11 },
              { gx: 10, gy: 10 },
            ];
            const pick = candidateSpots[Math.floor(Math.random() * candidateSpots.length)];
            const p = this.findPath(av.gx, av.gy, pick.gx, pick.gy, av.id);
            if (p.length > 0) av.path = p;
          }
        }
      }
    }

    // Flutuação suave em cascata dos balões de chat (estilo Habbo Hotel)
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.currentY -= 5.5 * dt; // sobe lentamente para o teto
      if (wallNow - b.createdAt > 18000 || b.currentY < 34) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // RENDERIZAÇÃO ISOMÉTRICA 2:1 (PAREDES EM L, LADRILHOS 64x32, MOBIS E AVATARES)
  // ============================================================================

  private renderScene(now: number): void {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    // 1. Fundo Azul-Noite Profundo do Hotel com estrelas pixeladas
    ctx.fillStyle = '#0b0e17';
    ctx.fillRect(0, 0, w, h);
    this.drawStarfield(ctx, w, h, now);

    // 2. Paredes em "L" chanfradas (Parede Traseira gy=0 e Parede Esquerda gx=0)
    this.drawCutawayWalls(ctx, now);

    // 3. Piso Isométrico 64x32 (Mezanino Nível 1, Escadinha e Salão Principal Nível 0)
    this.drawIsometricFloor(ctx, now);

    // 4. Cursor branco luminoso do ladrilho sob o mouse (clássico do Habbo!)
    if (this.hoverTile && this.isTileValid(this.hoverTile.gx, this.hoverTile.gy)) {
      const gz = this.getTileLevel(this.hoverTile.gx, this.hoverTile.gy);
      this.drawTileCursor(ctx, this.hoverTile.gx, this.hoverTile.gy, gz);
    }

    // 5. Ordenação de profundidade (Painter's Algorithm: gx + gy + zOffset) para Mobis e Avatares
    const drawList: Array<{ depth: number; draw: () => void }> = [];

    for (const f of this.furni) {
      const meta = getCatalogMeta(f.type);
      const gz = this.getTileLevel(f.gx, f.gy);
      const depth = f.gx + f.gy + (meta.isWalkable ? -1.5 : 0.2) + gz * 0.5;
      drawList.push({
        depth,
        draw: () => this.drawFurniItem(ctx, f, gz, now),
      });
    }

    for (const av of this.avatars) {
      const gz = this.getTileLevel(Math.round(av.gx), Math.round(av.gy));
      const depth = av.gx + av.gy + 0.45 + gz * 0.5;
      drawList.push({
        depth,
        draw: () => this.drawIsoAvatar(ctx, av, gz, now),
      });
    }

    drawList.sort((a, b) => a.depth - b.depth);
    for (const item of drawList) {
      item.draw();
    }

    // 6. Balões de Chat em Cascata no topo
    this.drawCascadingBubbles(ctx);
  }

  private drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    // Halo sutil atrás do quarto isométrico
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 50, w * 0.5, h * 0.45, Math.max(w, h) * 0.6);
    grad.addColorStop(0, 'rgba(30, 58, 138, 0.22)');
    grad.addColorStop(1, 'rgba(11, 14, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Pontos de luz pixelados discretos
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    for (let i = 0; i < 36; i++) {
      const sx = ((i * 197) % w);
      const sy = ((i * 131) % h);
      const twinkle = Math.sin(now * 0.002 + i) > 0.3 ? 2 : 1;
      ctx.fillRect(sx, sy, twinkle, twinkle);
    }
  }

  private drawIsoDiamond(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    gz: number,
    fill: string,
    stroke = '#1e293b',
    thicknessPx = 8,
  ): void {
    const top = this.isoToScreen(gx, gy, gz);
    const right = this.isoToScreen(gx + 1, gy, gz);
    const bottom = this.isoToScreen(gx + 1, gy + 1, gz);
    const left = this.isoToScreen(gx, gy + 1, gz);

    // Espessura lateral da laje (chanfro 3D do piso do Habbo)
    if (thicknessPx > 0) {
      const th = thicknessPx * this.zoom;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(bottom.x, bottom.y);
      ctx.lineTo(bottom.x, bottom.y + th);
      ctx.lineTo(left.x, left.y + th);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(bottom.x, bottom.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(right.x, right.y + th);
      ctx.lineTo(bottom.x, bottom.y + th);
      ctx.closePath();
      ctx.fill();
    }

    // Face superior do ladrilho
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, 1 * this.zoom);
    ctx.stroke();
  }

  private drawIsometricFloor(ctx: CanvasRenderingContext2D, now: number): void {
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        // Parede divisória do mezanino em gy=4 (exceto escada gx 4..6)
        if (gy === 4 && (gx < 4 || gx > 6)) {
          // Desenha o degrau/mureta frontal do Mezanino VIP
          this.drawMezzanineFrontWall(ctx, gx, gy);
          continue;
        }

        // Escadinha isométrica conectando o Mezanino VIP (gy=3) ao Salão Principal (gy=5)
        if (gy === 4 && gx >= 4 && gx <= 6) {
          this.drawIsometricStairs(ctx, gx, gy);
          continue;
        }

        const gz = this.getTileLevel(gx, gy);
        const checker = (gx + gy) % 2 === 0;

        let fill = checker ? '#d9a15b' : '#cf9650'; // Parquet de carvalho mel (Salão Dev)
        let stroke = 'rgba(120, 72, 24, 0.45)';

        if (gz === 1) {
          // Mezanino VIP: Carpete Executivo Bordô & Ouro
          fill = checker ? '#881337' : '#9f1239';
          stroke = 'rgba(251, 191, 36, 0.32)';
        } else if (gx >= 9 && gy >= 5 && gy <= 9) {
          // Piso Xadrez Retrô da Cafeteria & Lounge
          fill = checker ? '#e2e8f0' : '#475569';
          stroke = 'rgba(30, 41, 59, 0.4)';
        } else if (gx === 0 && gy === 8) {
          // Tapete de entrada na porta do quarto
          fill = '#1d4ed8';
          stroke = '#93c5fd';
        }

        this.drawIsoDiamond(ctx, gx, gy, gz, fill, stroke, gz === 1 ? 14 : 9);
      }
    }
  }

  private drawMezzanineFrontWall(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
    const pLeft = this.isoToScreen(gx, gy, 1);
    const pRight = this.isoToScreen(gx + 1, gy, 1);
    const drop = LEVEL_H * this.zoom;

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pRight.x, pRight.y + drop);
    ctx.lineTo(pLeft.x, pLeft.y + drop);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawIsometricStairs(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
    // 3 degraus isométricos dourados/madeira
    for (let s = 0; s < 3; s++) {
      const stepGz = 0.8 - s * 0.32;
      const sy0 = gy + (s / 3);
      const sy1 = gy + ((s + 1) / 3);
      const tl = this.isoToScreen(gx, sy0, stepGz);
      const tr = this.isoToScreen(gx + 1, sy0, stepGz);
      const br = this.isoToScreen(gx + 1, sy1, stepGz);
      const bl = this.isoToScreen(gx, sy1, stepGz);

      ctx.fillStyle = s % 2 === 0 ? '#f59e0b' : '#d97706';
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.stroke();
    }
  }

  private drawCutawayWalls(ctx: CanvasRenderingContext2D, now: number): void {
    const wallH = 108 * this.zoom;
    const thick = 8 * this.zoom;

    // 1. Parede Traseira Direita (gy = 0, gx = 0..GRID_W)
    for (let gx = 0; gx < GRID_W; gx++) {
      const gz = this.getTileLevel(gx, 0);
      const bLeft = this.isoToScreen(gx, 0, gz);
      const bRight = this.isoToScreen(gx + 1, 0, gz);

      // Face frontal da parede
      ctx.fillStyle = gx % 2 === 0 ? '#cbd5e1' : '#c2cddb';
      ctx.beginPath();
      ctx.moveTo(bLeft.x, bLeft.y - wallH);
      ctx.lineTo(bRight.x, bRight.y - wallH);
      ctx.lineTo(bRight.x, bRight.y);
      ctx.lineTo(bLeft.x, bLeft.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rodapé de madeira
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(bLeft.x, bLeft.y - 9 * this.zoom);
      ctx.lineTo(bRight.x, bRight.y - 9 * this.zoom);
      ctx.lineTo(bRight.x, bRight.y);
      ctx.lineTo(bLeft.x, bLeft.y);
      ctx.closePath();
      ctx.fill();

      // Chanfro de corte superior da parede (estilo Habbo Cutaway Wall)
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(bLeft.x, bLeft.y - wallH);
      ctx.lineTo(bRight.x, bRight.y - wallH);
      ctx.lineTo(bRight.x, bRight.y - wallH - thick);
      ctx.lineTo(bLeft.x, bLeft.y - wallH - thick);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Janelas panorâmicas noturnas na parede traseira (gx = 6, 7)
      if (gx === 6 || gx === 7) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(bLeft.x + 3 * this.zoom, bLeft.y - wallH * 0.78);
        ctx.lineTo(bRight.x - 3 * this.zoom, bRight.y - wallH * 0.78);
        ctx.lineTo(bRight.x - 3 * this.zoom, bRight.y - wallH * 0.25);
        ctx.lineTo(bLeft.x + 3 * this.zoom, bLeft.y - wallH * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }
    }

    // 2. Parede Esquerda (gx = 0, gy = 0..GRID_H)
    for (let gy = 0; gy < GRID_H; gy++) {
      if (gy === 4) continue;
      const gz = this.getTileLevel(0, gy);
      const bTop = this.isoToScreen(0, gy, gz);
      const bBot = this.isoToScreen(0, gy + 1, gz);
      const isDoor = gy === 8;

      ctx.fillStyle = gy % 2 === 0 ? '#94a3b8' : '#8b9bb0';
      ctx.beginPath();
      ctx.moveTo(bTop.x, bTop.y - wallH);
      ctx.lineTo(bBot.x, bBot.y - wallH);
      ctx.lineTo(bBot.x, bBot.y);
      ctx.lineTo(bTop.x, bTop.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Porta de Entrada do Quarto (gy = 8)
      if (isDoor) {
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.moveTo(bTop.x, bTop.y - wallH * 0.72);
        ctx.lineTo(bBot.x, bBot.y - wallH * 0.72);
        ctx.lineTo(bBot.x, bBot.y);
        ctx.lineTo(bTop.x, bTop.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
      }

      // Chanfro superior
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(bTop.x, bTop.y - wallH);
      ctx.lineTo(bBot.x, bBot.y - wallH);
      ctx.lineTo(bBot.x, bBot.y - wallH - thick);
      ctx.lineTo(bTop.x, bTop.y - wallH - thick);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.stroke();
    }
  }

  private drawTileCursor(ctx: CanvasRenderingContext2D, gx: number, gy: number, gz: number): void {
    const top = this.isoToScreen(gx, gy, gz);
    const right = this.isoToScreen(gx + 1, gy, gz);
    const bottom = this.isoToScreen(gx + 1, gy + 1, gz);
    const left = this.isoToScreen(gx, gy + 1, gz);

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, 2.6 * this.zoom);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================================
  // DESENHO DOS MOBIS AUTORAIS (PIXFURNI) EM PROJEÇÃO ISOMÉTRICA 2:1
  // ============================================================================

  private drawIsoBox(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    gz: number,
    sx: number,
    sy: number,
    heightPx: number,
    topColor: string,
    leftColor: string,
    rightColor: string,
    outline = '#0f172a',
  ): void {
    const h = heightPx * this.zoom;
    const pTop = this.isoToScreen(gx, gy, gz);
    const pRight = this.isoToScreen(gx + sx, gy, gz);
    const pBot = this.isoToScreen(gx + sx, gy + sy, gz);
    const pLeft = this.isoToScreen(gx, gy + sy, gz);

    // Face esquerda
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y - h);
    ctx.lineTo(pBot.x, pBot.y - h);
    ctx.lineTo(pBot.x, pBot.y);
    ctx.lineTo(pLeft.x, pLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Face direita
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(pBot.x, pBot.y - h);
    ctx.lineTo(pRight.x, pRight.y - h);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(pBot.x, pBot.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Topo
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y - h);
    ctx.lineTo(pRight.x, pRight.y - h);
    ctx.lineTo(pBot.x, pBot.y - h);
    ctx.lineTo(pLeft.x, pLeft.y - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawFurniItem(ctx: CanvasRenderingContext2D, f: PlacedFurni, gz: number, now: number): void {
    const meta = getCatalogMeta(f.type);
    const sx = f.rot === 0 ? meta.sizeX : meta.sizeY;
    const sy = f.rot === 0 ? meta.sizeY : meta.sizeX;
    const isSel = this.selectedFurniId === f.id;

    if (isSel) {
      this.drawTileCursor(ctx, f.gx, f.gy, gz);
    }

    switch (f.type) {
      case 'rug_vip': {
        this.drawIsoBox(ctx, f.gx, f.gy, gz, sx, sy, 2, '#991b1b', '#7f1d1d', '#b45309', '#fbbf24');
        break;
      }
      case 'club_sofa': {
        // Assento bordô imperial + encosto alto com friso dourado (Sofá PixClub VIP)
        this.drawIsoBox(ctx, f.gx, f.gy, gz, sx, sy, 14, '#be123c', '#9f1239', '#881337', '#1e1b4b');
        this.drawIsoBox(ctx, f.gx, f.gy, gz + 0.45, sx, sy * 0.42, 16, '#fbbf24', '#be123c', '#881337', '#1e1b4b');
        break;
      }
      case 'conf_table': {
        this.drawIsoBox(ctx, f.gx, f.gy, gz, sx, sy, 20, '#92400e', '#78350f', '#451a03', '#1e293b');
        break;
      }
      case 'dev_desk': {
        // Mesa + 2 monitores isométricos com linhas de código verdes/azuis animadas
        this.drawIsoBox(ctx, f.gx, f.gy, gz, 1, 1, 20, '#e2e8f0', '#94a3b8', '#64748b', '#0f172a');
        const c = this.isoToScreen(f.gx + 0.5, f.gy + 0.5, gz);
        const z = this.zoom;
        // Monitor 1 e 2
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(c.x - 16 * z, c.y - 42 * z, 15 * z, 13 * z);
        ctx.fillRect(c.x + 1 * z, c.y - 40 * z, 15 * z, 13 * z);
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(c.x - 16 * z, c.y - 42 * z, 15 * z, 13 * z);
        ctx.strokeRect(c.x + 1 * z, c.y - 40 * z, 15 * z, 13 * z);
        // Linhas de código piscando
        ctx.fillStyle = '#22c55e';
        const lineOffset = Math.floor(now / 300) % 3;
        ctx.fillRect(c.x - 14 * z, c.y - (39 - lineOffset * 2) * z, 9 * z, 2 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(c.x + 3 * z, c.y - (37 - lineOffset * 2) * z, 10 * z, 2 * z);
        break;
      }
      case 'exec_chair': {
        this.drawIsoBox(ctx, f.gx + 0.15, f.gy + 0.15, gz, 0.7, 0.7, 13, '#3b82f6', '#1d4ed8', '#1e3a8a', '#0f172a');
        this.drawIsoBox(ctx, f.gx + 0.15, f.gy + 0.55, gz + 0.4, 0.7, 0.25, 14, '#60a5fa', '#2563eb', '#1e3a8a', '#0f172a');
        break;
      }
      case 'espresso_bar': {
        this.drawIsoBox(ctx, f.gx, f.gy, gz, 1, 1, 24, '#78350f', '#451a03', '#27272a', '#0f172a');
        this.drawIsoBox(ctx, f.gx + 0.2, f.gy + 0.2, gz + 0.85, 0.6, 0.6, 15, '#ef4444', '#b91c1c', '#7f1d1d', '#0f172a');
        // Vapor de café subindo
        const c = this.isoToScreen(f.gx + 0.5, f.gy + 0.5, gz + 1.4);
        const floatY = (now * 0.02) % 12;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(c.x, c.y - floatY * this.zoom, 3 * this.zoom, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'vending_drinks': {
        this.drawIsoBox(ctx, f.gx, f.gy, gz, 1, 1, 46, '#0284c7', '#0369a1', '#0c4a6e', '#0f172a');
        const c = this.isoToScreen(f.gx + 0.5, f.gy + 0.5, gz);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(c.x - 8 * this.zoom, c.y - 38 * this.zoom, 16 * this.zoom, 22 * this.zoom);
        break;
      }
      case 'server_rack': {
        this.drawIsoBox(ctx, f.gx, f.gy, gz, 1, 1, 52, '#334155', '#1e293b', '#0f172a', '#020617');
        const c = this.isoToScreen(f.gx + 0.5, f.gy + 0.5, gz);
        const z = this.zoom;
        for (let row = 0; row < 5; row++) {
          const on = (Math.floor(now / 220) + row) % 2 === 0;
          ctx.fillStyle = on ? '#22c55e' : '#38bdf8';
          ctx.fillRect(c.x - 8 * z, c.y - (44 - row * 7) * z, 4 * z, 3 * z);
          ctx.fillStyle = !on ? '#f59e0b' : '#22c55e';
          ctx.fillRect(c.x + 2 * z, c.y - (44 - row * 7) * z, 4 * z, 3 * z);
        }
        break;
      }
      case 'holo_screen': {
        const c = this.isoToScreen(f.gx + 1, f.gy + 0.2, gz);
        const z = this.zoom;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5 * z;
        ctx.fillRect(c.x - 58 * z, c.y - 88 * z, 116 * z, 58 * z);
        ctx.strokeRect(c.x - 58 * z, c.y - 88 * z, 116 * z, 58 * z);

        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.round(10 * z)}px Tahoma, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('PIXOFFICE CLOUD 24/7 · SPRINT LIVE', c.x, c.y - 72 * z);
        ctx.fillStyle = '#22c55e';
        ctx.font = `bold ${Math.round(9 * z)}px Tahoma, sans-serif`;
        ctx.fillText('8 Agentes Ativos · Build OK · Clique p/ 3D', c.x, c.y - 54 * z);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('GitHub: Joopdr/pixoffice-cloud [MAIN]', c.x, c.y - 39 * z);
        break;
      }
      case 'arcade_cab': {
        this.drawIsoBox(ctx, f.gx, f.gy, gz, 1, 1, 44, '#7c3aed', '#6d28d9', '#4c1d95', '#0f172a');
        const c = this.isoToScreen(f.gx + 0.5, f.gy + 0.5, gz);
        ctx.fillStyle = Math.floor(now / 400) % 2 === 0 ? '#f43f5e' : '#facc15';
        ctx.fillRect(c.x - 8 * this.zoom, c.y - 36 * this.zoom, 16 * this.zoom, 14 * this.zoom);
        break;
      }
      case 'palm_plant': {
        this.drawIsoBox(ctx, f.gx + 0.22, f.gy + 0.22, gz, 0.56, 0.56, 15, '#d97706', '#b45309', '#92400e', '#0f172a');
        const c = this.isoToScreen(f.gx + 0.5, f.gy + 0.5, gz);
        const z = this.zoom;
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(c.x, c.y - 28 * z, 13 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(c.x - 6 * z, c.y - 33 * z, 9 * z, 0, Math.PI * 2);
        ctx.arc(c.x + 6 * z, c.y - 33 * z, 9 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  // ============================================================================
  // DESENHO DOS AVATARES ISOMÉTRICOS (PIXAVATARS ESTILO HABBO HOTEL)
  // ============================================================================

  private drawIsoAvatar(ctx: CanvasRenderingContext2D, av: IsoAvatar, gz: number, now: number): void {
    const pos = this.isoToScreen(av.gx + 0.5, av.gy + 0.5, gz);
    const z = this.zoom;
    const isSel = this.selectedAvatarId === av.id;
    const isTalking = Date.now() < av.talkUntil;
    const isWaving = Date.now() < av.waveUntil;

    const walkBob = av.action === 'walk' ? Math.abs(Math.sin(now * 0.015)) * 5 * z : 0;
    const sitOffset = av.action === 'sit' || av.action === 'type' ? 6 * z : 0;
    const baseX = pos.x;
    const baseY = pos.y - walkBob + sitOffset;

    ctx.save();

    // Sombra elíptica no ladrilho
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 2 * z, 13 * z, 6.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Indicador luminoso sob o agente selecionado
    if (isSel) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 2 * z, 16 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Pernas / Calça pixelada
    const legSwing = av.action === 'walk' ? Math.sin(now * 0.015) * 4 * z : 0;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.2 * z;
    ctx.fillRect(baseX - 7 * z, baseY - 14 * z + legSwing, 6 * z, 13 * z);
    ctx.strokeRect(baseX - 7 * z, baseY - 14 * z + legSwing, 6 * z, 13 * z);
    ctx.fillRect(baseX + 1 * z, baseY - 14 * z - legSwing, 6 * z, 13 * z);
    ctx.strokeRect(baseX + 1 * z, baseY - 14 * z - legSwing, 6 * z, 13 * z);

    // Tronco Isométrico (Camisa / Jaqueta com sombreamento em 2 tons)
    ctx.fillStyle = av.shirtColor;
    ctx.fillRect(baseX - 10 * z, baseY - 31 * z, 20 * z, 18 * z);
    ctx.fillStyle = av.shirtDark;
    ctx.fillRect(baseX + 2 * z, baseY - 31 * z, 8 * z, 18 * z);
    ctx.strokeRect(baseX - 10 * z, baseY - 31 * z, 20 * z, 18 * z);

    // Braços (Acenando o/, digitando, segurando café ou normal)
    ctx.fillStyle = av.shirtColor;
    if (isWaving) {
      const waveAngle = Math.sin(now * 0.02) * 4 * z;
      ctx.fillRect(baseX - 15 * z, baseY - 42 * z + waveAngle, 5 * z, 14 * z);
      ctx.strokeRect(baseX - 15 * z, baseY - 42 * z + waveAngle, 5 * z, 14 * z);
    } else {
      ctx.fillRect(baseX - 14 * z, baseY - 29 * z, 4 * z, 13 * z);
      ctx.strokeRect(baseX - 14 * z, baseY - 29 * z, 4 * z, 13 * z);
    }
    ctx.fillRect(baseX + 10 * z, baseY - 29 * z, 4 * z, 13 * z);
    ctx.strokeRect(baseX + 10 * z, baseY - 29 * z, 4 * z, 13 * z);

    // Se estiver tomando café, desenha a caneca fumegante na mão!
    if (av.action === 'coffee') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(baseX + 12 * z, baseY - 24 * z, 6 * z, 7 * z);
      ctx.strokeRect(baseX + 12 * z, baseY - 24 * z, 6 * z, 7 * z);
    }

    // Cabeça Isométrica (Proporção expressiva estilo Habbo Hotel)
    ctx.fillStyle = av.skinColor;
    ctx.fillRect(baseX - 11 * z, baseY - 51 * z, 22 * z, 20 * z);
    ctx.strokeRect(baseX - 11 * z, baseY - 51 * z, 22 * z, 20 * z);

    // Cabelo pixel-art
    ctx.fillStyle = av.hairColor;
    ctx.fillRect(baseX - 12 * z, baseY - 56 * z, 24 * z, 8 * z);
    ctx.strokeRect(baseX - 12 * z, baseY - 56 * z, 24 * z, 8 * z);

    // Olhos e Boca (mexe a boca quando fala!)
    const facingFront = av.dir === 'SE' || av.dir === 'SW';
    if (facingFront) {
      const lookShift = av.dir === 'SE' ? 2 * z : -2 * z;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(baseX - 5 * z + lookShift, baseY - 43 * z, 3 * z, 3 * z);
      ctx.fillRect(baseX + 3 * z + lookShift, baseY - 43 * z, 3 * z, 3 * z);

      // Boca animada ao falar
      if (isTalking && Math.floor(now / 120) % 2 === 0) {
        ctx.fillStyle = '#be123c';
        ctx.fillRect(baseX - 2 * z + lookShift, baseY - 36 * z, 5 * z, 3.5 * z);
      } else {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(baseX - 2 * z + lookShift, baseY - 36 * z, 4 * z, 1.5 * z);
      }
    }

    // Acessórios exclusivos de cada agente (Coroa Founder, Headset, Óculos, Boina)
    if (av.accessory === 'crown') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(baseX - 8 * z, baseY - 62 * z, 16 * z, 6 * z);
      ctx.strokeRect(baseX - 8 * z, baseY - 62 * z, 16 * z, 6 * z);
    } else if (av.accessory === 'glasses') {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5 * z;
      ctx.strokeRect(baseX - 7 * z, baseY - 44 * z, 6 * z, 5 * z);
      ctx.strokeRect(baseX + 2 * z, baseY - 44 * z, 6 * z, 5 * z);
    } else if (av.accessory === 'headset') {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(baseX - 13 * z, baseY - 46 * z, 3 * z, 8 * z);
      ctx.fillRect(baseX + 10 * z, baseY - 46 * z, 3 * z, 8 * z);
    }

    // Crachá flutuante discreto acima da cabeça
    ctx.font = `bold ${Math.max(10, Math.round(10.5 * z))}px Tahoma, sans-serif`;
    const label = av.name;
    const tw = ctx.measureText(label).width;
    const tagX = baseX - tw / 2 - 6;
    const tagY = baseY - 76 * z;

    ctx.fillStyle = av.isFounder ? 'rgba(180, 83, 9, 0.92)' : 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = av.isFounder ? '#fde68a' : av.shirtColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tw + 12, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, baseX, tagY + 8);

    ctx.restore();
  }

  // ============================================================================
  // BALÕES DE CHAT EM CASCATA (ESTILO CLÁSSICO HABBO HOTEL)
  // ============================================================================

  private drawCascadingBubbles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = '12px Tahoma, Verdana, sans-serif';

    for (const b of this.bubbles) {
      const prefix = `${b.speakerName}: `;
      ctx.font = 'bold 12px Tahoma, Verdana, sans-serif';
      const prefixW = ctx.measureText(prefix).width;
      ctx.font = '12px Tahoma, Verdana, sans-serif';
      const msgW = ctx.measureText(b.text).width;

      const totalW = Math.min(540, Math.max(150, 34 + prefixW + msgW + 18));
      const boxH = 28;
      const w = this.canvas.clientWidth || window.innerWidth;
      const boxX = Math.max(14, Math.min(w - totalW - 14, b.anchorScreenX - totalW * 0.5));
      const boxY = Math.round(b.currentY);

      // Sombra pixelada do balão
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(boxX + 2, boxY + 3, totalW, boxH, 5);
      ctx.fill();

      // Corpo branco do balão Habbo com borda preta de 1.5px
      ctx.fillStyle = b.isImportant ? '#fffbeb' : '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, totalW, boxH, 5);
      ctx.fill();
      ctx.stroke();

      // Faixa lateral colorida com a miniatura da cabeça do avatar à esquerda
      ctx.fillStyle = b.shirtColor;
      ctx.beginPath();
      ctx.roundRect(boxX + 3, boxY + 3, 22, boxH - 6, 3);
      ctx.fill();

      // Mini-rosto pixelado dentro do balão
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(boxX + 8, boxY + 9, 12, 11);
      ctx.fillStyle = b.hairColor;
      ctx.fillRect(boxX + 7, boxY + 6, 14, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(boxX + 10, boxY + 13, 2, 2);
      ctx.fillRect(boxX + 15, boxY + 13, 2, 2);

      // Nome em negrito + mensagem com contraste 100% escuro sobre branco
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Tahoma, Verdana, sans-serif';
      ctx.fillText(prefix, boxX + 31, boxY + boxH / 2);

      ctx.font = '12px Tahoma, Verdana, sans-serif';
      ctx.fillStyle = '#1e293b';
      const maxMsgChars = Math.floor((totalW - 38 - prefixW) / 6.6);
      const clippedMsg = b.text.length > maxMsgChars ? b.text.slice(0, Math.max(12, maxMsgChars - 1)) + '…' : b.text;
      ctx.fillText(clippedMsg, boxX + 31 + prefixW, boxY + boxH / 2);
    }

    ctx.restore();
  }
}
