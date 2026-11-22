// Motor de Avatares Isométricos em Pixel Art (Proporção Clássica Habbo Hotel 2006 / Chibi Isométrico 3-Cabeças)
// Resolução nativa 1x: 32x52 px com âncora nos pés (16, 47).
// Tudo é composto de forma determinística em um PixelBuf puro com rampas de cor hue-shifted,
// contorno seletivo escuro de 1px (buf.outline()) e sombra elíptica 2:1 nos pés (buf.shadow()).

import { mix, ramp, shade, type Ramp } from '../art/core/color';
import { PixelBuf, type Palette } from '../art/core/pixbuf';

export type HabboAccessory = 'crown' | 'glasses' | 'headset' | 'beret' | 'cap' | 'visor' | 'none';
export type HabboDirection = 'SE' | 'SW' | 'NW' | 'NE';
export type HabboAction = 'idle' | 'walk' | 'sit' | 'type' | 'coffee' | 'wave';

export interface HabboAvatarLook {
  id: string;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  shirtDark: string;
  pantsColor?: string;
  accessory: HabboAccessory;
  hairStyle?: number;
}

export interface HabboAvatarFrame {
  canvas: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
}

const SPRITE_W = 32;
const SPRITE_H = 52;
const ANCHOR_X = 16;
const ANCHOR_Y = 47;
const PORTRAIT_SIZE = 24;

// Cache de frames e retratos para performance máxima a 60fps
const spriteCache = new Map<string, HabboAvatarFrame>();
const portraitCache = new Map<string, HTMLCanvasElement>();

function bufToCanvas(buf: PixelBuf): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, buf.w);
  c.height = Math.max(1, buf.h);
  const ctx = c.getContext('2d');
  if (ctx && buf.w > 0 && buf.h > 0) {
    ctx.putImageData(new ImageData(buf.data, buf.w, buf.h), 0, 0);
  }
  return c;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function resolveHairStyle(look: HabboAvatarLook): number {
  if (typeof look.hairStyle === 'number') {
    return ((Math.floor(look.hairStyle) % 4) + 4) % 4;
  }
  return hashId(look.id) % 4;
}

function lookKey(look: HabboAvatarLook): string {
  return [
    look.id,
    look.skinColor,
    look.hairColor,
    look.shirtColor,
    look.shirtDark,
    look.pantsColor ?? '#1e293b',
    look.accessory,
    resolveHairStyle(look),
  ].join('|');
}

// ============================================================================
// TEMPLATES ASCII ESCULPIDOS (CABEÇA 14x15 ARREDONDADA E CORTES DE CABELO)
// ============================================================================

// Cabeça arredondada isométrica 3/4 (olhando para SE, com orelha à esquerda e queixo suave)
// Legenda:
// L = pele iluminada, s = pele base, S = pele sombra lateral, D = sombra profunda (abaixo do cabelo/queixo)
// r = interior da orelha, b = rubor das bochechas
const HEAD_FRONT_SE: readonly string[] = [
  '....DDDDDD....',
  '..DDLLLLssss..',
  '.DLLLLLsssssS.',
  '.LLLLsssssssS.',
  '.LLLssssssssSS',
  'srLsssssssssSS',
  'srssssssssssSS',
  'SsssssssssssSS',
  '.sssssssssssS.',
  '.ssbssssssbsS.',
  '.sssssssssssS.',
  '..sssssssssSS.',
  '..SssssssssSD.',
  '...SSsssssSD..',
  '.....DDDDD....',
];

// Cabeça de costas 3/4 (olhando para NE, nuca e orelha visível)
const HEAD_BACK_NE: readonly string[] = [
  '....DDDDDD....',
  '..DDssssssSS..',
  '.DssssssssssS.',
  '.sssssssssssS.',
  '.sssssssssssSS',
  '.ssssssssssSrS',
  '.ssssssssssSrS',
  '.sssssssssssSS',
  '.sssssssssssS.',
  '.sssssssssssS.',
  '.SssssssssssS.',
  '..SssssssssSD.',
  '..DSsssssssDD.',
  '...DDsssssDD..',
  '.....DDDDD....',
];

// 4 Estilos de Cabelo Volumosos (o = base, h = claro, H = brilho especular, d = sombra, D = sombra profunda)
// Estilo 0: Executivo / Clássico Habbo com topete e mechas laterais
const HAIR_0_FRONT: readonly string[] = [
  '....oooooo....',
  '..oohhhhhooo..',
  '.ohhHHHHhhood.',
  'oohhhhhhhhoodd',
  'ohhooooooodddd',
  'ohoo..oo...odd',
  'ood.........dd',
  'od..........dd',
  '.d...........d',
];

const HAIR_0_BACK: readonly string[] = [
  '....oooooo....',
  '..oohhhhhooo..',
  '.ohhHHHHhhood.',
  'oohhhhhhhhoodd',
  'ohhooooooooddd',
  'oooooooooooodd',
  'ohoooooooooodd',
  'oooooooooooddd',
  'dooooooooooodd',
  '.dooooooooodd.',
  '.ddoooooooddd.',
  '..dddddddddd..',
];

// Estilo 1: Spiky / Punk Moderno com pontas recortadas e brilho
const HAIR_1_FRONT: readonly string[] = [
  '..o...oo...o..',
  '.oho.ohho.ood.',
  '.oohhhhhhhood.',
  'oohhHHHHhhoodd',
  'ohhhhhhhoooddd',
  'ohoo.ooo..oodd',
  'ood...o.....dd',
  'od..........dd',
  '.d...........d',
];

const HAIR_1_BACK: readonly string[] = [
  '..o...oo...o..',
  '.oho.ohho.ood.',
  '.oohhhhhhhood.',
  'oohhHHHHhhoodd',
  'ohhhhhhhoooddd',
  'ohoooooooooodd',
  'oooooooooooodd',
  'oooooooooooddd',
  'dooooooooooodd',
  '.dooooooooodd.',
  '..ddoooooodd..',
  '...dddddddd...',
];

// Estilo 2: Franja Lateral / Artista Longo com volume nas têmporas
const HAIR_2_FRONT: readonly string[] = [
  '....oooooo....',
  '..ooDhhhhhoo..',
  '.ooDhHHHHhood.',
  'oooDhhhhhhoodd',
  'ooo.ohoooooddd',
  'oho....ooooood',
  'ohd.......oodd',
  'od.........odd',
  'od..........dd',
  'dd..........dd',
  '.d..........d.',
];

const HAIR_2_BACK: readonly string[] = [
  '....oooooo....',
  '..ooDhhhhhoo..',
  '.ooDhHHHHhood.',
  'oooDhhhhhhoodd',
  'oooDoooooooddd',
  'ohoooooooooodd',
  'ohoooooooooodd',
  'oooooooooooddd',
  'oooooooooooddd',
  'odoooooooooddd',
  '.ddoooooooddd.',
  '..dddddddddd..',
];

// Estilo 3: Cacheado / Pompadour Volumoso
const HAIR_3_FRONT: readonly string[] = [
  '...oohhhhoo...',
  '.oohhHHHHhhoo.',
  'oohhhHHHHhhhod',
  'ohhhhhhhhhoodd',
  'ohhooooooooddd',
  'ooo..oo....odd',
  'ood.........dd',
  'od..........dd',
  '.d...........d',
];

const HAIR_3_BACK: readonly string[] = [
  '...oohhhhoo...',
  '.oohhHHHHhhoo.',
  'oohhhHHHHhhhod',
  'ohhhhhhhhhoodd',
  'ohhooooooooddd',
  'oooooooooooodd',
  'oooooooooooodd',
  'oooooooooooddd',
  'dooooooooooddd',
  '.dooooooooodd.',
  '..ddoooooodd..',
  '...dddddddd...',
];

const HAIR_STYLES_FRONT = [HAIR_0_FRONT, HAIR_1_FRONT, HAIR_2_FRONT, HAIR_3_FRONT];
const HAIR_STYLES_BACK = [HAIR_0_BACK, HAIR_1_BACK, HAIR_2_BACK, HAIR_3_BACK];

interface AvatarPalettes {
  skin: Ramp;
  hair: Ramp;
  shirt: Ramp;
  pants: Ramp;
  shoes: Ramp;
}

function buildPalettes(look: HabboAvatarLook): AvatarPalettes {
  const skin = ramp(look.skinColor || '#fcd34d', 0.08);
  const hair = ramp(look.hairColor || '#1e293b', 0.09);
  const shirtBase = ramp(look.shirtColor || '#2563eb', 0.09);
  const shirt: Ramp = {
    hi: shirtBase.hi,
    lt: shirtBase.lt,
    base: shirtBase.base,
    dk: look.shirtDark || shirtBase.dk,
    dd: shade(look.shirtDark || shirtBase.dk, -0.1),
  };
  const pants = ramp(look.pantsColor || '#1e293b', 0.08);
  const shoes = ramp('#18181b', 0.09);
  return { skin, hair, shirt, pants, shoes };
}

// ============================================================================
// SAPATOS & PERNAS (ISOMÉTRICO 3/4 COM CICLO DE CAMINHADA E POSE SENTADA)
// ============================================================================

function drawLegsAndShoes(
  buf: PixelBuf,
  pal: AvatarPalettes,
  action: HabboAction,
  f4: number,
  isFront: boolean,
): void {
  const { pants, shoes } = pal;

  // Sentado ou Digitando: pernas dobradas para frente na diagonal isométrica 2:1 e tronco 4px mais baixo
  if (action === 'sit' || action === 'type') {
    // Quadril apoiado no assento (y = 37..40)
    buf.rect(11, 37, 10, 4, pants.dk);
    buf.hline(11, 20, 37, pants.dd);

    // Coxa traseira (esquerda na tela, projetada em SE)
    buf.rect(11, 39, 4, 4, pants.dk);
    buf.rect(12, 41, 4, 4, pants.dd);
    // Sapato traseiro arredondado com brilho na ponta
    buf.rect(12, 45, 5, 2, shoes.dk);
    buf.hline(13, 16, 44, shoes.base);
    buf.set(16, 45, shoes.hi);

    // Coxa dianteira (direita na tela, iluminada com vinco social/jeans)
    buf.rect(16, 38, 5, 4, pants.base);
    buf.vline(18, 39, 43, pants.lt);
    buf.rect(17, 41, 5, 4, pants.base);
    buf.vline(16, 39, 44, pants.dk); // vinco divisor entre as pernas
    // Sapato dianteiro de couro escuro com bico arredondado e brilho de 1px
    buf.rect(17, 45, 6, 2, shoes.base);
    buf.hline(18, 22, 44, shoes.lt);
    buf.hline(17, 22, 46, shoes.dd);
    buf.set(21, 45, shoes.hi);
    return;
  }

  // Em pé ou caminhando:
  // No ciclo 'walk' (4 frames), alterna altura e avanço isométrico entre perna de trás e da frente
  let backDx = 0;
  let backDy = 0;
  let frontDx = 0;
  let frontDy = 0;

  if (action === 'walk') {
    if (f4 === 0) {
      backDx = -2;
      backDy = -1;
      frontDx = 2;
      frontDy = 0;
    } else if (f4 === 1) {
      backDx = 0;
      backDy = 0;
      frontDx = 0;
      frontDy = -1;
    } else if (f4 === 2) {
      backDx = 2;
      backDy = 0;
      frontDx = -2;
      frontDy = -1;
    } else {
      backDx = 0;
      backDy = -1;
      frontDx = 0;
      frontDy = 0;
    }
  }

  // Cós da calça / cinto de couro com fivela prateada (y = 33..35)
  buf.hline(11, 20, 33, '#0f172a');
  if (isFront) {
    buf.rect(16, 33, 2, 1, '#e2e8f0'); // fivela metálica
  }
  buf.rect(11, 34, 10, 2, pants.base);
  buf.hline(11, 14, 34, pants.dk);

  // Perna de trás (sombreada para profundidade isométrica)
  const bx = 11 + backDx;
  const by = 36 + backDy;
  buf.rect(bx, by, 4, 8, pants.dk);
  buf.vline(bx, by, by + 7, pants.dd);
  buf.vline(bx + 3, by, by + 7, pants.base);
  // Sapato de trás arredondado com brilho na ponta
  const bShoeY = by + 8;
  buf.hline(bx + 1, bx + 4, bShoeY, shoes.base);
  buf.rect(bx, bShoeY + 1, 5, 2, shoes.dk);
  buf.hline(bx, bx + 4, bShoeY + 2, shoes.dd);
  buf.set(bx + 4, bShoeY + 1, shoes.hi);

  // Perna da frente (iluminada com vinco central)
  const fx = 16 + frontDx;
  const fy = 36 + frontDy;
  buf.rect(fx, fy, 4, 8, pants.base);
  buf.vline(fx, fy, fy + 7, pants.dk); // sombra interna do entrepernas
  buf.vline(fx + 2, fy, fy + 7, pants.lt); // vinco iluminado da calça
  buf.vline(fx + 3, fy, fy + 7, pants.base);
  // Sapato da frente de couro escuro com ponta arredondada e brilho especular de 1px
  const fShoeY = fy + 8;
  buf.hline(fx + 1, fx + 4, fShoeY, shoes.lt);
  buf.rect(fx, fShoeY + 1, 6, 2, shoes.base);
  buf.hline(fx, fx + 5, fShoeY + 2, shoes.dd);
  buf.set(fx + 4, fShoeY + 1, shoes.hi);
}

// ============================================================================
// TRONCO ISOMÉTRICO (CAMISA/JAQUETA COM GOLA, GRAVATA/CRACHÁ E 3 TONS)
// ============================================================================

function drawTorso(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  yOff: number,
  isFront: boolean,
): void {
  const { shirt, skin } = pal;
  const ty = 21 + yOff; // Tronco ocupa 12px de altura (y = 21..32 em pé, 25..36 sentado)

  // Silhueta arredondada nos ombros e cintura (nada de bloco quadrado!)
  // Linha de ombros superior (ty)
  buf.hline(11, 20, ty, shirt.lt);
  // Corpo principal do tronco (ty + 1 .. ty + 10)
  for (let r = 1; r <= 10; r++) {
    const y = ty + r;
    // Sombra lateral esquerda (costas/lateral em 3/4 SE)
    buf.hline(10, 12, y, shirt.dk);
    // Meio-tom central
    buf.hline(13, 17, y, shirt.base);
    // Luz principal no peito direito (virado para SE)
    buf.hline(18, 20, y, shirt.lt);
    // Borda extrema em sombra suave para dar curvatura cilíndrica ao tronco
    buf.set(21, y, shirt.dk);
  }
  // Cintura inferior levemente afunilada (ty + 11)
  buf.hline(11, 14, ty + 11, shirt.dd);
  buf.hline(15, 20, ty + 11, shirt.dk);

  // Pescoço sombreado conectando cabeça ao colarinho
  buf.rect(14, ty - 1, 4, 2, skin.dk);
  buf.set(16, ty - 1, skin.base);

  if (isFront) {
    // Colarinho branco em V isométrico (deslocado 1px para SE)
    buf.set(13, ty, '#e2e8f0');
    buf.set(14, ty + 1, '#ffffff');
    buf.set(15, ty + 2, '#cbd5e1');
    buf.set(18, ty, '#ffffff');
    buf.set(17, ty + 1, '#f8fafc');
    buf.set(16, ty + 2, '#e2e8f0');

    // Abertura sutil da jaqueta / camisa com gravata ou crachá corporativo
    const tieCol = look.accessory === 'crown' ? '#dc2626' : shade(shirt.dd, -0.12);
    buf.vline(16, ty + 3, ty + 9, tieCol);
    buf.set(16, ty + 3, '#fbbf24'); // nó / prendedor dourado

    // Crachá / lenço executivo de 2x2 px no peito
    buf.set(18, ty + 4, '#ffffff');
    buf.set(19, ty + 4, '#38bdf8');
    buf.set(18, ty + 5, '#e2e8f0');
    buf.set(19, ty + 5, '#0284c7');
  } else {
    // Vista de costas (NE): gola alta estruturada e costura dorsal
    buf.hline(13, 18, ty, shirt.hi);
    buf.hline(12, 19, ty + 1, shirt.lt);
    buf.vline(15, ty + 2, ty + 10, shirt.dk);
  }
}

// ============================================================================
// BRAÇOS ARTICULADOS, MÃOS 3x3 PX E CANECA DE CAFÉ FUMEGANTE
// ============================================================================

function drawHand3x3(buf: PixelBuf, x: number, y: number, skin: Ramp): void {
  buf.rect(x, y, 3, 3, skin.base);
  buf.set(x, y, skin.lt);
  buf.set(x + 1, y, skin.lt);
  buf.set(x + 2, y + 2, skin.dk);
  buf.set(x, y + 2, skin.dk);
}

function drawBackArm(
  buf: PixelBuf,
  pal: AvatarPalettes,
  action: HabboAction,
  f4: number,
  yOff: number,
): void {
  const { shirt, skin } = pal;
  const sy = 22 + yOff;

  if (action === 'wave') {
    // Braço levantado acima do ombro oscilando com frame % 2
    const waveShift = f4 % 2 === 0 ? 0 : -1;
    // Ombro e braço erguido
    buf.rect(7, sy - 4 + waveShift, 3, 6, shirt.base);
    buf.vline(7, sy - 4 + waveShift, sy + 1 + waveShift, shirt.lt);
    buf.rect(6 + waveShift, sy - 8 + waveShift, 3, 5, shirt.lt);
    // Mão aberta 3x3 acenando lá no alto
    drawHand3x3(buf, 5 + waveShift, sy - 11 + waveShift, skin);
    return;
  }

  if (action === 'type') {
    // Antebraço esquerdo estendido para frente alternando 1px verticalmente
    const dy = f4 % 2 === 0 ? 0 : 1;
    buf.rect(8, sy, 3, 6, shirt.dk);
    buf.rect(9, sy + 5 + dy, 4, 3, shirt.base);
    drawHand3x3(buf, 11, sy + 6 + dy, skin);
    return;
  }

  if (action === 'walk') {
    // Balanço oposto à perna de trás
    const swing = f4 === 0 ? 2 : f4 === 2 ? -2 : 0;
    buf.rect(8, sy, 3, 4, shirt.dk);
    buf.rect(8 + Math.round(swing * 0.5), sy + 4, 3, 4, shirt.base);
    drawHand3x3(buf, 8 + swing, sy + 8, skin);
    return;
  }

  // Idle / Sit / Coffee: braço traseiro relaxado ao lado do corpo
  buf.rect(8, sy, 3, 7, shirt.dk);
  buf.vline(8, sy, sy + 6, shirt.base);
  drawHand3x3(buf, 8, sy + 7, skin);
}

function drawCoffeeMug(buf: PixelBuf, x: number, y: number, f4: number): void {
  // Caneca branca/vermelha detalhada (5x6 px) com café espresso escuro e vapor subindo
  buf.rect(x, y, 5, 5, '#ffffff');
  buf.hline(x, x + 4, y + 2, '#ef4444'); // faixa vermelha PixCafe
  buf.hline(x, x + 4, y + 3, '#dc2626');
  buf.vline(x + 4, y, y + 4, '#cbd5e1'); // sombra cilíndrica da caneca
  // Café escuro no topo
  buf.hline(x + 1, x + 3, y, '#3e2723');
  // Alça lateral da caneca
  buf.set(x + 5, y + 1, '#e2e8f0');
  buf.set(x + 5, y + 2, '#cbd5e1');
  buf.set(x + 5, y + 3, '#94a3b8');

  // Fio de vapor branco animado subindo
  const vShift = f4 % 2;
  buf.set(x + 2 + vShift, y - 2, 'rgba(255, 255, 255, 0.85)');
  buf.set(x + 3 - vShift, y - 4, 'rgba(255, 255, 255, 0.75)');
  buf.set(x + 2, y - 6, 'rgba(255, 255, 255, 0.55)');
}

function drawFrontArm(
  buf: PixelBuf,
  pal: AvatarPalettes,
  action: HabboAction,
  f4: number,
  yOff: number,
): void {
  const { shirt, skin } = pal;
  const sy = 22 + yOff;

  if (action === 'coffee') {
    // Braço dobrado trazendo a caneca à altura do peito/boca
    const sip = f4 % 2 === 1 ? -1 : 0;
    buf.rect(20, sy, 3, 5, shirt.base);
    buf.vline(22, sy, sy + 4, shirt.dk);
    buf.rect(19, sy + 3 + sip, 4, 3, shirt.lt);
    drawHand3x3(buf, 21, sy + 3 + sip, skin);
    drawCoffeeMug(buf, 23, sy + 1 + sip, f4);
    return;
  }

  if (action === 'type') {
    // Antebraço direito estendido para frente alternando em oposição ao esquerdo
    const dy = f4 % 2 === 1 ? 0 : 1;
    buf.rect(20, sy, 3, 5, shirt.base);
    buf.rect(19, sy + 4 + dy, 4, 3, shirt.lt);
    drawHand3x3(buf, 21, sy + 5 + dy, skin);
    return;
  }

  if (action === 'walk') {
    // Balanço oposto à perna da frente
    const swing = f4 === 0 ? -2 : f4 === 2 ? 2 : 0;
    buf.rect(20, sy, 3, 4, shirt.base);
    buf.rect(20 + Math.round(swing * 0.5), sy + 4, 3, 4, shirt.lt);
    drawHand3x3(buf, 20 + swing, sy + 8, skin);
    return;
  }

  // Idle / Sit / Wave: braço dianteiro alinhado com mão 3x3 na cor da pele
  buf.rect(20, sy, 3, 7, shirt.base);
  buf.vline(20, sy, sy + 6, shirt.lt);
  buf.vline(22, sy, sy + 6, shirt.dk);
  drawHand3x3(buf, 20, sy + 7, skin);
}

// ============================================================================
// CABEÇA, ROSTO EXPRESSIVO, CABELOS & ACESSÓRIOS EXCLUSIVOS
// ============================================================================

function drawHeadAndFace(
  buf: PixelBuf,
  pal: AvatarPalettes,
  yOff: number,
  isFront: boolean,
  talking: boolean,
  f4: number,
): void {
  const { skin, hair } = pal;
  const hx = 9;
  const hy = 6 + yOff; // Cabeça ocupa y = 6..20 (15px de altura)

  const headPal: Palette = {
    L: skin.lt,
    s: skin.base,
    S: skin.dk,
    D: skin.dd,
    r: shade(skin.dk, -0.08),
    b: mix(skin.base, '#fb7185', 0.38),
  };

  buf.stamp(isFront ? HEAD_FRONT_SE : HEAD_BACK_NE, hx, hy, headPal);

  if (isFront) {
    // Sobrancelhas expressivas na cor do cabelo escurecida
    const browCol = hair.dd;
    buf.hline(hx + 4, hx + 6, hy + 5, browCol);
    buf.hline(hx + 9, hx + 11, hy + 5, browCol);

    // Olhos de 2x2 px com pupila escura e brilho branco especular de 1px
    // Olho esquerdo (hx+5..hx+6, hy+6..hy+7)
    buf.rect(hx + 5, hy + 6, 2, 2, '#0f172a');
    buf.set(hx + 5, hy + 6, '#ffffff');
    // Olho direito (hx+9..hx+10, hy+6..hy+7)
    buf.rect(hx + 9, hy + 6, 2, 2, '#0f172a');
    buf.set(hx + 9, hy + 6, '#ffffff');

    // Nariz discreto de 1px sombreado
    buf.set(hx + 8, hy + 8, skin.dk);

    // Boca animada ao falar (alterna entre sorriso discreto e boca aberta #9f1239 com dente #ffffff)
    if (talking && f4 % 2 === 0) {
      buf.rect(hx + 6, hy + 10, 4, 3, '#9f1239');
      buf.hline(hx + 7, hx + 8, hy + 10, '#ffffff'); // dente branco
      buf.hline(hx + 7, hx + 8, hy + 12, '#fb7185'); // língua
    } else {
      // Sorriso Habbo simpático
      buf.hline(hx + 6, hx + 8, hy + 11, shade(skin.dd, -0.18));
      buf.set(hx + 5, hy + 10, skin.dk);
      buf.set(hx + 9, hy + 10, skin.dk);
    }
  }
}

function drawHairAndAccessory(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  yOff: number,
  isFront: boolean,
): void {
  const { hair } = pal;
  const hx = 9;
  const hy = 5 + yOff;
  const styleIdx = resolveHairStyle(look);

  const hairPal: Palette = {
    o: hair.base,
    h: hair.lt,
    H: hair.hi,
    d: hair.dk,
    D: hair.dd,
  };

  // Desenha o corte de cabelo em camadas (cobrindo a nuca quando virado para NW/NE)
  const tpl = isFront ? HAIR_STYLES_FRONT[styleIdx] : HAIR_STYLES_BACK[styleIdx];
  buf.stamp(tpl, hx, hy, hairPal);

  // Acessórios exclusivos detalhados
  const acc = look.accessory;
  const ay = 6 + yOff;

  switch (acc) {
    case 'crown': {
      // Coroa imperial dourada com 3 pontas e joias vermelha/azul brilhantes
      const gold = ramp('#f59e0b', 0.1);
      // Base da coroa
      buf.hline(11, 20, ay - 1, gold.dk);
      buf.hline(10, 21, ay - 2, gold.base);
      buf.hline(10, 21, ay - 3, gold.lt);
      // 3 Pontas imperiais
      buf.rect(10, ay - 5, 2, 2, gold.lt);
      buf.set(11, ay - 6, gold.hi);
      buf.rect(15, ay - 6, 2, 3, gold.hi);
      buf.set(16, ay - 7, '#ffffff');
      buf.rect(20, ay - 5, 2, 2, gold.base);
      buf.set(20, ay - 6, gold.lt);
      // Joias incrustadas (rubi vermelho e safira azul)
      buf.set(12, ay - 2, '#ef4444');
      buf.set(15, ay - 2, '#38bdf8');
      buf.set(16, ay - 2, '#e0f2fe');
      buf.set(19, ay - 2, '#ef4444');
      break;
    }

    case 'glasses': {
      if (isFront) {
        // Óculos de aro estilizado com lente azulada semi-reflexiva
        const frameCol = '#1e293b';
        // Aro esquerdo
        buf.hline(13, 16, ay + 5, frameCol);
        buf.hline(13, 16, ay + 8, frameCol);
        buf.vline(13, ay + 5, ay + 8, frameCol);
        buf.vline(16, ay + 5, ay + 8, frameCol);
        // Ponte nasal + haste para a orelha
        buf.hline(11, 12, ay + 6, frameCol);
        buf.set(17, ay + 6, frameCol);
        // Aro direito
        buf.hline(18, 21, ay + 5, frameCol);
        buf.hline(18, 21, ay + 8, frameCol);
        buf.vline(18, ay + 5, ay + 8, frameCol);
        buf.vline(21, ay + 5, ay + 8, frameCol);
        // Reflexo ciano translúcido nas lentes
        buf.set(14, ay + 6, '#7dd3fc');
        buf.set(15, ay + 7, 'rgba(56, 189, 248, 0.55)');
        buf.set(19, ay + 6, '#7dd3fc');
        buf.set(20, ay + 7, 'rgba(56, 189, 248, 0.55)');
      } else {
        // Haste lateral atrás da orelha
        buf.hline(19, 21, ay + 6, '#1e293b');
      }
      break;
    }

    case 'headset': {
      // Arco sobre a cabeça + fones laterais acolchoados com LED neon e microfone boom
      buf.hline(11, 20, ay - 1, '#334155');
      buf.hline(12, 19, ay - 2, '#64748b');
      // Concha acústica lateral esquerda (visível em 3/4 SE)
      buf.rect(8, ay + 4, 3, 5, '#1e293b');
      buf.vline(9, ay + 5, ay + 7, '#22c55e'); // LED verde neon
      // Concha direita
      buf.rect(21, ay + 4, 2, 5, '#0f172a');
      buf.set(22, ay + 6, '#22c55e');
      if (isFront) {
        // Microfone boom articulado vindo até perto da boca
        buf.line(10, ay + 8, 14, ay + 11, '#475569');
        buf.rect(14, ay + 11, 2, 2, '#0f172a');
        buf.set(15, ay + 11, '#22c55e'); // LED ativo no mic
      }
      break;
    }

    case 'beret': {
      // Boina francesa inclinada de artista com brilho no topo
      const beret = ramp(look.shirtColor || '#ec4899', 0.1);
      buf.hline(12, 18, ay - 3, beret.lt);
      buf.hline(9, 20, ay - 2, beret.base);
      buf.hline(8, 21, ay - 1, beret.base);
      buf.hline(9, 21, ay, beret.dk);
      buf.hline(10, 20, ay + 1, '#1e293b'); // faixa de couro da boina
      // Brilho especular e cabinho clássico no topo
      buf.hline(13, 16, ay - 2, beret.hi);
      buf.set(15, ay - 4, beret.dd);
      break;
    }

    case 'cap': {
      // Boné urbano com copa estruturada e aba projetada na direção do olhar
      const cap = ramp(look.shirtColor || '#06b6d4', 0.09);
      buf.hline(12, 19, ay - 2, cap.lt);
      buf.hline(10, 20, ay - 1, cap.base);
      buf.hline(10, 21, ay, cap.base);
      buf.hline(10, 21, ay + 1, cap.dk);
      buf.set(15, ay - 3, '#ffffff'); // botão no topo do boné
      buf.hline(13, 16, ay - 1, cap.hi);
      if (isFront) {
        // Aba projetada para a frente/direita (SE)
        buf.hline(13, 23, ay + 2, cap.dk);
        buf.hline(15, 24, ay + 3, cap.dd);
      } else {
        // Aba virada para NE e ajuste traseiro
        buf.hline(18, 24, ay + 2, cap.dd);
        buf.rect(13, ay + 1, 4, 1, '#1e293b');
      }
      break;
    }

    case 'visor': {
      // Visor tático futurista vermelho/ciano translúcido sobre os olhos
      buf.hline(9, 22, ay + 4, '#334155');
      if (isFront) {
        buf.rect(12, ay + 5, 10, 3, '#e11d48');
        buf.hline(13, 21, ay + 5, '#38bdf8');
        buf.hline(14, 18, ay + 6, '#ffffff'); // reflexo laser horizontal
        buf.hline(13, 21, ay + 7, '#9f1239');
      } else {
        buf.hline(9, 22, ay + 5, '#1e293b');
        buf.set(15, ay + 5, '#ef4444');
      }
      break;
    }

    case 'none':
    default:
      break;
  }
}

// ============================================================================
// COMPOSIÇÃO COMPLETA DO SPRITE 32x52 E RETRATO 24x24
// ============================================================================

function renderHabboAvatarBuf(
  look: HabboAvatarLook,
  dir: HabboDirection,
  action: HabboAction,
  frame: number,
  talking: boolean,
): PixelBuf {
  const f4 = ((Math.floor(frame) % 4) + 4) % 4;
  const isFront = dir === 'SE' || dir === 'SW';
  const shouldFlip = dir === 'SW' || dir === 'NW';
  const pal = buildPalettes(look);

  // Em 'sit' e 'type', o tronco e a cabeça descem 4px; em 'walk', há um leve bounce de 1px nos frames ímpares
  const seatDrop = action === 'sit' || action === 'type' ? 4 : 0;
  const walkBounce = action === 'walk' && (f4 === 1 || f4 === 3) ? -1 : 0;
  const yOff = seatDrop + walkBounce;

  const work = new PixelBuf(SPRITE_W, SPRITE_H);

  // 1. Braço de trás (atrás do tronco)
  drawBackArm(work, pal, action, f4, yOff);

  // 2. Pernas e sapatos arredondados com brilho
  drawLegsAndShoes(work, pal, action, f4, isFront);

  // 3. Tronco isométrico em 3/4 com colarinho/gravata e 3 tons
  drawTorso(work, pal, look, yOff, isFront);

  // 4. Cabeça arredondada 14x15 e rosto expressivo
  drawHeadAndFace(work, pal, yOff, isFront, talking, f4);

  // 5. Cabelo esculpido com mechas e acessório exclusivo
  drawHairAndAccessory(work, pal, look, yOff, isFront);

  // 6. Braço da frente (sobreposto ao tronco, segurando café ou digitando)
  drawFrontArm(work, pal, action, f4, yOff);

  // 7. Se a direção for SW ou NW, espelha horizontalmente mantendo a consistência isométrica
  const out = shouldFlip ? work.flipped() : work;

  // 8. Contorno seletivo escuro de 1px na silhueta externa + sombra elíptica 2:1 nos pés
  out.outline();
  out.shadow(16, 47, 9, 4, '#090d16', 0.35);

  return out;
}

export function getHabboAvatarSprite(
  look: HabboAvatarLook,
  dir: HabboDirection,
  action: HabboAction,
  frame: number,
  talking: boolean,
): HabboAvatarFrame {
  const f4 = ((Math.floor(frame) % 4) + 4) % 4;
  const talkBit = talking && f4 % 2 === 0 ? 1 : 0;
  const key = `${lookKey(look)}|${dir}|${action}|${f4}|${talkBit}`;

  let cached = spriteCache.get(key);
  if (!cached) {
    if (spriteCache.size > 4000) spriteCache.clear();
    const buf = renderHabboAvatarBuf(look, dir, action, f4, talking);
    cached = {
      canvas: bufToCanvas(buf),
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
    };
    spriteCache.set(key, cached);
  }
  return cached;
}

export function getHabboAvatarPortrait(look: HabboAvatarLook): HTMLCanvasElement {
  const key = lookKey(look);
  let cached = portraitCache.get(key);
  if (!cached) {
    if (portraitCache.size > 512) portraitCache.clear();
    // Gera o personagem em pose idle frontal (SE) sem sombra de chão e recorta o busto 24x24 (cabeça + ombros + coroa/acessório)
    const pal = buildPalettes(look);
    const work = new PixelBuf(SPRITE_W, SPRITE_H);
    drawBackArm(work, pal, 'idle', 0, 2);
    drawTorso(work, pal, look, 2, true);
    drawHeadAndFace(work, pal, 2, true, false, 0);
    drawHairAndAccessory(work, pal, look, 2, true);
    drawFrontArm(work, pal, 'idle', 0, 2);
    work.outline();

    // Recorta 24x24 centrado na cabeça + colarinho/ombros (x = 4..27, y = 2..25)
    const bust = work.crop(4, 2, PORTRAIT_SIZE, PORTRAIT_SIZE);
    cached = bufToCanvas(bust);
    portraitCache.set(key, cached);
  }
  return cached;
}
