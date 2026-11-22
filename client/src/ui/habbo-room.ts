// PixHotel Isometric Room Engine (Plano B — 100% Pixel Art Autoral via PixelBuf)
// Integra os 3 módulos construídos pelos especialistas de Pixel Art:
// 1. habbo-pix-surfaces.ts (@pixel-iso-architect): Ladrilhos 2:1 (32x16 -> 64x32), escada, paredes em corte com lambril, janela skyline, quadros e portal.
// 2. habbo-pix-furni.ts (@pixel-furni-artist): 11 Mobis isométricos 2:1 esculpidos pixel a pixel com contorno seletivo 1px e frames animados.
// 3. habbo-pix-avatars.ts (@pixel-avatar-artist): Avatares na proporção Habbo 3-cabeças (32x52) em 4 direções, ciclos de animação e retratos 24x24.

import type { OfficeStore } from '../net/store';
import {
  getIsoCursorCanvas,
  getIsoFloorTileCanvas,
  getIsoStairCanvas,
  getIsoWallCanvas,
  type IsoFloorTileKind,
  type IsoWallDecor,
} from './habbo-pix-surfaces';
import { getPixFurniSprite } from './habbo-pix-furni';
import {
  getHabboAvatarPortrait,
  getHabboAvatarSprite,
  type HabboAccessory,
  type HabboAction,
  type HabboAvatarLook,
  type HabboDirection,
} from './habbo-pix-avatars';

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
    desc: 'Estofado bordô imperial em capitonê com botões dourados e pés torneados.',
    category: 'Assentos',
    priceCoins: 25,
    sizeX: 2,
    sizeY: 1,
    canSit: true,
  },
  {
    type: 'dev_desk',
    name: 'Bancada Dual-Monitor Dev',
    desc: 'Estação isométrica em carvalho e aço com 2 monitores compilando código ao vivo.',
    category: 'Tecnologia',
    priceCoins: 30,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'exec_chair',
    name: 'Poltrona Executiva Mesh',
    desc: 'Cadeira ergonômica com base estrela de 5 rodízios e encosto respirável.',
    category: 'Assentos',
    priceCoins: 15,
    sizeX: 1,
    sizeY: 1,
    canSit: true,
  },
  {
    type: 'espresso_bar',
    name: 'Máquina Espresso Barista',
    desc: 'Cafeteira italiana cromada com manômetro, cachimbos e vapor pixelado.',
    category: 'Café & Lounge',
    priceCoins: 20,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'vending_drinks',
    name: 'Máquina PixCola Neon',
    desc: 'Vitrine iluminada com 3 prateleiras de latinhas coloridas 24/7.',
    category: 'Café & Lounge',
    priceCoins: 20,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'server_rack',
    name: 'Rack Cloud 24/7',
    desc: 'Torre de datacenter com porta perfurada em dithering e 6 blades com LEDs.',
    category: 'Tecnologia',
    priceCoins: 35,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'holo_screen',
    name: 'Telão Executivo de Sprint',
    desc: 'Painel panorâmico no mezanino com gráfico de barras de commits ao vivo.',
    category: 'Tecnologia',
    priceCoins: 45,
    sizeX: 2,
    sizeY: 1,
  },
  {
    type: 'conf_table',
    name: 'Mesa de Reunião Mogno',
    desc: 'Mesa executiva polida com faixa real, notebook aberto e relatórios.',
    category: 'Assentos',
    priceCoins: 30,
    sizeX: 2,
    sizeY: 1,
  },
  {
    type: 'arcade_cab',
    name: 'Fliperama PixArcade 16-Bit',
    desc: 'Gabinete retrô com marquee neon, CRT animado, joystick e ficheiro.',
    category: 'Café & Lounge',
    priceCoins: 28,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'palm_plant',
    name: 'Palmeira Imperial em Vaso',
    desc: 'Vaso de terracota com coroa de folhas recortadas pixel a pixel.',
    category: 'Decoração',
    priceCoins: 10,
    sizeX: 1,
    sizeY: 1,
  },
  {
    type: 'rug_vip',
    name: 'Tapete Persa PixRoyal',
    desc: 'Tapete persa 2x2 com franjas douradas e medalhão em dithering Bayer.',
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
  rot: 0 | 1;
  state?: number;
}

export interface IsoAvatar extends HabboAvatarLook {
  name: string;
  role: string;
  isFounder?: boolean;
  gx: number;
  gy: number;
  path: Array<{ gx: number; gy: number }>;
  dir: HabboDirection;
  action: HabboAction;
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
  portrait: HTMLCanvasElement;
  text: string;
  anchorScreenX: number;
  currentY: number;
  createdAt: number;
  isImportant?: boolean;
}

const STORAGE_KEY_FURNI = 'pixoffice-habbo-furni-v2';
const STORAGE_KEY_MODE = 'pixoffice-habbo-mode-v1';

const GRID_W = 14;
const GRID_H = 14;
const TILE_W = 64;
const TILE_H = 32;
const LEVEL_H = 24;

function getCatalogMeta(type: FurniType): FurniCatalogMeta {
  return PIX_FURNI_CATALOG.find((c) => c.type === type) || PIX_FURNI_CATALOG[0];
}

function spriteToDataUrl(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
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

    // Tapete Persa Central + Lounge & Café (gx = 8..13, gy = 5..12)
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
  private camY = -28;
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
    document.body.classList.toggle('is-pixhotel-iso', this.active);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pixhotel-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.hostEl.appendChild(this.canvas);

    this.buildHotelInterface();
    document.body.appendChild(this.hostEl);

    this.bindEvents();
    this.resize();
    this.startLoop();

    // Mensagens iniciais de boas-vindas em cascata
    setTimeout(() => {
      this.pushBubble(
        'agent-05-art',
        'Sprites isométricos 2:1 esculpidos em PixelBuf com contorno seletivo 1px e dithering Bayer!',
        false,
      );
    }, 800);
    setTimeout(() => {
      this.pushBubble(
        'agent-01-dev',
        '8 agentes sincronizados no quarto! Clique em qualquer ladrilho para andar ou fale conosco.',
        false,
      );
    }, 2300);
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
    const defs: Array<{
      id: string;
      name: string;
      role: string;
      isFounder?: boolean;
      gx: number;
      gy: number;
      dir: HabboDirection;
      shirtColor: string;
      shirtDark: string;
      hairColor: string;
      skinColor: string;
      pantsColor: string;
      accessory: HabboAccessory;
      hairStyle: number;
      action: HabboAction;
      statusText: string;
      roamDelay: number;
    }> = [
      {
        id: 'founder-you',
        name: 'Você (Founder)',
        role: 'Dono do Quarto · CEO',
        isFounder: true,
        gx: 1,
        gy: 8,
        dir: 'SE',
        shirtColor: '#f59e0b',
        shirtDark: '#b45309',
        hairColor: '#1e293b',
        skinColor: '#fcd34d',
        pantsColor: '#1e293b',
        accessory: 'crown',
        hairStyle: 0,
        action: 'idle',
        statusText: 'Comandando o PixOffice HQ',
        roamDelay: Infinity,
      },
      {
        id: 'agent-00-researcher',
        name: '00 Vicente',
        role: 'Pesquisador & Arquiteto',
        gx: 3,
        gy: 1,
        dir: 'SE',
        shirtColor: '#2563eb',
        shirtDark: '#1d4ed8',
        hairColor: '#475569',
        skinColor: '#fde68a',
        pantsColor: '#1e293b',
        accessory: 'glasses',
        hairStyle: 1,
        action: 'sit',
        statusText: 'Mapeando referências no Mezanino VIP',
        roamDelay: 15000,
      },
      {
        id: 'agent-01-dev',
        name: '01 Dev',
        role: 'Engenheiro Full-Stack',
        gx: 2,
        gy: 7,
        dir: 'NW',
        shirtColor: '#10b981',
        shirtDark: '#047857',
        hairColor: '#0f172a',
        skinColor: '#fcd34d',
        pantsColor: '#1e293b',
        accessory: 'headset',
        hairStyle: 2,
        action: 'type',
        statusText: 'Codificando TypeScript & WebGL na Bancada 1',
        roamDelay: 19000,
      },
      {
        id: 'agent-02-fx-audio',
        name: '02 FX & Áudio',
        role: 'Especialista DSP & Shaders',
        gx: 4,
        gy: 7,
        dir: 'NW',
        shirtColor: '#8b5cf6',
        shirtDark: '#6d28d9',
        hairColor: '#312e81',
        skinColor: '#fed7aa',
        pantsColor: '#312e81',
        accessory: 'headset',
        hairStyle: 3,
        action: 'type',
        statusText: 'Calibrando síntese de voz neural PT-BR',
        roamDelay: 22000,
      },
      {
        id: 'agent-03-qa',
        name: '03 QA Auditor',
        role: 'Gatekeeper de Qualidade',
        gx: 6,
        gy: 7,
        dir: 'NW',
        shirtColor: '#ef4444',
        shirtDark: '#b91c1c',
        hairColor: '#1f2937',
        skinColor: '#fde68a',
        pantsColor: '#18181b',
        accessory: 'visor',
        hairStyle: 0,
        action: 'type',
        statusText: 'Auditando zero erros de build e performance',
        roamDelay: 16000,
      },
      {
        id: 'agent-04-user',
        name: '04 User',
        role: 'Advogado do Usuário',
        gx: 10,
        gy: 6,
        dir: 'SW',
        shirtColor: '#06b6d4',
        shirtDark: '#0e7490',
        hairColor: '#78350f',
        skinColor: '#fcd34d',
        pantsColor: '#1e3a8a',
        accessory: 'cap',
        hairStyle: 1,
        action: 'coffee',
        statusText: 'Tomando espresso na cafeteria e testando UX',
        roamDelay: 13000,
      },
      {
        id: 'agent-05-art',
        name: '05 Art XP',
        role: 'Diretor de Pixel Art',
        gx: 2,
        gy: 11,
        dir: 'NW',
        shirtColor: '#ec4899',
        shirtDark: '#be185d',
        hairColor: '#581c87',
        skinColor: '#fed7aa',
        pantsColor: '#1e1b4b',
        accessory: 'beret',
        hairStyle: 2,
        action: 'type',
        statusText: 'Esculpindo sprites isométricos 2:1 em PixelBuf',
        roamDelay: 21000,
      },
      {
        id: 'agent-06-ux-ui',
        name: '06 UX/UI',
        role: 'Arquiteto de Interfaces',
        gx: 4,
        gy: 11,
        dir: 'NW',
        shirtColor: '#14b8a6',
        shirtDark: '#0f766e',
        hairColor: '#1e293b',
        skinColor: '#fde68a',
        pantsColor: '#0f172a',
        accessory: 'glasses',
        hairStyle: 3,
        action: 'type',
        statusText: 'Validando contraste WCAG e layout do hotel',
        roamDelay: 17000,
      },
      {
        id: 'agent-07-release',
        name: '07 Release',
        role: 'Engenheiro Cloud & Deploy',
        gx: 6,
        gy: 11,
        dir: 'NW',
        shirtColor: '#f97316',
        shirtDark: '#c2410c',
        hairColor: '#27272a',
        skinColor: '#fcd34d',
        pantsColor: '#18181b',
        accessory: 'headset',
        hairStyle: 0,
        action: 'type',
        statusText: 'Monitorando container Docker 24/7 na nuvem',
        roamDelay: 24000,
      },
    ];

    this.avatars = defs.map((d) => ({
      ...d,
      path: [],
      talkUntil: 0,
      waveUntil: d.isFounder ? Date.now() + 2500 : 0,
      nextRoamAt: d.roamDelay === Infinity ? Infinity : Date.now() + d.roamDelay,
    }));
  }

  private getTileLevel(gx: number, gy: number): number {
    if (gy >= 0 && gy <= 3) return 1; // Mezanino VIP elevado
    if (gy === 4 && gx >= 4 && gx <= 6) return 0.5; // Escadinha central
    return 0;
  }

  private isTileValid(gx: number, gy: number): boolean {
    if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return false;
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
        if (meta.canSit) return false;
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

  private findPath(
    startGx: number,
    startGy: number,
    goalGx: number,
    goalGy: number,
    avatarId: string,
  ): Array<{ gx: number; gy: number }> {
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
    const originY = h * 0.23 + this.camY;
    const ix = (gx - gy) * (TILE_W * 0.5) * this.zoom;
    const iy = ((gx + gy) * (TILE_H * 0.5) - gz * LEVEL_H) * this.zoom;
    return { x: originX + ix, y: originY + iy };
  }

  private screenToIso(screenX: number, screenY: number): { gx: number; gy: number } | null {
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
      portrait: getHabboAvatarPortrait(av),
      text: clean.slice(0, 175),
      anchorScreenX: clampedX,
      currentY: Math.max(76, pos.y - 84 * this.zoom),
      createdAt: Date.now(),
      isImportant,
    });

    if (this.bubbles.length > 9) {
      this.bubbles.shift();
    }
  }

  private buildHotelInterface(): void {
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
      document.body.classList.toggle('is-pixhotel-iso', this.active);
      try {
        localStorage.setItem(STORAGE_KEY_MODE, this.active ? '1' : '0');
      } catch {
        // ignore
      }
      syncToggleText();
      if (this.active) this.resize();
    });
    document.body.appendChild(toggleBtn);

    const roomInfo = document.createElement('div');
    roomInfo.className = 'pixhotel-room-badge';
    roomInfo.innerHTML = `
      <div class="pixhotel-room-badge__icon">🏨</div>
      <div class="pixhotel-room-badge__body">
        <div class="pixhotel-room-badge__title">PixOffice HQ · Salão & Mezanino VIP (Pixel Art 2:1)</div>
        <div class="pixhotel-room-badge__sub">Dono: <b>Você (Founder)</b> · <span id="pixhotel-pop-count">9/16 no quarto</span> · ⭐ 998</div>
      </div>
      <div class="pixhotel-room-badge__actions">
        <button type="button" class="pixhotel-mini-btn" id="pixhotel-preset-work" title="Equipe nas bancadas">💻 Bancadas</button>
        <button type="button" class="pixhotel-mini-btn" id="pixhotel-preset-vip" title="Chamar todos para o Mezanino VIP">🛋️ Reunião VIP</button>
        <button type="button" class="pixhotel-mini-btn" id="pixhotel-preset-cafe" title="Hora do café">☕ Hora do Café</button>
      </div>
    `;
    this.hostEl.appendChild(roomInfo);

    this.cornerCardEl = document.createElement('div');
    this.cornerCardEl.className = 'pixhotel-inspector-card';
    this.hostEl.appendChild(this.cornerCardEl);
    this.updateInspectorCard();

    this.catalogModalEl = document.createElement('div');
    this.catalogModalEl.className = 'pixhotel-catalog-modal';
    this.catalogModalEl.style.display = 'none';
    this.renderCatalogModal();
    this.hostEl.appendChild(this.catalogModalEl);

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

    dock.querySelector('#pixhotel-btn-wave')?.addEventListener('click', () => {
      const me = this.avatars.find((a) => a.isFounder);
      if (me) {
        me.waveUntil = Date.now() + 3000;
        this.pushBubble(me.id, 'o/ Olá equipe!', false);
      }
    });

    dock.querySelector('#pixhotel-btn-catalog')?.addEventListener('click', () => {
      const open = this.catalogModalEl.style.display === 'none';
      if (open) this.renderCatalogModal();
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

    roomInfo.querySelector('#pixhotel-preset-work')?.addEventListener('click', () => this.sendTeamToPreset('work'));
    roomInfo.querySelector('#pixhotel-preset-vip')?.addEventListener('click', () => this.sendTeamToPreset('vip'));
    roomInfo.querySelector('#pixhotel-preset-cafe')?.addEventListener('click', () => this.sendTeamToPreset('cafe'));

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
            <div class="pixhotel-catalog-title">🛒 Catálogo PixFurni · Pixel Art 2:1 Autoral</div>
            <div class="pixhotel-catalog-sub">Sprites esculpidos pixel a pixel em PixelBuf com contorno seletivo 1px · Clique para posicionar</div>
          </div>
          <div class="pixhotel-catalog-coins">🪙 <span id="pixhotel-coins-val">${this.pixelCoins}</span> PixCoins</div>
          <button type="button" class="pixhotel-catalog-close" id="pixhotel-cat-close">✕</button>
        </div>
        <div class="pixhotel-catalog-grid">
          ${PIX_FURNI_CATALOG.map((item) => {
            const spr = getPixFurniSprite(item.type, 0, 0);
            const previewUrl = spriteToDataUrl(spr.canvas);
            return `
            <div class="pixhotel-cat-item" data-furni-type="${item.type}">
              <div class="pixhotel-cat-item__head">
                <span class="pixhotel-cat-item__cat">${item.category}</span>
                <span class="pixhotel-cat-item__price">🪙 ${item.priceCoins}</span>
              </div>
              <div class="pixhotel-cat-item__preview" style="display:flex;align-items:center;justify-content:center;height:78px;background:#0b0e17;border:1px solid #334155;border-radius:6px;margin:2px 0;">
                <img src="${previewUrl}" alt="${item.name}" style="image-rendering:pixelated;height:66px;width:auto;object-fit:contain;" />
              </div>
              <div class="pixhotel-cat-item__name">${item.name}</div>
              <div class="pixhotel-cat-item__desc">${item.desc}</div>
              <button type="button" class="pixhotel-cat-item__buy" data-buy-type="${item.type}">
                Colocar no Quarto (${item.sizeX}x${item.sizeY})
              </button>
            </div>
          `;
          }).join('')}
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
      const previewUrl = spriteToDataUrl(getPixFurniSprite(this.placingType, this.placingRot, 0).canvas);
      this.cornerCardEl.innerHTML = `
        <div class="pixhotel-card__tag">MODO CONSTRUÇÃO · POSICIONAR MOBI</div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
          <img src="${previewUrl}" alt="${meta.name}" style="image-rendering:pixelated;width:52px;height:52px;object-fit:contain;background:#0b0e17;border:1px solid #334155;border-radius:6px;padding:3px;" />
          <div>
            <div class="pixhotel-card__title">${meta.name}</div>
            <div class="pixhotel-card__desc">Clique em qualquer ladrilho livre do chão para posicionar.</div>
          </div>
        </div>
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
        const previewUrl = spriteToDataUrl(getPixFurniSprite(f.type, f.rot, 0).canvas);
        this.cornerCardEl.innerHTML = `
          <div class="pixhotel-card__tag">MOBI PIXFURNI · LADRILHO [${f.gx}, ${f.gy}]</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
            <img src="${previewUrl}" alt="${meta.name}" style="image-rendering:pixelated;width:54px;height:54px;object-fit:contain;background:#0b0e17;border:1px solid #334155;border-radius:6px;padding:3px;" />
            <div>
              <div class="pixhotel-card__title">${meta.name}</div>
              <div class="pixhotel-card__desc">${meta.desc}</div>
            </div>
          </div>
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
          this.updateInspectorCard();
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
    const portraitUrl = spriteToDataUrl(getHabboAvatarPortrait(av));
    this.cornerCardEl.innerHTML = `
      <div class="pixhotel-card__tag">HABITANTE DO QUARTO · ${av.role.toUpperCase()}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
        <img src="${portraitUrl}" alt="${av.name}" style="image-rendering:pixelated;width:48px;height:48px;background:#0b0e17;border:1.5px solid ${av.shirtColor};border-radius:6px;" />
        <div>
          <div class="pixhotel-card__title">${av.name}</div>
          <div class="pixhotel-card__desc">${av.statusText}</div>
        </div>
      </div>
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
      if (this.pointerDownDist > 7) return;

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

    for (const av of [...this.avatars].reverse()) {
      const gz = this.getTileLevel(Math.round(av.gx), Math.round(av.gy));
      const p = this.isoToScreen(av.gx + 0.5, av.gy + 0.5, gz);
      if (Math.abs(mx - p.x) <= 24 * this.zoom && my >= p.y - 78 * this.zoom && my <= p.y + 10 * this.zoom) {
        this.selectedAvatarId = av.id;
        this.selectedFurniId = null;
        av.waveUntil = Date.now() + 2200;
        if (!av.isFounder && this.targetSelectEl) {
          this.targetSelectEl.value = av.id;
        }
        this.updateInspectorCard();
        return;
      }
    }

    if (!tile) return;

    const clickedFurni = this.furni.find((f) => {
      const meta = getCatalogMeta(f.type);
      const sx = f.rot === 0 ? meta.sizeX : meta.sizeY;
      const sy = f.rot === 0 ? meta.sizeY : meta.sizeX;
      return tile.gx >= f.gx && tile.gx < f.gx + sx && tile.gy >= f.gy && tile.gy < f.gy + sy;
    });

    if (clickedFurni) {
      this.selectedFurniId = clickedFurni.id;
      this.updateInspectorCard();
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
    const w = this.hostEl.clientWidth || window.innerWidth;
    const h = this.hostEl.clientHeight || window.innerHeight - 68;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  private startLoop(): void {
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.active) {
        this.updateSimulation(dt);
        this.renderScene(now);
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private updateSimulation(dt: number): void {
    const wallNow = Date.now();

    const snapAgents = this.store.snapshot?.agents || [];
    for (const sa of snapAgents) {
      const match = this.avatars.find((av) => av.id === sa.id || av.name.toLowerCase().includes(sa.name.toLowerCase()));
      if (match && sa.task) {
        match.statusText = sa.task;
      }
    }

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

        if (wallNow < av.waveUntil) {
          av.action = 'wave';
        } else {
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
        }

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

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.currentY -= 5.2 * dt;
      if (wallNow - b.createdAt > 18000 || b.currentY < 28) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // RENDERIZAÇÃO ISOMÉTRICA 2:1 PIXEL-PERFECT (NEAREST-NEIGHBOR)
  // ============================================================================

  private renderScene(now: number): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const S = 2 * this.zoom; // Escala de cada pixel nativo 1x (32x16 -> 64x32 em zoom=1)
    const animFrame = Math.floor(now / 240);

    // 1. Fundo Azul-Noite Profundo do Hotel com estrelas pixeladas
    ctx.fillStyle = '#090c14';
    ctx.fillRect(0, 0, w, h);
    this.drawStarfield(ctx, w, h, now);

    // 2. Paredes Cutaway em "L" (Parede Traseira gy=0 e Parede Esquerda gx=0) em PixelBuf
    this.drawCutawayWalls(ctx, S, animFrame);

    // 3. Piso Isométrico 2:1 em PixelBuf (Carvalho, Carpete Imperial VIP, Mármore Xadrez, Escada)
    this.drawIsometricFloor(ctx, S);

    // 4. Cursor de Ladrilho do Habbo Hotel (34x18 px em PixelBuf)
    if (this.hoverTile && this.isTileValid(this.hoverTile.gx, this.hoverTile.gy)) {
      const gz = this.getTileLevel(this.hoverTile.gx, this.hoverTile.gy);
      this.drawTileCursor(ctx, this.hoverTile.gx, this.hoverTile.gy, gz, S);
    }

    // 5. Ordenação de Profundidade (Painter's Algorithm) para Mobis e Avatares
    const drawList: Array<{ depth: number; draw: () => void }> = [];

    for (const f of this.furni) {
      const meta = getCatalogMeta(f.type);
      const gz = this.getTileLevel(f.gx, f.gy);
      const depth = f.gx + f.gy + (meta.isWalkable ? -1.5 : 0.2) + gz * 0.5;
      drawList.push({
        depth,
        draw: () => this.drawFurniItem(ctx, f, gz, S, animFrame),
      });
    }

    for (const av of this.avatars) {
      const gz = this.getTileLevel(Math.round(av.gx), Math.round(av.gy));
      const depth = av.gx + av.gy + 0.45 + gz * 0.5;
      drawList.push({
        depth,
        draw: () => this.drawIsoAvatar(ctx, av, gz, S, now),
      });
    }

    drawList.sort((a, b) => a.depth - b.depth);
    for (const item of drawList) {
      item.draw();
    }

    // 6. Balões de Chat em Cascata com Retrato Pixel Art 24x24
    this.drawCascadingBubbles(ctx);
  }

  private drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.46, 40, w * 0.5, h * 0.46, Math.max(w, h) * 0.58);
    grad.addColorStop(0, 'rgba(30, 58, 138, 0.20)');
    grad.addColorStop(1, 'rgba(9, 12, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
    for (let i = 0; i < 42; i++) {
      const sx = (i * 197) % w;
      const sy = (i * 131) % h;
      const sz = Math.sin(now * 0.002 + i) > 0.3 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  private drawCutawayWalls(ctx: CanvasRenderingContext2D, S: number, animFrame: number): void {
    // 1. Parede Traseira Direita (gy = 0, gx = 0..GRID_W - 1)
    for (let gx = 0; gx < GRID_W; gx++) {
      const gz = this.getTileLevel(gx, 0);
      const bLeft = this.isoToScreen(gx, 0, gz);
      let decor: IsoWallDecor = 'plain';
      if (gx === 6 || gx === 7) decor = 'window';
      else if (gx === 11) decor = 'clock';
      else if (gx === 1) decor = 'poster_trophy';

      const spr = getIsoWallCanvas('back', decor, gx, animFrame);
      ctx.drawImage(
        spr,
        Math.round(bLeft.x - 1 * S),
        Math.round(bLeft.y - 61 * S),
        Math.round(spr.width * S),
        Math.round(spr.height * S),
      );
    }

    // 2. Parede Esquerda (gx = 0, gy = 0..GRID_H - 1)
    for (let gy = 0; gy < GRID_H; gy++) {
      if (gy === 4) continue;
      const gz = this.getTileLevel(0, gy);
      const bTop = this.isoToScreen(0, gy, gz);
      const bBot = this.isoToScreen(0, gy + 1, gz);
      let decor: IsoWallDecor = 'plain';
      if (gy === 8) decor = 'door';
      else if (gy === 2) decor = 'poster_trophy';
      else if (gy === 6) decor = 'poster_arcade';
      else if (gy === 11) decor = 'window';

      const spr = getIsoWallCanvas('left', decor, gy, animFrame);
      ctx.drawImage(
        spr,
        Math.round(bBot.x - 1 * S),
        Math.round(bTop.y - 61 * S),
        Math.round(spr.width * S),
        Math.round(spr.height * S),
      );
    }
  }

  private drawIsometricFloor(ctx: CanvasRenderingContext2D, S: number): void {
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        // Mureta divisória do Mezanino VIP em gy=4 (exceto escada gx 4..6)
        if (gy === 4 && (gx < 4 || gx > 6)) {
          const topTile = getIsoFloorTileCanvas('vip', gx + gy);
          const pTop = this.isoToScreen(gx, 3, 1);
          // O ladrilho de gy=3 já desenha a laje de mogno com friso dourado
          void topTile;
          void pTop;
          continue;
        }

        // Escadinha isométrica 2:1 em PixelBuf (gy=4, gx=4..6)
        if (gy === 4 && gx >= 4 && gx <= 6) {
          const stairSpr = getIsoStairCanvas();
          const top = this.isoToScreen(gx, gy, 0.72);
          ctx.drawImage(
            stairSpr,
            Math.round(top.x - 18 * S),
            Math.round(top.y - 2 * S),
            Math.round(stairSpr.width * S),
            Math.round(stairSpr.height * S),
          );
          continue;
        }

        const gz = this.getTileLevel(gx, gy);
        const checker = (gx + gy) % 2 === 0;
        let kind: IsoFloorTileKind = 'oak';

        if (gz === 1) {
          kind = 'vip';
        } else if (gx >= 9 && gy >= 5 && gy <= 9) {
          kind = checker ? 'cafe_light' : 'cafe_dark';
        } else if (gx === 0 && gy === 8) {
          kind = 'mat';
        }

        const tileSpr = getIsoFloorTileCanvas(kind, gx * 3 + gy);
        const top = this.isoToScreen(gx, gy, gz);
        ctx.drawImage(
          tileSpr,
          Math.round(top.x - 17 * S),
          Math.round(top.y - 1 * S),
          Math.round(tileSpr.width * S),
          Math.round(tileSpr.height * S),
        );
      }
    }
  }

  private drawTileCursor(ctx: CanvasRenderingContext2D, gx: number, gy: number, gz: number, S: number): void {
    const curSpr = getIsoCursorCanvas();
    const top = this.isoToScreen(gx, gy, gz);
    ctx.drawImage(
      curSpr,
      Math.round(top.x - 17 * S),
      Math.round(top.y - 1 * S),
      Math.round(curSpr.width * S),
      Math.round(curSpr.height * S),
    );
  }

  private drawFurniItem(
    ctx: CanvasRenderingContext2D,
    f: PlacedFurni,
    gz: number,
    S: number,
    animFrame: number,
  ): void {
    if (this.selectedFurniId === f.id) {
      this.drawTileCursor(ctx, f.gx, f.gy, gz, S);
    }

    const spr = getPixFurniSprite(f.type, f.rot, animFrame);
    let anchorPos: { x: number; y: number };

    if (f.type === 'rug_vip') {
      anchorPos = this.isoToScreen(f.gx + 1, f.gy + 1, gz);
    } else if (f.type === 'club_sofa' || f.type === 'conf_table' || f.type === 'holo_screen') {
      if (f.rot === 0) {
        anchorPos = this.isoToScreen(f.gx + 0.55, f.gy + 0.9, gz);
      } else {
        anchorPos = this.isoToScreen(f.gx + 0.9, f.gy + 0.55, gz);
      }
    } else {
      anchorPos = this.isoToScreen(f.gx + 0.72, f.gy + 0.72, gz);
    }

    ctx.drawImage(
      spr.canvas,
      Math.round(anchorPos.x - spr.anchorX * S),
      Math.round(anchorPos.y - spr.anchorY * S),
      Math.round(spr.canvas.width * S),
      Math.round(spr.canvas.height * S),
    );
  }

  private drawIsoAvatar(
    ctx: CanvasRenderingContext2D,
    av: IsoAvatar,
    gz: number,
    S: number,
    now: number,
  ): void {
    const isSel = this.selectedAvatarId === av.id;
    const isTalking = Date.now() < av.talkUntil;
    const frameIdx =
      av.action === 'walk'
        ? Math.floor(now / 130) % 4
        : av.action === 'type'
          ? Math.floor(now / 120) % 4
          : Math.floor(now / 220) % 4;

    if (isSel) {
      this.drawTileCursor(ctx, Math.round(av.gx), Math.round(av.gy), gz, S);
    }

    const spr = getHabboAvatarSprite(av, av.dir, av.action, frameIdx, isTalking);
    const feetPos = this.isoToScreen(av.gx + 0.5, av.gy + 0.5, gz);

    ctx.drawImage(
      spr.canvas,
      Math.round(feetPos.x - spr.anchorX * S),
      Math.round(feetPos.y - spr.anchorY * S),
      Math.round(spr.canvas.width * S),
      Math.round(spr.canvas.height * S),
    );

    // Crachá flutuante acima da cabeça do avatar
    ctx.save();
    ctx.font = `bold ${Math.max(10, Math.round(10.5 * this.zoom))}px Tahoma, sans-serif`;
    const label = av.name;
    const tw = ctx.measureText(label).width;
    const tagX = Math.round(feetPos.x - tw / 2 - 6);
    const tagY = Math.round(feetPos.y - 46 * S - 16);

    ctx.fillStyle = av.isFounder ? 'rgba(180, 83, 9, 0.94)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = av.isFounder ? '#fde68a' : av.shirtColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tw + 12, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, Math.round(feetPos.x), tagY + 8);
    ctx.restore();
  }

  private drawCascadingBubbles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const b of this.bubbles) {
      const prefix = `${b.speakerName}: `;
      ctx.font = 'bold 12px Tahoma, Verdana, sans-serif';
      const prefixW = ctx.measureText(prefix).width;
      ctx.font = '12px Tahoma, Verdana, sans-serif';
      const msgW = ctx.measureText(b.text).width;

      const totalW = Math.min(560, Math.max(160, 36 + prefixW + msgW + 18));
      const boxH = 30;
      const w = this.canvas.clientWidth || window.innerWidth;
      const boxX = Math.round(Math.max(14, Math.min(w - totalW - 14, b.anchorScreenX - totalW * 0.5)));
      const boxY = Math.round(b.currentY);

      // Sombra pixelada dura do balão Habbo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(boxX + 2, boxY + 3, totalW, boxH);

      // Corpo branco com cantos chanfrados estilo Habbo 1px pixel art
      ctx.fillStyle = b.isImportant ? '#fffbeb' : '#ffffff';
      ctx.fillRect(boxX + 1, boxY + 1, totalW - 2, boxH - 2);

      // Borda pixelada de 1px (#0f172a) com quinas recortadas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(boxX + 2, boxY, totalW - 4, 1);
      ctx.fillRect(boxX + 2, boxY + boxH - 1, totalW - 4, 1);
      ctx.fillRect(boxX, boxY + 2, 1, boxH - 4);
      ctx.fillRect(boxX + totalW - 1, boxY + 2, 1, boxH - 4);
      ctx.fillRect(boxX + 1, boxY + 1, 1, 1);
      ctx.fillRect(boxX + totalW - 2, boxY + 1, 1, 1);
      ctx.fillRect(boxX + 1, boxY + boxH - 2, 1, 1);
      ctx.fillRect(boxX + totalW - 2, boxY + boxH - 2, 1, 1);

      // Cápsula lateral colorida com o Retrato Pixel Art 24x24 real do agente
      ctx.fillStyle = b.shirtColor;
      ctx.fillRect(boxX + 3, boxY + 3, 24, boxH - 6);
      ctx.drawImage(b.portrait, boxX + 3, boxY + 3, 24, 24);

      // Linha divisória vertical após o retrato
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(boxX + 28, boxY + 3, 1, boxH - 6);

      // Texto de alto contraste
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Tahoma, Verdana, sans-serif';
      ctx.fillText(prefix, boxX + 34, boxY + boxH / 2);

      ctx.font = '12px Tahoma, Verdana, sans-serif';
      ctx.fillStyle = '#1e293b';
      const maxMsgChars = Math.floor((totalW - 42 - prefixW) / 6.6);
      const clippedMsg = b.text.length > maxMsgChars ? b.text.slice(0, Math.max(12, maxMsgChars - 1)) + '…' : b.text;
      ctx.fillText(clippedMsg, boxX + 34 + prefixW, boxY + boxH / 2);
    }

    ctx.restore();
  }
}
