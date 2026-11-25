// Motor de Avatares Isométricos em Pixel Art (Proporção Clássica Habbo Hotel 2006 / Chibi Isométrico 3-Cabeças)
// Resolução nativa 1x: 32x52 px com âncora nos pés (16, 47).
// Rodada 3 de Humanização & Cinemática de Estúdio:
// - Articulação orgânica com coxa + joelho dobrando + canela + rotação do pé (calcanhar -> planta -> ponta)
// - Braços com ombro + cotovelo articulado + antebraço + punho (zero blocos retangulares rígidos)
// - Micro-gestos humanos em 16 fases (0..15): olhar curioso para o lado, inclinar cabeça, coçar/ajustar queixo ou óculos,
//   pausa para pensar durante a digitação, virar página/ler monitor, e balanço natural de quadril na dança.

import { mix, ramp, shade, type Ramp } from '../art/core/color';
import { PixelBuf, type Palette } from '../art/core/pixbuf';

export type HabboAccessory = 'crown' | 'glasses' | 'headset' | 'beret' | 'cap' | 'visor' | 'none';
export type HabboDirection = 'SE' | 'SW' | 'NW' | 'NE';
export type HabboAction = 'idle' | 'walk' | 'sit' | 'type' | 'coffee' | 'wave' | 'dance';

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

function resolveOutfitStyle(look: HabboAvatarLook): 'jacket' | 'vest_tie' | 'hoodie' {
  if (look.accessory === 'crown' || look.accessory === 'glasses') return 'vest_tie';
  if (look.accessory === 'headset' || look.accessory === 'visor') return 'hoodie';
  return 'jacket';
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
// TEMPLATES ASCII ESCULPIDOS EM 3/4 ISOMÉTRICO REAL (CABEÇA 15x15 E CABELOS 3D)
// ============================================================================

const HEAD_3Q_SE: readonly string[] = [
  '.....DDDDDD....',
  '...DDLLLLLsss..',
  '..DLLLLLLssssS.',
  '..LLLLLsssssssS',
  '..LLLsssssssssS',
  'srLLssssssssssS',
  'srSsssssssssssS',
  'SSssssssssssssS',
  '..SsssssssssssS',
  '..sssbssssssbsS',
  '..SsssssssssssS',
  '...SsssssssssS.',
  '...SSsssssssSD.',
  '....DSSssssSD..',
  '......DDDDD....',
];

const HEAD_3Q_NE: readonly string[] = [
  '.....DDDDDD....',
  '...DDssssssSS..',
  '..DssssssssssS.',
  '..ssssssssssssS',
  '..ssssssssssssS',
  '..sssssssssSrSS',
  '..sssssssssSrSS',
  '..SssssssssssSS',
  '..SsssssssssssS',
  '..SSsssssssssS.',
  '...SssssssssSD.',
  '...SSsssssssDD.',
  '....DDsssssDD..',
  '.....DDDDDDD...',
  '...............',
];

const HAIR_0_SE: readonly string[] = [
  '.....oooooo.....',
  '...oohhhhhhooo..',
  '..ohhHHHHhhhood.',
  '.oohhhHHhhhhhood',
  '.ohhhhhhhhhooood',
  '.ohhoooohhhhoodd',
  '.ohoo..ooh..oodd',
  '.ood....o.....dd',
  '..d...........d.',
  '..d.............',
];

const HAIR_0_NE: readonly string[] = [
  '.....oooooo.....',
  '...oohhhhhhooo..',
  '..ohhHHHHhhhood.',
  '.oohhhHHhhhhhood',
  '.ohhhhhhhhhooood',
  '.ohhoooooooooodd',
  '.ohooooooooooodd',
  '.ooooooooooooddd',
  '.dooooooooooodd.',
  '..doooooooooodd.',
  '..ddoooooooodd..',
  '...dddddddddd...',
];

const HAIR_1_SE: readonly string[] = [
  '....oo...oo.....',
  '..oohho.ohhoo...',
  '.oohhHHhhhhood..',
  '.ohhHHHHhhhhood.',
  'oohhhhhhhhhooodd',
  'ohhooo.ohh..oodd',
  '.ood....o....odd',
  '.od...........d.',
  '..d.............',
];

const HAIR_1_NE: readonly string[] = [
  '....oo...oo.....',
  '..oohho.ohhoo...',
  '.oohhHHhhhhood..',
  '.ohhHHHHhhhhood.',
  'oohhhhhhhhhooodd',
  'ohhooooooooooodd',
  '.ohooooooooooodd',
  '.ooooooooooooddd',
  '.doooooooooooddd',
  '..doooooooooodd.',
  '...ddooooooodd..',
  '....ddddddddd...',
];

const HAIR_2_SE: readonly string[] = [
  '.....ooooooo....',
  '...ooDhhhhhhoo..',
  '..ooDhHHHHhhhod.',
  '.oooDhhhhhhhhood',
  '.ooo.ohhhhhhoodd',
  '.oho...oohhhoodd',
  '.ohd.....oo..odd',
  '.odd..........dd',
  '..dd..........dd',
  '..d...........d.',
];

const HAIR_2_NE: readonly string[] = [
  '.....ooooooo....',
  '...ooDhhhhhhoo..',
  '..ooDhHHHHhhhod.',
  '.oooDhhhhhhhhood',
  '.oooDooooooooodd',
  '.ohooooooooooodd',
  '.ohooooooooooodd',
  '.ooooooooooooddd',
  '.ooooooooooooddd',
  '..dooooooooooddd',
  '..ddooooooooddd.',
  '...ddddddddddd..',
];

const HAIR_3_SE: readonly string[] = [
  '....oohhhhhoo...',
  '..oohhHHHHhhhoo.',
  '.oohhhHHHHhhhhod',
  '.ohhhhhhhhhhhood',
  '.ohhhhoooohhhood',
  '.ohho..oo..ooodd',
  '.ood........oodd',
  '..d...........d.',
];

const HAIR_3_NE: readonly string[] = [
  '....oohhhhhoo...',
  '..oohhHHHHhhhoo.',
  '.oohhhHHHHhhhhod',
  '.ohhhhhhhhhhhood',
  '.ohhhhoooooooodd',
  '.ohhoooooooooodd',
  '.ooooooooooooodd',
  '.ooooooooooooddd',
  '.doooooooooooddd',
  '..doooooooooodd.',
  '...ddooooooodd..',
  '....ddddddddd...',
];

const HAIR_STYLES_SE = [HAIR_0_SE, HAIR_1_SE, HAIR_2_SE, HAIR_3_SE];
const HAIR_STYLES_NE = [HAIR_0_NE, HAIR_1_NE, HAIR_2_NE, HAIR_3_NE];

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
    dd: shade(look.shirtDark || shirtBase.dk, -0.11),
  };
  const pants = ramp(look.pantsColor || '#1e293b', 0.08);
  const shoes = ramp('#1e293b', 0.09);
  return { skin, hair, shirt, pants, shoes };
}

// ============================================================================
// PERNAS & TÊNIS ESCULPIDOS DO ZERO VIA TEMPLATES ASCII (MÉTODO PIXEL-ART-STUDIO)
// Grade 24x15 estampada em x=5, y=33 (âncora dos pés em y=47).
// Sem interpolação matemática de retas: cada pixel foi esculpido à mão para
// garantir silhueta limpa em 1x, zero jaggies e zero joelhos dobrando ao contrário!
// ============================================================================

const LEGS_IDLE_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '......ddddDpppplpd......',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '.......ttat.ttatw.......',
  '......sssss.uuuuwu......',
  '......gcccc.geeeee......',
];

const LEGS_SIT_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddddppppld......',
  '......ddddddDpppld......',
  '........dddd.ppppld.....',
  '........ddddDpppppld....',
  '..........dddDppplhd....',
  '..........dddDppplhd....',
  '..........dddDppplhd....',
  '..........dddDppplhd....',
  '..........dddDppplhd....',
  '..........ttat.ttatw....',
  '.........sssss.uuuuwu...',
  '.........gcccc.geeeee...',
];

// 4 Poses-Chave Clássicas de Caminhada (pixel-art-studio: 4 poses limpas > 12 borradas):
// F0: Contact Direito (Perna frontal avança +2px down-right, traseira impulsiona -2px)
const LEGS_WALK_0_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '.....ddddD.pppplpd......',
  '.....ddpd...Dpplhd......',
  '.....ddpd...Dpplhd......',
  '....ddpd.....Dpplhd.....',
  '....ddpd.....Dpplhd.....',
  '....ddpd......Dppld.....',
  '...ddpd.......Dppld.....',
  '...ttat.......Dppld.....',
  '..sssss.......ttatw.....',
  '..gcccc......uuuuwu.....',
  '.............geeeee.....',
];

// F1: Passing Direito (Perna frontal firme no centro, traseira recolhida +2px passando)
const LEGS_WALK_1_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '......ddddDpppplpd......',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '.......ddpdDplhd........',
  '.......ddpdDplhd........',
  '.......ddpdDplhd........',
  '.......ttatDplhd........',
  '......sssssDplhd........',
  '......gccccDplhd........',
  '............ttatw.......',
  '...........uuuuwu.......',
  '...........geeeee.......',
];

// F2: Contact Esquerdo (Perna traseira estende à frente por trás da frontal que recua)
const LEGS_WALK_2_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '.......dddpDppplpd......',
  '........ddpDppplpd......',
  '........ddpDppplp.......',
  '.........ddDpppl........',
  '........Dpppl.ddp.......',
  '........Dpppl..ddp......',
  '.......Dpppl...ddpd.....',
  '.......ttatw...ddpd.....',
  '......uuuuwu...ttat.....',
  '......geeeee..sssss.....',
  '..............gcccc.....',
];

// F3: Passing Esquerdo (Perna traseira firme no centro, frontal recolhida +2px passando)
const LEGS_WALK_3_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '......ddddDpppplpd......',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd..Dplhd.......',
  '......ddpd..Dplhd.......',
  '......ddpd..Dplhd.......',
  '......ddpd..ttatw.......',
  '......ddpd.uuuuwu.......',
  '......ttat.geeeee.......',
  '.....sssss..............',
  '.....gcccc..............',
];

const WALK_LEG_FRAMES = [LEGS_WALK_0_TPL, LEGS_WALK_1_TPL, LEGS_WALK_2_TPL, LEGS_WALK_3_TPL] as const;

// Poses de Dança Groove (pés batendo o ritmo limpos no chão)
const LEGS_DANCE_0_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '......ddddDpppplpd......',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd..Dplhd.......',
  '......ddpd..Dplhd.......',
  '......ddpd..Dplhd.......',
  '......ddpd..Dplhd.......',
  '......ddpd..Dplhd.......',
  '......ddpd..ttatw.......',
  '.......ttat.uuuuwu......',
  '......sssss.geeeee......',
  '......gcccc.............',
];

const LEGS_DANCE_1_TPL: readonly string[] = [
  '......BBBBBBkkBBBB......',
  '......ddddppppplpd......',
  '......ddddDpppplpd......',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ddpd.Dplhd........',
  '......ttat.Dplhd........',
  '.....sssss..ttatw.......',
  '.....gcccc.uuuuwu.......',
  '...........geeeee.......',
];

const DANCE_LEG_FRAMES = [LEGS_DANCE_0_TPL, LEGS_IDLE_TPL, LEGS_DANCE_1_TPL, LEGS_IDLE_TPL] as const;

function drawLegsAndShoes(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  action: HabboAction,
  f16: number,
  isFront: boolean,
): void {
  const { pants, shoes, shirt } = pal;
  const buckleCol = isFront ? (look.accessory === 'crown' ? '#fbbf24' : '#e2e8f0') : '#0f172a';

  const legPal: Palette = {
    B: '#0f172a',
    k: buckleCol,
    D: pants.dd,
    d: pants.dk,
    p: pants.base,
    l: pants.lt,
    h: pants.hi,
    s: shoes.dk,
    u: shoes.base,
    t: shoes.lt,
    w: '#ffffff',
    a: shirt.lt,
    e: '#e2e8f0',
    c: '#cbd5e1',
    g: '#94a3b8',
  };

  let tpl: readonly string[] = LEGS_IDLE_TPL;
  if (action === 'sit' || action === 'type') {
    tpl = LEGS_SIT_TPL;
  } else if (action === 'walk') {
    // 8 fases mapeadas suavemente sobre as 4 poses-chave clássicas (2 fases por pose-chave)
    const walkPhase = Math.floor((f16 % 8) / 2);
    tpl = WALK_LEG_FRAMES[walkPhase];
  } else if (action === 'dance') {
    const dancePhase = Math.floor((f16 % 8) / 2);
    tpl = DANCE_LEG_FRAMES[dancePhase];
  }

  buf.stamp(tpl, 5, 33, legPal);
}

// ============================================================================
// TRONCO EM 3/4 COM TORÇÃO DE OMBROS (CONTRAPPOSTO HUMANO NA CAMINHADA E DANÇA)
// ============================================================================

function drawTorso(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  yOff: number,
  xShift: number,
  isFront: boolean,
  chestTwist = 0,
): void {
  const { shirt, skin } = pal;
  const ty = 21 + yOff;
  const tx = xShift;
  const outfit = resolveOutfitStyle(look);

  buf.hline(11 + tx, 20 + tx, ty, shirt.lt);
  for (let r = 1; r <= 10; r++) {
    const y = ty + r;
    buf.set(10 + tx, y, shirt.dd);
    buf.hline(11 + tx, 13 + tx, y, shirt.dk);
    buf.hline(14 + tx, 17 + tx, y, shirt.base);
    buf.hline(18 + tx, 20 + tx, y, shirt.lt);
    buf.set(21 + tx, y, shirt.dk);
  }
  buf.hline(11 + tx, 14 + tx, ty + 11, shirt.dd);
  buf.hline(15 + tx, 20 + tx, ty + 11, shirt.dk);

  // Pescoço cilíndrico sombreado conectando cabeça ao colarinho
  buf.rect(14 + tx, ty - 1, 4, 2, skin.dk);
  buf.set(16 + tx, ty - 1, skin.base);
  buf.set(17 + tx, ty - 1, skin.lt);

  // O eixo central do peito gira sutilmente (+/- 1px) com o contrapposto dos ombros ao andar ou dançar!
  const cx = 17 + tx + chestTwist;

  if (isFront) {
    if (outfit === 'vest_tie') {
      buf.set(cx - 3, ty, '#cbd5e1');
      buf.set(cx - 2, ty + 1, '#e2e8f0');
      buf.set(cx - 1, ty + 2, '#ffffff');
      buf.set(cx + 2, ty, '#ffffff');
      buf.set(cx + 1, ty + 1, '#ffffff');
      buf.set(cx, ty + 2, '#f1f5f9');

      buf.vline(cx - 2, ty + 2, ty + 8, shirt.dd);
      buf.vline(cx + 2, ty + 2, ty + 8, shirt.hi);

      const tieCol = look.accessory === 'crown' ? '#dc2626' : '#f59e0b';
      const tieHi = look.accessory === 'crown' ? '#fbbf24' : '#fef08a';
      buf.set(cx, ty + 2, tieHi);
      buf.vline(cx, ty + 3, ty + 9, tieCol);
      buf.set(cx, ty + 9, tieHi);

      buf.set(cx + 2, ty + 4, '#ffffff');
      buf.set(cx + 3, ty + 4, '#38bdf8');
    } else if (outfit === 'hoodie') {
      buf.hline(13 + tx, 19 + tx, ty, shirt.dd);
      buf.hline(14 + tx, 18 + tx, ty + 1, '#1e293b');
      buf.vline(cx, ty + 2, ty + 11, '#0f172a');
      buf.vline(cx - 1, ty + 2, ty + 10, shirt.hi);
      buf.vline(cx - 2, ty + 2, ty + 5, '#e2e8f0');
      buf.vline(cx + 1, ty + 2, ty + 5, '#38bdf8');
      buf.hline(14 + tx, 19 + tx, ty + 8, shirt.dk);
      buf.vline(14 + tx, ty + 8, ty + 10, shirt.dd);
      buf.vline(19 + tx, ty + 8, ty + 10, shirt.dd);
    } else {
      buf.rect(cx - 1, ty + 1, 3, 10, '#f8fafc');
      buf.vline(cx - 1, ty + 1, ty + 10, '#cbd5e1');
      buf.hline(cx - 1, cx + 1, ty + 4, shirt.dk);
      buf.set(cx, ty + 5, '#38bdf8');
      buf.vline(cx - 2, ty + 1, ty + 11, shirt.lt);
      buf.vline(cx + 2, ty + 1, ty + 11, shirt.hi);
      buf.set(cx - 3, ty, shirt.hi);
      buf.set(cx + 2, ty, shirt.hi);
    }
  } else {
    buf.hline(12 + tx, 19 + tx, ty, shirt.hi);
    buf.hline(11 + tx, 20 + tx, ty + 1, shirt.lt);
    buf.hline(12 + tx, 18 + tx, ty + 2, shirt.dk);
    buf.vline(14 + tx + chestTwist, ty + 2, ty + 10, shirt.dd);
    buf.vline(15 + tx + chestTwist, ty + 2, ty + 10, shirt.base);
  }
}

// ============================================================================
// BRAÇOS ARTICULADOS COM COTOVELO REAL, MÃOS 3x3 PX E MICRO-GESTOS HUMANOS
// ============================================================================

function drawHand3x3(buf: PixelBuf, x: number, y: number, skin: Ramp): void {
  buf.rect(x, y, 3, 3, skin.base);
  buf.set(x, y, skin.lt);
  buf.set(x + 1, y, skin.lt);
  buf.set(x + 2, y + 2, skin.dk);
  buf.set(x, y + 2, skin.dk);
}

function drawArticulatedArm(
  buf: PixelBuf,
  shoulderX: number,
  shoulderY: number,
  elbowX: number,
  elbowY: number,
  handX: number,
  handY: number,
  shirt: Ramp,
  skin: Ramp,
  isFrontArm: boolean,
): void {
  const upperCol = isFrontArm ? shirt.base : shirt.dk;
  const foreCol = isFrontArm ? shirt.lt : shirt.base;
  const edgeCol = isFrontArm ? shirt.lt : shirt.dd;

  // Braço superior (ombro -> cotovelo)
  for (let s = 0; s <= 4; s++) {
    const t = s / 4;
    const cx = Math.round(shoulderX + (elbowX - shoulderX) * t);
    const cy = Math.round(shoulderY + (elbowY - shoulderY) * t);
    buf.rect(cx, cy, 3, 2, upperCol);
    buf.set(cx, cy, edgeCol);
  }

  // Antebraço articulado (cotovelo -> punho)
  for (let s = 0; s <= 4; s++) {
    const t = s / 4;
    const cx = Math.round(elbowX + (handX - elbowX) * t);
    const cy = Math.round(elbowY + (handY - elbowY) * t);
    buf.rect(cx, cy, 3, 2, foreCol);
    if (isFrontArm) buf.set(cx, cy, shirt.hi);
  }

  drawHand3x3(buf, handX, handY, skin);
}

function drawBackArm(
  buf: PixelBuf,
  pal: AvatarPalettes,
  action: HabboAction,
  f16: number,
  yOff: number,
  xShift: number,
): void {
  const { shirt, skin } = pal;
  const sy = 21 + yOff;
  const sx = 8 + xShift;
  const f8 = f16 % 8;

  if (action === 'wave') {
    // Aceno orgânico com cotovelo aberto e mão abanando em arco
    const WAVE_HAND_X = [5, 4, 3, 4, 6, 7, 6, 5] as const;
    const WAVE_HAND_Y = [-10, -11, -11, -10, -9, -10, -11, -10] as const;
    drawArticulatedArm(
      buf,
      sx,
      sy,
      sx - 2,
      sy - 4,
      WAVE_HAND_X[f8] + xShift,
      sy + WAVE_HAND_Y[f8],
      shirt,
      skin,
      false,
    );
    return;
  }

  if (action === 'dance') {
    // Na dança, o cotovelo dobra no ritmo do groove
    const up = f8 < 4;
    if (up) {
      const sway = f8 % 2 === 0 ? -1 : 1;
      drawArticulatedArm(buf, sx, sy, sx - 2, sy - 3, sx - 3 + sway, sy - 9, shirt, skin, false);
    } else {
      const hipTap = f8 % 2 === 0 ? 0 : 1;
      drawArticulatedArm(buf, sx, sy, sx - 2, sy + 3, sx - 1, sy + 6 + hipTap, shirt, skin, false);
    }
    return;
  }

  if (action === 'type') {
    // Digitando com pausas humanas (fases 6, 7 e 13..15 = lendo a tela, mão repousa; demais = dedos ágeis)
    const isReadingPause = f16 === 6 || f16 === 7 || f16 >= 13;
    const dy = isReadingPause ? 1 : f16 % 2 === 0 ? 0 : 1;
    const dx = isReadingPause ? 0 : f16 % 3 === 0 ? 1 : 0;
    drawArticulatedArm(buf, sx, sy, sx, sy + 4, sx + 4 + dx, sy + 6 + dy, shirt, skin, false);
    return;
  }

  if (action === 'sit') {
    // Braço apoiado no braço da poltrona
    drawArticulatedArm(buf, sx, sy, sx, sy + 4, sx + 2, sy + 7, shirt, skin, false);
    return;
  }

  if (action === 'walk') {
    // Pêndulo natural humano com dobra do cotovelo quando o braço avança à frente
    const ELBOW_DX = [1, 1, 0, -1, -2, -1, 0, 1] as const;
    const HAND_DX = [3, 2, 0, -2, -3, -2, 0, 2] as const;
    const HAND_DY = [7, 7, 8, 8, 7, 7, 8, 7] as const;
    drawArticulatedArm(
      buf,
      sx,
      sy,
      sx + ELBOW_DX[f8],
      sy + 4,
      sx + HAND_DX[f8],
      sy + HAND_DY[f8],
      shirt,
      skin,
      false,
    );
    return;
  }

  // Idle / Coffee: braço relaxado com leve flexão natural do cotovelo
  const breathLag = f8 === 4 || f8 === 5 ? 1 : 0;
  drawArticulatedArm(buf, sx, sy, sx - 1, sy + 4, sx, sy + 7 + breathLag, shirt, skin, false);
}

function drawCoffeeMug(buf: PixelBuf, x: number, y: number, f16: number): void {
  buf.rect(x, y, 5, 5, '#ffffff');
  buf.hline(x, x + 4, y + 2, '#ef4444');
  buf.hline(x, x + 4, y + 3, '#dc2626');
  buf.vline(x + 4, y, y + 4, '#cbd5e1');
  buf.hline(x + 1, x + 3, y, '#3e2723');
  buf.set(x + 5, y + 1, '#e2e8f0');
  buf.set(x + 5, y + 2, '#cbd5e1');
  buf.set(x + 5, y + 3, '#94a3b8');

  // Vapor em curva "S" suave
  const phase = f16 % 8;
  const s1 = phase % 2 === 0 ? 0 : 1;
  const s2 = (phase + 1) % 2 === 0 ? 0 : -1;
  buf.set(x + 2 + s1, y - 2, 'rgba(255, 255, 255, 0.88)');
  buf.set(x + 2 + s2, y - 4, 'rgba(255, 255, 255, 0.72)');
  buf.set(x + 3 - s1, y - 6 - (phase % 2), 'rgba(255, 255, 255, 0.50)');
}

function drawFrontArm(
  buf: PixelBuf,
  pal: AvatarPalettes,
  action: HabboAction,
  f16: number,
  yOff: number,
  xShift: number,
  talking: boolean,
): void {
  const { shirt, skin } = pal;
  const sy = 22 + yOff;
  const sx = 20 + xShift;
  const f8 = f16 % 8;

  if (action === 'coffee') {
    // Toma um gole real apenas nas fases 4..7 de cada ciclo de 16 frames; no resto segura a caneca relaxado
    const sip = f16 >= 4 && f16 <= 7 ? -4 : f16 === 3 || f16 === 8 ? -2 : 0;
    const elbowOut = sip < 0 ? 2 : 0;
    drawArticulatedArm(buf, sx, sy, sx + elbowOut, sy + 3 + Math.round(sip * 0.5), sx + 1, sy + 4 + sip, shirt, skin, true);
    drawCoffeeMug(buf, sx + 3, sy + 2 + sip, f16);
    return;
  }

  if (action === 'dance') {
    const up = f8 >= 4;
    if (up) {
      const sway = f8 % 2 === 0 ? 1 : -1;
      drawArticulatedArm(buf, sx, sy, sx + 2, sy - 3, sx + 2 + sway, sy - 9, shirt, skin, true);
    } else {
      const groove = f8 % 2 === 0 ? 1 : 0;
      drawArticulatedArm(buf, sx, sy, sx + 1, sy + 3, sx + 1, sy + 6 + groove, shirt, skin, true);
    }
    return;
  }

  if (action === 'type') {
    // Nas fases 13..15, o desenvolvedor para de digitar com uma mão e leva a mão ao queixo pensando no código!
    if (f16 >= 13 && !talking) {
      drawArticulatedArm(buf, sx, sy, sx + 2, sy + 2, sx - 1, sy - 3, shirt, skin, true);
      return;
    }
    const isPause = f16 === 6 || f16 === 7;
    const dy = isPause ? 1 : f16 % 2 === 1 ? 0 : 1;
    const dx = isPause ? 1 : f16 % 4 === 0 ? -1 : 0;
    drawArticulatedArm(buf, sx, sy, sx + 1, sy + 3, sx + dx, sy + 5 + dy, shirt, skin, true);
    return;
  }

  if (action === 'sit') {
    // Sentado conversando ou pensando: nas fases 11..13 gesticula ou apoia a mão no queixo
    if (talking && f8 % 2 === 0) {
      drawArticulatedArm(buf, sx, sy, sx + 1, sy + 3, sx + 2, sy + 2, shirt, skin, true);
      return;
    }
    if (f16 >= 11 && f16 <= 13) {
      drawArticulatedArm(buf, sx, sy, sx + 2, sy + 2, sx - 1, sy - 3, shirt, skin, true);
      return;
    }
    drawArticulatedArm(buf, sx, sy, sx + 1, sy + 3, sx - 1, sy + 6, shirt, skin, true);
    return;
  }

  if (action === 'walk') {
    // Balanço oposto ao braço traseiro com cotovelo flexionando para a frente (SE) quando avança
    const ELBOW_DX = [-1, -1, 0, 1, 2, 1, 0, -1] as const;
    const HAND_DX = [-2, -1, 0, 2, 3, 2, 0, -1] as const;
    const HAND_DY = [7, 8, 8, 6, 5, 6, 8, 7] as const;
    drawArticulatedArm(
      buf,
      sx,
      sy,
      sx + ELBOW_DX[f8],
      sy + 4,
      sx + HAND_DX[f8],
      sy + HAND_DY[f8],
      shirt,
      skin,
      true,
    );
    return;
  }

  // Quando falando em pé ('idle' + talking), faz gesto expressivo humano com a mão dianteira!
  if (talking) {
    const gestureLift = f8 % 3 === 0 ? -3 : f8 % 3 === 1 ? -2 : -1;
    drawArticulatedArm(buf, sx, sy, sx + 1, sy + 3, sx + 2, sy + 5 + gestureLift, shirt, skin, true);
    return;
  }

  // Micro-gesto humano em Idle (fases 11..13 de 16): leva a mão ao queixo/óculos como alguém pensando
  if (action === 'idle' && f16 >= 11 && f16 <= 13) {
    drawArticulatedArm(buf, sx, sy, sx + 2, sy + 2, sx - 1, sy - 4, shirt, skin, true);
    return;
  }

  const breathLag = f8 === 4 || f8 === 5 ? 1 : 0;
  drawArticulatedArm(buf, sx, sy, sx + 1, sy + 4, sx, sy + 7 + breathLag, shirt, skin, true);
}

// ============================================================================
// CABEÇA E ROSTO EM PERSPECTIVA 3/4 COM OLHAR VIVO (EYE SACCADES) E INCLINAÇÃO
// ============================================================================

function drawHeadAndFace(
  buf: PixelBuf,
  pal: AvatarPalettes,
  yOff: number,
  headDx: number,
  isFront: boolean,
  talking: boolean,
  f16: number,
  blinking = false,
  action: HabboAction = 'idle',
): void {
  const { skin, hair } = pal;
  const hx = 9 + headDx;
  const hy = 6 + yOff;
  const f8 = f16 % 8;

  const headPal: Palette = {
    L: skin.lt,
    s: skin.base,
    S: skin.dk,
    D: skin.dd,
    r: shade(skin.dk, -0.09),
    b: mix(skin.base, '#fb7185', 0.4),
  };

  buf.stamp(isFront ? HEAD_3Q_SE : HEAD_3Q_NE, hx, hy, headPal);

  if (isFront) {
    const browCol = hair.dd;
    const isThinkingPose =
      !talking &&
      ((action === 'idle' && f16 >= 11 && f16 <= 13) ||
        (action === 'type' && f16 >= 13) ||
        (action === 'sit' && f16 >= 11 && f16 <= 13));

    const browLiftL = talking || action === 'dance' || action === 'wave' ? (f8 % 4 === 0 ? -1 : 0) : 0;
    // Quando pensando, arqueia uma sobrancelha (expressão humana curiosa!)
    const browLiftR = isThinkingPose ? -1 : browLiftL;

    buf.hline(15 + headDx, 17 + headDx, hy + 5 + browLiftL, browCol);
    buf.hline(19 + headDx, 21 + headDx, hy + 5 + browLiftR, browCol);

    // Movimento ocular humano (Eye Saccades):
    // - Digitando: as pupilas varrem da esquerda para a direita lendo as linhas dos dois monitores!
    // - Em pé / Sentado: olha curiosamente para o lado nas fases 9..12
    let gazeDx = 0;
    if (action === 'type') {
      gazeDx = f8 < 4 ? 0 : 1;
    } else if ((action === 'idle' || action === 'sit') && f16 >= 8 && f16 <= 11) {
      gazeDx = 1;
    }

    if (blinking) {
      buf.hline(15 + headDx, 16 + headDx, hy + 7, '#0f172a');
      buf.hline(19 + headDx, 20 + headDx, hy + 7, '#0f172a');
    } else if (action === 'dance' && f8 % 4 < 2) {
      buf.set(15 + headDx, hy + 7, '#0f172a');
      buf.set(16 + headDx, hy + 6, '#0f172a');
      buf.set(19 + headDx, hy + 6, '#0f172a');
      buf.set(20 + headDx, hy + 7, '#0f172a');
    } else {
      buf.rect(15 + headDx, hy + 6, 2, 2, '#0f172a');
      buf.set(15 + headDx + gazeDx, hy + 6, '#ffffff');
      buf.rect(19 + headDx, hy + 6, 2, 2, '#0f172a');
      buf.set(19 + headDx + gazeDx, hy + 6, '#ffffff');
    }

    // Nariz sombreado no eixo 3/4
    buf.set(18 + headDx, hy + 8, skin.dk);
    buf.set(18 + headDx, hy + 7, skin.lt);

    // Reflexo ciano/verde do monitor no queixo quando digitando ('type')
    if (action === 'type') {
      const glowCol = f8 % 2 === 0 ? 'rgba(56, 189, 248, 0.38)' : 'rgba(34, 197, 94, 0.35)';
      buf.hline(15 + headDx, 20 + headDx, hy + 13, glowCol);
    }

    // Lip-Sync em 3 Formas de Boca (A / E / O) quando falando ou tomando gole de café
    if (action === 'coffee' && f16 >= 4 && f16 <= 7) {
      buf.rect(17 + headDx, hy + 10, 2, 2, '#7f1d1d');
    } else if (talking) {
      const mouthShape = f8 % 4;
      if (mouthShape === 0) {
        buf.rect(16 + headDx, hy + 10, 4, 3, '#9f1239');
        buf.hline(17 + headDx, 18 + headDx, hy + 10, '#ffffff');
        buf.hline(17 + headDx, 18 + headDx, hy + 12, '#fb7185');
      } else if (mouthShape === 1) {
        buf.rect(16 + headDx, hy + 10, 4, 2, '#7f1d1d');
        buf.hline(16 + headDx, 19 + headDx, hy + 10, '#ffffff');
      } else if (mouthShape === 2) {
        buf.rect(17 + headDx, hy + 10, 3, 3, '#881337');
        buf.set(18 + headDx, hy + 11, '#fb7185');
      } else {
        buf.hline(16 + headDx, 19 + headDx, hy + 11, shade(skin.dd, -0.25));
      }
    } else if (action === 'dance' || action === 'wave') {
      buf.rect(16 + headDx, hy + 10, 4, 2, '#9f1239');
      buf.hline(17 + headDx, 18 + headDx, hy + 10, '#ffffff');
    } else if (isThinkingPose) {
      // Boca pensativa de lado ("hmm")
      buf.hline(17 + headDx, 19 + headDx, hy + 11, shade(skin.dd, -0.22));
    } else {
      buf.hline(16 + headDx, 19 + headDx, hy + 11, shade(skin.dd, -0.2));
      buf.set(15 + headDx, hy + 10, skin.dk);
    }
  }
}

// ============================================================================
// CABELOS ESCULPIDOS COM VOLUME 3D & ACESSÓRIOS ALINHADOS EM 3/4
// ============================================================================

function drawHairAndAccessory(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  yOff: number,
  headDx: number,
  isFront: boolean,
): void {
  const { hair } = pal;
  const hx = 8 + headDx;
  const hy = 4 + yOff;
  const styleIdx = resolveHairStyle(look);

  const hairPal: Palette = {
    o: hair.base,
    h: hair.lt,
    H: hair.hi,
    d: hair.dk,
    D: hair.dd,
  };

  const tpl = isFront ? HAIR_STYLES_SE[styleIdx] : HAIR_STYLES_NE[styleIdx];
  buf.stamp(tpl, hx, hy, hairPal);

  const acc = look.accessory;
  const ay = 6 + yOff;
  const dx = headDx;

  switch (acc) {
    case 'crown': {
      const gold = ramp('#f59e0b', 0.1);
      buf.hline(11 + dx, 21 + dx, ay - 1, gold.dk);
      buf.hline(10 + dx, 22 + dx, ay - 2, gold.base);
      buf.hline(10 + dx, 22 + dx, ay - 3, gold.lt);
      buf.rect(10 + dx, ay - 5, 2, 2, gold.lt);
      buf.set(11 + dx, ay - 6, gold.hi);
      buf.rect(16 + dx, ay - 6, 2, 3, gold.hi);
      buf.set(17 + dx, ay - 7, '#ffffff');
      buf.rect(21 + dx, ay - 5, 2, 2, gold.base);
      buf.set(21 + dx, ay - 6, gold.lt);
      buf.set(12 + dx, ay - 2, '#ef4444');
      buf.set(16 + dx, ay - 2, '#38bdf8');
      buf.set(17 + dx, ay - 2, '#e0f2fe');
      buf.set(20 + dx, ay - 2, '#ef4444');
      break;
    }

    case 'glasses': {
      if (isFront) {
        const frameCol = '#1e293b';
        buf.hline(10 + dx, 13 + dx, ay + 6, frameCol);
        buf.hline(14 + dx, 17 + dx, ay + 5, frameCol);
        buf.hline(14 + dx, 17 + dx, ay + 8, frameCol);
        buf.vline(14 + dx, ay + 5, ay + 8, frameCol);
        buf.vline(17 + dx, ay + 5, ay + 8, frameCol);
        buf.set(18 + dx, ay + 6, frameCol);
        buf.hline(18 + dx, 21 + dx, ay + 5, frameCol);
        buf.hline(18 + dx, 21 + dx, ay + 8, frameCol);
        buf.vline(18 + dx, ay + 5, ay + 8, frameCol);
        buf.vline(21 + dx, ay + 5, ay + 8, frameCol);
        buf.set(15 + dx, ay + 6, '#7dd3fc');
        buf.set(16 + dx, ay + 7, 'rgba(56, 189, 248, 0.55)');
        buf.set(19 + dx, ay + 6, '#7dd3fc');
        buf.set(20 + dx, ay + 7, 'rgba(56, 189, 248, 0.55)');
      } else {
        buf.hline(19 + dx, 22 + dx, ay + 6, '#1e293b');
      }
      break;
    }

    case 'headset': {
      buf.hline(11 + dx, 21 + dx, ay - 1, '#334155');
      buf.hline(12 + dx, 20 + dx, ay - 2, '#64748b');
      buf.rect(8 + dx, ay + 4, 3, 5, '#1e293b');
      buf.vline(9 + dx, ay + 5, ay + 7, '#22c55e');
      buf.rect(22 + dx, ay + 4, 2, 5, '#0f172a');
      buf.set(23 + dx, ay + 6, '#22c55e');
      if (isFront) {
        buf.line(10 + dx, ay + 8, 14 + dx, ay + 11, '#475569');
        buf.rect(14 + dx, ay + 11, 2, 2, '#0f172a');
        buf.set(15 + dx, ay + 11, '#22c55e');
      }
      break;
    }

    case 'beret': {
      const beret = ramp(look.shirtColor || '#ec4899', 0.1);
      buf.hline(11 + dx, 19 + dx, ay - 3, beret.lt);
      buf.hline(9 + dx, 21 + dx, ay - 2, beret.base);
      buf.hline(8 + dx, 22 + dx, ay - 1, beret.base);
      buf.hline(9 + dx, 22 + dx, ay, beret.dk);
      buf.hline(10 + dx, 21 + dx, ay + 1, '#1e293b');
      buf.hline(12 + dx, 16 + dx, ay - 2, beret.hi);
      buf.set(14 + dx, ay - 4, beret.dd);
      break;
    }

    case 'cap': {
      const cap = ramp(look.shirtColor || '#06b6d4', 0.09);
      buf.hline(12 + dx, 20 + dx, ay - 2, cap.lt);
      buf.hline(10 + dx, 21 + dx, ay - 1, cap.base);
      buf.hline(10 + dx, 22 + dx, ay, cap.base);
      buf.hline(10 + dx, 22 + dx, ay + 1, cap.dk);
      buf.set(15 + dx, ay - 3, '#ffffff');
      buf.hline(12 + dx, 16 + dx, ay - 1, cap.hi);
      if (isFront) {
        buf.hline(14 + dx, 24 + dx, ay + 2, cap.dk);
        buf.hline(16 + dx, 25 + dx, ay + 3, cap.dd);
      } else {
        buf.hline(18 + dx, 24 + dx, ay + 2, cap.dd);
        buf.rect(13 + dx, ay + 1, 4, 1, '#1e293b');
      }
      break;
    }

    case 'visor': {
      buf.hline(9 + dx, 22 + dx, ay + 4, '#334155');
      if (isFront) {
        buf.rect(13 + dx, ay + 5, 10, 3, '#e11d48');
        buf.hline(14 + dx, 22 + dx, ay + 5, '#38bdf8');
        buf.hline(15 + dx, 20 + dx, ay + 6, '#ffffff');
        buf.hline(14 + dx, 22 + dx, ay + 7, '#9f1239');
      } else {
        buf.hline(9 + dx, 22 + dx, ay + 5, '#1e293b');
        buf.set(21 + dx, ay + 5, '#ef4444');
      }
      break;
    }

    case 'none':
    default:
      break;
  }
}

// ============================================================================
// COMPOSIÇÃO COMPLETA DO SPRITE 32x52 EM 16 FASES ORGÂNICAS E RETRATO 24x24
// ============================================================================

function renderHabboAvatarBuf(
  look: HabboAvatarLook,
  dir: HabboDirection,
  action: HabboAction,
  frame: number,
  talking: boolean,
  blinking = false,
): PixelBuf {
  const f16 = ((Math.floor(frame) % 16) + 16) % 16;
  const f8 = f16 % 8;
  const isFront = dir === 'SE' || dir === 'SW';
  const shouldFlip = dir === 'SW' || dir === 'NW';
  const pal = buildPalettes(look);

  // Cinemática Corporal de 16 Fases:
  const seatDrop = action === 'sit' || action === 'type' ? 3 : 0;
  let bodyBob = 0;
  let hairLag = 0;
  let torsoShiftX = 0;
  let chestTwist = 0;
  let headDx = 0;

  if (action === 'walk') {
    // Regra pixel-art-studio: corpo mais baixo no Contact (0..1, 4..5) e mais alto no Passing (2..3, 6..7);
    // cabelo/cabeça acompanha 1 fase depois (follow-through).
    const WALK_BOB = [1, 1, -1, -1, 1, 1, -1, -1] as const;
    const HAIR_LAG = [0, 1, 1, 0, 0, 1, 1, 0] as const;
    const CHEST_TWIST = [1, 1, 0, -1, -1, -1, 0, 1] as const;
    bodyBob = WALK_BOB[f8];
    hairLag = HAIR_LAG[f8];
    chestTwist = CHEST_TWIST[f8];
    headDx = 1;
  } else if (action === 'dance') {
    const DANCE_BOB = [0, 1, 0, 1, 0, 1, 0, 1] as const;
    const DANCE_SWAY = [-1, -1, 0, 0, 1, 1, 0, 0] as const;
    bodyBob = DANCE_BOB[f8];
    torsoShiftX = DANCE_SWAY[f8];
    chestTwist = DANCE_SWAY[f8];
    headDx = DANCE_SWAY[f8];
    hairLag = f8 % 2 === 1 ? 1 : 0;
  } else if (action === 'type') {
    // Digitando concentrado: inclina a cabeça 1px para os monitores; nas fases 13..15 recua 1px pensando
    const isThinking = f16 >= 13;
    bodyBob = isThinking ? 0 : f8 === 3 || f8 === 4 ? 1 : 0;
    headDx = isThinking ? 0 : 1;
  } else if (action === 'idle' || action === 'coffee' || action === 'sit') {
    // Respiração suave e pausada (apenas 2 fases por ciclo longo) + olhar curioso nas fases 9..12
    bodyBob = f16 === 4 || f16 === 5 || f16 === 12 ? 1 : 0;
    hairLag = f16 === 5 ? 1 : 0;
    if (action !== 'coffee' && f16 >= 9 && f16 <= 12) {
      headDx = 1;
    }
  }

  const yOff = seatDrop + bodyBob;
  const work = new PixelBuf(SPRITE_W, SPRITE_H);

  // 1. Braço traseiro articulado
  drawBackArm(work, pal, action, f16, yOff, torsoShiftX);

  // 2. Pernas articuladas (coxa + joelho + canela) e tênis com inclinação calcanhar-ponta
  drawLegsAndShoes(work, pal, look, action, f16, isFront);

  // 3. Tronco em 3/4 com contrapposto de ombros
  drawTorso(work, pal, look, yOff, torsoShiftX, isFront, chestTwist);

  // 4. Cabeça 15x15 em 3/4 com saccades oculares, expressão pensativa e Lip-Sync
  drawHeadAndFace(work, pal, yOff, torsoShiftX + headDx, isFront, talking, f16, blinking, action);

  // 5. Cabelo esculpido com volume 3D, secondary lag e acessório
  drawHairAndAccessory(work, pal, look, yOff + hairLag, torsoShiftX + headDx, isFront);

  // 6. Braço frontal articulado (com micro-gesto de mão no queixo, gole de café ou gesticulação de fala)
  drawFrontArm(work, pal, action, f16, yOff, torsoShiftX, talking);

  // 7. Espelhamento horizontal para SW e NW
  const out = shouldFlip ? work.flipped() : work;

  // 8. Contorno seletivo escuro de 1px + sombra elíptica 2:1 nos pés
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
  blinking = false,
): HabboAvatarFrame {
  const f16 = ((Math.floor(frame) % 16) + 16) % 16;
  const talkState = talking ? f16 % 4 : -1;
  const blinkBit = blinking ? 1 : 0;
  const key = `${lookKey(look)}|${dir}|${action}|${f16}|${talkState}|${blinkBit}`;

  let cached = spriteCache.get(key);
  if (!cached) {
    if (spriteCache.size > 8000) spriteCache.clear();
    const buf = renderHabboAvatarBuf(look, dir, action, f16, talking, blinking);
    cached = {
      canvas: bufToCanvas(buf),
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
    };
    spriteCache.set(key, cached);
  }
  return cached;
}

export function getHabboAvatarPortrait(
  look: HabboAvatarLook,
  frame = 0,
  talking = false,
  blinking = false,
): HTMLCanvasElement {
  const f4 = talking ? ((Math.floor(frame) % 4) + 4) % 4 : 0;
  const blinkBit = blinking ? 1 : 0;
  const key = `${lookKey(look)}|${talking ? f4 : 'idle'}|${blinkBit}`;
  let cached = portraitCache.get(key);
  if (!cached) {
    if (portraitCache.size > 1024) portraitCache.clear();
    const pal = buildPalettes(look);
    const work = new PixelBuf(SPRITE_W, SPRITE_H);
    drawBackArm(work, pal, 'idle', 0, 2, 0);
    drawTorso(work, pal, look, 2, 0, true, 0);
    drawHeadAndFace(work, pal, 2, 0, true, talking, f4, blinking, 'idle');
    drawHairAndAccessory(work, pal, look, 2, 0, true);
    drawFrontArm(work, pal, 'idle', 0, 2, 0, talking);
    work.outline();

    const bust = work.crop(4, 2, PORTRAIT_SIZE, PORTRAIT_SIZE);
    cached = bufToCanvas(bust);
    portraitCache.set(key, cached);
  }
  return cached;
}
