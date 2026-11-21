// Renderizador 1280×720 dos slides da Sala de Reunião + monitores laterais.
// Regras: texto SEMPRE ajustado à caixa (nunca vaza), sem emojis no canvas,
// contraste alto (texto escuro em fundo claro / branco em fundo escuro) e
// registro de "hotspots" para o laser apontar exatamente para o que está desenhado.

export interface FileStat {
  path: string;
  added: number;
  removed: number;
  area: string;
  isNew?: boolean;
}

export interface AreaStat {
  label: string;
  lines: number;
  files: number;
  color: string;
}

export interface CommitInfo {
  hash: string;
  subject: string;
  when: string;
}

export interface PresentationSlide {
  id: string;
  kind: 'cover' | 'code' | 'metrics' | 'visual' | 'roadmap' | 'timeline' | 'custom';
  title: string;
  subtitle: string;
  presenterKey: string;
  presenterName: string;
  presenterRole: string;
  narration: string;
  bullets: string[];
  kpis?: Array<{ label: string; value: string; accent: string; hint?: string }>;
  barChart?: { title: string; items: Array<{ label: string; value: number; color: string }> };
  donutChart?: { title: string; items: Array<{ label: string; value: number; color: string }> };
  files?: Array<{ name: string; tag: string; detail: string }>;
  fileStats?: FileStat[];
  areaStats?: AreaStat[];
  commits?: CommitInfo[];
  screenshots?: Array<{ url: string; caption: string }>;
  checklist?: Array<{ label: string; done: boolean; detail?: string }>;
  laserTargets?: Array<{ x: number; y: number }>;
}

export interface PresentationDeck {
  generatedAt: number;
  floorName: string;
  floorBadge: string;
  companyName: string;
  sprintTitle: string;
  totalAgents: number;
  workingAgents: number;
  totalActivities: number;
  participants: Array<{ key: string; name: string; role: string; color: string }>;
  slides: PresentationSlide[];
}

export interface SlideHotspot {
  x: number; // 0..1 (centro)
  y: number; // 0..1 (centro)
  label: string;
}

const W = 1280;
const H = 720;

// Paleta de alto contraste (fundo claro)
const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#F1F5F9',
  border: '#CBD5E1',
  ink: '#0F172A',
  inkSoft: '#334155',
  muted: '#475569',
  navy: '#0B2A6F',
  blue: '#0054E3',
  green: '#15803D',
  red: '#B91C1C',
  amber: '#B45309',
};

const FONT = 'Tahoma, "Segoe UI", Arial, sans-serif';
const MONO = 'Consolas, "Courier New", monospace';

const imageCache = new Map<string, HTMLImageElement>();
let hotspots: SlideHotspot[] = [];

/** Hotspots do último slide renderizado (para o laser 3D). */
export function getSlideHotspots(): SlideHotspot[] {
  return hotspots.slice();
}

function addHotspot(x: number, y: number, w: number, h: number, label: string) {
  hotspots.push({ x: (x + w / 2) / W, y: (y + h / 2) / H, label });
}

export function preloadDeckImages(deck: PresentationDeck, onLoaded?: () => void) {
  for (const s of deck.slides) {
    for (const shot of s.screenshots ?? []) {
      if (imageCache.has(shot.url)) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.set(shot.url, img);
        onLoaded?.();
      };
      img.src = shot.url;
    }
  }
}

// ---------------------------------------------------------------------------
// Utilitários de texto e forma
// ---------------------------------------------------------------------------

/** Remove emojis/pictogramas que o canvas renderiza como quadrados ou cores erradas. */
export function cleanText(s: string): string {
  return String(s ?? '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent?: string) {
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, 12);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (accent) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 6, h);
    ctx.restore();
  }
}

/** Escreve em uma linha, reduzindo a fonte até caber; se ainda não couber, corta com reticências. */
function fitText(
  ctx: CanvasRenderingContext2D,
  raw: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  weight = '600',
  minSize = 11,
  family = FONT,
) {
  let text = cleanText(raw);
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > minSize) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  if (ctx.measureText(text).width > maxW) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxW) text = text.slice(0, -1);
    text = `${text.trimEnd()}…`;
  }
  ctx.fillText(text, x, y);
  return s;
}

/** Quebra em até maxLines linhas dentro de maxW; a última recebe reticências se sobrar texto. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  raw: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
): number {
  const words = cleanText(raw).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    i = words.length;
  }
  if (i < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  lines.forEach((l, idx) => ctx.fillText(l, x, y + idx * lineH));
  return lines.length;
}

function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, done: boolean) {
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fillStyle = done ? C.green : '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = done ? C.green : C.amber;
  ctx.stroke();
  if (done) {
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx - 1, cy + 4);
    ctx.lineTo(cx + 6, cy - 4);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = C.amber;
    ctx.fillRect(cx - 1.5, cy - 6, 3, 7);
    ctx.fillRect(cx - 1.5, cy + 3, 3, 3);
  }
}

function sectionLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = C.blue) {
  ctx.fillStyle = color;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(cleanText(text).toUpperCase(), x, y);
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

function drawHBars(
  ctx: CanvasRenderingContext2D,
  items: Array<{ label: string; value: number; color: string; suffix?: string }>,
  x: number,
  y: number,
  w: number,
  rowH: number,
) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const labelW = Math.min(190, w * 0.36);
  const valueW = 92;
  const barW = w - labelW - valueW - 16;
  items.forEach((it, idx) => {
    const ry = y + idx * rowH;
    ctx.fillStyle = C.inkSoft;
    fitText(ctx, it.label, x, ry + rowH / 2 + 5, labelW - 8, 15, '600');
    roundRect(ctx, x + labelW, ry + rowH / 2 - 9, barW, 18, 5);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    const bw = Math.max(6, (it.value / max) * barW);
    roundRect(ctx, x + labelW, ry + rowH / 2 - 9, bw, 18, 5);
    ctx.fillStyle = it.color;
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'right';
    fitText(ctx, `${fmt(it.value)}${it.suffix ?? ''}`, x + w, ry + rowH / 2 + 5, valueW, 15, 'bold', 11, MONO);
    ctx.textAlign = 'left';
  });
}

function drawDonut(
  ctx: CanvasRenderingContext2D,
  items: Array<{ label: string; value: number; color: string }>,
  cx: number,
  cy: number,
  r: number,
  centerLabel: string,
) {
  const total = Math.max(1, items.reduce((s, i) => s + i.value, 0));
  let a0 = -Math.PI / 2;
  for (const it of items) {
    const a = (it.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + a);
    ctx.arc(cx, cy, r * 0.6, a0 + a, a0, true);
    ctx.closePath();
    ctx.fillStyle = it.color;
    ctx.fill();
    a0 += a;
  }
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.font = `bold 30px ${MONO}`;
  ctx.fillText(fmt(total), cx, cy + 8);
  ctx.fillStyle = C.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(centerLabel, cx, cy + 28);
  ctx.textAlign = 'left';
  return total;
}

// ---------------------------------------------------------------------------
// Moldura comum do slide
// ---------------------------------------------------------------------------

function drawChrome(ctx: CanvasRenderingContext2D, deck: PresentationDeck, slide: PresentationSlide, idx: number) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = C.blue;
  ctx.fillRect(0, 56, W, 4);

  ctx.fillStyle = '#FFFFFF';
  fitText(ctx, `${deck.companyName} · Revisão de Entrega`, 32, 36, 700, 19, 'bold');
  ctx.textAlign = 'right';
  ctx.fillStyle = '#E2E8F0';
  fitText(ctx, `${deck.floorName}   ${idx + 1} / ${deck.slides.length}`, W - 32, 36, 420, 15, '600');
  ctx.textAlign = 'left';

  // Título + subtítulo (deixa espaço para o crachá do apresentador)
  const titleMaxW = W - 88 - 300;
  ctx.fillStyle = C.ink;
  fitText(ctx, slide.title, 44, 112, titleMaxW, 34, 'bold', 20);
  ctx.fillStyle = C.muted;
  fitText(ctx, slide.subtitle, 44, 144, titleMaxW, 18, '500', 12);

  // Crachá do apresentador
  const color = deck.participants.find((p) => p.key === slide.presenterKey)?.color ?? C.blue;
  card(ctx, W - 324, 80, 280, 72, color);
  ctx.beginPath();
  ctx.arc(W - 290, 116, 16, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(cleanText(slide.presenterName).slice(0, 1).toUpperCase(), W - 290, 121);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  fitText(ctx, slide.presenterName, W - 262, 110, 206, 17, 'bold');
  ctx.fillStyle = C.muted;
  fitText(ctx, slide.presenterRole, W - 262, 132, 206, 13, '500');

  // Rodapé com progresso
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(0, H - 34, W, 34);
  ctx.fillStyle = C.blue;
  ctx.fillRect(0, H - 34, (W * (idx + 1)) / Math.max(1, deck.slides.length), 3);
  ctx.fillStyle = C.inkSoft;
  fitText(ctx, deck.sprintTitle, 32, H - 12, 820, 13, '600');
  ctx.textAlign = 'right';
  const when = new Date(deck.generatedAt);
  fitText(
    ctx,
    `Dados gerados às ${when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    W - 32,
    H - 12,
    320,
    13,
    '600',
  );
  ctx.textAlign = 'left';
}

const CONTENT_TOP = 172;
const CONTENT_BOTTOM = H - 50;

// ---------------------------------------------------------------------------
// Tipos de slide
// ---------------------------------------------------------------------------

function renderCover(ctx: CanvasRenderingContext2D, slide: PresentationSlide) {
  const kpis = (slide.kpis ?? []).slice(0, 4);
  const gap = 20;
  const cw = (W - 88 - gap * (kpis.length - 1)) / Math.max(1, kpis.length);
  kpis.forEach((k, i) => {
    const x = 44 + i * (cw + gap);
    card(ctx, x, CONTENT_TOP, cw, 116, k.accent);
    ctx.fillStyle = C.muted;
    fitText(ctx, k.label.toUpperCase(), x + 22, CONTENT_TOP + 32, cw - 36, 13, 'bold');
    ctx.fillStyle = C.ink;
    fitText(ctx, k.value, x + 22, CONTENT_TOP + 78, cw - 36, 40, 'bold', 18, MONO);
    if (k.hint) {
      ctx.fillStyle = C.muted;
      fitText(ctx, k.hint, x + 22, CONTENT_TOP + 102, cw - 36, 12, '500');
    }
    addHotspot(x, CONTENT_TOP, cw, 116, k.label);
  });

  const top = CONTENT_TOP + 136;
  const h = CONTENT_BOTTOM - top;
  card(ctx, 44, top, W - 88, h);
  sectionLabel(ctx, 'O que foi entregue nesta rodada', 70, top + 34);
  const bullets = slide.bullets.slice(0, 5);
  const rowH = (h - 56) / Math.max(1, bullets.length);
  bullets.forEach((b, i) => {
    const by = top + 52 + i * rowH;
    ctx.fillStyle = C.blue;
    roundRect(ctx, 70, by + 6, 8, 8, 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = `600 18px ${FONT}`;
    wrapText(ctx, b, 92, by + 16, W - 88 - 80, 22, rowH > 50 ? 2 : 1);
    addHotspot(70, by, W - 160, Math.min(rowH, 46), b);
  });
}

function renderCode(ctx: CanvasRenderingContext2D, slide: PresentationSlide) {
  const files = (slide.fileStats ?? []).slice(0, 8);
  const lw = 700;
  card(ctx, 44, CONTENT_TOP, lw, CONTENT_BOTTOM - CONTENT_TOP);
  sectionLabel(ctx, 'Arquivos com mais mudanças (linhas)', 68, CONTENT_TOP + 32);

  const maxChange = Math.max(1, ...files.map((f) => f.added + f.removed));
  const rowH = 52;
  files.forEach((f, i) => {
    const y = CONTENT_TOP + 48 + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = C.cardAlt;
      ctx.fillRect(56, y, lw - 24, rowH - 4);
    }
    const name = f.path.split('/').pop() ?? f.path;
    const dir = f.path.slice(0, Math.max(0, f.path.length - name.length - 1));
    ctx.fillStyle = C.ink;
    fitText(ctx, name, 68, y + 21, 330, 16, 'bold', 11, MONO);
    ctx.fillStyle = C.muted;
    fitText(ctx, `${dir || '.'}${f.isNew ? '  · novo' : ''}`, 68, y + 40, 330, 12, '500', 10, MONO);

    // barra +/−
    const bx = 410;
    const bw = 190;
    const tot = f.added + f.removed;
    const len = Math.max(8, (tot / maxChange) * bw);
    const addW = tot ? (f.added / tot) * len : len;
    ctx.fillStyle = C.green;
    ctx.fillRect(bx, y + 17, addW, 14);
    ctx.fillStyle = C.red;
    ctx.fillRect(bx + addW, y + 17, len - addW, 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.green;
    fitText(ctx, `+${fmt(f.added)}`, lw + 44 - 64, y + 29, 70, 14, 'bold', 10, MONO);
    ctx.fillStyle = C.red;
    fitText(ctx, `−${fmt(f.removed)}`, lw + 44 - 12, y + 29, 50, 14, 'bold', 10, MONO);
    ctx.textAlign = 'left';
    if (i < 4) addHotspot(56, y, lw - 24, rowH - 4, name);
  });
  if (!files.length) {
    ctx.fillStyle = C.muted;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('Nenhuma alteração pendente no repositório.', 68, CONTENT_TOP + 90);
  }

  // Direita: áreas do sistema
  const rx = 44 + lw + 20;
  const rw = W - 44 - rx;
  const areas = (slide.areaStats ?? []).slice(0, 6);
  const areaH = 70 + areas.length * 40;
  card(ctx, rx, CONTENT_TOP, rw, areaH);
  sectionLabel(ctx, 'Linhas alteradas por área', rx + 22, CONTENT_TOP + 32);
  drawHBars(
    ctx,
    areas.map((a) => ({ label: a.label, value: a.lines, color: a.color })),
    rx + 22,
    CONTENT_TOP + 46,
    rw - 44,
    40,
  );
  if (areas.length) addHotspot(rx, CONTENT_TOP, rw, areaH, 'areas');

  const dy = CONTENT_TOP + areaH + 16;
  const dh = CONTENT_BOTTOM - dy;
  if (dh > 80) {
    card(ctx, rx, dy, rw, dh, C.green);
    sectionLabel(ctx, 'Decisões técnicas', rx + 22, dy + 30, C.green);
    const bullets = slide.bullets.slice(0, 3);
    const bh = (dh - 46) / Math.max(1, bullets.length);
    bullets.forEach((b, i) => {
      ctx.fillStyle = C.ink;
      ctx.font = `500 15px ${FONT}`;
      wrapText(ctx, b, rx + 22, dy + 56 + i * bh, rw - 44, 19, Math.max(1, Math.floor(bh / 19)));
    });
    addHotspot(rx, dy, rw, dh, 'decisoes');
  }
}

function renderMetrics(ctx: CanvasRenderingContext2D, slide: PresentationSlide) {
  const lw = 520;
  const h = CONTENT_BOTTOM - CONTENT_TOP;
  card(ctx, 44, CONTENT_TOP, lw, h);
  const donut = slide.donutChart;
  sectionLabel(ctx, donut?.title ?? 'Atividade registrada', 68, CONTENT_TOP + 32);
  if (donut && donut.items.some((i) => i.value > 0)) {
    const total = drawDonut(ctx, donut.items, 44 + 150, CONTENT_TOP + 200, 112, 'ações');
    donut.items.forEach((it, i) => {
      const ly = CONTENT_TOP + 90 + i * 44;
      ctx.fillStyle = it.color;
      roundRect(ctx, 44 + 300, ly - 12, 16, 16, 3);
      ctx.fill();
      ctx.fillStyle = C.ink;
      fitText(ctx, it.label, 44 + 324, ly + 1, 120, 15, '600');
      ctx.fillStyle = C.inkSoft;
      ctx.textAlign = 'right';
      fitText(ctx, `${Math.round((it.value / total) * 100)}%`, 44 + lw - 22, ly + 1, 60, 15, 'bold', 11, MONO);
      ctx.textAlign = 'left';
    });
    addHotspot(44, CONTENT_TOP + 60, 300, 280, 'donut');
  } else {
    ctx.fillStyle = C.muted;
    ctx.font = `600 16px ${FONT}`;
    wrapText(ctx, 'Nenhuma ação dos agentes registrada nesta sessão ainda.', 68, CONTENT_TOP + 90, lw - 48, 22, 3);
  }
  // barras abaixo do donut
  if (slide.barChart?.items.length) {
    const by = CONTENT_TOP + 340;
    sectionLabel(ctx, slide.barChart.title, 68, by);
    drawHBars(ctx, slide.barChart.items.slice(0, 3), 68, by + 10, lw - 48, 34);
  }

  // Direita: checagens de qualidade reais
  const rx = 44 + lw + 20;
  const rw = W - 44 - rx;
  card(ctx, rx, CONTENT_TOP, rw, h);
  sectionLabel(ctx, 'Checagens verificadas no servidor', rx + 24, CONTENT_TOP + 32);
  const checks = (slide.checklist ?? []).slice(0, 6);
  const rowH = Math.min(70, (h - 60) / Math.max(1, checks.length));
  checks.forEach((c, i) => {
    const y = CONTENT_TOP + 52 + i * rowH;
    drawCheck(ctx, rx + 40, y + 18, c.done);
    ctx.fillStyle = C.ink;
    fitText(ctx, c.label, rx + 64, y + 18, rw - 200, 17, 'bold');
    ctx.fillStyle = c.done ? C.green : C.amber;
    ctx.textAlign = 'right';
    fitText(ctx, c.done ? 'OK' : 'PENDENTE', rx + rw - 24, y + 18, 110, 13, 'bold', 10);
    ctx.textAlign = 'left';
    if (c.detail) {
      ctx.fillStyle = C.muted;
      fitText(ctx, c.detail, rx + 64, y + 40, rw - 92, 13, '500');
    }
    addHotspot(rx + 20, y, rw - 40, rowH - 6, c.label);
  });
}

function renderTimeline(ctx: CanvasRenderingContext2D, slide: PresentationSlide) {
  const lw = 760;
  const h = CONTENT_BOTTOM - CONTENT_TOP;
  card(ctx, 44, CONTENT_TOP, lw, h);
  sectionLabel(ctx, 'Histórico recente do repositório', 68, CONTENT_TOP + 32);
  const commits = (slide.commits ?? []).slice(0, 7);
  const rowH = (h - 56) / Math.max(1, commits.length);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, CONTENT_TOP + 56);
  ctx.lineTo(84, CONTENT_TOP + 56 + rowH * Math.max(0, commits.length - 1) + 10);
  ctx.stroke();
  commits.forEach((c, i) => {
    const y = CONTENT_TOP + 56 + i * rowH;
    ctx.beginPath();
    ctx.arc(84, y + 8, 7, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? C.blue : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = C.blue;
    ctx.stroke();
    roundRect(ctx, 104, y - 4, 82, 24, 6);
    ctx.fillStyle = '#DBEAFE';
    ctx.fill();
    ctx.fillStyle = C.navy;
    fitText(ctx, c.hash, 112, y + 13, 68, 13, 'bold', 10, MONO);
    ctx.fillStyle = C.ink;
    fitText(ctx, c.subject, 198, y + 13, lw - 330, 15, '600');
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'right';
    fitText(ctx, c.when, 44 + lw - 22, y + 13, 120, 13, '500');
    ctx.textAlign = 'left';
    if (i < 3) addHotspot(104, y - 4, lw - 100, 24, c.subject);
  });
  if (!commits.length) {
    ctx.fillStyle = C.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Repositório sem histórico git disponível.', 68, CONTENT_TOP + 90);
  }

  const rx = 44 + lw + 20;
  const rw = W - 44 - rx;
  const kpis = (slide.kpis ?? []).slice(0, 3);
  const kh = (h - 20 * (kpis.length - 1)) / Math.max(1, kpis.length);
  kpis.forEach((k, i) => {
    const y = CONTENT_TOP + i * (kh + 20);
    card(ctx, rx, y, rw, kh, k.accent);
    ctx.fillStyle = C.muted;
    fitText(ctx, k.label.toUpperCase(), rx + 24, y + 34, rw - 44, 13, 'bold');
    ctx.fillStyle = C.ink;
    fitText(ctx, k.value, rx + 24, y + 80, rw - 44, 38, 'bold', 16, MONO);
    if (k.hint) {
      ctx.fillStyle = C.muted;
      ctx.font = `500 13px ${FONT}`;
      wrapText(ctx, k.hint, rx + 24, y + 106, rw - 44, 17, Math.max(1, Math.floor((kh - 112) / 17)));
    }
    addHotspot(rx, y, rw, kh, k.label);
  });
}

function renderRoadmap(ctx: CanvasRenderingContext2D, slide: PresentationSlide, approved: boolean) {
  const lw = 680;
  const h = CONTENT_BOTTOM - CONTENT_TOP;
  card(ctx, 44, CONTENT_TOP, lw, h);
  sectionLabel(ctx, 'Próximos passos propostos', 68, CONTENT_TOP + 32);
  const steps = slide.bullets.slice(0, 5);
  const rowH = (h - 56) / Math.max(1, steps.length);
  steps.forEach((s, i) => {
    const y = CONTENT_TOP + 48 + i * rowH;
    roundRect(ctx, 64, y, lw - 40, rowH - 10, 10);
    ctx.fillStyle = C.cardAlt;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(94, y + (rowH - 10) / 2, 15, 0, Math.PI * 2);
    ctx.fillStyle = C.blue;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 94, y + (rowH - 10) / 2 + 5);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = `600 16px ${FONT}`;
    const lines = Math.max(1, Math.floor((rowH - 18) / 20));
    wrapText(ctx, s, 122, y + (rowH - 10) / 2 + 6 - ((Math.min(lines, 2) - 1) * 10), lw - 110, 20, Math.min(lines, 2));
    addHotspot(64, y, lw - 40, rowH - 10, s);
  });

  const rx = 44 + lw + 20;
  const rw = W - 44 - rx;
  card(ctx, rx, CONTENT_TOP, rw, h, approved ? C.green : C.amber);
  sectionLabel(ctx, approved ? 'Entrega aprovada' : 'Critérios para aprovação', rx + 24, CONTENT_TOP + 32, approved ? C.green : C.amber);
  const list = (slide.checklist ?? []).slice(0, 6);
  const ch = Math.min(56, (h - 150) / Math.max(1, list.length));
  list.forEach((c, i) => {
    const y = CONTENT_TOP + 58 + i * ch;
    const done = c.done || approved;
    drawCheck(ctx, rx + 40, y + 10, done);
    ctx.fillStyle = C.ink;
    fitText(ctx, c.label, rx + 62, y + 15, rw - 86, 15, '600');
  });
  if (list.length) addHotspot(rx, CONTENT_TOP + 40, rw, list.length * ch, 'checklist');

  const sy = CONTENT_BOTTOM - 84;
  roundRect(ctx, rx + 20, sy, rw - 40, 64, 10);
  ctx.fillStyle = approved ? C.green : C.navy;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  fitText(ctx, approved ? 'APROVADO PELO FUNDADOR' : 'AGUARDANDO SUA DECISÃO', rx + rw / 2, sy + 30, rw - 70, 18, 'bold');
  ctx.fillStyle = '#E2E8F0';
  fitText(ctx, approved ? 'A equipe segue para o próximo ciclo' : 'Aprovar ou pedir ajuste no painel abaixo', rx + rw / 2, sy + 52, rw - 70, 13, '500');
  ctx.textAlign = 'left';
  addHotspot(rx + 20, sy, rw - 40, 64, 'decisao');
}

function renderCustom(ctx: CanvasRenderingContext2D, slide: PresentationSlide) {
  const h = CONTENT_BOTTOM - CONTENT_TOP;
  card(ctx, 44, CONTENT_TOP, W - 88, h, C.blue);
  const bullets = slide.bullets.slice(0, 6);
  const rowH = (h - 40) / Math.max(1, bullets.length);
  bullets.forEach((b, i) => {
    const y = CONTENT_TOP + 30 + i * rowH;
    ctx.fillStyle = C.blue;
    roundRect(ctx, 76, y + 8, 10, 10, 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = `600 22px ${FONT}`;
    wrapText(ctx, b, 104, y + 22, W - 200, 28, Math.max(1, Math.floor(rowH / 30)));
    addHotspot(76, y, W - 170, Math.min(rowH, 60), b);
  });
}

export function renderSlideToCanvas(
  canvas: HTMLCanvasElement,
  deck: PresentationDeck,
  slideIndex: number,
  approved = false,
) {
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const slide = deck.slides[slideIndex] ?? deck.slides[0];
  if (!slide) return;

  hotspots = [];
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  drawChrome(ctx, deck, slide, slideIndex);

  switch (slide.kind) {
    case 'cover':
      renderCover(ctx, slide);
      break;
    case 'code':
      renderCode(ctx, slide);
      break;
    case 'metrics':
      renderMetrics(ctx, slide);
      break;
    case 'timeline':
      renderTimeline(ctx, slide);
      break;
    case 'roadmap':
      renderRoadmap(ctx, slide, approved);
      break;
    default:
      renderCustom(ctx, slide);
  }

  if (!hotspots.length) hotspots.push({ x: 0.5, y: 0.5, label: 'centro' });
}

// ---------------------------------------------------------------------------
// Monitores laterais (512×512)
// ---------------------------------------------------------------------------

function monitorFrame(ctx: CanvasRenderingContext2D, title: string, accent: string) {
  const S = 512;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, S, 64);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 64, S, 4);
  ctx.fillStyle = '#FFFFFF';
  fitText(ctx, title, 24, 42, S - 48, 22, 'bold');
}

export function renderLeftMonitor(canvas: HTMLCanvasElement, deck: PresentationDeck, slideIndex: number) {
  const S = 512;
  if (canvas.width !== S) canvas.width = S;
  if (canvas.height !== S) canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  monitorFrame(ctx, 'Participantes', C.blue);

  const activeKey = deck.slides[slideIndex]?.presenterKey;
  const list = deck.participants.slice(0, 8);
  const rowH = (S - 96) / Math.max(1, list.length);
  list.forEach((p, i) => {
    const y = 84 + i * rowH;
    const speaking = p.key === activeKey;
    roundRect(ctx, 16, y, S - 32, rowH - 6, 8);
    ctx.fillStyle = speaking ? '#DBEAFE' : '#F1F5F9';
    ctx.fill();
    if (speaking) {
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(40, y + (rowH - 6) / 2, 9, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.fillStyle = C.ink;
    fitText(ctx, p.name, 60, y + (rowH - 6) / 2 + 6, 240, 18, speaking ? 'bold' : '600');
    ctx.textAlign = 'right';
    ctx.fillStyle = speaking ? C.blue : C.green;
    fitText(ctx, speaking ? 'APRESENTANDO' : 'PRESENTE', S - 30, y + (rowH - 6) / 2 + 5, 150, 14, 'bold', 10);
    ctx.textAlign = 'left';
  });
}

export function renderRightMonitor(canvas: HTMLCanvasElement, deck: PresentationDeck, slideIndex: number, approved = false) {
  const S = 512;
  if (canvas.width !== S) canvas.width = S;
  if (canvas.height !== S) canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  monitorFrame(ctx, 'Pauta da reunião', approved ? C.green : C.amber);

  const slides = deck.slides.slice(0, 7);
  const rowH = Math.min(58, (S - 170) / Math.max(1, slides.length));
  slides.forEach((s, i) => {
    const y = 84 + i * rowH;
    const cur = i === slideIndex;
    const past = i < slideIndex;
    roundRect(ctx, 16, y, S - 32, rowH - 6, 8);
    ctx.fillStyle = cur ? '#DBEAFE' : '#F1F5F9';
    ctx.fill();
    if (cur) {
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (past) drawCheck(ctx, 40, y + (rowH - 6) / 2, true);
    else {
      ctx.fillStyle = cur ? C.blue : C.muted;
      ctx.font = `bold 16px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), 40, y + (rowH - 6) / 2 + 6);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = C.ink;
    fitText(ctx, s.title, 62, y + (rowH - 6) / 2 + 6, S - 96, 16, cur ? 'bold' : '600');
  });

  roundRect(ctx, 16, S - 70, S - 32, 54, 10);
  ctx.fillStyle = approved ? C.green : C.navy;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  fitText(ctx, approved ? 'ENTREGA APROVADA' : 'AGUARDANDO APROVAÇÃO', S / 2, S - 36, S - 64, 18, 'bold');
  ctx.textAlign = 'left';
}
