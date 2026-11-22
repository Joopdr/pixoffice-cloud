// Habbo Hotel Classic Pixel Art Furni Generator (2005–2009 Style)
// Desenha pixel a pixel em resolução nativa 1x (para renderização com imageSmoothingEnabled = false em 2 * zoom)
// todos os 11 Mobis isométricos 2:1 do quarto corporativo PixOffice.

import { mix, ramp, shade } from '../art/core/color';
import { PixelBuf } from '../art/core/pixbuf';

export interface PixFurniSprite {
  canvas: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
}

export interface IsoPrismPalette {
  top: string;
  left: string;
  right: string;
  lt?: string;
  innerBorder?: string;
}

export interface IsoPrismOpts {
  bevelTop?: boolean;
  highlightFrontEdge?: boolean;
  woodGrainTop?: boolean;
  woodColor?: string;
  ditherLeft?: string;
  ditherRight?: string;
}

/**
 * Desenha um prisma isométrico 2:1 pixel a pixel em `PixelBuf`.
 * (cx, cy) é o vértice inferior frontal da base do prisma (no chão/apoio).
 * `wx` = extensão diagonal para a esquerda-cima (eixo GY, em pixels horizontais).
 * `wy` = extensão diagonal para a direita-cima (eixo GX, em pixels horizontais).
 * `h`  = altura vertical do prisma em pixels.
 */
function drawIsoPrism(
  buf: PixelBuf,
  cx: number,
  cy: number,
  wx: number,
  wy: number,
  h: number,
  pal: IsoPrismPalette,
  opts: IsoPrismOpts = {},
): void {
  const rx = Math.max(1, Math.round(wx));
  const ry = Math.max(1, Math.round(wy));
  const hh = Math.max(0, Math.round(h));
  const ltCol = pal.lt ?? shade(pal.top, 0.12);

  // 1. Face Esquerda (de cx - rx até cx)
  if (hh > 0) {
    for (let dx = 0; dx < rx; dx++) {
      const x = cx - rx + dx;
      const yBottom = cy - Math.floor((rx - 1 - dx) / 2);
      const yTop = yBottom - hh;
      for (let y = yTop; y <= yBottom; y++) {
        let col = pal.left;
        if (opts.ditherLeft && ((x + y) & 1) === 0) {
          col = opts.ditherLeft;
        }
        buf.set(x, y, col);
      }
      // Chanfro iluminado na aresta superior esquerda
      if (opts.bevelTop !== false) {
        buf.set(x, yTop, ltCol);
      }
    }

    // 2. Face Direita (de cx até cx + ry - 1)
    for (let dx = 0; dx < ry; dx++) {
      const x = cx + dx;
      const yBottom = cy - Math.floor(dx / 2);
      const yTop = yBottom - hh;
      for (let y = yTop; y <= yBottom; y++) {
        let col = pal.right;
        if (opts.ditherRight && ((x + y) & 1) === 0) {
          col = opts.ditherRight;
        }
        buf.set(x, y, col);
      }
      // Aresta superior direita levemente destacada
      if (opts.bevelTop !== false) {
        buf.set(x, yTop, mix(pal.top, pal.right, 0.35));
      }
    }
  }

  // 3. Face Superior (Losango isométrico 2:1 no topo y = cy - hh)
  const topCy = cy - hh;
  const minX = cx - rx;
  const maxX = cx + ry - 1;
  const backX = cx - rx + ry;
  const backY = topCy - Math.floor(rx / 2) - Math.floor(ry / 2);

  for (let x = minX; x <= maxX; x++) {
    // Limite inferior do losango superior
    const yFront =
      x < cx
        ? topCy - Math.floor((cx - 1 - x) / 2)
        : topCy - Math.floor((x - cx) / 2);
    // Limite superior (traseiro) do losango
    const yBack =
      x < backX
        ? backY + Math.floor((backX - 1 - x) / 2)
        : backY + Math.floor((x - backX) / 2);

    for (let y = yBack; y <= yFront; y++) {
      let col = pal.top;
      if (opts.woodGrainTop && opts.woodColor) {
        // Veios de madeira isométricos sutis
        if (((x + y * 2) % 7 === 0) || ((x - y * 2) % 11 === 0)) {
          col = opts.woodColor;
        }
      }
      buf.set(x, y, col);
    }
    // Brilho de 1px nas duas quinas frontais superiores
    if (opts.bevelTop !== false) {
      buf.set(x, yFront, ltCol);
    }
  }

  // 4. Quina vertical central frontal iluminada (1px)
  if (hh > 1 && opts.highlightFrontEdge !== false) {
    const edgeCol = mix(ltCol, pal.left, 0.35);
    for (let y = topCy + 1; y < cy; y++) {
      buf.set(cx - 1, y, edgeCol);
    }
  }
}

/** Desenha uma linha isométrica 2:1 acompanhando o eixo esquerdo-cima (dx < 0) ou direito-cima (dx > 0). */
function drawIsoLine(
  buf: PixelBuf,
  x0: number,
  y0: number,
  steps: number,
  dir: 'left-up' | 'right-up',
  color: string,
): void {
  const sx = dir === 'left-up' ? -1 : 1;
  for (let i = 0; i < steps; i++) {
    const x = x0 + sx * i;
    const y = y0 - Math.floor(i / 2);
    buf.set(x, y, color);
  }
}

function bufToCanvas(buf: PixelBuf): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.putImageData(new ImageData(buf.data, buf.w, buf.h), 0, 0);
  }
  return c;
}

// ============================================================================
// 1. CLUB_SOFA — Sofá PixClub VIP (2x1 tiles, 56x48 px)
// ============================================================================
function buildClubSofa(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(56, 48);
  const ax = 22;
  const ay = 43;

  // Sombra de contato 2:1 no chão
  buf.shadow(27, 36, 22, 9, '#0f172a', 0.28);

  const burgundy = {
    top: '#be123c',
    left: '#9f1239',
    right: '#881337',
    lt: '#f43f5e',
  };
  const darkBurgundy = {
    top: '#9f1239',
    left: '#881337',
    right: '#4c0519',
    lt: '#e11d48',
  };
  const gold = ramp('#fbbf24', 0.09);
  const wood = ramp('#78350f', 0.08);

  // 4 Pés de madeira torneados com ponteiras douradas
  const feet: Array<[number, number]> = [
    [10, 36], // esquerda-trás
    [22, 42], // frente-baixo
    [36, 35], // meio-direita
    [48, 29], // direita-frente
  ];
  for (const [fx, fy] of feet) {
    buf.rect(fx - 1, fy - 3, 3, 2, wood.base);
    buf.set(fx - 1, fy - 3, wood.lt);
    buf.hline(fx - 1, fx + 1, fy - 1, gold.base);
    buf.set(fx, fy - 1, gold.hi);
  }

  // Base inferior estofada bordô imperial (2x1 tiles: wx=13, wy=27, h=5)
  drawIsoPrism(buf, 22, 40, 13, 27, 5, darkBurgundy);

  // Friso frontal dourado imperial ao longo da base
  drawIsoLine(buf, 21, 38, 12, 'left-up', gold.base);
  drawIsoLine(buf, 22, 38, 26, 'right-up', gold.base);
  buf.set(22, 38, gold.hi);
  buf.set(28, 35, gold.hi);
  buf.set(36, 31, gold.hi);

  // Braço lateral traseiro-direito (desenhado antes das almofadas para profundidade)
  drawIsoPrism(buf, 46, 28, 13, 5, 11, burgundy);
  // Escudo dourado frontal do braço direito
  buf.rect(47, 20, 2, 4, gold.base);
  buf.set(47, 20, gold.hi);

  // Encosto alto acolchoado em capitonê (wx=5, wy=27, h=17)
  drawIsoPrism(buf, 14, 31, 5, 27, 17, burgundy);

  // Textura Capitonê (Tufted) no encosto: losangos + 4 botões dourados/escuros afundados
  const buttons: Array<[number, number]> = [
    [19, 17],
    [25, 14],
    [31, 11],
    [37, 8],
  ];
  for (const [bx, by] of buttons) {
    // Dobras em X ao redor do botão
    buf.set(bx - 1, by - 1, '#4c0519');
    buf.set(bx + 1, by - 1, '#4c0519');
    buf.set(bx - 1, by + 1, '#4c0519');
    buf.set(bx + 1, by + 1, '#f43f5e');
    // Botão dourado afundado
    buf.set(bx, by, gold.base);
    buf.set(bx, by - 1, '#4c0519');
  }

  // 2 Almofadas de assento macias separadas por costura de 1px
  // Almofada 2 (direita-cima)
  drawIsoPrism(buf, 35, 29, 8, 11, 4, {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  });
  // Almofada 1 (esquerda-baixo)
  drawIsoPrism(buf, 24, 34, 8, 11, 4, {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  });
  // Costura divisória escura entre as 2 almofadas
  drawIsoLine(buf, 34, 26, 7, 'left-up', '#4c0519');

  // Braço lateral frontal-esquerdo (wx=13, wy=5, h=11)
  drawIsoPrism(buf, 22, 40, 13, 5, 11, burgundy);
  // Detalhe arredondado e escudo dourado frontal no braço esquerdo
  buf.rect(23, 32, 2, 4, gold.base);
  buf.set(23, 32, gold.hi);
  drawIsoLine(buf, 21, 29, 11, 'left-up', '#fda4af');

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 2. DEV_DESK — Bancada Dual-Monitor Dev (1x1 tile, 44x48 px)
// ============================================================================
function buildDevDesk(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(44, 48);
  const ax = 22;
  const ay = 42;

  buf.shadow(22, 37, 16, 7, '#0f172a', 0.26);

  const oak = {
    top: '#e5c08d',
    left: '#c89d66',
    right: '#9c7241',
    lt: '#f7dcb4',
  };
  const steel = {
    top: '#cbd5e1',
    left: '#94a3b8',
    right: '#475569',
    lt: '#f1f5f9',
  };

  // Perna lateral esquerda em aço escovado
  drawIsoPrism(buf, 11, 36, 3, 3, 12, steel);
  // Barra transversal inferior
  drawIsoLine(buf, 12, 33, 14, 'right-up', '#64748b');

  // Gaveteiro à direita com 2 puxadores pixelados
  drawIsoPrism(buf, 27, 39, 9, 7, 12, {
    top: '#94a3b8',
    left: '#64748b',
    right: '#334155',
    lt: '#cbd5e1',
  });
  // Divisória das gavetas e 2 puxadores cromados na face direita/esquerda
  drawIsoLine(buf, 26, 33, 7, 'left-up', '#1e293b');
  buf.hline(21, 23, 30, '#f8fafc'); // puxador gaveta superior
  buf.hline(21, 23, 34, '#f8fafc'); // puxador gaveta inferior

  // Tampo de carvalho claro com veios de madeira pixelados e borda chanfrada
  drawIsoPrism(buf, 22, 29, 13, 15, 3, oak, {
    woodGrainTop: true,
    woodColor: '#cfa56e',
  });

  // Suportes articulados dos 2 monitores
  buf.rect(16, 20, 2, 4, '#334155');
  buf.rect(26, 18, 2, 4, '#334155');
  buf.hline(15, 18, 24, '#64748b');
  buf.hline(25, 28, 22, '#64748b');

  // Monitor 1 (Esquerdo - inclinado)
  buf.rect(10, 11, 13, 10, '#1e293b');
  buf.hline(10, 22, 11, '#64748b'); // topo iluminado da moldura
  buf.vline(10, 11, 20, '#475569');
  buf.rect(11, 12, 11, 8, '#0f172a'); // tela escura
  buf.set(21, 20, '#22c55e'); // LED power verde

  // Monitor 2 (Direito - inclinado em 2:1)
  buf.rect(23, 9, 13, 10, '#1e293b');
  buf.hline(23, 35, 9, '#64748b');
  buf.vline(23, 9, 18, '#475569');
  buf.rect(24, 10, 11, 8, '#0f172a');
  buf.set(34, 18, '#22c55e');

  // Linhas de código coloridas animadas conforme frame % 4
  const f = frame % 4;
  const codeColors = ['#22c55e', '#38bdf8', '#facc15', '#f472b6'];
  // Monitor 1 código
  buf.hline(12, 16 + (f % 3), 13, codeColors[f % 4]);
  buf.hline(13, 19, 15, codeColors[(f + 1) % 4]);
  buf.hline(12, 15 + ((f + 2) % 4), 17, codeColors[(f + 2) % 4]);
  buf.hline(14, 20, 18, codeColors[(f + 3) % 4]);
  // Monitor 2 código
  buf.hline(25, 31, 11, codeColors[(f + 1) % 4]);
  buf.hline(26, 29 + (f % 3), 13, codeColors[(f + 2) % 4]);
  buf.hline(25, 33, 15, codeColors[(f + 3) % 4]);
  buf.hline(26, 30 + ((f + 1) % 3), 16, codeColors[f % 4]);

  // Teclado mecânico isométrico com pontinhos de keycaps
  buf.rect(17, 23, 9, 3, '#334155');
  for (let kx = 18; kx <= 25; kx += 2) {
    buf.set(kx, 23, '#e2e8f0');
    buf.set(kx - 1, 24, '#cbd5e1');
  }
  buf.set(20, 25, '#38bdf8'); // barra de espaço custom

  // Mouse sobre mousepad azul
  buf.rect(27, 22, 4, 3, '#1d4ed8');
  buf.rect(28, 22, 2, 2, '#e2e8f0');

  // Caneca de café vermelha na ponta esquerda
  buf.rect(12, 22, 3, 3, '#ef4444');
  buf.hline(12, 14, 22, '#fca5a5');
  buf.set(13, 22, '#451a03'); // café
  buf.set(11, 23, '#dc2626'); // alça

  buf.outline();

  // Fumaça pixelada subindo da caneca (desenhada após outline para ficar leve)
  const sy = 20 - (f % 2);
  buf.set(13, sy, 'rgba(255,255,255,0.75)');
  buf.set(12 + (f % 2), sy - 2, 'rgba(255,255,255,0.5)');

  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 3. EXEC_CHAIR — Poltrona Executiva Mesh (1x1 tile, 32x38 px)
// ============================================================================
function buildExecChair(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(32, 38);
  const ax = 16;
  const ay = 34;

  buf.shadow(16, 32, 10, 5, '#0f172a', 0.26);

  // Base estrela de 5 pontas preta + rodízios pixelados
  buf.hline(9, 23, 31, '#1e293b');
  buf.hline(12, 20, 30, '#334155');
  buf.line(16, 30, 10, 33, '#1e293b');
  buf.line(16, 30, 22, 33, '#1e293b');
  buf.line(16, 30, 16, 34, '#334155');
  // Rodízios
  const casters: Array<[number, number]> = [
    [9, 32],
    [10, 34],
    [16, 35],
    [22, 34],
    [23, 32],
  ];
  for (const [cx, cy] of casters) {
    buf.set(cx, cy, '#0f172a');
    buf.set(cx, cy - 1, '#64748b');
  }

  // Pistão pneumático cromado central
  buf.vline(15, 25, 30, '#cbd5e1');
  buf.vline(16, 25, 30, '#64748b');
  buf.set(15, 27, '#f8fafc');

  // Assento anatômico azul royal com borda iluminada
  const royalBlue = {
    top: '#2563eb',
    left: '#1d4ed8',
    right: '#1e3a8a',
    lt: '#60a5fa',
  };
  drawIsoPrism(buf, 16, 26, 7, 7, 3, royalBlue);

  // Braço lateral direito em T (atrás)
  buf.vline(22, 18, 23, '#334155');
  buf.hline(20, 24, 18, '#475569');
  buf.set(21, 18, '#94a3b8');

  // Encosto alto ergonômico em Mesh com textura respirável (dithering)
  drawIsoPrism(
    buf,
    13,
    22,
    3,
    7,
    12,
    {
      top: '#3b82f6',
      left: '#1e40af',
      right: '#172554',
      lt: '#60a5fa',
    },
    {
      ditherLeft: '#1e3a8a',
      ditherRight: '#0f172a',
    },
  );

  // Apoio de cabeça acolchoado no topo
  drawIsoPrism(buf, 13, 10, 3, 6, 3, {
    top: '#3b82f6',
    left: '#2563eb',
    right: '#1e3a8a',
    lt: '#93c5fd',
  });

  // Braço lateral esquerdo em T (frente)
  buf.vline(11, 20, 25, '#475569');
  buf.hline(9, 13, 20, '#64748b');
  buf.set(10, 20, '#cbd5e1');

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 4. ESPRESSO_BAR — Máquina Espresso Barista (1x1 tile, 40x48 px)
// ============================================================================
function buildEspressoBar(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(40, 48);
  const ax = 20;
  const ay = 43;

  buf.shadow(20, 38, 15, 7, '#0f172a', 0.28);

  // Balcão de mogno com prateleira frontal
  const mahogany = {
    top: '#92400e',
    left: '#78350f',
    right: '#451a03',
    lt: '#b45309',
  };
  drawIsoPrism(buf, 20, 40, 11, 11, 14, mahogany);

  // Detalhe de prateleira frontal e friso dourado no balcão
  drawIsoLine(buf, 19, 33, 9, 'left-up', '#fbbf24');
  drawIsoLine(buf, 20, 33, 9, 'right-up', '#d97706');

  // Tampo de mármore/inox polido
  drawIsoPrism(buf, 20, 26, 12, 12, 2, {
    top: '#f1f5f9',
    left: '#cbd5e1',
    right: '#94a3b8',
    lt: '#ffffff',
  });

  // Bandeja pingadeira de inox na frente da cafeteira
  drawIsoPrism(buf, 21, 23, 6, 6, 1, {
    top: '#94a3b8',
    left: '#64748b',
    right: '#475569',
    lt: '#e2e8f0',
  });

  // Cafeteira Italiana Vermelha & Cromada no topo
  const crimson = {
    top: '#ef4444',
    left: '#dc2626',
    right: '#991b1b',
    lt: '#fca5a5',
  };
  drawIsoPrism(buf, 19, 22, 8, 8, 10, crimson);

  // Topo cromado aquecedor de xícaras
  drawIsoPrism(buf, 19, 12, 8, 8, 2, {
    top: '#e2e8f0',
    left: '#cbd5e1',
    right: '#94a3b8',
    lt: '#ffffff',
  });

  // Manômetro circular 3x3 px na face frontal
  buf.rect(15, 14, 3, 3, '#f8fafc');
  buf.set(16, 15, '#ef4444'); // ponteiro
  buf.set(15, 14, '#94a3b8');

  // 2 Cachimbos (Portafiltros) cromados com cabos pretos
  buf.rect(19, 17, 2, 2, '#cbd5e1');
  buf.hline(17, 18, 18, '#0f172a'); // cabo 1
  buf.rect(23, 15, 2, 2, '#cbd5e1');
  buf.hline(25, 26, 16, '#0f172a'); // cabo 2

  // Xícaras brancas sob os cachimbos e empilhadas no aquecedor superior
  buf.rect(19, 20, 2, 2, '#ffffff');
  buf.rect(23, 18, 2, 2, '#ffffff');
  // Xícaras no topo
  buf.rect(16, 7, 2, 2, '#ffffff');
  buf.rect(19, 6, 2, 2, '#e2e8f0');
  buf.rect(22, 7, 2, 2, '#ffffff');

  buf.outline();

  // Puffs de vapor branco que sobem conforme frame % 4
  const f = frame % 4;
  const puffY = 6 - f;
  buf.rect(20, puffY, 2, 2, 'rgba(255,255,255,0.85)');
  buf.set(18 + (f % 2), puffY - 2, 'rgba(255,255,255,0.65)');
  buf.set(22 - (f % 2), puffY - 3, 'rgba(255,255,255,0.45)');

  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 5. VENDING_DRINKS — Máquina PixCola Neon (1x1 tile, 40x56 px)
// ============================================================================
function buildVendingDrinks(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(40, 56);
  const ax = 20;
  const ay = 50;

  buf.shadow(20, 45, 15, 7, '#0f172a', 0.3);

  // Pés niveladores
  buf.rect(10, 42, 2, 2, '#1e293b');
  buf.rect(19, 46, 2, 2, '#1e293b');
  buf.rect(28, 42, 2, 2, '#1e293b');

  // Gabinete alto azul/ciano
  const cabinet = {
    top: '#38bdf8',
    left: '#0284c7',
    right: '#0369a1',
    lt: '#7dd3fc',
  };
  drawIsoPrism(buf, 20, 47, 11, 11, 32, cabinet);

  // Letreiro luminoso Neon no topo
  const neonOn = frame % 2 === 0;
  for (let dx = 1; dx < 9; dx++) {
    const x = 20 + dx;
    const y = 18 - Math.floor(dx / 2);
    buf.vline(x, y, y + 3, neonOn ? '#fde047' : '#38bdf8');
    buf.set(x, y + 1, '#ffffff');
  }

  // Vitrine de vidro iluminada na face direita (frontal-direita)
  for (let dx = 1; dx <= 6; dx++) {
    const x = 20 + dx;
    const yTop = 23 - Math.floor(dx / 2);
    buf.vline(x, yTop, yTop + 14, '#e0f2fe');
    // Reflexo diagonal no vidro
    if (dx === 2 || dx === 5) {
      buf.set(x, yTop + 2, '#ffffff');
      buf.set(x, yTop + 3, '#ffffff');
    }
  }

  // 3 Fileiras de latinhas coloridas (vermelha, azul, dourada, verde) dentro da vitrine
  const canColors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];
  for (let row = 0; row < 3; row++) {
    const ry = 26 + row * 4;
    // Prateleira interna
    drawIsoLine(buf, 21, ry + 2, 6, 'right-up', '#475569');
    for (let c = 0; c < 3; c++) {
      const cx = 21 + c * 2;
      const cy = ry - c;
      const col = canColors[(row + c) % canColors.length];
      buf.vline(cx, cy, cy + 1, col);
      buf.set(cx, cy, shade(col, 0.2));
    }
  }

  // Painel lateral de botões e leitor de moedas
  buf.vline(28, 21, 33, '#0f172a');
  buf.set(28, 22, '#22c55e'); // leitor verde
  buf.set(28, 24, '#facc15'); // moeda
  buf.set(28, 26, '#ef4444'); // botão 1
  buf.set(28, 28, '#38bdf8'); // botão 2

  // Abertura escura de retirada de latas na base
  for (let dx = 2; dx <= 8; dx++) {
    const x = 20 + dx;
    const y = 42 - Math.floor(dx / 2);
    buf.vline(x, y - 3, y, '#0f172a');
    buf.set(x, y - 3, '#334155');
  }

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 6. SERVER_RACK — Rack Cloud 24/7 (1x1 tile, 40x58 px)
// ============================================================================
function buildServerRack(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(40, 58);
  const ax = 20;
  const ay = 52;

  buf.shadow(20, 47, 15, 7, '#020617', 0.32);

  // Pés reforçados de datacenter
  buf.rect(10, 44, 2, 2, '#0f172a');
  buf.rect(19, 48, 2, 2, '#0f172a');
  buf.rect(28, 44, 2, 2, '#0f172a');

  // Gabinete em aço grafite com porta lateral perfurada (dithering)
  drawIsoPrism(
    buf,
    20,
    49,
    11,
    11,
    35,
    {
      top: '#475569',
      left: '#334155',
      right: '#1e293b',
      lt: '#94a3b8',
    },
    {
      ditherLeft: '#1e293b',
    },
  );

  // Exaustor circular superior no topo do rack
  buf.ellipse(20, 9, 4, 2, '#1e293b');
  buf.set(20, 9, '#38bdf8');

  // 6 Gavetas de servidores blade na face frontal-direita com LEDs piscando a cada frame % 4
  const f = frame % 4;
  const ledColors = ['#22c55e', '#38bdf8', '#f59e0b', '#22c55e'];

  for (let b = 0; b < 6; b++) {
    const baseY = 20 + b * 5;
    // Moldura escura da blade
    for (let dx = 1; dx <= 9; dx++) {
      const x = 20 + dx;
      const y = baseY - Math.floor(dx / 2);
      buf.vline(x, y, y + 3, '#0f172a');
      buf.set(x, y, '#475569'); // trilho metálico
    }

    // LEDs de atividade (verde, ciano, âmbar) piscando em padrão dinâmico
    const c1 = ledColors[(b + f) % 4];
    const c2 = ledColors[(b * 2 + f + 1) % 4];
    const c3 = (b + f) % 3 === 0 ? '#ef4444' : '#22c55e';
    buf.set(22, baseY + 1, c1);
    buf.set(24, baseY, c2);
    buf.set(26, baseY - 1, c3);
    buf.set(28, baseY - 2, c1);
  }

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 7. HOLO_SCREEN — Telão Executivo de Sprint (2x1 tiles, 68x56 px)
// ============================================================================
function buildHoloScreen(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(68, 56);
  const ax = 24;
  const ay = 49;

  buf.shadow(34, 42, 24, 9, '#0f172a', 0.28);

  const alu = {
    top: '#e2e8f0',
    left: '#94a3b8',
    right: '#475569',
    lt: '#ffffff',
  };

  // Base pedestal duplo em alumínio escovado com friso neon
  drawIsoPrism(buf, 24, 47, 10, 28, 3, alu);
  drawIsoLine(buf, 24, 45, 27, 'right-up', '#38bdf8');

  // 2 Colunas verticais do pedestal
  drawIsoPrism(buf, 28, 43, 3, 4, 8, alu);
  drawIsoPrism(buf, 44, 35, 3, 4, 8, alu);

  // Moldura panorâmica isométrica (wx=4, wy=32, h=24)
  drawIsoPrism(buf, 22, 39, 4, 32, 24, {
    top: '#64748b',
    left: '#334155',
    right: '#0f172a',
    lt: '#38bdf8',
  });

  // Borda interna neon ciano ao redor da tela
  drawIsoLine(buf, 23, 16, 30, 'right-up', '#38bdf8');
  drawIsoLine(buf, 23, 37, 30, 'right-up', '#0284c7');
  buf.vline(23, 16, 37, '#38bdf8');
  buf.vline(52, 2, 23, '#38bdf8');

  // Fundo azul-profundo de alta densidade do display
  for (let dx = 2; dx <= 29; dx++) {
    const x = 22 + dx;
    const yTop = 17 - Math.floor(dx / 2);
    const yBot = 36 - Math.floor(dx / 2);
    buf.vline(x, yTop, yBot, '#091024');
    // Grade holográfica sutil
    if (dx % 5 === 0) {
      buf.vline(x, yTop + 1, yBot - 1, '#112240');
    }
  }

  // Mini-gráfico de barras de commits em pixel art (verde/ciano/ouro)
  const f = frame % 4;
  const barColors = ['#22c55e', '#38bdf8', '#fbbf24', '#a855f7', '#22c55e', '#38bdf8'];
  const barHeights = [6, 10, 8, 13, 11, 15];

  for (let i = 0; i < 6; i++) {
    const dx = 5 + i * 4;
    const bx = 22 + dx;
    const byBot = 34 - Math.floor(dx / 2);
    const bh = Math.max(4, barHeights[i] + ((f + i) % 3) - 1);
    const col = barColors[i];
    buf.vline(bx, byBot - bh, byBot, col);
    buf.vline(bx + 1, byBot - bh, byBot, shade(col, -0.12));
    buf.set(bx, byBot - bh, '#ffffff');
  }

  // Linhas de status de sprint no topo da tela
  drawIsoLine(buf, 26, 18, 12, 'right-up', '#38bdf8');
  drawIsoLine(buf, 26, 20, 8, 'right-up', '#94a3b8');

  buf.outline();

  // Se rot === 1, espelha o gabinete primeiro e desenha o badge LIVE sem espelhar!
  const finalBuf = rot === 1 ? buf.flipped() : buf;

  // Indicador LIVE piscando (sempre legível)
  const liveOn = frame % 2 === 0;
  const lx = rot === 1 ? 18 : 42;
  const ly = 11;
  finalBuf.rect(lx, ly, 9, 5, '#1e293b');
  finalBuf.set(lx + 1, ly + 2, liveOn ? '#ef4444' : '#7f1d1d');
  finalBuf.set(lx + 2, ly + 2, liveOn ? '#fca5a5' : '#991b1b');
  // Mini-letras "LV"
  finalBuf.vline(lx + 4, ly + 1, ly + 3, '#ffffff');
  finalBuf.set(lx + 5, ly + 3, '#ffffff');
  finalBuf.vline(lx + 7, ly + 1, ly + 3, '#38bdf8');

  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 8. CONF_TABLE — Mesa de Reunião Mogno (2x1 tiles, 58x44 px)
// ============================================================================
function buildConfTable(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(58, 44);
  const ax = 22;
  const ay = 40;

  buf.shadow(29, 34, 23, 9, '#0f172a', 0.28);

  const darkMahogany = {
    top: '#78350f',
    left: '#451a03',
    right: '#270e02',
    lt: '#92400e',
  };

  // 2 Colunas de sustentação robustas com base dourada
  drawIsoPrism(buf, 22, 37, 6, 6, 12, darkMahogany);
  drawIsoPrism(buf, 38, 29, 6, 6, 12, darkMahogany);
  drawIsoLine(buf, 21, 36, 5, 'left-up', '#fbbf24');
  drawIsoLine(buf, 22, 36, 5, 'right-up', '#d97706');
  drawIsoLine(buf, 37, 28, 5, 'left-up', '#fbbf24');
  drawIsoLine(buf, 38, 28, 5, 'right-up', '#d97706');

  // Tampo grande de mogno polido com veios de madeira (wx=14, wy=28, h=4)
  drawIsoPrism(
    buf,
    22,
    28,
    14,
    28,
    4,
    {
      top: '#9a3412',
      left: '#7c2d12',
      right: '#431407',
      lt: '#ea580c',
    },
    {
      woodGrainTop: true,
      woodColor: '#7c2d12',
    },
  );

  // Faixa central executiva dourada/bordô ao longo da mesa
  for (let i = 4; i < 24; i++) {
    const rx = 16 + i;
    const ry = 21 - Math.floor(i / 2);
    buf.set(rx, ry, '#fbbf24');
    buf.set(rx, ry + 1, '#881337');
    buf.set(rx + 1, ry + 1, '#9f1239');
    buf.set(rx + 1, ry + 2, '#d97706');
  }

  // Notebook aberto sobre a mesa
  // Base do teclado
  buf.rect(21, 17, 5, 3, '#94a3b8');
  buf.hline(22, 25, 18, '#334155');
  // Tela aberta iluminada
  buf.rect(20, 13, 5, 4, '#1e293b');
  buf.rect(21, 14, 3, 2, '#38bdf8');
  buf.set(21, 14, '#ffffff');

  // Folhas de relatório pixeladas + gráfico impresso
  buf.rect(31, 12, 5, 3, '#f8fafc');
  buf.hline(32, 34, 13, '#64748b');
  buf.set(32, 14, '#ef4444');
  buf.set(34, 14, '#22c55e');

  buf.rect(26, 19, 4, 3, '#ffffff');
  buf.hline(27, 29, 20, '#94a3b8');

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 9. ARCADE_CAB — Fliperama PixArcade 16-Bit (1x1 tile, 40x56 px)
// ============================================================================
function buildArcadeCab(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(40, 56);
  const ax = 20;
  const ay = 50;

  buf.shadow(20, 45, 15, 7, '#0f172a', 0.3);

  const purpleCab = {
    top: '#8b5cf6',
    left: '#6d28d9',
    right: '#4c1d95',
    lt: '#c084fc',
  };

  // Base inferior do gabinete arcade (wx=11, wy=11, h=18)
  drawIsoPrism(buf, 20, 48, 11, 11, 18, purpleCab);

  // Faixa lateral neon rosa/ciano na face esquerda
  drawIsoLine(buf, 18, 37, 8, 'left-up', '#f472b6');
  drawIsoLine(buf, 18, 38, 8, 'left-up', '#38bdf8');

  // Ficheiro iluminado embaixo (coin door)
  for (let dx = 3; dx <= 7; dx++) {
    const x = 20 + dx;
    const y = 43 - Math.floor(dx / 2);
    buf.vline(x, y - 5, y, '#0f172a');
  }
  buf.set(24, 39, '#f97316'); // entrada de ficha laranja neon
  buf.set(26, 38, '#f97316');

  // Painel de controle saliente (control deck)
  drawIsoPrism(buf, 21, 31, 11, 12, 3, {
    top: '#1e1b4b',
    left: '#4c1d95',
    right: '#2e1065',
    lt: '#f472b6',
  });

  // Joystick com bolinha vermelha + botões arcade coloridos
  buf.vline(21, 25, 27, '#cbd5e1'); // haste
  buf.rect(20, 24, 2, 2, '#ef4444'); // bolinha vermelha
  buf.set(20, 24, '#fca5a5');
  // Botões
  buf.set(24, 26, '#facc15');
  buf.set(26, 25, '#22c55e');
  buf.set(25, 27, '#38bdf8');

  // Corpo superior recuado com tela CRT inclinada
  drawIsoPrism(buf, 19, 27, 10, 10, 12, purpleCab);

  // Tela CRT escura na face frontal-direita
  for (let dx = 1; dx <= 8; dx++) {
    const x = 19 + dx;
    const yTop = 17 - Math.floor(dx / 2);
    buf.vline(x, yTop, yTop + 7, '#090d16');
  }

  // Nave / Alien pixelado que se move conforme frame % 4
  const f = frame % 4;
  const shipX = 21 + f;
  const shipY = 19 - Math.floor(f / 2);
  // Alien rosa no topo da tela
  buf.rect(25 - (f % 2), 15, 2, 2, '#f472b6');
  // Nave verde + tiro laser amarelo
  buf.rect(shipX, shipY, 2, 2, '#22c55e');
  buf.set(shipX + 1, shipY - 2, '#facc15');

  // Marquee iluminado amarelo/rosa no topo
  drawIsoPrism(buf, 20, 15, 11, 10, 4, {
    top: '#f472b6',
    left: '#db2777',
    right: '#facc15',
    lt: '#fde047',
  });
  // Detalhe luminoso no marquee
  drawIsoLine(buf, 21, 13, 8, 'right-up', frame % 2 === 0 ? '#ffffff' : '#f43f5e');

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 10. PALM_PLANT — Palmeira Imperial em Vaso (1x1 tile, 36x48 px)
// ============================================================================
function buildPalmPlant(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(36, 48);
  const ax = 18;
  const ay = 43;

  buf.shadow(18, 39, 11, 5, '#0f172a', 0.25);

  const terra = {
    top: '#ea580c',
    left: '#c2410c',
    right: '#9a3412',
    lt: '#fb923c',
  };

  // Vaso quadrado de terracota (base)
  drawIsoPrism(buf, 18, 42, 7, 7, 9, terra);
  // Borda superior grossa do vaso
  drawIsoPrism(buf, 18, 33, 8, 8, 2, {
    top: '#f97316',
    left: '#ea580c',
    right: '#9a3412',
    lt: '#fdba74',
  });

  // Terra escura dentro do vaso
  drawIsoPrism(buf, 18, 31, 6, 6, 1, {
    top: '#451a03',
    left: '#451a03',
    right: '#270e02',
    lt: '#78350f',
  });

  // Tronco anelado de palmeira imperial subindo do centro (x=17..19, y=17..30)
  for (let y = 17; y <= 30; y++) {
    const ring = y % 2 === 0;
    buf.set(17, y, ring ? '#b45309' : '#92400e');
    buf.set(18, y, ring ? '#92400e' : '#78350f');
    buf.set(19, y, ring ? '#78350f' : '#451a03');
  }

  // Coroa exuberante de folhas de palmeira arqueadas em 4 tons de verde:
  // #14532d (sombra profunda), #15803d (médio escuro), #22c55e (vivo), #86efac (brilho)
  const fronds: Array<{ dx: number; dy: number; len: number; droop: number; bright: boolean }> = [
    { dx: -1, dy: -0.5, len: 12, droop: 0.42, bright: false },
    { dx: 1, dy: -0.5, len: 12, droop: 0.42, bright: false },
    { dx: -1, dy: 0.15, len: 13, droop: 0.55, bright: true },
    { dx: 1, dy: 0.15, len: 13, droop: 0.55, bright: true },
    { dx: -0.6, dy: -0.9, len: 10, droop: 0.35, bright: true },
    { dx: 0.6, dy: -0.9, len: 10, droop: 0.35, bright: true },
    { dx: 0, dy: -1, len: 8, droop: 0.2, bright: true },
  ];

  for (const f of fronds) {
    for (let s = 1; s <= f.len; s++) {
      const t = s / f.len;
      const px = Math.round(18 + f.dx * s);
      const py = Math.round(17 + f.dy * s + t * t * f.len * f.droop);

      // Nervura central iluminada
      buf.set(px, py, f.bright ? '#86efac' : '#22c55e');
      buf.set(px, py - 1, f.bright ? '#22c55e' : '#15803d');

      // Folíolos recortados pixel a pixel (alternados para efeito pinnate)
      if (s % 2 === 1 && s > 2) {
        buf.set(px, py + 1, '#15803d');
        buf.set(px, py + 2, '#14532d');
      } else if (s > 1) {
        buf.set(px, py + 1, '#22c55e');
      }
    }
  }

  // Miolo da coroa
  buf.rect(17, 15, 3, 3, '#15803d');
  buf.set(18, 15, '#86efac');

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 11. RUG_VIP — Tapete Persa PixRoyal (2x2 tiles, 68x38 px)
// ============================================================================
function buildRugVip(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(68, 38);
  const cx = 34;
  const cy = 19;
  const rx = 30;
  const ry = 15;

  // Sombra de contato rente ao chão sob as bordas do tapete
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const d = Math.abs(x - cx) / rx + Math.abs(y - cy) / ry;
      if (d <= 1.06 && d > 0.98) {
        buf.under(x, y + 1, 'rgba(15, 23, 42, 0.28)');
      }
    }
  }

  // Tecido isométrico 2:1 com moldura geométrica real e medalhão central em dithering Bayer
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const d = dx / rx + dy / ry;

      if (d > 1.0) {
        // Franjas douradas (#fde68a) nas bordas externas do tapete
        if (d <= 1.08 && ((x + y) & 1) === 0) {
          buf.set(x, y, '#fde68a');
        }
        continue;
      }

      const bayer = ((x & 1) + ((y & 1) << 1)) % 2 === 0;
      let col = '#881337'; // bordô imperial profundo

      if (d > 0.9) {
        // Borda externa azul-marinho/ouro
        col = '#1e1b4b';
      } else if (d > 0.8) {
        // Moldura geométrica dourada real
        col = ((x + y) % 3 === 0) ? '#fde68a' : '#d97706';
      } else if (d > 0.72) {
        col = '#4c0519';
      } else if (d > 0.38) {
        // Campo principal bordô com padrão persa em dithering
        col = bayer ? '#9f1239' : '#881337';
        if ((dx + dy * 2) % 6 === 0) {
          col = '#be123c';
        }
      } else if (d > 0.24) {
        // Anel do medalhão central em ouro
        col = bayer ? '#fbbf24' : '#d97706';
      } else {
        // Coração do medalhão real
        col = bayer ? '#fde68a' : '#be123c';
      }

      buf.set(x, y, col);
    }
  }

  // Sem buf.outline() no tapete para que fique perfeitamente rente ao chão!
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: cx,
    anchorY: cy,
  };
}

// ============================================================================
// CACHE & EXPORTAÇÃO PRINCIPAL
// ============================================================================

const spriteCache = new Map<string, PixFurniSprite>();

export function getPixFurniSprite(type: string, rot: 0 | 1, frame: number): PixFurniSprite {
  // Normaliza o frame apenas para mobis animados (0..3) para maximizar reuso de cache
  const isAnimated =
    type === 'dev_desk' ||
    type === 'espresso_bar' ||
    type === 'vending_drinks' ||
    type === 'server_rack' ||
    type === 'holo_screen' ||
    type === 'arcade_cab';
  const normFrame = isAnimated ? ((Math.floor(frame) % 4) + 4) % 4 : 0;
  const key = `${type}|${rot}|${normFrame}`;

  const cached = spriteCache.get(key);
  if (cached) return cached;

  let sprite: PixFurniSprite;
  switch (type) {
    case 'club_sofa':
      sprite = buildClubSofa(rot);
      break;
    case 'dev_desk':
      sprite = buildDevDesk(rot, normFrame);
      break;
    case 'exec_chair':
      sprite = buildExecChair(rot);
      break;
    case 'espresso_bar':
      sprite = buildEspressoBar(rot, normFrame);
      break;
    case 'vending_drinks':
      sprite = buildVendingDrinks(rot, normFrame);
      break;
    case 'server_rack':
      sprite = buildServerRack(rot, normFrame);
      break;
    case 'holo_screen':
      sprite = buildHoloScreen(rot, normFrame);
      break;
    case 'conf_table':
      sprite = buildConfTable(rot);
      break;
    case 'arcade_cab':
      sprite = buildArcadeCab(rot, normFrame);
      break;
    case 'palm_plant':
      sprite = buildPalmPlant(rot);
      break;
    case 'rug_vip':
      sprite = buildRugVip(rot);
      break;
    default:
      sprite = buildClubSofa(rot);
      break;
  }

  spriteCache.set(key, sprite);
  return sprite;
}
