// Motor de Avatares Isométricos em Pixel Art (Proporção Clássica Habbo Hotel 2006 / Chibi Isométrico 3-Cabeças)
// Resolução nativa 1x: 32x52 px com âncora nos pés (16, 47).
// Rodada 2 de Polimento Crítico: Anatomia 3/4 Isométrica Real (rosto virado na diagonal 2:1 com orelha de um só lado,
// olhos deslocados +2px para a face frontal, cabelos orgânicos com volume 3D e franja em 3/4, tronco em 3/4 com
// jaqueta aberta / colete & gravata / moletom tech, tênis bicolor com sola #e2e8f0 e postura sentada natural em L).

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

// Cabeça arredondada isométrica 3/4 olhando para SE (diagonal inferior-direita):
// - Orelha visível APENAS no lado esquerdo (colunas 0..1, x = 9..10 no canvas).
// - Têmpora e maxilar esquerdos sombreados, face central/direita iluminada e bochecha direita (col 13, x = 22)
//   curvada e saliente como no Habbo Hotel clássico!
// Legenda:
// L = pele iluminada (testa/maçã do rosto), s = pele base, S = sombra lateral/mandíbula,
// D = sombra profunda (sob a franja e sob o queixo), r = concha da orelha, b = rubor das bochechas
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

// Cabeça em 3/4 de costas olhando para NE (diagonal superior-direita):
// - Nuca arredondada à esquerda/centro, orelha lateral e perfil direito do maxilar visível à direita.
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

// 4 Estilos de Cabelo Esculpidos com Volume 3D, Silhueta Orgânica Arredondada e Franja Diagonal 3/4
// Grade de 16 colunas (aplicada em hx = 8, cobrindo x = 8..23):
// o = base, h = meio-tom claro, H = cluster de brilho especular no topo-esquerdo, d = sombra, D = sombra profunda

// Estilo 0: Habbo Classic Layered Swoop (franja diagonal caindo em 3/4 sobre a testa + costeleta antes da orelha)
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

// Estilo 1: Spiky Anime / Tech Dev (mechas recortadas orgânicas em 3D com topete projetado para SE)
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

// Estilo 2: Side-Part / Artista Volumoso com repartição profunda (D) e mecha longa emoldurando o rosto 3/4
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

// Estilo 3: Pompadour / Cacheado Esculpido (volume alto arredondado com textura de luz/sombra)
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
// SAPATOS BICOLOR & PERNAS EM 3/4 (CAMINHADA ISOMÉTRICA E POSTURA SENTADA EM "L")
// ============================================================================

function drawSneaker(
  buf: PixelBuf,
  x: number,
  y: number,
  shoes: Ramp,
  accentColor: string,
  isFrontFoot: boolean,
): void {
  // Tênis / Sapato isométrico arredondado com bico projetado para a direita (SE),
  // detalhe colorido no cabedal, brilho especular na ponta e sola clara de 1px (#e2e8f0)
  const w = isFrontFoot ? 6 : 5;
  const upperCol = isFrontFoot ? shoes.base : shoes.dk;
  const tongueCol = isFrontFoot ? shoes.lt : shoes.base;

  // Cano / língua do tênis
  buf.hline(x + 1, x + w - 2, y, tongueCol);
  buf.set(x + 2, y, accentColor); // detalhe da cor da camisa na lingueta
  // Corpo arredondado do calçado
  buf.rect(x, y + 1, w, 1, upperCol);
  buf.set(x + w - 2, y + 1, '#ffffff'); // biqueira / brilho de 1px na ponta
  // Sola bicolor clara de 1px (#e2e8f0 / #cbd5e1) — assinatura clássica de leitura nítida no piso!
  buf.hline(x, x + w - 1, y + 2, isFrontFoot ? '#e2e8f0' : '#cbd5e1');
  buf.set(x, y + 2, '#94a3b8'); // calcanhar sombreado
}

function drawLegsAndShoes(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  action: HabboAction,
  f4: number,
  isFront: boolean,
): void {
  const { pants, shoes, shirt } = pal;

  // Postura Sentada ('sit' e 'type') Natural em "L" na diagonal isométrica 2:1:
  // O quadril fica recuado no assento (x = 11..19, y = 36..39), as coxas avançam na diagonal SE (x + 3, y + 2),
  // os joelhos dobram em x = 16..22 e as canelas descem até os tênis apoiados à frente (x = 16..24, y = 44..46)!
  if (action === 'sit' || action === 'type') {
    // Cinto com fivela na cintura sentada (y = 35)
    buf.hline(11, 20, 35, '#0f172a');
    if (isFront) {
      buf.rect(17, 35, 2, 1, look.accessory === 'crown' ? '#fbbf24' : '#e2e8f0');
    }

    // Quadril apoiado na poltrona/sofá
    buf.rect(11, 36, 9, 3, pants.dk);
    buf.hline(11, 14, 38, pants.dd);

    // Perna traseira (esquerda na tela) dobrada na diagonal SE
    buf.rect(13, 38, 4, 3, pants.dk); // coxa avançando
    buf.rect(15, 40, 4, 4, pants.dd); // joelho e canela descendo
    drawSneaker(buf, 15, 43, shoes, shirt.base, false);

    // Perna dianteira (direita na tela) iluminada na coxa e joelho dobrado à frente
    buf.rect(16, 37, 5, 3, pants.base); // coxa frontal
    buf.hline(17, 20, 37, pants.lt); // luz superior na coxa sentada
    buf.vline(16, 38, 43, pants.dd); // vinco escuro separando as duas pernas
    buf.rect(18, 39, 4, 5, pants.base); // joelho e canela frontal
    buf.vline(20, 39, 43, pants.lt); // brilho vertical na canela
    drawSneaker(buf, 19, 44, shoes, shirt.lt, true);
    return;
  }

  // Em pé ou caminhando:
  // No ciclo 'walk' (4 frames), alterna avanço diagonal e elevação dos joelhos/pés
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
      frontDx = 1;
      frontDy = -1;
    } else if (f4 === 2) {
      backDx = 2;
      backDy = 0;
      frontDx = -2;
      frontDy = -1;
    } else {
      backDx = -1;
      backDy = -1;
      frontDx = 0;
      frontDy = 0;
    }
  }

  // Cinto escuro com fivela dourada/prateada deslocada +1px para a direita (perspectiva 3/4 SE)
  buf.hline(11, 20, 33, '#0f172a');
  if (isFront) {
    const buckleCol = look.accessory === 'crown' ? '#fbbf24' : '#e2e8f0';
    buf.rect(17, 33, 2, 1, buckleCol);
  }
  // Quadril isométrico (y = 34..35)
  buf.rect(11, 34, 10, 2, pants.base);
  buf.rect(11, 34, 4, 2, pants.dk);
  buf.set(15, 35, pants.dd);

  // Perna traseira (esquerda em SE, sombreada)
  const bx = 11 + backDx;
  const by = 36 + backDy;
  buf.rect(bx, by, 4, 8, pants.dk);
  buf.vline(bx, by, by + 7, pants.dd);
  buf.vline(bx + 2, by, by + 7, pants.base);
  drawSneaker(buf, bx, by + 8, shoes, shirt.base, false);

  // Perna dianteira (direita em SE, avança 1px mais abaixo na projeção isométrica e recebe luz na coxa)
  const fx = 16 + frontDx;
  const fy = 36 + frontDy;
  buf.rect(fx, fy, 4, 8, pants.base);
  buf.vline(fx, fy, fy + 7, pants.dd); // vinco profundo entre as pernas
  buf.vline(fx + 1, fy, fy + 7, pants.lt); // luz na face frontal da coxa
  buf.vline(fx + 2, fy, fy + 6, pants.hi); // vinco iluminado
  buf.vline(fx + 3, fy, fy + 7, pants.dk); // curvatura lateral externa
  drawSneaker(buf, fx, fy + 8, shoes, shirt.lt, true);
}

// ============================================================================
// TRONCO EM 3/4 COM ROUPAS DETALHADAS (JAQUETA ABERTA / COLETE & GRAVATA / MOLETOM TECH)
// ============================================================================

function drawTorso(
  buf: PixelBuf,
  pal: AvatarPalettes,
  look: HabboAvatarLook,
  yOff: number,
  isFront: boolean,
): void {
  const { shirt, skin } = pal;
  const ty = 21 + yOff; // Tronco ocupa y = 21..32 em pé (ou 25..36 sentado)
  const outfit = resolveOutfitStyle(look);

  // Silhueta isométrica 3/4 arredondada:
  // O lado esquerdo (x = 10..13) é a lateral traseira sombreada; o centro-direito (x = 14..21) é o peito frontal virado para SE!
  buf.hline(11, 20, ty, shirt.lt);
  for (let r = 1; r <= 10; r++) {
    const y = ty + r;
    buf.set(10, y, shirt.dd);
    buf.hline(11, 13, y, shirt.dk);
    buf.hline(14, 17, y, shirt.base);
    buf.hline(18, 20, y, shirt.lt);
    buf.set(21, y, shirt.dk);
  }
  // Barra inferior da jaqueta/camisa (ty + 11)
  buf.hline(11, 14, ty + 11, shirt.dd);
  buf.hline(15, 20, ty + 11, shirt.dk);

  // Pescoço cilíndrico sombreado conectando cabeça ao colarinho (x = 14..17)
  buf.rect(14, ty - 1, 4, 2, skin.dk);
  buf.set(16, ty - 1, skin.base);
  buf.set(17, ty - 1, skin.lt);

  if (isFront) {
    // Eixo central do peito em 3/4 SE fica deslocado para x = 17!
    if (outfit === 'vest_tie') {
      // Camisa branca social por baixo + Colete/Blazer executivo com lapela e gravata imperial
      buf.set(14, ty, '#cbd5e1');
      buf.set(15, ty + 1, '#e2e8f0');
      buf.set(16, ty + 2, '#ffffff');
      buf.set(19, ty, '#ffffff');
      buf.set(18, ty + 1, '#ffffff');
      buf.set(17, ty + 2, '#f1f5f9');

      // Lapelas sombreadas do blazer em V ao redor de x = 17
      buf.vline(15, ty + 2, ty + 8, shirt.dd);
      buf.vline(19, ty + 2, ty + 8, shirt.hi);

      // Gravata vermelha/dourada no eixo 3/4 (x = 17)
      const tieCol = look.accessory === 'crown' ? '#dc2626' : '#f59e0b';
      const tieHi = look.accessory === 'crown' ? '#fbbf24' : '#fef08a';
      buf.set(17, ty + 2, tieHi); // nó da gravata
      buf.vline(17, ty + 3, ty + 9, tieCol);
      buf.set(17, ty + 9, tieHi);

      // Lenço de bolso / crachá VIP no lado direito do peito (x = 19..20)
      buf.set(19, ty + 4, '#ffffff');
      buf.set(20, ty + 4, '#38bdf8');
    } else if (outfit === 'hoodie') {
      // Moletom Tech / Cyber Jacket com zíper deslocado em 3/4 (x = 17), gola estruturada e cordões claros
      buf.hline(13, 19, ty, shirt.dd);
      buf.hline(14, 18, ty + 1, '#1e293b');
      // Trilho do zíper frontal em x = 17
      buf.vline(17, ty + 2, ty + 11, '#0f172a');
      buf.vline(16, ty + 2, ty + 10, shirt.hi);
      // Cordões brancos/ciano do capuz descendo no peito
      buf.vline(15, ty + 2, ty + 5, '#e2e8f0');
      buf.vline(18, ty + 2, ty + 5, '#38bdf8');
      // Bolso canguru sombreado na parte inferior
      buf.hline(14, 19, ty + 8, shirt.dk);
      buf.vline(14, ty + 8, ty + 10, shirt.dd);
      buf.vline(19, ty + 8, ty + 10, shirt.dd);
    } else {
      // Jaqueta Aberta moderna sobre camiseta clara interna (eixo 3/4 em x = 16..18)
      buf.rect(16, ty + 1, 3, 10, '#f8fafc');
      buf.vline(16, ty + 1, ty + 10, '#cbd5e1'); // sombra interna da jaqueta sobre a camiseta
      // Estampa gráfica minimalista na camiseta interna
      buf.hline(16, 18, ty + 4, shirt.dk);
      buf.set(17, ty + 5, '#38bdf8');
      // Bordas abertas da jaqueta com brilho na lapela
      buf.vline(15, ty + 1, ty + 11, shirt.lt);
      buf.vline(19, ty + 1, ty + 11, shirt.hi);
      // Colarinho dobrado
      buf.set(14, ty, shirt.hi);
      buf.set(19, ty, shirt.hi);
    }
  } else {
    // Vista 3/4 de costas (NE): capuz/gola estruturada nas costas e costura dorsal deslocada para x = 14
    buf.hline(12, 19, ty, shirt.hi);
    buf.hline(11, 20, ty + 1, shirt.lt);
    buf.hline(12, 18, ty + 2, shirt.dk);
    buf.vline(14, ty + 2, ty + 10, shirt.dd); // costura da coluna em 3/4 traseiro
    buf.vline(15, ty + 2, ty + 10, shirt.base);
  }
}

// ============================================================================
// BRAÇOS ARTICULADOS EM 3/4, MÃOS 3x3 PX E CANECA DE CAFÉ FUMEGANTE
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
  // Ombro traseiro (esquerdo na tela quando em SE) fica 1px mais alto/recuado na perspectiva 3/4
  const sy = 21 + yOff;

  if (action === 'wave') {
    // Braço levantado acima do ombro oscilando com frame % 2
    const waveShift = f4 % 2 === 0 ? 0 : -1;
    buf.rect(7, sy - 4 + waveShift, 3, 6, shirt.base);
    buf.vline(7, sy - 4 + waveShift, sy + 1 + waveShift, shirt.lt);
    buf.rect(6 + waveShift, sy - 8 + waveShift, 3, 5, shirt.lt);
    drawHand3x3(buf, 5 + waveShift, sy - 11 + waveShift, skin);
    return;
  }

  if (action === 'type') {
    // Antebraço traseiro projetado para o teclado na diagonal SE, alternando 1px verticalmente
    const dy = f4 % 2 === 0 ? 0 : 1;
    buf.rect(8, sy, 3, 6, shirt.dk);
    buf.rect(10, sy + 5 + dy, 4, 3, shirt.base);
    drawHand3x3(buf, 13, sy + 6 + dy, skin);
    return;
  }

  if (action === 'sit') {
    // Sentado: antebraço apoiado no braço da poltrona/coxa
    buf.rect(8, sy, 3, 6, shirt.dk);
    buf.rect(9, sy + 5, 3, 3, shirt.base);
    drawHand3x3(buf, 10, sy + 7, skin);
    return;
  }

  if (action === 'walk') {
    const swing = f4 === 0 ? 2 : f4 === 2 ? -2 : 0;
    buf.rect(8, sy, 3, 4, shirt.dk);
    buf.rect(8 + Math.round(swing * 0.5), sy + 4, 3, 4, shirt.base);
    drawHand3x3(buf, 8 + swing, sy + 8, skin);
    return;
  }

  // Idle / Coffee: braço traseiro em 3/4 parcialmente ocluído pelo tronco
  buf.rect(8, sy, 3, 7, shirt.dk);
  buf.vline(8, sy, sy + 6, shirt.dd);
  buf.vline(10, sy, sy + 6, shirt.base);
  drawHand3x3(buf, 8, sy + 7, skin);
}

function drawCoffeeMug(buf: PixelBuf, x: number, y: number, f4: number): void {
  // Caneca branca/vermelha detalhada (5x5 px) com café escuro e vapor subindo
  buf.rect(x, y, 5, 5, '#ffffff');
  buf.hline(x, x + 4, y + 2, '#ef4444');
  buf.hline(x, x + 4, y + 3, '#dc2626');
  buf.vline(x + 4, y, y + 4, '#cbd5e1');
  buf.hline(x + 1, x + 3, y, '#3e2723');
  // Alça lateral
  buf.set(x + 5, y + 1, '#e2e8f0');
  buf.set(x + 5, y + 2, '#cbd5e1');
  buf.set(x + 5, y + 3, '#94a3b8');

  // Vapor animado
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
  // Ombro frontal (direito na tela em SE) articulado com luz direta
  const sy = 22 + yOff;

  if (action === 'coffee') {
    const sip = f4 % 2 === 1 ? -1 : 0;
    buf.rect(20, sy, 3, 5, shirt.base);
    buf.vline(20, sy, sy + 4, shirt.lt);
    buf.rect(19, sy + 3 + sip, 4, 3, shirt.lt);
    drawHand3x3(buf, 21, sy + 3 + sip, skin);
    drawCoffeeMug(buf, 23, sy + 1 + sip, f4);
    return;
  }

  if (action === 'type') {
    // Antebraço direito projetado para frente alternando em oposição ao esquerdo
    const dy = f4 % 2 === 1 ? 0 : 1;
    buf.rect(20, sy, 3, 5, shirt.base);
    buf.vline(20, sy, sy + 4, shirt.lt);
    buf.rect(19, sy + 4 + dy, 4, 3, shirt.lt);
    drawHand3x3(buf, 21, sy + 5 + dy, skin);
    return;
  }

  if (action === 'sit') {
    // Sentado: braço direito dobrado apoiando a mão sobre a coxa
    buf.rect(20, sy, 3, 5, shirt.base);
    buf.vline(20, sy, sy + 4, shirt.lt);
    buf.rect(19, sy + 4, 3, 3, shirt.lt);
    drawHand3x3(buf, 19, sy + 6, skin);
    return;
  }

  if (action === 'walk') {
    const swing = f4 === 0 ? -2 : f4 === 2 ? 2 : 0;
    buf.rect(20, sy, 3, 4, shirt.base);
    buf.vline(20, sy, sy + 3, shirt.lt);
    buf.rect(20 + Math.round(swing * 0.5), sy + 4, 3, 4, shirt.lt);
    drawHand3x3(buf, 20 + swing, sy + 8, skin);
    return;
  }

  // Idle / Wave: braço frontal articulado com punho levemente adiantado em 3/4
  buf.rect(20, sy, 3, 7, shirt.base);
  buf.vline(20, sy, sy + 6, shirt.lt);
  buf.vline(22, sy, sy + 6, shirt.dk);
  drawHand3x3(buf, 20, sy + 7, skin);
}

// ============================================================================
// CABEÇA E ROSTO EM PERSPECTIVA 3/4 REAL (OLHOS E BOCA DESLOCADOS +2PX PARA SE)
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
  const hy = 6 + yOff; // Cabeça ocupa x = 9..23, y = 6..20 (15x15 px)

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
    // Perspectiva 3/4 Real do Habbo Hotel:
    // A orelha está em x = 9..10 (hx + 0..1) e a bochecha direita vai até x = 22 (hx + 13).
    // Os dois olhos ficam deslocados +2px para a direita do centro da cabeça:
    // - Olho esquerdo (próximo ao centro): x = 15..16 (hx + 6..7), y = hy + 6..7 (2x2 px)
    // - Espaço de 2px entre os olhos: x = 17..18 (hx + 8..9), onde fica a ponte nasal e o pixel do nariz!
    // - Olho direito (próximo à borda direita da face): x = 19..20 (hx + 10..11), y = hy + 6..7 (2x2 px)

    // Sobrancelhas expressivas acompanhando o eixo 3/4
    const browCol = hair.dd;
    buf.hline(15, 17, hy + 5, browCol);
    buf.hline(19, 21, hy + 5, browCol);

    // Olho esquerdo (2x2 px com pupila #0f172a e brilho especular branco 1px no canto superior-esquerdo)
    buf.rect(15, hy + 6, 2, 2, '#0f172a');
    buf.set(15, hy + 6, '#ffffff');

    // Olho direito (2x2 px com pupila #0f172a e brilho especular branco 1px)
    buf.rect(19, hy + 6, 2, 2, '#0f172a');
    buf.set(19, hy + 6, '#ffffff');

    // Nariz sombreado de 1px posicionado entre/abaixo dos olhos no eixo 3/4 (x = 18, y = hy + 8)
    buf.set(18, hy + 8, skin.dk);
    buf.set(18, hy + 7, skin.lt); // brilho na ponta do nariz

    // Boca alinhada com o eixo 3/4 dos olhos (centrada em x = 17..19)
    if (talking && f4 % 2 === 0) {
      // Boca aberta expressiva cantando/falando (#9f1239 com dente #ffffff e língua #fb7185)
      buf.rect(16, hy + 10, 4, 3, '#9f1239');
      buf.hline(17, 18, hy + 10, '#ffffff');
      buf.hline(17, 18, hy + 12, '#fb7185');
    } else {
      // Sorriso discreto em 3/4 com canto esquerdo levemente erguido
      buf.hline(16, 19, hy + 11, shade(skin.dd, -0.2));
      buf.set(15, hy + 10, skin.dk);
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
  isFront: boolean,
): void {
  const { hair } = pal;
  const hx = 8;
  const hy = 4 + yOff;
  const styleIdx = resolveHairStyle(look);

  const hairPal: Palette = {
    o: hair.base,
    h: hair.lt,
    H: hair.hi,
    d: hair.dk,
    D: hair.dd,
  };

  // Estampa o cabelo esculpido com mechas recortadas e brilho especular no topo-esquerdo
  const tpl = isFront ? HAIR_STYLES_SE[styleIdx] : HAIR_STYLES_NE[styleIdx];
  buf.stamp(tpl, hx, hy, hairPal);

  // Acessórios exclusivos ajustados para o eixo 3/4 real (olhos em x = 15..16 e 19..20)
  const acc = look.accessory;
  const ay = 6 + yOff;

  switch (acc) {
    case 'crown': {
      // Coroa imperial dourada com 3 pontas e joias vermelha/azul brilhantes
      const gold = ramp('#f59e0b', 0.1);
      buf.hline(11, 21, ay - 1, gold.dk);
      buf.hline(10, 22, ay - 2, gold.base);
      buf.hline(10, 22, ay - 3, gold.lt);
      // 3 Pontas imperiais em perspectiva 3/4
      buf.rect(10, ay - 5, 2, 2, gold.lt);
      buf.set(11, ay - 6, gold.hi);
      buf.rect(16, ay - 6, 2, 3, gold.hi);
      buf.set(17, ay - 7, '#ffffff');
      buf.rect(21, ay - 5, 2, 2, gold.base);
      buf.set(21, ay - 6, gold.lt);
      // Joias incrustadas alinhadas ao eixo 3/4
      buf.set(12, ay - 2, '#ef4444');
      buf.set(16, ay - 2, '#38bdf8');
      buf.set(17, ay - 2, '#e0f2fe');
      buf.set(20, ay - 2, '#ef4444');
      break;
    }

    case 'glasses': {
      if (isFront) {
        // Óculos de aro estilizado perfeitamente alinhado aos olhos em 3/4 (x = 14..17 e 18..21)
        const frameCol = '#1e293b';
        // Haste indo até a orelha esquerda (x = 10..13)
        buf.hline(10, 13, ay + 6, frameCol);
        // Aro esquerdo (ao redor do olho x = 15..16)
        buf.hline(14, 17, ay + 5, frameCol);
        buf.hline(14, 17, ay + 8, frameCol);
        buf.vline(14, ay + 5, ay + 8, frameCol);
        buf.vline(17, ay + 5, ay + 8, frameCol);
        // Ponte nasal em x = 17..18
        buf.set(18, ay + 6, frameCol);
        // Aro direito (ao redor do olho x = 19..20)
        buf.hline(18, 21, ay + 5, frameCol);
        buf.hline(18, 21, ay + 8, frameCol);
        buf.vline(18, ay + 5, ay + 8, frameCol);
        buf.vline(21, ay + 5, ay + 8, frameCol);
        // Lentes azuladas semi-reflexivas
        buf.set(15, ay + 6, '#7dd3fc');
        buf.set(16, ay + 7, 'rgba(56, 189, 248, 0.55)');
        buf.set(19, ay + 6, '#7dd3fc');
        buf.set(20, ay + 7, 'rgba(56, 189, 248, 0.55)');
      } else {
        buf.hline(19, 22, ay + 6, '#1e293b');
      }
      break;
    }

    case 'headset': {
      // Arco sobre a cabeça + fones acolchoados com LED neon e microfone boom vindo da esquerda até a boca 3/4
      buf.hline(11, 21, ay - 1, '#334155');
      buf.hline(12, 20, ay - 2, '#64748b');
      // Concha acústica principal sobre a orelha esquerda (x = 8..10)
      buf.rect(8, ay + 4, 3, 5, '#1e293b');
      buf.vline(9, ay + 5, ay + 7, '#22c55e');
      // Borda da concha direita em escorço (x = 22..23)
      buf.rect(22, ay + 4, 2, 5, '#0f172a');
      buf.set(23, ay + 6, '#22c55e');
      if (isFront) {
        // Microfone boom articulado indo até perto da boca 3/4 (x = 15)
        buf.line(10, ay + 8, 14, ay + 11, '#475569');
        buf.rect(14, ay + 11, 2, 2, '#0f172a');
        buf.set(15, ay + 11, '#22c55e');
      }
      break;
    }

    case 'beret': {
      // Boina francesa inclinada de artista com volume arredondado e brilho especular no topo-esquerdo
      const beret = ramp(look.shirtColor || '#ec4899', 0.1);
      buf.hline(11, 19, ay - 3, beret.lt);
      buf.hline(9, 21, ay - 2, beret.base);
      buf.hline(8, 22, ay - 1, beret.base);
      buf.hline(9, 22, ay, beret.dk);
      buf.hline(10, 21, ay + 1, '#1e293b');
      buf.hline(12, 16, ay - 2, beret.hi);
      buf.set(14, ay - 4, beret.dd);
      break;
    }

    case 'cap': {
      // Boné urbano com copa arredondada e aba projetada na direção 3/4 do olhar (SE)
      const cap = ramp(look.shirtColor || '#06b6d4', 0.09);
      buf.hline(12, 20, ay - 2, cap.lt);
      buf.hline(10, 21, ay - 1, cap.base);
      buf.hline(10, 22, ay, cap.base);
      buf.hline(10, 22, ay + 1, cap.dk);
      buf.set(15, ay - 3, '#ffffff');
      buf.hline(12, 16, ay - 1, cap.hi);
      if (isFront) {
        // Aba projetada para a direita/frente (x = 14..25)
        buf.hline(14, 24, ay + 2, cap.dk);
        buf.hline(16, 25, ay + 3, cap.dd);
      } else {
        buf.hline(18, 24, ay + 2, cap.dd);
        buf.rect(13, ay + 1, 4, 1, '#1e293b');
      }
      break;
    }

    case 'visor': {
      // Visor tático futurista vermelho/ciano translúcido cobrindo os olhos em 3/4 (x = 13..22)
      buf.hline(9, 22, ay + 4, '#334155');
      if (isFront) {
        buf.rect(13, ay + 5, 10, 3, '#e11d48');
        buf.hline(14, 22, ay + 5, '#38bdf8');
        buf.hline(15, 20, ay + 6, '#ffffff');
        buf.hline(14, 22, ay + 7, '#9f1239');
      } else {
        buf.hline(9, 22, ay + 5, '#1e293b');
        buf.set(21, ay + 5, '#ef4444');
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

  // Em 'sit' e 'type', o tronco e a cabeça descem 3px enquanto os joelhos dobram em L para a frente;
  // em 'walk', há um quique vivo de 1px nos frames ímpares.
  const seatDrop = action === 'sit' || action === 'type' ? 3 : 0;
  const walkBounce = action === 'walk' && (f4 === 1 || f4 === 3) ? -1 : 0;
  const yOff = seatDrop + walkBounce;

  const work = new PixelBuf(SPRITE_W, SPRITE_H);

  // 1. Braço traseiro (atrás do tronco na perspectiva 3/4)
  drawBackArm(work, pal, action, f4, yOff);

  // 2. Pernas em 3/4 e tênis bicolor com sola clara #e2e8f0
  drawLegsAndShoes(work, pal, look, action, f4, isFront);

  // 3. Tronco em 3/4 com jaqueta aberta / colete & gravata / moletom tech
  drawTorso(work, pal, look, yOff, isFront);

  // 4. Cabeça 15x15 arredondada em 3/4 real com orelha unilateral e olhos deslocados +2px
  drawHeadAndFace(work, pal, yOff, isFront, talking, f4);

  // 5. Cabelo esculpido com volume 3D, franja diagonal e acessório exclusivo
  drawHairAndAccessory(work, pal, look, yOff, isFront);

  // 6. Braço frontal (sobreposto ao tronco, segurando café ou digitando)
  drawFrontArm(work, pal, action, f4, yOff);

  // 7. Se a direção for SW ou NW, espelha horizontalmente mantendo a perspectiva 3/4 consistente
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
    const pal = buildPalettes(look);
    const work = new PixelBuf(SPRITE_W, SPRITE_H);
    drawBackArm(work, pal, 'idle', 0, 2);
    drawTorso(work, pal, look, 2, true);
    drawHeadAndFace(work, pal, 2, true, false, 0);
    drawHairAndAccessory(work, pal, look, 2, true);
    drawFrontArm(work, pal, 'idle', 0, 2);
    work.outline();

    // Recorta 24x24 centrado no busto 3/4 (cabeça + ombros + acessório)
    const bust = work.crop(4, 2, PORTRAIT_SIZE, PORTRAIT_SIZE);
    cached = bufToCanvas(bust);
    portraitCache.set(key, cached);
  }
  return cached;
}
