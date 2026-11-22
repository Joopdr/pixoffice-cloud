// Sprites de Superfícies Isométricas 2:1 (Pisos, Escadinha, Paredes Cutaway e Cursor)
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
    const vipRamp = ramp(v % 2 === 0 ? '#9f1239' : '#881337', 0.06);
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
  return getCachedCanvas('iso-stair-v1', () => {
    const buf = new PixelBuf(36, 32);
    const wood = ramp('#b45309', 0.08);

    // 4 degraus isométricos descendo da direita-topo (NE/NW) para a esquerda-baixo (SW/SE)
    // Cada degrau tem uma faixa de piso isométrico 2:1 e um espelho vertical de 3px
    for (let s = 0; s < 4; s++) {
      // Centro de cada degrau deslocado ao longo do eixo de descida isométrico
      const scx = 18;
      const topY = 2 + s * 5;
      const treadD = 6; // profundidade vertical do losango truncado do degrau
      const riserH = 4; // altura do espelho do degrau

      for (let dy = 0; dy < treadD; dy++) {
        // Largura 2:1 de cada fatia do degrau
        const hw = dy < 3 ? 10 + dy * 2 : 14 - (dy - 3) * 2;
        const x0 = scx - hw;
        const x1 = scx + hw - 1;
        const py = topY + dy;

        for (let x = x0; x <= x1; x++) {
          const isFrontEdge = dy === treadD - 1 || (dy >= 3 && (x - x0 < 2 || x1 - x < 2));
          const isBackEdge = dy === 0;

          let col = (x + dy + s) % 5 === 0 ? wood.lt : s % 2 === 0 ? wood.base : shade(wood.base, -0.04);
          if (isBackEdge && s > 0) {
            // Sombra projetada pelo espelho do degrau anterior
            col = '#451a03';
          } else if (isFrontEdge) {
            // Friso antiderrapante dourado na quina frontal de cada degrau
            col = (x + dy) % 2 === 0 ? '#fde68a' : '#fbbf24';
          }
          buf.set(x, py, col);
        }

        // Espelho vertical (riser) e longarina lateral chanfrada abaixo da borda frontal do degrau
        if (dy >= 3) {
          for (let step = 0; step < 2; step++) {
            const lx = x0 + step;
            const rx = x1 - step;
            for (let ry = 1; ry <= riserH; ry++) {
              const pyRiser = py + ry;
              // Sombra profunda sob a quina (#451a03) e madeira escura no espelho
              const leftCol = ry === 1 ? '#451a03' : ry === riserH ? '#270e05' : '#78350f';
              const rightCol = ry === 1 ? '#270e05' : ry === riserH ? '#1c0903' : '#5c200c';
              buf.set(lx, pyRiser, leftCol);
              buf.set(rx, pyRiser, rightCol);
            }
          }
        }
      }

      // Preenchimento central do espelho frontal de cada degrau
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

    // Contorno seletivo automático 1px ao redor da silhueta da escada
    buf.outline();
    return buf;
  });
}

/**
 * 3. Segmento de Parede em Corte (Cutaway Wall) estilo Habbo em resolução 1x (`18x72` px).
 * - Corresponde a 1 ladrilho de largura isométrica (`16px` de passo horizontal + `2px` de margem de contorno),
 *   com inclinação 2:1 de `8px` na base e `56px` de altura vertical.
 * - `side === 'back'` (parede traseira direita: desce da esquerda para a direita, `slopeY = Math.floor(ix / 2)`).
 * - `side === 'left'` (parede esquerda: desce da direita para a esquerda, `slopeY = Math.floor((15 - ix) / 2)`).
 */
export function getIsoWallCanvas(
  side: IsoWallSide,
  decor: IsoWallDecor,
  variant: number,
  frame: number,
): HTMLCanvasElement {
  const v = ((variant | 0) % 4 + 4) % 4;
  const f = (frame | 0) % 8;
  const key = `wall|${side}|${decor}|${v}|${f}`;

  return getCachedCanvas(key, () => {
    const buf = new PixelBuf(18, 72);
    const wallHeight = 56;
    const capThick = 4;

    // Iluminação consistente do topo-esquerda:
    // Parede 'left' (voltada para SE) recebe luz mais clara; parede 'back' (voltada para SW) fica em tom médio (-8%)
    const baseWallColor = side === 'left' ? '#cbd5e1' : '#b8c4d4';
    const wallRamp = ramp(baseWallColor, 0.06);
    const woodBase = side === 'left' ? '#78350f' : '#5c2409';
    const woodRamp = ramp(woodBase, 0.07);

    // Helper que converte coordenada local da coluna (ix = 0..15) e altura relativa ao topo da parede (wy = 0..55)
    // para coordenada Y real no buffer (respeitando a escada isométrica 2:1!)
    const slopeAt = (ix: number): number =>
      side === 'back' ? Math.floor(ix / 2) : Math.floor((15 - ix) / 2);

    // 1. Corpo base da parede + Chanfro de corte superior (Cutaway Cap) + Lambril (Wainscoting) nos 14px inferiores
    for (let ix = 0; ix < 16; ix++) {
      const x = ix + 1;
      const sy = slopeAt(ix);
      const topCapY = 2 + sy;
      const wallTopY = topCapY + capThick;

      // 1A. Clássico chanfro de corte de parede do Habbo no topo (4px de espessura clara #f8fafc / #e2e8f0 + contorno #1e293b)
      buf.set(x, topCapY, '#1e293b');
      buf.set(x, topCapY + 1, '#f8fafc');
      buf.set(x, topCapY + 2, side === 'left' ? '#f1f5f9' : '#e2e8f0');
      buf.set(x, topCapY + 3, '#cbd5e1');
      buf.set(x, topCapY + 4, '#475569'); // linha divisória entre o corte do topo e a face da parede

      // 1B. Corpo vertical da parede (wy = 1..55)
      for (let wy = 1; wy < wallHeight; wy++) {
        const py = wallTopY + wy;

        if (wy < wallHeight - 14) {
          // Papel de parede texturizado com listras verticais sutis e dithering leve
          const isStripe = ix % 4 === 0 || ix % 4 === 1;
          const bayer = BAYER2[wy & 1][ix & 1];
          let col = isStripe ? wallRamp.base : wallRamp.dk;

          if (wy === 1) {
            // Sombra logo abaixo do chanfro do teto
            col = wallRamp.dd;
          } else if (wy === 2) {
            col = wallRamp.lt;
          } else if (bayer === 0 && (wy + ix) % 5 === 0) {
            col = mix(col, wallRamp.lt, 0.35);
          }

          // Sombra sutil de junção de painel nas extremidades do ladrilho
          if (ix === 0) col = shade(col, 0.04);
          else if (ix === 15) col = shade(col, -0.05);

          buf.set(x, py, col);
        } else {
          // Lambril (wainscoting) de madeira escura nos 14px inferiores com rodapé bisotado e friso dourado
          const ly = wy - (wallHeight - 14); // 0..13
          let col = woodRamp.base;

          if (ly === 0) {
            // Friso superior dourado do lambril
            col = (ix + ly) % 2 === 0 ? '#fbbf24' : '#d97706';
          } else if (ly === 1) {
            col = '#451a03';
          } else if (ly === 2) {
            col = woodRamp.lt;
          } else if (ly >= 4 && ly <= 9 && ix >= 2 && ix <= 13) {
            // Almofada entalhada do lambril (rebaixo central)
            if (ly === 4 || ix === 2) col = '#451a03';
            else if (ly === 9 || ix === 13) col = woodRamp.lt;
            else col = woodRamp.dk;
          } else if (ly === 11) {
            // Rodapé bisotado superior
            col = woodRamp.lt;
          } else if (ly === 12) {
            col = woodRamp.dd;
          } else if (ly === 13) {
            // Linha de contato escura com o piso
            col = '#1e1b18';
          }

          buf.set(x, py, col);
        }
      }
    }

    // Bordas laterais externas de 1px no topo do corte (x = 0 e x = 17)
    const leftSlope = slopeAt(0);
    const rightSlope = slopeAt(15);
    buf.vline(0, 2 + leftSlope, 2 + leftSlope + capThick, '#1e293b');
    buf.vline(17, 2 + rightSlope, 2 + rightSlope + capThick, '#1e293b');

    // 2. Decorações Específicas da Parede Isométrica
    const paintIsoPixel = (ix: number, wy: number, col: string) => {
      if (ix < 0 || ix >= 16 || wy < 1 || wy >= wallHeight) return;
      const py = 2 + slopeAt(ix) + capThick + wy;
      buf.set(ix + 1, py, col);
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
            // Céu azul-noite profundo (#0f172a) com gradiente horizonte (#1e293b)
            let col = wy > 29 ? '#1e293b' : '#0f172a';

            // Skyline de prédios pixelados ao fundo
            const bldgH =
              ix <= 5 ? 25 : ix <= 9 ? 22 : ix <= 11 ? 27 : 24;
            if (wy >= bldgH) {
              col = '#090d16';
              // Janelinhas acesas nos prédios (#fbbf24, #38bdf8) piscando suavemente com frame
              if ((wy - bldgH) % 3 === 1 && ix % 2 === 1) {
                const lit = ((ix * 3 + wy + v) % 5) !== (f % 5);
                if (lit) {
                  col = (ix + wy) % 3 === 0 ? '#38bdf8' : '#fbbf24';
                }
              }
            } else if ((ix === 4 && wy === 12) || (ix === 11 && wy === 14)) {
              // Estrelas no céu noturno
              col = f % 2 === 0 ? '#f8fafc' : '#7dd3fc';
            }

            // Reflexo diagonal em L (#7dd3fc) no vidro
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

        // Peitoril projetado de pedra clara com sombra embaixo
        paintIsoPixel(ix, winBot + 1, '#f8fafc');
        paintIsoPixel(ix, winBot + 2, '#94a3b8');
        paintIsoPixel(ix, winBot + 3, '#334155');
      }
    } else if (decor === 'poster_trophy') {
      // Quadro emoldurado em ouro com troféu pixelado Habbo-style
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
            // Fundo veludo azul-marinho do quadro
            let col = '#172554';

            // Desenho do Troféu Habbo Dourado no centro (ix = 5..10, wy = 14..29)
            const cx = ix - 7.5;
            if (wy >= 15 && wy <= 21 && Math.abs(cx) <= 2.5) {
              // Taça superior dourada com brilho especular
              col = cx < 0 ? '#fde68a' : cx < 1 ? '#fbbf24' : '#d97706';
            } else if ((wy === 16 || wy === 18) && Math.abs(cx) <= 3.5) {
              // Alças laterais do troféu
              col = '#fbbf24';
            } else if (wy >= 22 && wy <= 25 && Math.abs(cx) <= 0.6) {
              // Haste central do troféu
              col = '#f59e0b';
            } else if (wy === 26 && Math.abs(cx) <= 2.0) {
              // Base dourada
              col = '#fbbf24';
            } else if ((wy === 27 || wy === 28) && Math.abs(cx) <= 2.5) {
              // Pedestal de mogno com plaquinha de ouro
              col = wy === 28 && Math.abs(cx) <= 1.0 ? '#fde68a' : '#451a03';
            }

            paintIsoPixel(ix, wy, col);
          }
        }
        // Sombra projetada pelo quadro
        paintIsoPixel(ix, pBot + 1, '#475569');
      }
    } else if (decor === 'poster_arcade') {
      // Pôster neon retrô 16-bit emoldurado
      const pTop = 10;
      const pBot = 34;
      for (let ix = 2; ix <= 13; ix++) {
        for (let wy = pTop; wy <= pBot; wy++) {
          const isBorder = ix === 2 || ix === 13 || wy === pTop || wy === pBot;
          if (isBorder) {
            paintIsoPixel(ix, wy, '#0f172a');
          } else {
            // Fundo synthwave roxo/magenta escuro
            let col = wy < 22 ? '#1e1b4b' : '#3b0764';

            // Sol neon / grade synthwave e nave espacial 16-bit
            const dx = ix - 7.5;
            const dy = wy - 19;
            if (dx * dx + dy * dy <= 12 && wy <= 22) {
              col = wy % 2 === 0 ? '#f43f5e' : '#fbbf24';
            } else if (wy === 23) {
              col = '#22d3ee'; // horizonte neon ciano
            } else if (wy > 23 && ((ix + wy) % 3 === 0 || wy % 3 === 0)) {
              col = '#a855f7'; // grade 3D neon
            }

            // Moldura interna LED piscante
            if (ix === 3 || ix === 12 || wy === pTop + 1 || wy === pBot - 1) {
              col = (ix + wy + f) % 3 === 0 ? '#22d3ee' : '#ec4899';
            }

            paintIsoPixel(ix, wy, col);
          }
        }
        paintIsoPixel(ix, pBot + 1, '#475569');
      }
    } else if (decor === 'clock') {
      // Relógio de parede pixel art com mostrador claro, aro metálico/dourado e ponteiros
      const cY = 17;
      const cX = 7.5;
      for (let ix = 2; ix <= 13; ix++) {
        for (let wy = 10; wy <= 25; wy++) {
          const dx = ix - cX;
          const dy = wy - cY;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= 32) {
            let col = '#f8fafc'; // mostrador claro
            if (dist2 >= 21) {
              // Aro externo de madeira/ouro
              col = dy < 0 ? '#fbbf24' : '#78350f';
            } else if (dist2 >= 16) {
              col = '#cbd5e1'; // sombra interna do aro
            } else {
              // Marcadores de 12h, 3h, 6h, 9h
              if ((Math.abs(dx) <= 0.6 && Math.abs(dy) >= 3) || (Math.abs(dy) <= 0.6 && Math.abs(dx) >= 3)) {
                col = '#475569';
              }
              // Ponteiro das horas (apontando para a direita/baixo) e minutos (para o topo)
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
      // Portal em arco de madeira nobre e pedra com umbral iluminado, batente profundo escuro e maçaneta de latão dourado
      const doorTop = 10;
      for (let ix = 1; ix <= 14; ix++) {
        const dx = ix - 7.5;
        // Arco arredondado no topo do portal
        const archOffset = Math.round((dx * dx) / 6);
        const topY = doorTop + archOffset;

        for (let wy = topY; wy < wallHeight; wy++) {
          const isStoneArch = wy <= topY + 1 || ix === 1 || ix === 14;
          const isDeepJamb = ix === 2 || ix === 3 || wy === topY + 2;

          if (isStoneArch) {
            // Moldura de pedra/madeira entalhada ao redor do portal
            const stoneCol =
              wy === topY || ix === 1 ? '#f1f5f9' : ix === 14 ? '#475569' : '#94a3b8';
            paintIsoPixel(ix, wy, stoneCol);
          } else if (isDeepJamb) {
            // Batente interno profundo escuro (dando sensação de espessura 3D à parede)
            paintIsoPixel(ix, wy, '#1e1b18');
          } else if (wy >= wallHeight - 3) {
            // Umbral/soleira iluminada no piso da porta
            paintIsoPixel(ix, wy, wy === wallHeight - 3 ? '#fde68a' : '#b45309');
          } else {
            // Folha de madeira nobre da porta com almofadas entalhadas e maçaneta de latão dourado
            let col = (ix + wy) % 7 === 0 ? '#92400e' : '#78350f';

            // Almofadas retangulares da porta
            const inUpperPanel = ix >= 5 && ix <= 11 && wy >= topY + 5 && wy <= 31;
            const inLowerPanel = ix >= 5 && ix <= 11 && wy >= 36 && wy <= 48;
            if (inUpperPanel || inLowerPanel) {
              if (ix === 5 || wy === topY + 5 || wy === 36) col = '#451a03';
              else if (ix === 11 || wy === 31 || wy === 48) col = '#b45309';
              else col = '#5c200c';
            }

            // Maçaneta de latão dourado com brilho especular
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
 * 4. Cursor Isométrico Clássico do Habbo Hotel em resolução 1x (`34x18` px).
 * - Losango `32x16` com borda dupla pixelada branca (`#ffffff`) + contorno externo (`#0f172a`) de 1px
 *   e brilho ciano/dourado sutil nos 4 vértices para leitura instantânea sobre qualquer piso.
 */
export function getIsoCursorCanvas(): HTMLCanvasElement {
  return getCachedCanvas('iso-cursor-v1', () => {
    const buf = new PixelBuf(34, 18);
    const cx = 17;
    const topY = 1;

    // 1. Desenha o anel branco duplo em escada estrita 2:1 (losango 32x16)
    for (let dy = 0; dy < 16; dy++) {
      const hw = dy < 8 ? (dy + 1) * 2 : (16 - dy) * 2;
      const x0 = cx - hw;
      const x1 = cx + hw - 1;
      const py = topY + dy;

      // Borda externa branca (2px horizontais por degrau 2:1)
      buf.set(x0, py, '#ffffff');
      buf.set(x0 + 1, py, '#ffffff');
      buf.set(x1 - 1, py, '#ffffff');
      buf.set(x1, py, '#ffffff');

      // Borda interna luminosa (2px adicionais para dar o visual grosso clássico do Habbo)
      if (hw >= 4) {
        const innerCol = dy < 8 ? '#f8fafc' : '#e0f2fe';
        buf.set(x0 + 2, py, innerCol);
        buf.set(x0 + 3, py, innerCol);
        buf.set(x1 - 3, py, innerCol);
        buf.set(x1 - 2, py, innerCol);
      }

      // Contorno escuro seletivo 1px por fora e por dentro do anel para contraste máximo
      buf.set(x0 - 1, py, '#0f172a');
      buf.set(x1 + 1, py, '#0f172a');
      if (hw >= 6) {
        buf.set(x0 + 4, py, '#0f172a');
        buf.set(x1 - 4, py, '#0f172a');
      }
    }

    // Fechamento do contorno escuro no topo (y = 0) e base (y = 17)
    buf.set(cx - 2, 0, '#0f172a');
    buf.set(cx - 1, 0, '#0f172a');
    buf.set(cx, 0, '#0f172a');
    buf.set(cx + 1, 0, '#0f172a');

    buf.set(cx - 2, 17, '#0f172a');
    buf.set(cx - 1, 17, '#0f172a');
    buf.set(cx, 17, '#0f172a');
    buf.set(cx + 1, 17, '#0f172a');

    // Brilho nos 4 vértices do losango (Topo, Base, Esquerda, Direita)
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
