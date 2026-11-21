// Sons Foley do ambiente sugeridos pelo mundo em estéreo (pan + atenuação por zoom):
// teclado mecânico, cliques de mouse, passos sincronizados, impressora puxando papel,
// páginas virando, cafeteira, bebedouro, cadeira giratória, servidores, elevador,
// pingue-pongue, fliperama e comemorações.
import type { SoundCue } from './api';
import type { Camera } from './camera';
import type { Character } from './sim/character';
import type { Sim } from './sim/sim';

/** Reavalia digitação e ambiente a cada isto (ms). */
const KEYS_TICK_MS = 140;
/** Período (ms) de uma ida da bolinha do pingue-pongue (o mesmo do desenho). */
const PINGPONG_PERIOD = 1_100;

interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class SoundCues {
  private doors: number[] = [];
  private keysAt = 0;
  private nextKeysAt = 0;
  private nextMouseAt = 0;
  private nextPrinterAt = 0;
  private nextServerAt = 0;
  private nextPaperAt = 0;
  private nextDrinkAt = 0;
  private nextArcadeAt = 0;
  private rally = new Map<number, number>();
  private lastStepAt = new Map<string, number>();
  private prevSeated = new Map<string, boolean>();
  private prevPose = new Map<string, string>();

  constructor(
    private readonly sim: Sim,
    private readonly camera: Camera,
    private readonly rng: () => number = Math.random,
  ) {}

  update(now: number, emit: (cue: SoundCue) => void): void {
    const a = this.camera.screenToWorld(0, 0);
    const b = this.camera.screenToWorld(this.camera.viewW, this.camera.viewH);
    const view = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    const near = Math.max(0.5, Math.min(1, 0.3 + this.camera.zoom * 0.28));

    this.elevators(view, emit);
    this.characters(now, view, near, emit);
    this.workAmbient(now, view, near, emit);
    this.social(now, view, near, emit);
  }

  private pan(x: number, v: ViewRect): number {
    const half = Math.max(1, (v.x1 - v.x0) / 2);
    return Math.max(-0.75, Math.min(0.75, ((x - (v.x0 + v.x1) / 2) / half) * 0.75));
  }

  private inView(x: number, y: number, v: ViewRect, m = 20): boolean {
    return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
  }

  /** "Ding-Dong" + porta quando o elevador começa a abrir. */
  private elevators(view: ViewRect, emit: (cue: SoundCue) => void): void {
    this.sim.elevators.forEach((e, i) => {
      const prev = this.doors[i];
      this.doors[i] = e.door;
      if (prev === undefined || prev > 0.01 || e.door <= 0.01) return;
      const spot = this.sim.spots.get(e.spotId);
      if (!spot) return;
      emit({ kind: 'elevator', gain: this.inView(spot.x, spot.y, view, 24) ? 1 : 0.55, pan: this.pan(spot.x, view) });
    });
  }

  /** Passos, cadeira ao sentar/levantar, folhas virando, café, bebedouro e comemoração por personagem. */
  private characters(now: number, view: ViewRect, near: number, emit: (cue: SoundCue) => void): void {
    const seen = new Set<string>();
    for (const ch of this.sim.chars.values()) {
      seen.add(ch.id);
      if (ch.inside || ch.alpha <= 0.5) continue;
      const visible = this.inView(ch.x, ch.y, view);

      // 1. Transição de sentar / levantar -> som de cadeira giratória
      const wasSeated = this.prevSeated.get(ch.id);
      this.prevSeated.set(ch.id, ch.seated);
      if (visible && wasSeated !== undefined && wasSeated !== ch.seated) {
        emit({ kind: 'chair', gain: near * 0.72, pan: this.pan(ch.x, view) });
      }

      // 2. Transição de pose para comemoração/risada
      const oldPose = this.prevPose.get(ch.id);
      this.prevPose.set(ch.id, ch.pose);
      if (visible && oldPose !== ch.pose && (ch.pose === 'cheer' || ch.pose === 'laugh')) {
        emit({ kind: 'cheer', gain: near * 0.78, pan: this.pan(ch.x, view) });
      }

      if (!visible) continue;

      // 3. Passos sincronizados com caminhada ou corrida
      if (ch.pose === 'walk' || ch.pose === 'run') {
        const stride = ch.pose === 'run' ? 190 : 285;
        const prev = this.lastStepAt.get(ch.id) ?? 0;
        if (now - prev >= stride) {
          this.lastStepAt.set(ch.id, now);
          emit({
            kind: 'step',
            gain: near * (ch.pose === 'run' ? 0.85 : 0.68),
            pan: this.pan(ch.x, view),
          });
        }
      }

      // 4. Lendo documento / folhas virando
      if ((ch.pose === 'read' || ch.held === 'papers' || ch.held === 'book') && now >= this.nextPaperAt) {
        this.nextPaperAt = now + 2_200 + this.rng() * 3_000;
        emit({ kind: 'paper', gain: near * 0.75, pan: this.pan(ch.x, view) });
      }

      // 5. Café & Bebedouro (usando máquina ou tomando gole)
      const spot = ch.atSpot ? this.sim.spots.get(ch.atSpot) : undefined;
      if (now >= this.nextDrinkAt) {
        if (ch.held === 'coffee' || spot?.kind === 'coffee') {
          this.nextDrinkAt = now + 3_400 + this.rng() * 3_500;
          emit({ kind: 'coffee', gain: near * 0.82, pan: this.pan(ch.x, view) });
        } else if (ch.held === 'water' || spot?.kind === 'water') {
          this.nextDrinkAt = now + 3_200 + this.rng() * 3_500;
          emit({ kind: 'water', gain: near * 0.84, pan: this.pan(ch.x, view) });
        }
      }
    }

    // Limpa mapas de personagens que saíram
    for (const id of this.lastStepAt.keys()) if (!seen.has(id)) this.lastStepAt.delete(id);
    for (const id of this.prevSeated.keys()) if (!seen.has(id)) this.prevSeated.delete(id);
    for (const id of this.prevPose.keys()) if (!seen.has(id)) this.prevPose.delete(id);
  }

  /** Teclado mecânico, cliques de mouse, impressora do escritório e racks de servidor. */
  private workAmbient(now: number, view: ViewRect, near: number, emit: (cue: SoundCue) => void): void {
    if (now - this.keysAt < KEYS_TICK_MS) return;
    this.keysAt = now;

    let typers = 0;
    let sx = 0;
    let workers = 0;
    let wx = 0;

    for (const ch of this.sim.chars.values()) {
      if (ch.leaving || ch.inside || ch.alpha <= 0.5 || !this.inView(ch.x, ch.y, view)) continue;
      if (ch.mode === 'work') {
        workers++;
        wx += ch.x;
      }
      if (typing(ch)) {
        typers++;
        sx += ch.x;
      }
    }

    // 1. Rajadas de teclado mecânico
    if (typers > 0 && now >= this.nextKeysAt) {
      if (this.rng() <= Math.min(0.88, 0.38 + 0.14 * typers)) {
        this.nextKeysAt = now + (520 + this.rng() * 1_150) / Math.sqrt(Math.min(typers, 6));
        emit({
          kind: 'keys',
          gain: near * Math.min(1, 0.65 + 0.1 * typers),
          pan: this.pan(sx / typers, view),
          count: 3 + Math.floor(this.rng() * 5),
        });
      }
    }

    // 2. Cliques de mouse ocasionais enquanto há gente nas mesas
    if (workers > 0 && now >= this.nextMouseAt) {
      this.nextMouseAt = now + 1_300 + this.rng() * 2_400;
      emit({
        kind: 'mouse',
        gain: near * 0.72,
        pan: this.pan(wx / workers, view),
      });
    }

    // 3. Impressora do escritório imprimindo relatórios / entregas quando há agentes trabalhando
    if (workers > 0 && now >= this.nextPrinterAt) {
      this.nextPrinterAt = now + 12_000 + this.rng() * 14_000;
      if (this.nextPrinterAt > 0 && this.rng() < 0.78) {
        emit({
          kind: 'printer',
          gain: near * 0.75,
          pan: this.pan(wx / workers, view),
        });
      }
    }

    // 4. Racks de servidor 42U com micro-atividade de disco
    if (workers > 0 && now >= this.nextServerAt) {
      this.nextServerAt = now + 5_500 + this.rng() * 7_500;
      emit({
        kind: 'server',
        gain: near * 0.52,
        pan: this.pan(wx / workers + 40, view),
      });
    }
  }

  /** Pingue-pongue (raquetadas e quiques no ritmo da bolinha desenhada) e o fliperama. */
  private social(now: number, view: ViewRect, near: number, emit: (cue: SoundCue) => void): void {
    const alive = new Set<number>();
    for (const g of this.sim.social.gatherings) {
      if (g.phase !== 'run') continue;
      if (g.kind !== 'pingpong' && g.kind !== 'arcade') continue;
      let x = 0;
      let y = 0;
      let k = 0;
      for (const m of g.members) {
        if (m.role !== 'player' || m.left) continue;
        const ch = this.sim.chars.get(m.id);
        if (!ch) continue;
        x += ch.x;
        y += ch.y;
        k++;
      }
      if (!k) continue;
      x /= k;
      y /= k;
      if (!this.inView(x, y, view, 24)) continue;
      if (g.kind === 'pingpong') {
        alive.add(g.id);
        const seg = Math.floor(((now - g.startAt) % (PINGPONG_PERIOD * 2)) / (PINGPONG_PERIOD / 2));
        const prev = this.rally.get(g.id);
        this.rally.set(g.id, seg);
        if (prev !== undefined && prev !== seg) emit({ kind: seg % 2 === 0 ? 'pingpong' : 'table', gain: near, pan: this.pan(x, view) });
      } else if (now >= this.nextArcadeAt) {
        this.nextArcadeAt = now + 500 + this.rng() * 900;
        emit({ kind: 'arcade', gain: near * 0.85, pan: this.pan(x, view) });
      }
    }
    for (const id of this.rally.keys()) if (!alive.has(id)) this.rally.delete(id);
  }
}

/** Sentado na própria mesa, digitando. */
function typing(ch: Character): boolean {
  return ch.mode === 'work' && ch.seated && ch.pose === 'type' && !ch.leaving && !ch.inside && ch.alpha > 0.5;
}
