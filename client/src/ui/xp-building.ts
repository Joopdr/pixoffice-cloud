// Prédio Corporativo Multi-Andar do Habblaud (Elevador Interativo + Corte Vertical SimTower)
// Cada andar representa uma empresa / conversa única com tema arquitetônico, iluminação e departamentos próprios!

export type FloorArchStyle = 'luna_tech' | 'retro_studio' | 'warm_loft' | 'cyber_neon' | 'sunset_lounge';

export interface BuildingFloorDto {
  id: string;
  floorNumber: number;
  companyName: string;
  subtitle: string;
  provider: 'antigravity' | 'claude' | 'codex';
  providerLabel: string;
  providerBadge: 'AG' | 'CC' | 'CX';
  providerColor: string;
  style: FloorArchStyle;
  styleLabel: string;
  daylight: 'day' | 'night' | 'auto';
  squigglyFloor: boolean;
  accentColor: string;
  floorBg: string;
  departments: [string, string];
  sessionId: string;
  cwd: string;
  lastActivityAt: number;
  activeAgents: number;
  workingCount: number;
  isSelected: boolean;
  agents: {
    id: string;
    name: string;
    role: string;
    status: string;
    lastText: string;
  }[];
}

export class BuildingTowerUI {
  private floors: BuildingFloorDto[] = [];
  private elevatorPanel: HTMLElement;
  private cutawayModal: HTMLElement;
  private bannerEl: HTMLElement;
  private doorsEl: HTMLElement;
  private pollTimer: any = null;
  private onFloorSelected?: (floor: BuildingFloorDto) => void;
  private isElevatorOpen = true;
  private isCutawayOpen = false;
  private audioCtx: AudioContext | null = null;

  constructor(opts: { onFloorSelected?: (floor: BuildingFloorDto) => void } = {}) {
    this.onFloorSelected = opts.onFloorSelected;

    // 1. Painel lateral retrô do Elevador
    this.elevatorPanel = document.createElement('aside');
    this.elevatorPanel.id = 'xp-elevator-panel';
    this.elevatorPanel.className = 'xp-elevator-panel';
    document.body.appendChild(this.elevatorPanel);

    // 2. Vista de Corte Vertical do Prédio Inteiro (SimTower)
    this.cutawayModal = document.createElement('div');
    this.cutawayModal.id = 'xp-building-cutaway';
    this.cutawayModal.className = 'xp-building-cutaway';
    this.cutawayModal.hidden = true;
    document.body.appendChild(this.cutawayModal);

    // 3. Banner de chegada do elevador
    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'xp-elevator-banner';
    this.bannerEl.className = 'xp-elevator-banner';
    this.bannerEl.hidden = true;
    document.body.appendChild(this.bannerEl);

    // 4. Portas metálicas animadas de transição entre andares
    this.doorsEl = document.createElement('div');
    this.doorsEl.id = 'xp-elevator-doors';
    this.doorsEl.className = 'xp-elevator-doors';
    this.doorsEl.hidden = true;
    this.doorsEl.innerHTML = `<div class="xp-door-left"></div><div class="xp-door-center"></div><div class="xp-door-right"></div>`;
    document.body.appendChild(this.doorsEl);

    void this.refresh();
    this.pollTimer = setInterval(() => void this.refresh(), 5000);
  }

  public toggleElevatorPanel(force?: boolean) {
    this.isElevatorOpen = force !== undefined ? force : !this.isElevatorOpen;
    this.elevatorPanel.classList.toggle('is-collapsed', !this.isElevatorOpen);
  }

  public toggleCutaway(force?: boolean) {
    this.isCutawayOpen = force !== undefined ? force : !this.isCutawayOpen;
    this.cutawayModal.hidden = !this.isCutawayOpen;
    if (this.isCutawayOpen) {
      this.renderCutaway();
    }
  }

  public getCurrentFloor(): BuildingFloorDto | undefined {
    return this.floors.find((f) => f.isSelected) ?? this.floors[0];
  }

  private playElevatorDing() {
    try {
      if (!this.audioCtx && typeof window !== 'undefined') {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (AC) this.audioCtx = new AC();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = this.audioCtx!.createOscillator();
        const g = this.audioCtx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.14, start);
        g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
        osc.connect(g);
        g.connect(this.audioCtx!.destination);
        osc.start(start);
        osc.stop(start + dur);
      };
      playTone(1046.5, now, 0.32);
      playTone(783.99, now + 0.16, 0.55);
    } catch {
      // ignore
    }
  }

  private animateElevatorDoors(floor: BuildingFloorDto) {
    const center = this.doorsEl.querySelector('.xp-door-center');
    if (center) {
      center.innerHTML = `<div class="xp-door-sign"><strong>🛗 ${floor.floorNumber}º ANDAR</strong><span>${this.esc(floor.companyName)}</span><small>${this.esc(floor.styleLabel)}</small></div>`;
    }
    this.doorsEl.hidden = false;
    this.doorsEl.classList.remove('is-opening');
    this.doorsEl.classList.add('is-closing');
    setTimeout(() => {
      this.doorsEl.classList.remove('is-closing');
      this.doorsEl.classList.add('is-opening');
      setTimeout(() => {
        this.doorsEl.hidden = true;
        this.doorsEl.classList.remove('is-opening');
      }, 360);
    }, 340);
  }

  private showArrivalBanner(floor: BuildingFloorDto) {
    this.bannerEl.innerHTML = `
      <span class="xp-elev-badge" style="background:${floor.accentColor || floor.providerColor}">${floor.providerBadge}</span>
      <div>
        <strong>🛗 ${floor.floorNumber}º Andar · ${this.esc(floor.companyName)}</strong>
        <div class="xp-elev-sub">${this.esc(floor.styleLabel)} · ${this.esc(floor.providerLabel)}</div>
      </div>
    `;
    this.bannerEl.hidden = false;
    this.bannerEl.classList.remove('is-leaving');
    setTimeout(() => {
      this.bannerEl.classList.add('is-leaving');
      setTimeout(() => {
        this.bannerEl.hidden = true;
      }, 350);
    }, 3400);
  }

  public async refresh() {
    try {
      const res = await fetch('/api/building/floors');
      if (!res.ok) return;
      const data = (await res.json()) as { floors?: BuildingFloorDto[] };
      if (Array.isArray(data.floors) && data.floors.length > 0) {
        this.floors = data.floors;
        this.renderElevator();
        if (this.isCutawayOpen) this.renderCutaway();
      }
    } catch {
      // ignore
    }
  }

  public async selectFloor(floorId: string) {
    try {
      const res = await fetch('/api/building/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floorId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { floor?: BuildingFloorDto; floors?: BuildingFloorDto[] };
      if (Array.isArray(data.floors)) this.floors = data.floors;
      this.renderElevator();
      if (this.isCutawayOpen) this.toggleCutaway(false);
      if (data.floor) {
        this.playElevatorDing();
        this.animateElevatorDoors(data.floor);
        this.showArrivalBanner(data.floor);
        this.onFloorSelected?.(data.floor);
      }
    } catch {
      // ignore
    }
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private renderElevator() {
    const current = this.getCurrentFloor();
    const taskLbl = document.getElementById('xp-task-floor-lbl');
    if (taskLbl && current) {
      taskLbl.textContent = `${current.floorNumber}º Andar · ${current.companyName} (${current.providerBadge})`;
    }

    const rowsHtml = this.floors
      .map((f) => {
        const activeCls = f.isSelected ? 'is-selected' : '';
        const dotCls = f.workingCount > 0 ? 'is-busy' : 'is-idle';
        return `
          <button type="button" class="xp-floor-btn ${activeCls}" data-floor-id="${this.esc(f.id)}" style="border-left: 4px solid ${f.accentColor || f.providerColor}" title="${this.esc(f.companyName)} — ${this.esc(f.styleLabel)}">
            <span class="xp-floor-num" style="${f.isSelected ? `background:${f.accentColor || '#0054E3'};color:#fff` : ''}">${f.floorNumber}º</span>
            <span class="xp-floor-meta">
              <span class="xp-floor-top">
                <span class="xp-floor-badge" style="background:${f.providerColor}">${f.providerBadge}</span>
                <span class="xp-floor-name">${this.esc(f.companyName)}</span>
              </span>
              <span class="xp-floor-sub">${this.esc(f.styleLabel)}</span>
            </span>
            <span class="xp-floor-led ${dotCls}"></span>
          </button>
        `;
      })
      .join('');

    this.elevatorPanel.innerHTML = `
      <div class="xp-elev-head">
        <span class="xp-elev-title">🏢 Prédio · Elevador</span>
        <div class="xp-elev-head-actions">
          <button type="button" class="xp-elev-mini-btn" id="xp-btn-open-cutaway" title="Ver Prédio Inteiro (Corte Vertical)">Prédio</button>
          <button type="button" class="xp-elev-close-btn" id="xp-btn-close-elev" title="Minimizar Elevador">✕</button>
        </div>
      </div>
      <div class="xp-elev-display">
        <span class="xp-elev-lcd-floor">${current ? `${current.floorNumber}º ANDAR · ${this.esc(current.styleLabel)}` : 'TÉRREO'}</span>
        <span class="xp-elev-lcd-co">${this.esc(current?.companyName ?? 'Habblaud Tower')}</span>
      </div>
      <div class="xp-elev-list">${rowsHtml || '<div class="xp-elev-empty">Carregando andares...</div>'}</div>
      <div class="xp-elev-foot">
        <span class="xp-prov-legend"><i style="background:#0054E3"></i>AG</span>
        <span class="xp-prov-legend"><i style="background:#D97706"></i>Claude</span>
        <span class="xp-prov-legend"><i style="background:#059669"></i>Codex</span>
      </div>
    `;

    this.elevatorPanel.querySelectorAll<HTMLButtonElement>('.xp-floor-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fid = btn.dataset.floorId;
        if (fid) void this.selectFloor(fid);
      });
    });
    this.elevatorPanel.querySelector('#xp-btn-open-cutaway')?.addEventListener('click', () => this.toggleCutaway(true));
    this.elevatorPanel.querySelector('#xp-btn-close-elev')?.addEventListener('click', () => this.toggleElevatorPanel(false));
  }

  private renderCutaway() {
    const selectedIdx = Math.max(0, this.floors.findIndex((f) => f.isSelected));
    const total = Math.max(1, this.floors.length);
    const elevTopPct = (selectedIdx / total) * 100;

    const floorsHtml = this.floors
      .map((f) => {
        const isDark = f.style === 'cyber_neon';
        const agentsChips = f.agents
          .slice(0, 6)
          .map(
            (a) => `
              <div class="xp-cut-agent ${a.status === 'working' ? 'is-working' : ''}" title="${this.esc(a.name)}: ${this.esc(a.lastText)}">
                <span class="xp-cut-avatar"></span>
                <span class="xp-cut-aname">${this.esc(a.name)}</span>
              </div>
            `,
          )
          .join('');

        return `
          <div class="xp-cut-floor ${f.isSelected ? 'is-selected' : ''}" data-floor-id="${this.esc(f.id)}">
            <div class="xp-cut-floor-badge" style="border-left: 5px solid ${f.accentColor}">
              <div class="xp-cut-fnum">${f.floorNumber}º</div>
              <div class="xp-cut-prov" style="background:${f.providerColor}">${f.providerBadge}</div>
            </div>
            <div class="xp-cut-room">
              <div class="xp-cut-room-head">
                <strong>${this.esc(f.companyName)}</strong>
                <span class="xp-cut-style-tag" style="background:${f.accentColor}20;color:${f.accentColor};border:1px solid ${f.accentColor}66">${this.esc(f.styleLabel)}</span>
                <span class="xp-cut-room-prov">${this.esc(f.departments[0])} · ${this.esc(f.departments[1])}</span>
                <span class="xp-cut-enter-cta">${f.isSelected ? '✓ Andar Atual' : 'Subir de Elevador →'}</span>
              </div>
              <div class="xp-cut-interior ${isDark ? 'is-dark-floor' : ''}" style="background:${f.floorBg}">
                <div class="xp-cut-prop xp-cut-rack" title="Rack de Servidores 42U"></div>
                <div class="xp-cut-prop xp-cut-crt" title="Estação CRT Retrô"></div>
                <div class="xp-cut-agents-row">${agentsChips}</div>
                <div class="xp-cut-prop xp-cut-hcsofa" title="Sofá HC Esmeralda"></div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    this.cutawayModal.innerHTML = `
      <div class="xp-cut-window">
        <div class="xp-cut-titlebar">
          <span>🏢 Torre Corporativa Habblaud · Andares Exclusivos por Empresa (Antigravity · Claude · Codex)</span>
          <button type="button" class="xp-win-x" id="xp-cut-close" title="Fechar Corte Vertical">✕</button>
        </div>
        <div class="xp-cut-sky">
          <div class="xp-cut-roof">
            <div class="xp-cut-antenna"></div>
            <div class="xp-cut-neon">HABBLAUD TOWER · CADA ANDAR É UMA EMPRESA ÚNICA</div>
          </div>
          <div class="xp-cut-tower-wrap">
            <div class="xp-cut-shaft" title="Poço do Elevador">
              <div class="xp-cut-cable"></div>
              <div class="xp-cut-car" style="top: calc(${elevTopPct}% + 10px)">🛗</div>
            </div>
            <div class="xp-cut-stack">${floorsHtml}</div>
          </div>
          <div class="xp-cut-lobby">
            <span>🏛️ Térreo · Recepção Geral · Cada andar tem decoração, iluminação e departamentos exclusivos! Clique para viajar de elevador.</span>
          </div>
        </div>
      </div>
    `;

    this.cutawayModal.querySelector('#xp-cut-close')?.addEventListener('click', () => this.toggleCutaway(false));
    this.cutawayModal.addEventListener('click', (e) => {
      if (e.target === this.cutawayModal) this.toggleCutaway(false);
    });
    this.cutawayModal.querySelectorAll<HTMLElement>('.xp-cut-floor').forEach((el) => {
      el.addEventListener('click', () => {
        const fid = el.dataset.floorId;
        if (fid) void this.selectFloor(fid);
      });
    });
  }

  public destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.elevatorPanel.remove();
    this.cutawayModal.remove();
    this.bannerEl.remove();
    this.doorsEl.remove();
  }
}
