// PixArt Master Palette & Hybrid Aseprite/PixelBuf Engine
// Baseado em Lospec AAP-64 + Endesga 32 + Slynyrd Hue-Shifting (Warm Light / Cool Shadow)
// + Iluminação ambiente pixelada (glows, feixes de janela, AO de rodapé)
// + Carregador híbrido para sprites PNG exportados diretamente do Aseprite (/assets/pixhotel/).

export const PIX_PALETTE = {
  // Contornos tingidos (nunca #000000 chapado)
  outline: {
    indigo: '#181425',
    slate: '#242234',
    plum: '#2e1e2e',
    wine: '#3b1725',
    espresso: '#221c1a',
    pine: '#122020',
  },
  // Carvalho quente (clareia p/ creme, escurece p/ marrom-vinho)
  oak: {
    hi: '#f4d29c',
    lt: '#dba463',
    mid: '#bb7547',
    dk: '#71413b',
    dd: '#322b28',
  },
  // Mogno / Lambril / Mezanino
  mahogany: {
    hi: '#ba756a',
    lt: '#8e5252',
    mid: '#5b3138',
    dk: '#422433',
    dd: '#221c1a',
  },
  // Bordô Imperial VIP (Sofá PixClub & Carpete Mezanino)
  vipCrimson: {
    hi: '#e86a73',
    lt: '#df3e23',
    mid: '#b4202a',
    dk: '#73172d',
    dd: '#3b1725',
  },
  // Ouro & Latão
  gold: {
    hi: '#fef3c0',
    lt: '#ffd541',
    mid: '#f9a31b',
    dk: '#bb7547',
    dd: '#71413b',
  },
  // Aço / Neutros Frios (AAP-64 Steel 6)
  steel: {
    hi: '#dae0ea',
    lt: '#b3b9d1',
    mid: '#8b93af',
    dk: '#6d758d',
    dd: '#4a5462',
    deep: '#333941',
  },
  // Folhagem Viva (hue-shifted: teal na sombra -> amarelo-lima na ponta)
  foliage: {
    hi: '#d6f264',
    lt: '#9cdb43',
    mid: '#59c135',
    dk: '#1a7a3e',
    dd: '#24523b',
    deep: '#122020',
  },
  // Telas, Vidro & Ciano Neon
  cyan: {
    hi: '#a6fcdb',
    lt: '#20d6c7',
    mid: '#249fde',
    dk: '#285cc4',
    dd: '#143464',
  },
  // Neon Magenta / Synthwave
  neonPink: {
    hi: '#f6757a',
    lt: '#ff0044',
    mid: '#b55088',
    dk: '#68386c',
    dd: '#3e2731',
  },
  // Iluminação Quente (Abajures / Janelas / Vela)
  warmLight: {
    core: '#fef3c0',
    mid: '#ffd541',
    outer: '#f9a31b',
  },
} as const;

// ============================================================================
// REGISTRO HÍBRIDO DE SPRITES PNG EXPORTADOS DO ASEPRITE
// ============================================================================

export interface AsepriteOverrideSprite {
  image: HTMLImageElement;
  anchorX: number;
  anchorY: number;
  loaded: boolean;
}

const asepriteOverrides = new Map<string, AsepriteOverrideSprite>();
let manifestChecked = false;

export function registerAsepriteOverride(key: string, url: string, anchorX: number, anchorY: number): void {
  const img = new Image();
  const entry: AsepriteOverrideSprite = { image: img, anchorX, anchorY, loaded: false };
  img.onload = () => {
    entry.loaded = true;
  };
  img.src = url;
  asepriteOverrides.set(key, entry);
}

export function getAsepriteOverride(key: string): AsepriteOverrideSprite | null {
  const found = asepriteOverrides.get(key);
  return found && found.loaded ? found : null;
}

/**
 * Tenta carregar opcionalmente `/assets/pixhotel/manifest.json` caso o usuário tenha
 * exportado PNGs customizados do Aseprite. Falha silenciosamente para manter 100% de fallback PixelBuf.
 */
export function preloadAsepriteManifest(): void {
  if (manifestChecked || typeof fetch === 'undefined') return;
  manifestChecked = true;
  fetch('/assets/pixhotel/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: Record<string, { url: string; anchorX: number; anchorY: number }> | null) => {
      if (!data || typeof data !== 'object') return;
      for (const [k, v] of Object.entries(data)) {
        if (v?.url) {
          registerAsepriteOverride(k, v.url, v.anchorX ?? 16, v.anchorY ?? 32);
        }
      }
    })
    .catch(() => {
      // Sem manifest externo: usa sprites PixelBuf autorais
    });
}

// ============================================================================
// EFEITOS DE ILUMINAÇÃO AMBIENTE EM ESTILO PIXEL ART (GLOWS, FEIXES E AO)
// ============================================================================

/**
 * Halo de luz pixelado em 2 degraus concêntricos (sem blur borrado), mantendo a estética
 * crocante de pixel art em telas de monitores, neon, fliperamas e luminárias.
 */
export function drawPixelGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  colorRgb: string,
  alpha = 0.22,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Anel externo suave
  ctx.fillStyle = `rgba(${colorRgb}, ${(alpha * 0.45).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), Math.round(rx), Math.round(ry), 0, 0, Math.PI * 2);
  ctx.fill();
  // Núcleo interno concentrado
  ctx.fillStyle = `rgba(${colorRgb}, ${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), Math.round(rx * 0.55), Math.round(ry * 0.55), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Feixe de luar azul-ciano projetado pelas janelas noturnas sobre os ladrilhos do chão
 * seguindo rigorosamente o eixo isométrico 2:1.
 */
export function drawWindowLightBeam(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  reachX: number,
  reachY: number,
  colorRgb = '56, 189, 248',
  alpha = 0.085,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(${colorRgb}, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(Math.round(x0), Math.round(y0));
  ctx.lineTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x1 + reachX), Math.round(y1 + reachY));
  ctx.lineTo(Math.round(x0 + reachX), Math.round(y0 + reachY));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Oclusão de ambiente (AO) fria de 2px na junção entre o rodapé das paredes e o piso,
 * ancorando as paredes no chão com profundidade arquitetônica.
 */
export function drawBaseboardAO(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(20, 16, 36, 0.34)';
  ctx.lineWidth = Math.max(2, Math.round(thickness));
  ctx.beginPath();
  ctx.moveTo(Math.round(x0), Math.round(y0));
  ctx.lineTo(Math.round(x1), Math.round(y1));
  ctx.stroke();
  ctx.restore();
}
