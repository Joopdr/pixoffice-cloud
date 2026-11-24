// Sprites de Superfícies Isométricas 2:1 (Pisos, Escadinha, Paredes Cutaway 100% Contínuas, Pilar de Quina, Mureta VIP e Cursor)
// Desenhados em resolução nativa 1x via PixelBuf (RGBA puro) para ampliação nearest-neighbor 2x (64x32 px)
// seguindo a estética clássica do Habbo Hotel (2005–2009) e eBoy.

import { mix, ramp, shade } from '../art/core/color';
import { PixelBuf } from '../art/core/pixbuf';

export type IsoFloorTileKind = 'oak' | 'vip' | 'cafe_light' | 'cafe_dark' | 'mat';
export type IsoWallSide = 'back' | 'left';
export type IsoWallDecor = 'plain' | 'window' | 'poster_trophy' | 'poster_arcade' | 'door' | 'clock';

// Cache de canvases gerados para performance 60fps
const surfaceCache = new Map<string, HTMLCanvasElement>();

function getCachedCanvas(key: string, build: () => PixelBuf): HTMLCanvasElement {
  let c = surfaceCache.get(key);
  if (!c) {
    if (surfaceCache.size > 1024) surfaceCache.clear();
    const buf = build();
    c = document.createElement('canvas');
    c.width = buf.w;
    c.height = buf.h;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.putImageData(new ImageData(buf.data, buf.w, buf.h), 0, 0);
    }
    surfaceCache.set(key, c);
  }
  return c;
}

// Matriz de Dithering Bayer 2x2 normalizada (0..3)
const BAYER2 = [
  [0, 2],
  [3, 1],
] as const;

/**
 * 1. Ladrilho de Piso Isométrico 2:1 em resolução nativa 1x (`34x26` px).
 * - Losango superior `32x16` px centrado em `cx = 17`, `y = 1..16`.
 * - Aresta estritamente 2:1: para `dy` de `0` a `15`, a meia-largura `hw = dy < 8 ? (dy + 1) * 2 : (16 - dy) * 2`.
 * - Laje lateral de `7px` de altura abaixo das faces frontal-esquerda e frontal-direita, com contorno seletivo 1px.
 */
export function getIsoFloorTileCanvas(kind: IsoFloorTileKind, variant: number): HTMLCanvasElement {
  const v = ((variant | 0) % 4 + 4) % 4;
  const key = `floor|${kind}|${v}`;
  return getCachedCanvas(key, () => {
    const buf = new PixelBuf(34, 26);
    const cx = 17;
    const topY = 1;
    const slabH = 7;

    // Paletas de rampa baseadas no material
    const oakRamp = ramp(v % 2 === 0 ? '#d89b56' : '#ce914c', 0.07);
    const cafeLightRamp = ramp('#e2e8f0', 0.06);
    const cafeDarkRamp = ramp('#334155', 0.07);
    const matRamp = ramp('#1d4ed8', 0.08);

    // 1. Desenha primeiro a laje lateral inferior (7px de altura) acompanhando a borda inferior do losango (dy = 8..15)
    for (let dy = 8; dy < 16; dy++) {
      const hw = (16 - dy) * 2;
      const xLeft = cx - hw;
      const xRight = cx + hw - 1;
      const ySurf = topY + dy;

      // Dois pixels por degrau 2:1 na borda inferior esquerda e direita
      for (let step = 0; step < 2; step++) {
        const lx = xLeft + step;
        const rx = xRight - step;

        for (let sy = 1; sy <= slabH; sy++) {
          const py = ySurf + sy;

          if (kind === 'oak') {
            // Laje de madeira com face esquerda (#6e4726) e direita (#4e3119)
            const leftCol = sy === 1 ? '#855831' : sy === slabH ? '#36200f' : '#6e4726';
            const rightCol = sy === 1 ? '#5c3b1e' : sy === slabH ? '#28170a' : '#4e3119';
            buf.set(lx, py, leftCol);
            buf.set(rx, py, rightCol);
          } else if (kind === 'vip') {
            // Laje de mogno com friso dourado no meio (sy === 3) e contorno escuro na base
            const leftCol =
              sy === 1 ? '#7c2d12' : sy === 3 ? '#fbbf24' : sy === 4 ? '#b45309' : sy === slabH ? '#270e05' : '#5c200c';
            const rightCol =
              sy === 1 ? '#5c200c' : sy === 3 ? '#d97706' : sy === 4 ? '#78350f' : sy === slabH ? '#1c0903' : '#431407';
            buf.set(lx, py, leftCol);
            buf.set(rx, py, rightCol);
          } else if (kind === 'cafe_light' || kind === 'cafe_dark') {
            // Laje de pedra/mármore polido
            const leftCol = sy === 1 ? '#94a3b8' : sy === slabH ? '#1e293b' : '#64748b';
            const rightCol = sy === 1 ? '#64748b' : sy === slabH ? '#0f172a' : '#475569';
            buf.set(lx, py, leftCol);
            buf.set(rx, py, rightCol);
          } else {
            // Tapete ('mat'): base de borracha azul-marinho/dourada
            const leftCol = sy === 1 ? '#fbbf24' : sy === slabH ? '#0f172a' : '#1e3a8a';
            const rightCol = sy === 1 ? '#d97706' : sy === slabH ? '#090d16' : '#172554';
            buf.set(lx, py, leftCol);
            buf.set(rx, py, rightCol);
          }
        }
      }
    }

    // Quina vertical central da laje (x = cx - 1 e cx) para destacar o volume convexo 3D
    for (let sy = 1; sy <= slabH; sy++) {
      const py = topY + 15 + sy;
      if (kind === 'oak') {
        buf.set(cx - 1, py, sy === slabH ? '#36200f' : '#7c522d');
        buf.set(cx, py, sy === slabH ? '#28170a' : '#422914');
      } else if (kind === 'vip') {
        buf.set(cx - 1, py, sy === 3 ? '#fde68a' : sy === slabH ? '#270e05' : '#6d260f');
        buf.set(cx, py, sy === 3 ? '#b45309' : sy === slabH ? '#1c0903' : '#3b1106');
      } else {
        buf.set(cx - 1, py, sy === slabH ? '#1e293b' : '#78889e');
        buf.set(cx, py, sy === slabH ? '#0f172a' : '#3b4759');
      }
    }

    // Contorno seletivo 1px escuro nas bordas verticais externas da laje (dy = 8 -> x = 1 e x = 32)
    const slabOutline =
      kind === 'oak' ? '#36200f' : kind === 'vip' ? '#270e05' : '#0f172a';
    for (let sy = 0; sy <= slabH; sy++) {
      buf.set(cx - 16, topY + 7 + sy, slabOutline);
      buf.set(cx + 15, topY + 7 + sy, slabOutline);
    }

    // 2. Desenha a face superior isométrica (losango 32x16 estrito 2:1)
    for (let dy = 0; dy < 16; dy++) {
      const hw = dy < 8 ? (dy + 1) * 2 : (16 - dy) * 2;
      const x0 = cx - hw;
      const x1 = cx + hw - 1;
      const py = topY + dy;

      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        // Coordenadas isométricas locais (u, v) ao longo das arestas 2:1
        const isoU = Math.floor((dx + dy * 2) / 2);
        const isoV = Math.floor((dy * 2 - dx) / 2);

        // Distância em degraus até a borda do losango (0 = borda externa, 1 = borda interna, etc.)
        const distFromEdge = Math.min(Math.floor((x - x0) / 2), Math.floor((x1 - x) / 2));
        const isTopLeftEdge = dy < 8 && (x - x0 < 2);
        const isTopRightEdge = dy < 8 && (x1 - x < 2);
        const isBottomLeftEdge = dy >= 8 && (x - x0 < 2);
        const isBottomRightEdge = dy >= 8 && (x1 - x < 2);

        if (kind === 'oak') {
          // Parquet de carvalho mel com tábuas isométricas alternadas
          const plankIdx = Math.floor((isoV + (v % 2) * 2) / 4);
          let col = plankIdx % 2 === 0 ? oakRamp.base : shade(oakRamp.base, -0.04);

          // Linhas de junção escuras (#7c4d25) entre tábuas
          const isPlankSeam = (isoV + (v % 2) * 2) % 4 === 0 || (isoU + plankIdx * 5 + v * 3) % 11 === 0;
          if (isPlankSeam) {
            col = '#7c4d25';
          } else {
            // Pixels de veio de madeira (#e3ad6b claro, #b87b3d médio)
            const grainHash = ((x * 7 + dy * 13 + v * 5) & 15);
            if (grainHash === 0 || grainHash === 5) col = '#e3ad6b';
            else if (grainHash === 2 || grainHash === 9 || grainHash === 12) col = '#b87b3d';
          }

          // Chanfro superior iluminado (#f3c68f) e bordas de luz/sombra 2:1
          if (isTopLeftEdge) col = '#f3c68f';
          else if (isTopRightEdge) col = '#e3ad6b';
          else if (isBottomLeftEdge) col = '#b87b3d';
          else if (isBottomRightEdge) col = '#7c4d25';

          buf.set(x, py, col);
        } else if (kind === 'vip') {
          // Carpete Imperial Bordô (#9f1239 / #881337) com dithering Bayer 2x2 sutil
          const bayer = BAYER2[dy & 1][x & 1];
          let col = bayer === 0 ? '#9f1239' : bayer === 3 ? shade('#881337', -0.05) : '#881337';

          // Borda interna tecida em fios de ouro (#fbbf24 / #d97706) acompanhando o losango 2:1
          if (distFromEdge === 1) {
            col = (x + dy) % 2 === 0 ? '#fbbf24' : '#d97706';
          } else if (distFromEdge === 2 && (x + dy) % 3 === 0) {
            col = '#78350f';
          } else if (distFromEdge >= 4 && Math.abs(dx) <= 2 && Math.abs(dy - 7.5) <= 1.5) {
            // Pequeno florão imperial no centro do ladrilho VIP
            col = (Math.abs(dx) + dy) % 2 === 0 ? '#fbbf24' : '#b45309';
          }

          // Iluminação de chanfro na borda externa
          if (isTopLeftEdge) col = mix('#9f1239', '#fda4af', 0.28);
          else if (isTopRightEdge) col = '#9f1239';
          else if (isBottomRightEdge) col = '#4c0519';

          buf.set(x, py, col);
        } else if (kind === 'cafe_light' || kind === 'cafe_dark') {
          const isLight = kind === 'cafe_light';
          const rmp = isLight ? cafeLightRamp : cafeDarkRamp;
          let col = rmp.base;

          // Veios diagonais sutis de mármore
          const vein = (x + dy * 2 + v * 3) % 13;
          if (vein === 0) {
            col = isLight ? '#cbd5e1' : '#475569';
          } else if (vein === 1 && (x & 1) === 0) {
            col = isLight ? '#f8fafc' : '#1e293b';
          }

          // Brilho especular de 2px próximo ao topo-esquerdo
          if ((dy === 3 && (x === cx - 3 || x === cx - 2)) || (dy === 4 && (x === cx - 5 || x === cx - 4))) {
            col = isLight ? '#ffffff' : '#94a3b8';
          }

          // Rejunte bisotado
          if (isTopLeftEdge) col = isLight ? '#ffffff' : '#64748b';
          else if (isTopRightEdge) col = isLight ? '#f1f5f9' : '#475569';
          else if (isBottomLeftEdge) col = isLight ? '#cbd5e1' : '#1e293b';
          else if (isBottomRightEdge) col = isLight ? '#94a3b8' : '#0f172a';

          buf.set(x, py, col);
        } else {
          // 'mat': Tapete de boas-vindas azul royal com borda dourada e trama pixelada
          const weave = (x + dy) & 1;
          let col = weave === 0 ? matRamp.base : matRamp.dk;

          if (distFromEdge === 0) {
            col = isTopLeftEdge ? '#fde68a' : isBottomRightEdge ? '#b45309' : '#fbbf24';
          } else if (distFromEdge === 1) {
            col = '#1e3a8a';
          } else if (distFromEdge === 2) {
            col = (x + dy) % 2 === 0 ? '#60a5fa' : '#2563eb';
          } else if (dy >= 6 && dy <= 9 && Math.abs(dx) <= 5 && ((dx + dy) & 1) === 0) {
            // Trama central destacada
            col = '#93c5fd';
          }

          buf.set(x, py, col);
        }
      }
    }

    return buf;
  });
}

/**
 * 2. Escadinha Isométrica 2:1 em resolução nativa 1x (`36x32` px).
 * - 4 degraus de madeira nobre conectando o Mezanino VIP ao Salão Principal.
 * - Friso antiderrapante dourado (`#fde68a` / `#fbbf24`) na quina convexa de cada degrau,
 *   sombra sob cada espelho (`#451a03`) e lateral chanfrada com `buf.outline()`.
 */
export function getIsoStairCanvas(): HTMLCanvasElement {
  return getCachedCanvas('iso-stair-v2', () => {
    const buf = new PixelBuf(36, 32);
    const wood = ramp('#b45309', 0.08);

    // 4 degraus isométricos descendo da direita-topo para a esquerda-baixo
    for (let s = 0; s < 4; s++) {
      const scx = 18;
      const topY = 2 + s * 5;
      const treadD = 6;
      const riserH = 4;

      for (let dy = 0; dy < treadD; dy++) {
        const hw = dy < 3 ? 10 + dy * 2 : 14 - (dy - 3) * 2;
        const x0 = scx - hw;
        const x1 = scx + hw - 1;
        const py = topY + dy;

        for (let x = x0; x <= x1; x++) {
          const isFrontEdge = dy === treadD - 1 || (dy >= 3 && (x - x0 < 2 || x1 - x < 2));
          const isBackEdge = dy === 0;

          let col = (x + dy + s) % 5 === 0 ? wood.lt : s % 2 === 0 ? wood.base : shade(wood.base, -0.04);
          if (isBackEdge && s > 0) {
            col = '#451a03';
          } else if (isFrontEdge) {
            col = (x + dy) % 2 === 0 ? '#fde68a' : '#fbbf24';
          }
          buf.set(x, py, col);
        }

        if (dy >= 3) {
          for (let step = 0; step < 2; step++) {
            const lx = x0 + step;
            const rx = x1 - step;
            for (let ry = 1; ry <= riserH; ry++) {
              const pyRiser = py + ry;
              const leftCol = ry === 1 ? '#451a03' : ry === riserH ? '#270e05' : '#78350f';
              const rightCol = ry === 1 ? '#270e05' : ry === riserH ? '#1c0903' : '#5c200c';
              buf.set(lx, pyRiser, leftCol);
              buf.set(rx, pyRiser, rightCol);
            }
          }
        }
      }

      const frontY = topY + treadD - 1;
      for (let x = scx - 8; x <= scx + 7; x++) {
        const isLeftHalf = x < scx;
        for (let ry = 1; ry <= riserH; ry++) {
          const col =
            ry === 1
              ? '#451a03'
              : ry === 2
                ? isLeftHalf
                  ? '#92400e'
                  : '#78350f'
                : isLeftHalf
                  ? '#78350f'
                  : '#5c200c';
          buf.set(x, frontY + ry, col);
        }
      }
    }

    buf.outline();
    return buf;
  });
}

/**
 * 3. Segmento de Parede em Corte (Cutaway Wall) 100% Contínuo em resolução 1x (`16x74` px).
 * - Largura ativa exata de `16px` (`ix = 0..15`), SEM linhas verticais de contorno em `x = 0` ou `x = 15`.
 * - Quando desenhados lado a lado (`bLeft.x` para `'back'` e `bBot.x` para `'left'`, em `y = topAnchor.y - 61 * S`),
 *   o chanfro branco superior (`#f8fafc` com linha `#0f172a` em cima e embaixo), o papel de parede e o lambril
 *   com friso dourado se soldam em uma única parede diagonal contínua e perfeita!
 */
export function getIsoWallCanvas(
  side: IsoWallSide,
  decor: IsoWallDecor,
  variant: number,
  frame: number,
): HTMLCanvasElement {
  const v = ((variant | 0) % 4 + 4) % 4;
  const f = (frame | 0) % 8;
  const key = `wall-v2|${side}|${decor}|${v}|${f}`;

  return getCachedCanvas(key, () => {
    const buf = new PixelBuf(16, 74);
    const wallHeight = 56;
    const capThick = 4;

    // Iluminação consistente do topo-esquerda:
    // Parede 'left' (voltada para SE) é mais clara; parede 'back' (voltada para SW) fica em tom médio (-8%)
    const baseWallColor = side === 'left' ? '#cbd5e1' : '#b8c4d4';
    const wallRamp = ramp(baseWallColor, 0.06);
    const woodBase = side === 'left' ? '#78350f' : '#5c2409';
    const woodRamp = ramp(woodBase, 0.07);

    // Escada estrita 2:1 (0..7 px de desnível ao longo dos 16px de largura)
    const slopeAt = (ix: number): number =>
      side === 'back' ? Math.floor(ix / 2) : Math.floor((15 - ix) / 2);

    // 1. Corpo base contínuo da parede + Chanfro de corte superior (Cutaway Cap) + Lambril contínuo nos 14px inferiores
    for (let ix = 0; ix < 16; ix++) {
      const sy = slopeAt(ix);
      const topCapY = 1 + sy;
      const wallTopY = topCapY + capThick; // 5 + sy (para sy = 0 -> y = 5; base em wy = 56 -> y = 61)

      // 1A. Chanfro de corte de parede do Habbo no topo (4px de espessura clara #f8fafc / #e2e8f0 + linha #0f172a em cima e embaixo)
      buf.set(ix, topCapY, '#0f172a');
      buf.set(ix, topCapY + 1, '#f8fafc');
      buf.set(ix, topCapY + 2, side === 'left' ? '#f8fafc' : '#e2e8f0');
      buf.set(ix, topCapY + 3, side === 'left' ? '#e2e8f0' : '#cbd5e1');
      buf.set(ix, topCapY + 4, '#0f172a');

      // 1B. Corpo vertical da parede (wy = 1..56) — zero bordas verticais em ix=0 ou ix=15!
      for (let wy = 1; wy <= wallHeight; wy++) {
        const py = wallTopY + wy;

        if (wy <= wallHeight - 14) {
          // Papel de parede texturizado com listras verticais contínuas (passo 4px, que divide 16 perfeitamente!) e dithering Bayer 2x2
          const isStripe = (ix & 3) < 2;
          const bayer = BAYER2[wy & 1][ix & 1];
          let col = isStripe ? wallRamp.base : wallRamp.dk;

          if (wy === 1) {
            // Sombra projetada pelo chanfro superior
            col = wallRamp.dd;
          } else if (wy === 2) {
            col = wallRamp.lt;
          } else if (bayer === 0 && ((wy + ix) & 3) === 0) {
            col = mix(col, wallRamp.lt, 0.3);
          }

          buf.set(ix, py, col);
        } else {
          // Lambril (wainscoting) de madeira escura contínuo nos 14px inferiores com rodapé bisotado e friso dourado
          const ly = wy - (wallHeight - 13); // 0..13
          let col = woodRamp.base;

          if (ly === 0) {
            // Friso superior contínuo em ouro (#fbbf24 / #d97706)
            col = (ix & 1) === 0 ? '#fbbf24' : '#d97706';
          } else if (ly === 1) {
            col = '#451a03';
          } else if (ly === 2) {
            col = woodRamp.lt;
          } else if (ly >= 4 && ly <= 9) {
            // Almofadas de madeira entalhada repetindo a cada 8px (2 por segmento de 16px, sem costura nas bordas!)
            const localX = ix & 7;
            if (localX >= 1 && localX <= 6) {
              if (ly === 4 || localX === 1) col = '#451a03';
              else if (ly === 9 || localX === 6) col = woodRamp.lt;
              else col = woodRamp.dk;
            }
          } else if (ly === 11) {
            // Friso dourado fino no rodapé bisotado
            col = (ix & 1) === 0 ? '#d97706' : '#92400e';
          } else if (ly === 12) {
            col = woodRamp.dd;
          } else if (ly === 13) {
            // Linha escura contínua de contato com o piso
            col = '#0f172a';
          }

          buf.set(ix, py, col);
        }
      }
    }

    // 2. Decorações Específicas da Parede Isométrica
    const paintIsoPixel = (ix: number, wy: number, col: string) => {
      if (ix < 0 || ix >= 16 || wy < 1 || wy > wallHeight) return;
      const py = 1 + slopeAt(ix) + capThick + wy;
      buf.set(ix, py, col);
    };

    if (decor === 'window') {
      // Janela noturna isométrica com moldura de madeira/aço, peitoril projetado com sombra,
      // vidro azul-noite (#0f172a), skyline pixelado com janelinhas acesas (#fbbf24, #38bdf8) e reflexo em L (#7dd3fc)
      const winTop = 8;
      const winBot = 36;
      for (let ix = 1; ix <= 14; ix++) {
        for (let wy = winTop; wy <= winBot; wy++) {
          const isOuterFrame = ix === 1 || ix === 14 || wy === winTop || wy === winBot;
          const isInnerFrame = ix === 2 || ix === 13 || wy === winTop + 1 || wy === winBot - 1;
          const isMullion = ix === 7 || ix === 8 || wy === 21;

          if (isOuterFrame) {
            paintIsoPixel(ix, wy, '#1e293b');
          } else if (isInnerFrame || isMullion) {
            paintIsoPixel(ix, wy, wy === winTop + 1 || ix === 2 ? '#e2e8f0' : '#64748b');
          } else {
            let col = wy > 29 ? '#1e293b' : '#0f172a';
            const bldgH = ix <= 5 ? 25 : ix <= 9 ? 22 : ix <= 11 ? 27 : 24;
            if (wy >= bldgH) {
              col = '#090d16';
              if ((wy - bldgH) % 3 === 1 && ix % 2 === 1) {
                const lit = ((ix * 3 + wy + v) % 5) !== (f % 5);
                if (lit) {
                  col = (ix + wy) % 3 === 0 ? '#38bdf8' : '#fbbf24';
                }
              }
            } else if (wy === 19 && (ix === 3 + f || ix === 2 + f)) {
              // Luz de hover-car / monorail atravessando o céu noturno em 8 frames
              col = ix === 3 + f ? '#fef08a' : '#f43f5e';
            } else if (ix === 8 && wy === 21) {
              // Farol de topo de arranha-céu piscando
              col = f % 2 === 0 ? '#ef4444' : '#7f1d1d';
            } else if ((ix === 4 && wy === 12) || (ix === 11 && wy === 14)) {
              col = f % 2 === 0 ? '#f8fafc' : '#7dd3fc';
            }

            if (
              (ix === 4 && wy >= 11 && wy <= 16) ||
              (wy === 16 && ix >= 4 && ix <= 6) ||
              (ix + wy === 29 && ix >= 9 && ix <= 12)
            ) {
              col = '#7dd3fc';
            }

            paintIsoPixel(ix, wy, col);
          }
        }

        paintIsoPixel(ix, winBot + 1, '#f8fafc');
        paintIsoPixel(ix, winBot + 2, '#94a3b8');
        paintIsoPixel(ix, winBot + 3, '#334155');
      }
    } else if (decor === 'poster_trophy') {
      const pTop = 10;
      const pBot = 33;
      for (let ix = 2; ix <= 13; ix++) {
        for (let wy = pTop; wy <= pBot; wy++) {
          const isBorder = ix === 2 || ix === 13 || wy === pTop || wy === pBot;
          const isInnerBorder = ix === 3 || ix === 12 || wy === pTop + 1 || wy === pBot - 1;
          if (isBorder) {
            paintIsoPixel(ix, wy, '#78350f');
          } else if (isInnerBorder) {
            paintIsoPixel(ix, wy, (ix + wy) % 2 === 0 ? '#fde68a' : '#d97706');
          } else {
            let col = '#172554';
            const cx = ix - 7.5;
            if (wy >= 15 && wy <= 21 && Math.abs(cx) <= 2.5) {
              col = cx < 0 ? '#fde68a' : cx < 1 ? '#fbbf24' : '#d97706';
            } else if ((wy === 16 || wy === 18) && Math.abs(cx) <= 3.5) {
              col = '#fbbf24';
            } else if (wy >= 22 && wy <= 25 && Math.abs(cx) <= 0.6) {
              col = '#f59e0b';
            } else if (wy === 26 && Math.abs(cx) <= 2.0) {
              col = '#fbbf24';
            } else if ((wy === 27 || wy === 28) && Math.abs(cx) <= 2.5) {
              col = wy === 28 && Math.abs(cx) <= 1.0 ? '#fde68a' : '#451a03';
            }
            paintIsoPixel(ix, wy, col);
          }
        }
        paintIsoPixel(ix, pBot + 1, '#475569');
      }
    } else if (decor === 'poster_arcade') {
      const pTop = 10;
      const pBot = 34;
      for (let ix = 2; ix <= 13; ix++) {
        for (let wy = pTop; wy <= pBot; wy++) {
          const isBorder = ix === 2 || ix === 13 || wy === pTop || wy === pBot;
          if (isBorder) {
            paintIsoPixel(ix, wy, '#0f172a');
          } else {
            let col = wy < 22 ? '#1e1b4b' : '#3b0764';
            const dx = ix - 7.5;
            const dy = wy - 19;
            if (dx * dx + dy * dy <= 12 && wy <= 22) {
              col = wy % 2 === 0 ? '#f43f5e' : '#fbbf24';
            } else if (wy === 23) {
              col = '#22d3ee';
            } else if (wy > 23 && ((ix + wy) % 3 === 0 || wy % 3 === 0)) {
              col = '#a855f7';
            }
            if (ix === 3 || ix === 12 || wy === pTop + 1 || wy === pBot - 1) {
              col = (ix + wy + f) % 3 === 0 ? '#22d3ee' : '#ec4899';
            }
            paintIsoPixel(ix, wy, col);
          }
        }
        paintIsoPixel(ix, pBot + 1, '#475569');
      }
    } else if (decor === 'clock') {
      const cY = 17;
      const cX = 7.5;
      for (let ix = 2; ix <= 13; ix++) {
        for (let wy = 10; wy <= 25; wy++) {
          const dx = ix - cX;
          const dy = wy - cY;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= 32) {
            let col = '#f8fafc';
            if (dist2 >= 21) {
              col = dy < 0 ? '#fbbf24' : '#78350f';
            } else if (dist2 >= 16) {
              col = '#cbd5e1';
            } else {
              if ((Math.abs(dx) <= 0.6 && Math.abs(dy) >= 3) || (Math.abs(dy) <= 0.6 && Math.abs(dx) >= 3)) {
                col = '#475569';
              }
              if (Math.abs(dx) <= 0.6 && dy <= 0 && dy >= -3.2) {
                col = '#0f172a';
              } else if (dy >= -0.5 && dy <= 0.8 && dx >= 0 && dx <= 2.8) {
                col = '#dc2626';
              } else if (Math.abs(dx) <= 0.6 && Math.abs(dy) <= 0.6) {
                col = '#fbbf24';
              }
            }
            paintIsoPixel(ix, wy, col);
          }
        }
      }
    } else if (decor === 'door') {
      const doorTop = 10;
      for (let ix = 1; ix <= 14; ix++) {
        const dx = ix - 7.5;
        const archOffset = Math.round((dx * dx) / 6);
        const topY = doorTop + archOffset;

        for (let wy = topY; wy <= wallHeight; wy++) {
          const isStoneArch = wy <= topY + 1 || ix === 1 || ix === 14;
          const isDeepJamb = ix === 2 || ix === 3 || wy === topY + 2;

          if (isStoneArch) {
            const stoneCol = wy === topY || ix === 1 ? '#f1f5f9' : ix === 14 ? '#475569' : '#94a3b8';
            paintIsoPixel(ix, wy, stoneCol);
          } else if (isDeepJamb) {
            paintIsoPixel(ix, wy, '#1e1b18');
          } else if (wy >= wallHeight - 3) {
            paintIsoPixel(ix, wy, wy === wallHeight - 3 ? '#fde68a' : '#b45309');
          } else {
            let col = (ix + wy) % 7 === 0 ? '#92400e' : '#78350f';
            const inUpperPanel = ix >= 5 && ix <= 11 && wy >= topY + 5 && wy <= 31;
            const inLowerPanel = ix >= 5 && ix <= 11 && wy >= 36 && wy <= 48;
            if (inUpperPanel || inLowerPanel) {
              if (ix === 5 || wy === topY + 5 || wy === 36) col = '#451a03';
              else if (ix === 11 || wy === 31 || wy === 48) col = '#b45309';
              else col = '#5c200c';
            }
            if ((ix === 11 || ix === 12) && (wy === 33 || wy === 34)) {
              col = wy === 33 && ix === 11 ? '#fef08a' : '#f59e0b';
            }
            paintIsoPixel(ix, wy, col);
          }
        }
      }
    }

    return buf;
  });
}

/**
 * 3B. Pilar de Quina / Espessura Externa 3D de Parede em Corte (`16x76` px).
 * - Usado no canto traseiro `(gx=0, gy=0)` e nas extremidades das paredes para dar espessura 3D sólida
 *   de maquete recortada estilo Habbo Hotel!
 * - Âncora da base do pilar: `(cx = 8, baseY = 62)` — desenhar em `(cornerScreen.x - 8 * S, cornerScreen.y - 62 * S)`.
 */
export function getIsoWallCornerPillarCanvas(heightPx = 56): HTMLCanvasElement {
  const h = Math.max(24, Math.min(62, heightPx | 0));
  const key = `wall-pillar|${h}`;
  return getCachedCanvas(key, () => {
    const buf = new PixelBuf(16, 76);
    const cx = 8;
    const topY = 62 - h - 4; // Para h=56 -> topY = 2

    // 1. Topo losangular 2:1 do pilar de corte (largura 12px = 6px para cada lado, altura 6px)
    for (let dy = 0; dy < 6; dy++) {
      const hw = dy < 3 ? (dy + 1) * 2 : (6 - dy) * 2;
      const x0 = cx - hw;
      const x1 = cx + hw - 1;
      for (let x = x0; x <= x1; x++) {
        const isEdge = x === x0 || x === x1 || dy === 0 || dy === 5;
        buf.set(x, topY + dy, isEdge ? '#0f172a' : '#f8fafc');
      }
    }

    // 2. Coluna vertical 3D chanfrada (face esquerda clara, quina central luminosa, face direita sombreada)
    for (let wy = 0; wy <= h; wy++) {
      const py = topY + 3 + wy;
      for (let dx = -6; dx <= 5; dx++) {
        const x = cx + dx;
        const distEdge = dx < 0 ? Math.floor((dx + 6) / 2) : Math.floor((5 - dx) / 2);
        const pyIso = py + (2 - distEdge);

        let col: string;
        if (dx === -6 || dx === 5 || wy === h) {
          col = '#0f172a'; // contorno externo vertical e base
        } else if (wy === 0) {
          col = '#0f172a'; // linha abaixo do chanfro do topo
        } else if (wy >= h - 14) {
          // Acabamento em mogno e friso dourado alinhado ao lambril
          const ly = wy - (h - 14);
          if (ly === 0 || ly === 11) {
            col = dx < 0 ? '#fbbf24' : '#d97706';
          } else {
            col = dx === -1 || dx === 0 ? '#92400e' : dx < 0 ? '#78350f' : '#451a03';
          }
        } else {
          // Reboco arquitetônico do pilar
          col = dx === -1 || dx === 0 ? '#f1f5f9' : dx < 0 ? '#cbd5e1' : '#94a3b8';
        }
        buf.set(x, pyIso, col);
      }
    }

    return buf;
  });
}

/**
 * 3C. Mureta Frontal de Sustentação do Mezanino VIP + Balaustrada de Latão Dourado e Vidro/Veludo Bordô (`34x38` px).
 * - Elimina 100% o buraco preto em `gy = 4` entre o Mezanino VIP (`gz = 1`, `gy = 3`) e o Salão Principal (`gz = 0`, `gy = 4`).
 * - Geometria: Acompanhar a borda frontal-esquerda (SW) de um ladrilho isométrico (`32px` de largura horizontal e `16px` de queda diagonal 2:1,
 *   deslocando `1px` para baixo a cada `2px` da esquerda para a direita).
 * - Coordenada de desenho em `habbo-room.ts`:
 *   Para cada `gx` em `gy = 4` (exceto escada `gx = 4..6`), primeiro desenhe o ladrilho de piso normal (`gz = 0`) em `(gx, 4)`,
 *   e depois desenhe `getIsoMezzanineFrontWallCanvas(gx)` ancorado em `pLeft = isoToScreen(gx, 4, 1)`:
 *   `ctx.drawImage(wallSpr, Math.round(pLeft.x - 1 * S), Math.round(pLeft.y - 8 * S), Math.round(wallSpr.width * S), Math.round(wallSpr.height * S))`
 */
export function getIsoMezzanineFrontWallCanvas(variant: number): HTMLCanvasElement {
  const v = ((variant | 0) % 4 + 4) % 4;
  const key = `mezz-front-wall|${v}`;

  return getCachedCanvas(key, () => {
    const buf = new PixelBuf(34, 38);
    // pLeft = isoToScreen(gx, 4, 1) corresponde a (x = 1, y = 8) no sprite.
    // pRight = isoToScreen(gx + 1, 4, 1) corresponde a (x = 32, y = 15) no sprite (queda 2:1 de 8px em 16px? Não:
    // de (gx, 4) para (gx+1, 4), dx_screen = +16px em 1x (32px em 2x) e dy_screen = +8px em 1x (16px em 2x)!
    // Portanto, cada ladrilho ao longo de gx tem 16px de largura horizontal em 1x (ou 32px se cobrir o losango inteiro).
    // Vamos verificar: em 1x, TILE_W/2 = 16px e TILE_H/2 = 8px!
    // Quando gx aumenta em +1 (mantendo gy = 4 constante):
    // screen.x aumenta em +16px (em 1x) e screen.y aumenta em +8px (em 1x)!
    // E a queda vertical do nível gz=1 para gz=0 é LEVEL_H = 26px em 2x = 13px em 1x!

    const startX = 1;
    const baseTopY = 8; // coordenada Y do piso do mezanino (gz=1) em ix=0
    const railH = 7; // altura da Balaustrada VIP acima do piso do mezanino (y = 1..7 em ix=0)
    const dropH = 14; // altura da parede de sustentação abaixo do mezanino até encostar no piso gz=0 (13px + 1px de contato)

    for (let ix = 0; ix < 16; ix++) {
      const x = startX + ix;
      const slopeY = Math.floor(ix / 2); // +0..+7 px (escada estrita 2:1!)
      const floorY = baseTopY + slopeY;

      // 1. Balaustrada VIP no topo da mureta (acima de floorY: ry = -railH .. -1)
      const isPillar = ix === 0 || ix === 1 || ix === 15;
      for (let ry = -railH; ry < 0; ry++) {
        const py = floorY + ry;
        if (ry === -railH) {
          // Corrimão superior de latão dourado polido com brilho especular
          buf.set(x, py, (ix & 1) === 0 ? '#fef08a' : '#fbbf24');
        } else if (ry === -railH + 1) {
          buf.set(x, py, '#b45309');
        } else if (isPillar) {
          // Pilarete de latão dourado e mogno a cada ladrilho
          buf.set(x, py, ix === 0 ? '#fde68a' : '#b45309');
        } else if (ry === -1) {
          // Trilho inferior dourado da balaustrada
          buf.set(x, py, '#d97706');
        } else {
          // Painel de Vidro Fumê VIP com Cordão de Veludo Bordô Imperial no meio
          const cordSag = ix >= 4 && ix <= 11 ? 1 : 0;
          if (ry === -4 + cordSag) {
            buf.set(x, py, '#e11d48'); // cordão de veludo bordô iluminado
          } else if (ry === -3 + cordSag) {
            buf.set(x, py, '#881337'); // sombra do cordão de veludo
          } else {
            // Vidro fumê translúcido com reflexo diagonal ciano
            const isHighlight = (ix - ry === 7) || (ix - ry === 8);
            buf.set(x, py, isHighlight ? 'rgba(125, 211, 252, 0.75)' : 'rgba(15, 23, 42, 0.58)');
          }
        }
      }

      // 2. Parede frontal de sustentação do Mezanino (de floorY até floorY + dropH)
      // Painéis de mogno entalhado (#78350f, #451a03) com molduras douradas (#fbbf24) e rodapé escuro na base
      for (let wy = 0; wy <= dropH; wy++) {
        const py = floorY + wy;
        let col = '#5c200c';

        if (wy === 0) {
          // Borda do piso do mezanino (carpete bordô)
          col = (ix & 1) === 0 ? '#9f1239' : '#881337';
        } else if (wy === 1 || wy === 2) {
          // Cornija superior de ouro maciço sob a borda do mezanino
          col = wy === 1 ? ((ix & 1) === 0 ? '#fde68a' : '#fbbf24') : '#b45309';
        } else if (wy === 3) {
          col = '#270e05';
        } else if (wy >= 4 && wy <= 10 && ix >= 2 && ix <= 13) {
          // Painel de mogno entalhado com filete dourado interno
          const isGoldFrame = wy === 4 || wy === 10 || ix === 2 || ix === 13;
          const isRecess = wy >= 6 && wy <= 8 && ix >= 4 && ix <= 11;
          if (isGoldFrame) {
            col = wy === 4 || ix === 2 ? '#fbbf24' : '#b45309';
          } else if (isRecess) {
            col = (ix + wy + v) % 4 === 0 ? '#92400e' : '#78350f';
          } else {
            col = '#451a03';
          }
        } else if (wy === 11) {
          // Friso dourado do rodapé inferior
          col = (ix & 1) === 0 ? '#fbbf24' : '#d97706';
        } else if (wy === 12 || wy === 13) {
          // Rodapé de madeira nobre escura
          col = '#270e05';
        } else if (wy === dropH) {
          // Linha de contato e sombra projetada no piso inferior (gz = 0)
          col = '#0f172a';
        } else {
          // Pilastra lateral de mogno entre painéis
          col = ix === 0 ? '#78350f' : '#451a03';
        }

        buf.set(x, py, col);
      }
    }

    return buf;
  });
}

/**
 * 4. Cursor Isométrico Clássico do Habbo Hotel em resolução 1x (`34x18` px).
 * - Losango `32x16` com borda dupla pixelada branca (`#ffffff`) + contorno externo (`#0f172a`) de 1px
 *   e brilho ciano/dourado sutil nos 4 vértices para leitura instantânea sobre qualquer piso.
 */
export function getIsoCursorCanvas(): HTMLCanvasElement {
  return getCachedCanvas('iso-cursor-v1', () => {
    const buf = new PixelBuf(34, 18);
    const cx = 17;
    const topY = 1;

    for (let dy = 0; dy < 16; dy++) {
      const hw = dy < 8 ? (dy + 1) * 2 : (16 - dy) * 2;
      const x0 = cx - hw;
      const x1 = cx + hw - 1;
      const py = topY + dy;

      buf.set(x0, py, '#ffffff');
      buf.set(x0 + 1, py, '#ffffff');
      buf.set(x1 - 1, py, '#ffffff');
      buf.set(x1, py, '#ffffff');

      if (hw >= 4) {
        const innerCol = dy < 8 ? '#f8fafc' : '#e0f2fe';
        buf.set(x0 + 2, py, innerCol);
        buf.set(x0 + 3, py, innerCol);
        buf.set(x1 - 3, py, innerCol);
        buf.set(x1 - 2, py, innerCol);
      }

      buf.set(x0 - 1, py, '#0f172a');
      buf.set(x1 + 1, py, '#0f172a');
      if (hw >= 6) {
        buf.set(x0 + 4, py, '#0f172a');
        buf.set(x1 - 4, py, '#0f172a');
      }
    }

    buf.set(cx - 2, 0, '#0f172a');
    buf.set(cx - 1, 0, '#0f172a');
    buf.set(cx, 0, '#0f172a');
    buf.set(cx + 1, 0, '#0f172a');

    buf.set(cx - 2, 17, '#0f172a');
    buf.set(cx - 1, 17, '#0f172a');
    buf.set(cx, 17, '#0f172a');
    buf.set(cx + 1, 17, '#0f172a');

    buf.set(cx - 1, topY, '#fef08a');
    buf.set(cx, topY, '#fef08a');
    buf.set(cx - 1, topY + 15, '#bae6fd');
    buf.set(cx, topY + 15, '#bae6fd');
    buf.set(cx - 16, topY + 7, '#fef08a');
    buf.set(cx - 16, topY + 8, '#bae6fd');
    buf.set(cx + 15, topY + 7, '#fef08a');
    buf.set(cx + 15, topY + 8, '#bae6fd');

    return buf;
  });
}
