// Habbo Hotel Classic Pixel Art Furni Generator (2005–2009 Style) — Rodada 2 HD Polish
// Desenha pixel a pixel em resolução nativa 1x (para renderização com imageSmoothingEnabled = false em 2 * zoom)
// todos os 11 Mobis isométricos 2:1 do quarto corporativo PixOffice.

import { mix, ramp, shade } from '../art/core/color';
import { PixelBuf } from '../art/core/pixbuf';
import { PIX_PALETTE } from './habbo-pix-palette';

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
    const yFront =
      x < cx
        ? topCy - Math.floor((cx - 1 - x) / 2)
        : topCy - Math.floor((x - cx) / 2);
    const yBack =
      x < backX
        ? backY + Math.floor((backX - 1 - x) / 2)
        : backY + Math.floor((x - backX) / 2);

    for (let y = yBack; y <= yFront; y++) {
      let col = pal.top;
      if (opts.woodGrainTop && opts.woodColor) {
        if (((x + y * 2) % 6 === 0) || ((x - y * 2) % 9 === 0)) {
          col = opts.woodColor;
        }
      }
      buf.set(x, y, col);
    }
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
// 1. CLUB_SOFA — Sofá PixClub VIP (2x1 tiles, 58x48 px)
// Braços laterais arredondados e volumosos com medalhão dourado na frente,
// encosto curvo acolchoado com capitonê profundo e almofadas com brilho especular.
// ============================================================================
function buildClubSofa(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(58, 48);
  const ax = 23;
  const ay = 44;

  // Sombra de contato 2:1 ampla no chão
  buf.shadow(28, 36, 23, 9, '#0f172a', 0.3);

  const velvet = {
    top: '#be123c',
    left: '#9f1239',
    right: '#881337',
    lt: '#f43f5e',
  };
  const velvetDeep = {
    top: '#9f1239',
    left: '#881337',
    right: '#4c0519',
    lt: '#e11d48',
  };
  const gold = ramp('#fbbf24', 0.1);
  const wood = ramp('#78350f', 0.08);

  // 4 Pés de madeira torneados com ponteiras de latão dourado
  const feet: Array<[number, number]> = [
    [10, 36], // esquerda-trás
    [23, 43], // frente-baixo
    [37, 36], // meio-direita
    [50, 29], // direita-frente
  ];
  for (const [fx, fy] of feet) {
    buf.rect(fx - 1, fy - 3, 3, 2, wood.base);
    buf.set(fx - 1, fy - 3, wood.lt);
    buf.hline(fx - 1, fx + 1, fy - 1, gold.base);
    buf.set(fx, fy - 1, gold.hi);
  }

  // Saia / Base estofada inferior bordô imperial (2x1 tiles: wx=14, wy=28, h=5)
  drawIsoPrism(buf, 23, 41, 14, 28, 5, velvetDeep);

  // Friso frontal dourado real com gemas de brilho especular
  drawIsoLine(buf, 22, 39, 13, 'left-up', gold.base);
  drawIsoLine(buf, 23, 39, 27, 'right-up', gold.base);
  for (let gx = 23; gx <= 47; gx += 4) {
    buf.set(gx, 39 - Math.floor((gx - 23) / 2), gold.hi);
  }

  // --- Braço Lateral Traseiro-Direito Volumoso & Arredondado (Rolled Armrest) ---
  drawIsoPrism(buf, 47, 29, 13, 6, 9, velvet);
  // Topo abaulado do braço direito (camada superior arredondada)
  drawIsoPrism(buf, 46, 20, 12, 4, 2, {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  });
  // Medalhão dourado imperial cravado na face frontal do braço direito
  buf.rect(47, 21, 3, 4, gold.dk);
  buf.rect(48, 22, 2, 2, gold.base);
  buf.set(48, 22, gold.hi);

  // --- Encosto Alto Curvo Acolchoado em Capitonê (Tufted Backrest) ---
  drawIsoPrism(buf, 15, 32, 6, 28, 16, velvet);
  // Crista superior curva acolchoada do encosto (2 gomos macios)
  drawIsoPrism(buf, 15, 16, 4, 13, 2, {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  });
  drawIsoPrism(buf, 28, 9, 4, 13, 2, {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  });

  // Textura Capitonê (Tufted) rica no encosto: sulcos diagonais + 5 botões dourados afundados
  const tuftedButtons: Array<[number, number]> = [
    [19, 19],
    [24, 16],
    [29, 14],
    [34, 11],
    [39, 9],
  ];
  for (const [bx, by] of tuftedButtons) {
    // Losango de sombra do estofado
    buf.set(bx - 1, by - 1, '#4c0519');
    buf.set(bx + 1, by - 1, '#4c0519');
    buf.set(bx - 1, by + 1, '#4c0519');
    buf.set(bx, by - 2, '#6b0722');
    // Volume iluminado abaixo do botão
    buf.set(bx + 1, by + 1, '#f43f5e');
    buf.set(bx, by + 1, '#fda4af');
    // Botão dourado cravado
    buf.set(bx, by, gold.hi);
    buf.set(bx, by - 1, '#3b0413');
  }

  // --- 2 Almofadas de Assento Estofadas com Brilho Especular na Quina Frontal ---
  const cushionPal = {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  };
  // Almofada Direita-Superior
  drawIsoPrism(buf, 36, 30, 9, 11, 5, cushionPal);
  drawIsoLine(buf, 36, 25, 10, 'right-up', '#ffe4e6'); // brilho especular na quina frontal
  // Almofada Esquerda-Inferior
  drawIsoPrism(buf, 25, 35, 9, 11, 5, cushionPal);
  drawIsoLine(buf, 25, 30, 10, 'right-up', '#ffe4e6'); // brilho especular na quina frontal
  // Costura profunda separando os 2 assentos
  drawIsoLine(buf, 35, 26, 8, 'left-up', '#4c0519');
  buf.vline(35, 26, 30, '#4c0519');

  // --- Braço Lateral Frontal-Esquerdo Volumoso & Arredondado (Rolled Armrest) ---
  drawIsoPrism(buf, 23, 41, 14, 6, 9, velvet);
  // Topo abaulado do braço esquerdo (rolo estofado macio)
  drawIsoPrism(buf, 22, 32, 13, 4, 2, {
    top: '#e11d48',
    left: '#be123c',
    right: '#9f1239',
    lt: '#fda4af',
  });
  // Brilho especular ao longo do rolo do braço
  drawIsoLine(buf, 21, 30, 11, 'left-up', '#ffe4e6');
  // Medalhão dourado imperial na frente do braço esquerdo
  buf.rect(23, 33, 3, 4, gold.dk);
  buf.rect(24, 34, 2, 2, gold.base);
  buf.set(24, 34, gold.hi);

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 2. DEV_DESK — Bancada Dual-Monitor Dev + Gabinete PC Gamer RGB (1x1 tile, 48x50 px)
// Tampo de carvalho largo com borda chanfrada clara, Gabinete PC Workstation com
// vidro temperado e LED RGB interno animado, 2 monitores widescreen moldura fina,
// teclado mecânico RGB, mousepad e caneca fumegante.
// ============================================================================
function buildDevDesk(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(48, 50);
  const ax = 24;
  const ay = 44;

  buf.shadow(24, 39, 19, 8, '#0f172a', 0.28);

  const f = frame % 4;
  const rgbCycle = ['#22c55e', '#38bdf8', '#f472b6', '#a855f7'];
  const rgbCol1 = rgbCycle[f];
  const rgbCol2 = rgbCycle[(f + 1) % 4];
  const rgbCol3 = rgbCycle[(f + 2) % 4];

  const steel = {
    top: '#cbd5e1',
    left: '#94a3b8',
    right: '#475569',
    lt: '#f8fafc',
  };

  // Perna lateral esquerda em aço escovado com sapata preta
  drawIsoPrism(buf, 11, 38, 3, 3, 13, steel);
  buf.rect(9, 37, 3, 2, '#0f172a');
  // Calha organizadora de cabos sob o tampo
  drawIsoLine(buf, 12, 33, 15, 'right-up', '#334155');

  // --- Gabinete PC Gamer / Workstation sob o lado direito da bancada ---
  // Chassis em aço grafite escuro (wx=10, wy=7, h=13)
  drawIsoPrism(buf, 31, 42, 10, 7, 13, {
    top: '#334155',
    left: '#1e293b',
    right: '#0f172a',
    lt: '#64748b',
  });
  // Janela lateral esquerda de vidro temperado mostrando cooler RGB e GPU iluminada
  for (let dx = 2; dx <= 7; dx++) {
    const gx = 31 - dx;
    const gyBot = 40 - Math.floor(dx / 2);
    buf.vline(gx, gyBot - 8, gyBot - 1, '#091024');
  }
  // Cooler CPU circular RGB + placa de vídeo iluminada lá dentro
  buf.rect(25, 32, 3, 3, rgbCol1);
  buf.set(26, 33, '#ffffff'); // núcleo brilhante do cooler
  buf.hline(24, 28, 36, rgbCol2); // barra LED da GPU RTX
  // Reflexo diagonal de vidro na janela do gabinete
  buf.set(28, 31, 'rgba(255,255,255,0.65)');
  buf.set(27, 32, 'rgba(255,255,255,0.65)');
  // Fita LED frontal na face direita do gabinete + botão power
  buf.vline(34, 30, 38, rgbCol3);
  buf.set(33, 29, '#22c55e');

  // --- Tampo Largo de Carvalho Claro com Veios de Madeira e Borda Chanfrada Clara ---
  drawIsoPrism(
    buf,
    24,
    31,
    16,
    18,
    3,
    {
      top: '#eac896',
      left: '#d4a66a',
      right: '#a67942',
      lt: '#fff1d6',
    },
    {
      woodGrainTop: true,
      woodColor: '#d1a368',
    },
  );
  // Chanfro duplo extra claro na quina frontal do tampo
  drawIsoLine(buf, 23, 28, 15, 'left-up', '#fffbeb');
  drawIsoLine(buf, 24, 28, 17, 'right-up', '#fde68a');

  // --- Pedestais Metálicos Articulados para os 2 Monitores Widescreen ---
  buf.rect(17, 21, 2, 4, '#475569');
  buf.hline(15, 19, 25, '#94a3b8');
  buf.rect(29, 18, 2, 4, '#475569');
  buf.hline(27, 31, 22, '#94a3b8');

  // --- Monitor 1 (Esquerdo Widescreen — Moldura Fina) ---
  buf.rect(9, 11, 15, 11, '#1e293b');
  buf.hline(9, 23, 11, '#94a3b8'); // chanfro superior metálico
  buf.vline(9, 11, 21, '#64748b');
  buf.rect(10, 12, 13, 9, '#090f1d'); // display IPS alta densidade
  buf.hline(10, 22, 12, '#1e3a8a'); // barra de título da IDE
  buf.set(22, 21, '#22c55e'); // LED power

  // --- Monitor 2 (Direito Widescreen — Moldura Fina) ---
  buf.rect(24, 8, 15, 11, '#1e293b');
  buf.hline(24, 38, 8, '#94a3b8');
  buf.vline(24, 8, 18, '#64748b');
  buf.rect(25, 9, 13, 9, '#090f1d');
  buf.hline(25, 37, 9, '#1e3a8a'); // barra de título do terminal/dashboard
  buf.set(37, 18, '#22c55e');

  // --- Código Colorido Animado em Alta Definição nos 2 Monitores ---
  const codePalette = ['#22c55e', '#38bdf8', '#facc15', '#f472b6'];
  // Monitor 1: Sidebar + indentação de código
  buf.vline(11, 13, 20, '#334155');
  buf.hline(13, 17 + (f % 3), 14, codePalette[f % 4]);
  buf.hline(14, 20, 15, codePalette[(f + 1) % 4]);
  buf.hline(14, 18 + ((f + 1) % 3), 17, codePalette[(f + 2) % 4]);
  buf.hline(13, 21, 18, codePalette[(f + 3) % 4]);
  buf.hline(15, 19, 19, '#a855f7');

  // Monitor 2: Código + mini-gráfico de telemetria à direita
  buf.hline(26, 31 + (f % 2), 11, codePalette[(f + 1) % 4]);
  buf.hline(27, 33, 12, codePalette[(f + 2) % 4]);
  buf.hline(26, 30 + ((f + 2) % 3), 14, codePalette[(f + 3) % 4]);
  buf.hline(27, 32, 15, codePalette[f % 4]);
  // Mini barras de build no canto do Monitor 2
  buf.vline(35, 14 - (f % 2), 16, '#22c55e');
  buf.vline(36, 12, 16, '#38bdf8');

  // --- Teclado Mecânico Custom com Underglow RGB e Keycaps ---
  buf.rect(18, 23, 10, 4, '#1e293b');
  buf.hline(18, 27, 26, rgbCol1); // borda inferior iluminada RGB
  for (let kx = 19; kx <= 26; kx += 2) {
    buf.set(kx, 23, '#f8fafc');
    buf.set(kx - 1, 24, '#cbd5e1');
  }
  buf.set(19, 23, '#ef4444'); // tecla ESC vermelha
  buf.hline(21, 24, 25, '#38bdf8'); // spacebar ciano

  // --- Mousepad Deskmat Escuro + Mouse Sem Fio ---
  buf.rect(29, 21, 5, 4, '#1e3a8a');
  buf.hline(29, 33, 24, '#38bdf8');
  buf.rect(30, 22, 2, 2, '#f8fafc');
  buf.set(30, 22, '#22c55e'); // scroll LED

  // --- Caneca de Café Vermelha na Esquerda ---
  buf.rect(12, 22, 3, 4, '#ef4444');
  buf.hline(12, 14, 22, '#fee2e2');
  buf.set(13, 22, '#451a03'); // espresso escuro
  buf.set(11, 23, '#dc2626'); // alça
  buf.set(11, 24, '#b91c1c');

  buf.outline();

  // Vapor fumegante subindo da caneca
  const sy = 20 - (f % 2);
  buf.set(13, sy, 'rgba(255,255,255,0.85)');
  buf.set(12 + (f % 2), sy - 2, 'rgba(255,255,255,0.6)');
  buf.set(14 - (f % 2), sy - 3, 'rgba(255,255,255,0.4)');

  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 3. EXEC_CHAIR — Poltrona Executiva Mesh (1x1 tile, 34x40 px)
// Vista 3/4 traseira/lateral rica para quando o agente senta olhando para a bancada (NW):
// coluna vertebral ergonômica preta/cromada ("spine"), suporte lombar, estofado azul royal,
// braços curvos e base estrela de 5 rodízios bem nítida.
// ============================================================================
function buildExecChair(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(34, 40);
  const ax = 17;
  const ay = 36;

  buf.shadow(17, 33, 11, 5, '#0f172a', 0.28);

  // --- Base Estrela de 5 Pontas Cromada/Preta com 5 Rodízios Duplos Nítidos ---
  buf.hline(9, 25, 32, '#1e293b');
  buf.hline(13, 21, 31, '#94a3b8'); // anel central cromado
  buf.line(17, 31, 9, 34, '#334155');
  buf.line(17, 31, 25, 34, '#334155');
  buf.line(17, 31, 13, 36, '#1e293b');
  buf.line(17, 31, 21, 36, '#1e293b');

  const casters: Array<[number, number]> = [
    [9, 34],
    [13, 36],
    [17, 35],
    [21, 36],
    [25, 34],
  ];
  for (const [cx, cy] of casters) {
    buf.rect(cx - 1, cy, 2, 2, '#0f172a');
    buf.set(cx, cy - 1, '#cbd5e1'); // garfo cromado do rodízio
  }

  // Pistão pneumático telescópico cromado
  buf.vline(16, 26, 31, '#e2e8f0');
  buf.vline(17, 26, 31, '#475569');
  buf.set(16, 28, '#ffffff');

  // --- Assento Anatômico Azul Royal com Borda Frontal Chanfrada ---
  const royalBlue = {
    top: '#2563eb',
    left: '#1d4ed8',
    right: '#1e3a8a',
    lt: '#60a5fa',
  };
  drawIsoPrism(buf, 17, 27, 8, 8, 3, royalBlue);

  // Braço Curvo Direito (atrás)
  buf.vline(24, 18, 24, '#1e293b');
  buf.hline(21, 25, 18, '#334155');
  buf.hline(22, 24, 17, '#94a3b8'); // almofada superior do braço

  // --- Encosto Alto Ergonômico em Mesh Azul Royal com Moldura Curva ---
  drawIsoPrism(
    buf,
    14,
    23,
    4,
    8,
    13,
    {
      top: '#3b82f6',
      left: '#1d4ed8',
      right: '#172554',
      lt: '#93c5fd',
    },
    {
      ditherLeft: '#1e3a8a',
      ditherRight: '#0f172a',
    },
  );

  // --- Coluna Vertebral Ergonômica Externa ("Exoskeleton Spine" Preta/Cromada) ---
  // Suporte lombar horizontal abraçando o encosto
  drawIsoLine(buf, 13, 18, 4, 'left-up', '#1e293b');
  drawIsoLine(buf, 14, 18, 7, 'right-up', '#334155');
  // Eixo central cromado/preto subindo da base do assento até o apoio de cabeça
  buf.vline(13, 11, 24, '#0f172a');
  buf.vline(14, 11, 24, '#cbd5e1');
  buf.set(14, 15, '#ffffff'); // articulação cromada da coluna
  buf.set(14, 19, '#ffffff');

  // --- Apoio de Cabeça Anatômico no Topo ---
  drawIsoPrism(buf, 14, 10, 4, 7, 3, {
    top: '#3b82f6',
    left: '#2563eb',
    right: '#1e3a8a',
    lt: '#93c5fd',
  });

  // Braço Curvo Esquerdo (frente) com acabamento cromado
  buf.vline(11, 20, 26, '#334155');
  buf.vline(12, 21, 26, '#94a3b8');
  buf.hline(9, 13, 20, '#1e293b');
  buf.hline(10, 12, 19, '#e2e8f0');

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 4. ESPRESSO_BAR — Máquina Espresso Barista + Moedor de Grãos (1x1 tile, 42x48 px)
// Balcão de mogno com tampo de mármore/inox, Máquina Italiana Vermelha/Cromada,
// Moedor de Café com cúpula transparente cheia de grãos marrons ao lado,
// manômetro, 2 portafiltros, xícaras empilhadas e vapor animado.
// ============================================================================
function buildEspressoBar(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(42, 48);
  const ax = 21;
  const ay = 43;

  buf.shadow(21, 38, 16, 7, '#0f172a', 0.28);

  // Balcão de mogno com prateleira frontal e friso dourado
  const mahogany = {
    top: '#92400e',
    left: '#78350f',
    right: '#451a03',
    lt: '#b45309',
  };
  drawIsoPrism(buf, 21, 40, 12, 12, 14, mahogany);
  drawIsoLine(buf, 20, 33, 10, 'left-up', '#fbbf24');
  drawIsoLine(buf, 21, 33, 10, 'right-up', '#d97706');

  // Tampo de mármore Carrara & Inox polido
  drawIsoPrism(buf, 21, 26, 13, 13, 2, {
    top: '#f8fafc',
    left: '#cbd5e1',
    right: '#94a3b8',
    lt: '#ffffff',
  });

  // --- Moedor de Grãos de Café Barista (à esquerda sobre o balcão) ---
  // Base metálica do moedor
  drawIsoPrism(buf, 14, 23, 3, 3, 5, {
    top: '#64748b',
    left: '#475569',
    right: '#1e293b',
    lt: '#94a3b8',
  });
  // Cúpula transparente (Hopper) cheia de grãos de café torrados marrons
  buf.rect(12, 13, 5, 5, '#bae6fd'); // vidro translúcido
  buf.rect(13, 15, 3, 3, '#78350f'); // massa de grãos
  buf.set(13, 15, '#b45309'); // grão claro
  buf.set(15, 16, '#451a03'); // grão escuro
  buf.set(14, 14, '#92400e');
  buf.set(12, 14, '#ffffff'); // reflexo da cúpula
  buf.hline(12, 16, 12, '#334155'); // tampa preta da cúpula

  // Bandeja pingadeira de inox na frente da cafeteira
  drawIsoPrism(buf, 23, 23, 6, 7, 1, {
    top: '#94a3b8',
    left: '#64748b',
    right: '#475569',
    lt: '#e2e8f0',
  });

  // --- Cafeteira Italiana Vermelha & Cromada Principal ---
  const crimson = {
    top: '#ef4444',
    left: '#dc2626',
    right: '#991b1b',
    lt: '#fca5a5',
  };
  drawIsoPrism(buf, 22, 22, 7, 8, 10, crimson);

  // Topo cromado aquecedor de xícaras com grade protetora
  drawIsoPrism(buf, 22, 12, 7, 8, 2, {
    top: '#e2e8f0',
    left: '#cbd5e1',
    right: '#94a3b8',
    lt: '#ffffff',
  });

  // Manômetro circular 3x3 px com aro cromado e ponteiro vermelho
  buf.rect(18, 14, 3, 3, '#f8fafc');
  buf.set(19, 15, '#ef4444');
  buf.set(18, 14, '#64748b');

  // 2 Cachimbos (Portafiltros) cromados com cabos pretos
  buf.rect(22, 17, 2, 2, '#cbd5e1');
  buf.hline(20, 21, 18, '#0f172a');
  buf.rect(26, 15, 2, 2, '#cbd5e1');
  buf.hline(28, 29, 16, '#0f172a');

  // Xícaras brancas de espresso servidas na bandeja + pilhas de xícaras no aquecedor
  buf.rect(22, 20, 2, 2, '#ffffff');
  buf.set(22, 20, '#78350f'); // crema do café
  buf.rect(26, 18, 2, 2, '#ffffff');
  // Pilha dupla de xícaras brancas no topo
  buf.rect(19, 7, 2, 3, '#ffffff');
  buf.set(19, 8, '#cbd5e1');
  buf.rect(22, 6, 2, 3, '#f8fafc');
  buf.set(22, 7, '#cbd5e1');
  buf.rect(25, 7, 2, 2, '#ffffff');

  buf.outline();

  // Puffs de vapor branco perfumado subindo conforme frame % 4
  const f = frame % 4;
  const puffY = 5 - f;
  buf.rect(22, puffY, 2, 2, 'rgba(255,255,255,0.88)');
  buf.set(20 + (f % 2), puffY - 2, 'rgba(255,255,255,0.68)');
  buf.set(24 - (f % 2), puffY - 3, 'rgba(255,255,255,0.48)');

  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 5. VENDING_DRINKS — Máquina PixCola Neon (1x1 tile, 40x56 px)
// Letreiro superior arredondado vermelho/ciano estilo retrô com pixels escritos,
// vitrine rica com fileiras de latinhas contrastadas e grade de ventilação na base.
// ============================================================================
function buildVendingDrinks(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(40, 56);
  const ax = 20;
  const ay = 50;

  buf.shadow(20, 45, 15, 7, '#0f172a', 0.3);

  // Pés niveladores
  buf.rect(10, 42, 2, 2, '#0f172a');
  buf.rect(19, 46, 2, 2, '#0f172a');
  buf.rect(28, 42, 2, 2, '#0f172a');

  // Gabinete alto azul/ciano
  const cabinet = {
    top: '#38bdf8',
    left: '#0284c7',
    right: '#0369a1',
    lt: '#7dd3fc',
  };
  drawIsoPrism(buf, 20, 47, 11, 11, 31, cabinet);

  // --- Domo / Letreiro Superior Arredondado Vermelho/Ciano Retrô com Pixels Escritos ---
  drawIsoPrism(buf, 20, 16, 10, 10, 4, {
    top: '#f43f5e',
    left: '#e11d48',
    right: '#be123c',
    lt: '#fda4af',
  });
  // Crista arredondada no topo do domo
  drawIsoPrism(buf, 20, 12, 8, 8, 2, {
    top: '#fb7185',
    left: '#f43f5e',
    right: '#e11d48',
    lt: '#ffe4e6',
  });
  // Moldura ciano neon + pixels escritos "PIX" brilhando no letreiro
  const neonOn = frame % 2 === 0;
  drawIsoLine(buf, 20, 16, 9, 'right-up', '#38bdf8');
  drawIsoLine(buf, 20, 12, 9, 'right-up', neonOn ? '#fde047' : '#7dd3fc');
  // Letras pixeladas brancas/amarelas no letreiro vermelho
  buf.set(22, 14, '#ffffff');
  buf.set(22, 13, '#ffffff');
  buf.set(24, 13, neonOn ? '#fde047' : '#ffffff');
  buf.set(26, 12, '#ffffff');
  buf.set(27, 11, '#ffffff');

  // --- Vitrine de Vidro Iluminada com Fileiras de Latinhas Bem Contrastadas ---
  for (let dx = 1; dx <= 6; dx++) {
    const x = 20 + dx;
    const yTop = 21 - Math.floor(dx / 2);
    buf.vline(x, yTop, yTop + 14, '#082f49'); // fundo escuro contrastado da vitrine
    buf.set(x, yTop, '#7dd3fc'); // iluminação LED de teto da vitrine
  }

  // 3 Fileiras de latinhas coloridas com anel prateado no topo
  const canColors = ['#ef4444', '#38bdf8', '#facc15', '#22c55e'];
  for (let row = 0; row < 3; row++) {
    const ry = 24 + row * 4;
    drawIsoLine(buf, 21, ry + 2, 6, 'right-up', '#94a3b8'); // prateleira cromada
    for (let c = 0; c < 3; c++) {
      const cx = 21 + c * 2;
      const cy = ry - c;
      const col = canColors[(row + c) % canColors.length];
      buf.set(cx, cy, '#ffffff'); // lacre prateado da latinha
      buf.set(cx, cy + 1, col); // corpo vibrante da lata
    }
  }
  // Reflexo diagonal branco no vidro da vitrine
  buf.set(22, 23, 'rgba(255,255,255,0.65)');
  buf.set(23, 22, 'rgba(255,255,255,0.65)');

  // Painel lateral de seleção com visor digital e botões iluminados
  buf.vline(28, 19, 32, '#0f172a');
  buf.set(28, 20, '#22c55e'); // display preço
  buf.set(28, 22, '#facc15'); // moedeiro
  buf.set(28, 24, '#ef4444');
  buf.set(28, 26, '#38bdf8');
  buf.set(28, 28, '#22c55e');

  // Abertura escura de retirada de latas
  for (let dx = 2; dx <= 8; dx++) {
    const x = 20 + dx;
    const y = 40 - Math.floor(dx / 2);
    buf.vline(x, y - 3, y, '#090d16');
    buf.set(x, y - 3, '#475569');
  }

  // --- Grade de Ventilação na Base (Esquerda e Direita) ---
  for (let gy = 41; gy <= 44; gy += 2) {
    drawIsoLine(buf, 18, gy, 7, 'left-up', '#0c4a6e');
    drawIsoLine(buf, 22, gy + 1, 6, 'right-up', '#082f49');
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

  buf.rect(10, 44, 2, 2, '#0f172a');
  buf.rect(19, 48, 2, 2, '#0f172a');
  buf.rect(28, 44, 2, 2, '#0f172a');

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

  buf.ellipse(20, 9, 4, 2, '#1e293b');
  buf.set(20, 9, '#38bdf8');

  const f = frame % 4;
  const ledColors = ['#22c55e', '#38bdf8', '#f59e0b', '#22c55e'];

  for (let b = 0; b < 6; b++) {
    const baseY = 20 + b * 5;
    for (let dx = 1; dx <= 9; dx++) {
      const x = 20 + dx;
      const y = baseY - Math.floor(dx / 2);
      buf.vline(x, y, y + 3, '#0f172a');
      buf.set(x, y, '#475569');
    }

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

  drawIsoPrism(buf, 24, 47, 10, 28, 3, alu);
  drawIsoLine(buf, 24, 45, 27, 'right-up', '#38bdf8');

  drawIsoPrism(buf, 28, 43, 3, 4, 8, alu);
  drawIsoPrism(buf, 44, 35, 3, 4, 8, alu);

  drawIsoPrism(buf, 22, 39, 4, 32, 24, {
    top: '#64748b',
    left: '#334155',
    right: '#0f172a',
    lt: '#38bdf8',
  });

  drawIsoLine(buf, 23, 16, 30, 'right-up', '#38bdf8');
  drawIsoLine(buf, 23, 37, 30, 'right-up', '#0284c7');
  buf.vline(23, 16, 37, '#38bdf8');
  buf.vline(52, 2, 23, '#38bdf8');

  for (let dx = 2; dx <= 29; dx++) {
    const x = 22 + dx;
    const yTop = 17 - Math.floor(dx / 2);
    const yBot = 36 - Math.floor(dx / 2);
    buf.vline(x, yTop, yBot, '#091024');
    if (dx % 5 === 0) {
      buf.vline(x, yTop + 1, yBot - 1, '#112240');
    }
  }

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

  drawIsoLine(buf, 26, 18, 12, 'right-up', '#38bdf8');
  drawIsoLine(buf, 26, 20, 8, 'right-up', '#94a3b8');

  buf.outline();

  const finalBuf = rot === 1 ? buf.flipped() : buf;

  const liveOn = frame % 2 === 0;
  const lx = rot === 1 ? 18 : 42;
  const ly = 11;
  finalBuf.rect(lx, ly, 9, 5, '#1e293b');
  finalBuf.set(lx + 1, ly + 2, liveOn ? '#ef4444' : '#7f1d1d');
  finalBuf.set(lx + 2, ly + 2, liveOn ? '#fca5a5' : '#991b1b');
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

  drawIsoPrism(buf, 22, 37, 6, 6, 12, darkMahogany);
  drawIsoPrism(buf, 38, 29, 6, 6, 12, darkMahogany);
  drawIsoLine(buf, 21, 36, 5, 'left-up', '#fbbf24');
  drawIsoLine(buf, 22, 36, 5, 'right-up', '#d97706');
  drawIsoLine(buf, 37, 28, 5, 'left-up', '#fbbf24');
  drawIsoLine(buf, 38, 28, 5, 'right-up', '#d97706');

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

  for (let i = 4; i < 24; i++) {
    const rx = 16 + i;
    const ry = 21 - Math.floor(i / 2);
    buf.set(rx, ry, '#fbbf24');
    buf.set(rx, ry + 1, '#881337');
    buf.set(rx + 1, ry + 1, '#9f1239');
    buf.set(rx + 1, ry + 2, '#d97706');
  }

  buf.rect(21, 17, 5, 3, '#94a3b8');
  buf.hline(22, 25, 18, '#334155');
  buf.rect(20, 13, 5, 4, '#1e293b');
  buf.rect(21, 14, 3, 2, '#38bdf8');
  buf.set(21, 14, '#ffffff');

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

  drawIsoPrism(buf, 20, 48, 11, 11, 18, purpleCab);

  drawIsoLine(buf, 18, 37, 8, 'left-up', '#f472b6');
  drawIsoLine(buf, 18, 38, 8, 'left-up', '#38bdf8');

  for (let dx = 3; dx <= 7; dx++) {
    const x = 20 + dx;
    const y = 43 - Math.floor(dx / 2);
    buf.vline(x, y - 5, y, '#0f172a');
  }
  buf.set(24, 39, '#f97316');
  buf.set(26, 38, '#f97316');

  drawIsoPrism(buf, 21, 31, 11, 12, 3, {
    top: '#1e1b4b',
    left: '#4c1d95',
    right: '#2e1065',
    lt: '#f472b6',
  });

  buf.vline(21, 25, 27, '#cbd5e1');
  buf.rect(20, 24, 2, 2, '#ef4444');
  buf.set(20, 24, '#fca5a5');
  buf.set(24, 26, '#facc15');
  buf.set(26, 25, '#22c55e');
  buf.set(25, 27, '#38bdf8');

  drawIsoPrism(buf, 19, 27, 10, 10, 12, purpleCab);

  for (let dx = 1; dx <= 8; dx++) {
    const x = 19 + dx;
    const yTop = 17 - Math.floor(dx / 2);
    buf.vline(x, yTop, yTop + 7, '#090d16');
  }

  const f = frame % 4;
  const shipX = 21 + f;
  const shipY = 19 - Math.floor(f / 2);
  buf.rect(25 - (f % 2), 15, 2, 2, '#f472b6');
  buf.rect(shipX, shipY, 2, 2, '#22c55e');
  buf.set(shipX + 1, shipY - 2, '#facc15');

  drawIsoPrism(buf, 20, 15, 11, 10, 4, {
    top: '#f472b6',
    left: '#db2777',
    right: '#facc15',
    lt: '#fde047',
  });
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

  drawIsoPrism(buf, 18, 42, 7, 7, 9, terra);
  drawIsoPrism(buf, 18, 33, 8, 8, 2, {
    top: '#f97316',
    left: '#ea580c',
    right: '#9a3412',
    lt: '#fdba74',
  });

  drawIsoPrism(buf, 18, 31, 6, 6, 1, {
    top: '#451a03',
    left: '#451a03',
    right: '#270e02',
    lt: '#78350f',
  });

  for (let y = 17; y <= 30; y++) {
    const ring = y % 2 === 0;
    buf.set(17, y, ring ? '#b45309' : '#92400e');
    buf.set(18, y, ring ? '#92400e' : '#78350f');
    buf.set(19, y, ring ? '#78350f' : '#451a03');
  }

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

      buf.set(px, py, f.bright ? '#86efac' : '#22c55e');
      buf.set(px, py - 1, f.bright ? '#22c55e' : '#15803d');

      if (s % 2 === 1 && s > 2) {
        buf.set(px, py + 1, '#15803d');
        buf.set(px, py + 2, '#14532d');
      } else if (s > 1) {
        buf.set(px, py + 1, '#22c55e');
      }
    }
  }

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

  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const d = Math.abs(x - cx) / rx + Math.abs(y - cy) / ry;
      if (d <= 1.06 && d > 0.98) {
        buf.under(x, y + 1, 'rgba(15, 23, 42, 0.28)');
      }
    }
  }

  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const d = dx / rx + dy / ry;

      if (d > 1.0) {
        if (d <= 1.08 && ((x + y) & 1) === 0) {
          buf.set(x, y, '#fde68a');
        }
        continue;
      }

      const bayer = ((x & 1) + ((y & 1) << 1)) % 2 === 0;
      let col = '#881337';

      if (d > 0.9) {
        col = '#1e1b4b';
      } else if (d > 0.8) {
        col = ((x + y) % 3 === 0) ? '#fde68a' : '#d97706';
      } else if (d > 0.72) {
        col = '#4c0519';
      } else if (d > 0.38) {
        col = bayer ? '#9f1239' : '#881337';
        if ((dx + dy * 2) % 6 === 0) {
          col = '#be123c';
        }
      } else if (d > 0.24) {
        col = bayer ? '#fbbf24' : '#d97706';
      } else {
        col = bayer ? '#fde68a' : '#be123c';
      }

      buf.set(x, y, col);
    }
  }

  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: cx,
    anchorY: cy,
  };
}

// ============================================================================
// 12. FLOOR_LAMP — Luminária de Pé Retrô Dourada (1x1 tile, 30x54 px)
// ============================================================================
function buildFloorLamp(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(30, 54);
  const cx = 15;
  const ay = 47;

  // Sombra 2:1 no piso
  buf.shadow(cx, ay - 2, 8, 4, PIX_PALETTE.outline.indigo, 0.3);

  // Base circular de latão em elipse 2:1
  buf.ellipse(cx, ay - 3, 6, 3, PIX_PALETTE.gold.dk);
  buf.ellipse(cx, ay - 4, 5, 2.5, PIX_PALETTE.gold.mid);
  buf.hline(cx - 3, cx + 1, ay - 5, PIX_PALETTE.gold.hi);

  // Haste fina de latão com brilho na face esquerda (luz topo-esquerda)
  buf.vline(cx - 1, 18, ay - 5, PIX_PALETTE.gold.lt);
  buf.vline(cx, 18, ay - 5, PIX_PALETTE.gold.mid);
  buf.vline(cx + 1, 18, ay - 5, PIX_PALETTE.gold.dk);
  // Anel ornamental no meio da haste
  buf.hline(cx - 2, cx + 2, 31, PIX_PALETTE.gold.lt);
  buf.hline(cx - 1, cx + 1, 32, PIX_PALETTE.gold.dk);

  // Cúpula plissada cônica creme/âmbar emitindo luz quente
  const shimmer = frame % 2 === 0 ? PIX_PALETTE.warmLight.core : PIX_PALETTE.warmLight.mid;
  for (let row = 0; row < 12; row++) {
    const y = 7 + row;
    const hw = Math.round(4 + row * 0.45);
    for (let x = cx - hw; x <= cx + hw; x++) {
      const isPleat = (x - cx) % 3 === 0;
      const isLeftLit = x < cx;
      let col: string = isLeftLit ? PIX_PALETTE.warmLight.core : PIX_PALETTE.warmLight.mid;
      if (isPleat) col = isLeftLit ? PIX_PALETTE.warmLight.mid : PIX_PALETTE.gold.dk;
      if (row === 0 || row === 11) col = PIX_PALETTE.gold.mid;
      buf.set(x, y, col);
    }
  }
  // Brilho interno sob a cúpula (lâmpada acesa)
  buf.ellipse(cx, 19, 6, 2.2, shimmer);
  buf.hline(cx - 3, cx + 3, 19, '#ffffff');
  // Remate dourado no topo da cúpula
  buf.rect(cx - 1, 5, 3, 2, PIX_PALETTE.gold.lt);
  buf.set(cx, 4, PIX_PALETTE.gold.hi);

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: cx,
    anchorY: ay,
  };
}

// ============================================================================
// 13. BOOKSHELF_PRO — Estante Mogno com Livros & Troféu Pixel (1x1 tile, 44x58 px)
// ============================================================================
function buildBookshelfPro(rot: 0 | 1): PixFurniSprite {
  const buf = new PixelBuf(44, 58);
  const ax = 22;
  const ay = 52;

  buf.shadow(22, 46, 15, 7, PIX_PALETTE.outline.indigo, 0.3);

  const wood = {
    top: PIX_PALETTE.mahogany.lt,
    left: PIX_PALETTE.mahogany.mid,
    right: PIX_PALETTE.mahogany.dk,
    lt: PIX_PALETTE.mahogany.hi,
  };

  // Corpo da estante isométrica (wx=13, wy=13, h=34)
  drawIsoPrism(buf, 22, 48, 13, 13, 34, wood, { woodGrainTop: true, woodColor: PIX_PALETTE.mahogany.dk });

  // Nichos internos sombreados na face direita (3 prateleiras)
  const bookColors = [
    PIX_PALETTE.vipCrimson.mid,
    PIX_PALETTE.cyan.mid,
    PIX_PALETTE.gold.mid,
    PIX_PALETTE.foliage.mid,
    PIX_PALETTE.neonPink.mid,
    PIX_PALETTE.steel.lt,
  ];
  for (let shelf = 0; shelf < 3; shelf++) {
    const baseY = 23 + shelf * 9;
    // Fundo escuro da prateleira seguindo 2:1
    for (let dx = 1; dx < 12; dx++) {
      const x = 22 + dx;
      const yb = baseY - Math.floor(dx / 2);
      for (let h = 0; h < 6; h++) {
        buf.set(x, yb - h, PIX_PALETTE.outline.espresso);
      }
      // Lombadas de livros coloridos variados
      if (dx % 2 === 1 && dx < 11) {
        const bCol = bookColors[(shelf * 5 + dx) % bookColors.length];
        const bHi = shade(bCol, 0.14);
        const bh = 4 + ((shelf + dx) % 2);
        for (let h = 0; h < bh; h++) {
          buf.set(x, yb - h, h === bh - 1 ? bHi : bCol);
          buf.set(x + 1, yb - h, shade(bCol, -0.15));
        }
      }
    }
    // Borda dourada da prateleira
    drawIsoLine(buf, 22, baseY + 1, 12, 'right-up', PIX_PALETTE.gold.dk);
  }

  // Troféu Pixel Dourado no topo da estante
  buf.rect(18, 6, 4, 4, PIX_PALETTE.gold.lt);
  buf.set(18, 6, PIX_PALETTE.gold.hi);
  buf.set(17, 7, PIX_PALETTE.gold.mid);
  buf.set(22, 7, PIX_PALETTE.gold.mid);
  buf.rect(19, 10, 2, 2, PIX_PALETTE.gold.dk);
  buf.rect(18, 12, 4, 2, PIX_PALETTE.mahogany.dd);

  // Ramo pendente de planta no canto esquerdo do topo
  buf.set(12, 14, PIX_PALETTE.foliage.lt);
  buf.set(11, 15, PIX_PALETTE.foliage.mid);
  buf.set(12, 16, PIX_PALETTE.foliage.dk);
  buf.set(11, 17, PIX_PALETTE.foliage.hi);

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// 14. WATER_COOLER — Bebedouro Corporativo com Galão Borbulhando (34x52 px)
// ============================================================================
function buildWaterCooler(rot: 0 | 1, frame: number): PixFurniSprite {
  const buf = new PixelBuf(34, 52);
  const ax = 17;
  const ay = 47;

  buf.shadow(17, 43, 10, 5, PIX_PALETTE.outline.indigo, 0.28);

  const whiteSteel = {
    top: PIX_PALETTE.steel.hi,
    left: PIX_PALETTE.steel.lt,
    right: PIX_PALETTE.steel.mid,
    lt: '#ffffff',
  };

  // Gabinete branco/aço (wx=9, wy=9, h=22)
  drawIsoPrism(buf, 17, 44, 9, 9, 22, whiteSteel);

  // Nicho escuro das torneiras (vermelha água quente + azul água fria)
  for (let dx = 2; dx <= 6; dx++) {
    const x = 17 + dx;
    const yb = 31 - Math.floor(dx / 2);
    for (let y = yb - 5; y <= yb; y++) {
      buf.set(x, y, PIX_PALETTE.steel.deep);
    }
  }
  buf.set(19, 26, PIX_PALETTE.vipCrimson.lt); // torneira quente
  buf.set(22, 25, PIX_PALETTE.cyan.mid); // torneira gelada

  // Suporte lateral de copinhos descartáveis
  buf.rect(10, 26, 3, 7, PIX_PALETTE.steel.hi);
  buf.vline(12, 26, 32, PIX_PALETTE.steel.dk);

  // Galão translúcido de água mineral azul-ciano no topo (cilindro pixel art)
  for (let y = 7; y <= 19; y++) {
    for (let x = 13; x <= 21; x++) {
      let col: string = x < 16 ? PIX_PALETTE.cyan.lt : x < 19 ? PIX_PALETTE.cyan.mid : PIX_PALETTE.cyan.dk;
      if (y < 10) col = PIX_PALETTE.cyan.hi; // parte superior com ar/reflexo
      if (x === 14 && y >= 9 && y <= 17) col = '#ffffff'; // reflexo especular vertical
      buf.set(x, y, col);
    }
  }
  // Anéis estruturais do galão
  buf.hline(13, 21, 12, PIX_PALETTE.cyan.hi);
  buf.hline(13, 21, 16, PIX_PALETTE.cyan.hi);
  // Bolhinha de ar subindo animada por frame
  const bubbleY = 18 - (frame % 4) * 3;
  buf.set(17, bubbleY, '#ffffff');
  buf.set(18, bubbleY - 1, PIX_PALETTE.cyan.hi);

  buf.outline();
  const finalBuf = rot === 1 ? buf.flipped() : buf;
  return {
    canvas: bufToCanvas(finalBuf),
    anchorX: rot === 1 ? buf.w - ax : ax,
    anchorY: ay,
  };
}

// ============================================================================
// CACHE & EXPORTAÇÃO PRINCIPAL
// ============================================================================

const spriteCache = new Map<string, PixFurniSprite>();

export function getPixFurniSprite(type: string, rot: 0 | 1, frame: number): PixFurniSprite {
  const isAnimated =
    type === 'dev_desk' ||
    type === 'espresso_bar' ||
    type === 'vending_drinks' ||
    type === 'server_rack' ||
    type === 'holo_screen' ||
    type === 'arcade_cab' ||
    type === 'floor_lamp' ||
    type === 'water_cooler';
  const normFrame = isAnimated ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
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
    case 'floor_lamp':
      sprite = buildFloorLamp(rot, normFrame);
      break;
    case 'bookshelf_pro':
      sprite = buildBookshelfPro(rot);
      break;
    case 'water_cooler':
      sprite = buildWaterCooler(rot, normFrame);
      break;
    default:
      sprite = buildClubSofa(rot);
      break;
  }

  spriteCache.set(key, sprite);
  return sprite;
}
