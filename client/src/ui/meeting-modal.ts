import {
  preloadDeckImages,
  renderSlideToCanvas,
  type PresentationDeck,
  type PresentationSlide,
} from './meeting-slides';
import type { CameraPreset, LiveMeetingAgent, MeetingRoom3D } from './meeting-room-3d';

export interface MeetingVoiceBridge {
  setMeetingMode: (active: boolean) => void;
  prefetchPresenterLine: (agentKey: string, text: string) => void;
  speakPresenterLine: (agentKey: string, text: string, onStart?: () => void) => Promise<boolean>;
  stopMeetingAudio: () => void;
  playFoley?: (kind: 'cheer' | 'paper' | 'mouse') => void;
  getLiveAgents?: () => LiveMeetingAgent[];
}

const PRESENTER_OPTIONS = [
  { key: 'vicente', name: 'Vicente', role: 'Pesquisador & Líder' },
  { key: 'dev', name: 'Dev', role: 'Engenheiro Full-Stack' },
  { key: 'qa', name: 'QA Auditor', role: 'Qualidade & Métricas' },
  { key: 'art', name: 'Art XP', role: 'Direção de Arte 3D/XP' },
  { key: 'ux', name: 'UX/UI', role: 'Experiência & Layout' },
  { key: 'fx', name: 'FX Áudio', role: 'Vozes & Foley DSP' },
  { key: 'user', name: 'Usuário', role: 'Advogado do Fundador' },
  { key: 'release', name: 'Release', role: 'Deploy & Entrega' },
];

export class MeetingModalUI {
  private voice: MeetingVoiceBridge;
  private modal: HTMLElement;
  private room: MeetingRoom3D | null = null;
  private deck: PresentationDeck | null = null;

  private slideIndex = 0;
  private isOpen = false;
  private isPlaying = false;
  private approved = false;
  private playRunId = 0;
  private activePreset: CameraPreset = 'overview';
  private editorOpen = false;
  private askOpen = false;
  private isFullscreen = false;
  private isSlideTheater = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(voice: MeetingVoiceBridge) {
    this.voice = voice;

    this.modal = document.createElement('div');
    this.modal.id = 'xp-meeting-modal';
    this.modal.className = 'xp-meeting-modal';
    this.modal.hidden = true;
    document.body.appendChild(this.modal);

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal && !this.isFullscreen) this.close();
    });
  }

  public async open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.approved = false;
    this.editorOpen = false;
    this.askOpen = false;
    this.isFullscreen = false;
    this.isSlideTheater = false;
    this.voice.setMeetingMode(true);
    this.modal.hidden = false;
    this.modal.classList.remove('is-fullscreen');

    this.renderShell();
    this.bindKeyboardShortcuts();
    this.setSubtitle('Vicente', 'Preparando Sala 3D Habblaud e carregando dados reais do projeto...', false);

    try {
      const [deckRes, mod3d] = await Promise.all([
        fetch('/api/presentation/deck'),
        import('./meeting-room-3d'),
      ]);
      if (!this.isOpen) return;

      if (!deckRes.ok) throw new Error(`HTTP ${deckRes.status}`);
      this.deck = (await deckRes.json()) as PresentationDeck;
      this.slideIndex = 0;

      const stage = this.modal.querySelector('#xp-meeting-stage') as HTMLElement | null;
      if (stage) {
        const liveAgents = this.voice.getLiveAgents?.();
        this.room = new mod3d.MeetingRoom3D(stage, liveAgents);
      }

      preloadDeckImages(this.deck, () => {
        if (this.deck) {
          this.room?.updatePresentation(this.deck, this.slideIndex, this.approved);
          this.syncTheaterCanvas();
        }
      });

      this.syncSlideUI();
      this.prefetchUpcoming(0);
      void this.startPresentation();
    } catch (err) {
      this.setSubtitle(
        'Sistema',
        `Não foi possível carregar a Sala 3D: ${err instanceof Error ? err.message : 'erro'}`,
        false,
      );
    }
  }

  public close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stopPresentation();
    this.unbindKeyboardShortcuts();
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
    this.room?.dispose();
    this.room = null;
    this.modal.hidden = true;
    this.modal.classList.remove('is-fullscreen');
    this.voice.setMeetingMode(false);
  }

  private bindKeyboardShortcuts() {
    this.unbindKeyboardShortcuts();
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.isOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.toggleSlideTheater();
      } else if (e.key === 'ArrowRight' && this.deck) {
        this.goToSlide((this.slideIndex + 1) % this.deck.slides.length, this.isPlaying);
      } else if (e.key === 'ArrowLeft' && this.deck) {
        this.goToSlide((this.slideIndex - 1 + this.deck.slides.length) % this.deck.slides.length, this.isPlaying);
      } else if (e.key === 'Escape') {
        if (this.isSlideTheater) this.toggleSlideTheater(false);
        else if (this.isFullscreen) this.toggleFullscreen(false);
        else this.close();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private unbindKeyboardShortcuts() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  private toggleFullscreen(force?: boolean) {
    this.isFullscreen = typeof force === 'boolean' ? force : !this.isFullscreen;
    this.modal.classList.toggle('is-fullscreen', this.isFullscreen);

    const btn = this.modal.querySelector('#xp-meeting-fullscreen-btn');
    if (btn) btn.textContent = this.isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia';

    if (this.isFullscreen) {
      void this.modal.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }

    setTimeout(() => this.room?.forceResize(), 60);
    setTimeout(() => this.room?.forceResize(), 220);
  }

  private toggleSlideTheater(force?: boolean) {
    this.isSlideTheater = typeof force === 'boolean' ? force : !this.isSlideTheater;
    const theater = this.modal.querySelector('#xp-meeting-slide-theater') as HTMLElement | null;
    if (theater) theater.hidden = !this.isSlideTheater;

    const btn = this.modal.querySelector('#xp-meeting-slidefull-btn');
    if (btn) {
      btn.textContent = this.isSlideTheater ? 'Voltar ao 3D' : 'Slide Cheio';
      btn.classList.toggle('is-active', this.isSlideTheater);
    }

    if (this.isSlideTheater) {
      this.syncTheaterCanvas();
    } else {
      setTimeout(() => this.room?.forceResize(), 50);
    }
    this.voice.playFoley?.('mouse');
  }

  private syncTheaterCanvas() {
    if (!this.deck) return;
    const canvas = this.modal.querySelector('#xp-meeting-theater-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    renderSlideToCanvas(canvas, this.deck, this.slideIndex, this.approved);
  }

  private renderShell() {
    this.modal.innerHTML = `
      <div class="xp-meeting-window">
        <div class="xp-cut-titlebar xp-meeting-titlebar">
          <div class="xp-meeting-title-left">
            <span>Sala de Reunião 3D · PixOffice</span>
            <span id="xp-meeting-company" class="xp-meeting-company-pill">Carregando...</span>
          </div>
          <div class="xp-meeting-cam-group" role="group" aria-label="Câmeras 3D">
            <button type="button" class="xp-meeting-cam-btn is-active" data-cam="overview">Geral</button>
            <button type="button" class="xp-meeting-cam-btn" data-cam="screen">Telão</button>
            <button type="button" class="xp-meeting-cam-btn" data-cam="podium">Púlpito</button>
            <button type="button" class="xp-meeting-cam-btn" data-cam="table">Mesa</button>
          </div>
          <div class="xp-meeting-head-actions">
            <button type="button" id="xp-meeting-slidefull-btn" class="xp-meeting-cam-btn" title="Ver o slide em tela cheia (Tecla S)">Slide Cheio</button>
            <button type="button" id="xp-meeting-fullscreen-btn" class="xp-elev-mini-btn" title="Expandir Sala de Reunião em tela cheia (Tecla F)">Tela Cheia</button>
            <button type="button" id="xp-meeting-edit-btn" class="xp-elev-mini-btn">Slides</button>
            <button type="button" id="xp-meeting-refresh-btn" class="xp-elev-mini-btn">Atualizar</button>
            <button type="button" id="xp-meeting-close-btn" class="xp-win-x" title="Fechar Sala 3D">✕</button>
          </div>
        </div>

        <div id="xp-meeting-session-bar" class="xp-meeting-session-bar">
          <span id="xp-sess-sprint" class="xp-sess-item">Sessão ativa</span>
          <span id="xp-sess-slide" class="xp-sess-item">Slide 1 / 5</span>
          <span id="xp-sess-presenter" class="xp-sess-item">Apresentador: Vicente</span>
          <span id="xp-sess-metrics" class="xp-sess-item">8 agentes online</span>
        </div>

        <div class="xp-meeting-main">
          <div class="xp-meeting-stage-wrap">
            <div id="xp-meeting-stage" class="xp-meeting-stage"></div>
            <div class="xp-meeting-orbit-hint">Arraste para girar 3D · Scroll zoom · F: Tela Cheia · S: Slide Cheio</div>

            <!-- Modo Teatro / Slide em Tela Cheia 1280×720 -->
            <div id="xp-meeting-slide-theater" class="xp-meeting-slide-theater" hidden>
              <canvas id="xp-meeting-theater-canvas" class="xp-meeting-theater-canvas" width="1280" height="720"></canvas>
              <button type="button" id="xp-meeting-theater-back" class="xp-meeting-theater-back">Voltar para Sala 3D</button>
            </div>

            <div id="xp-meeting-subtitle" class="xp-meeting-subtitle">
              <div class="xp-meeting-sub-head">
                <span id="xp-meeting-sub-speaker" class="xp-meeting-sub-speaker">Vicente</span>
                <span id="xp-meeting-sub-status" class="xp-meeting-sub-status">Ao vivo no púlpito</span>
              </div>
              <div id="xp-meeting-sub-text" class="xp-meeting-sub-text"></div>
            </div>

            <div id="xp-meeting-ask-drawer" class="xp-meeting-ask-drawer" hidden>
              <div class="xp-meeting-ask-head">
                <strong>Perguntar ou pedir ajuste ao time</strong>
                <button type="button" id="xp-meeting-ask-close" class="xp-win-x">✕</button>
              </div>
              <div class="xp-meeting-ask-chips">
                <button type="button" class="xp-meeting-chip" data-q="Qual foi o maior risco técnico nessa entrega?">Maior risco técnico?</button>
                <button type="button" class="xp-meeting-chip" data-q="Como ficou a performance do 3D e do áudio?">Performance 3D e Áudio?</button>
                <button type="button" class="xp-meeting-chip" data-q="Como funciona o Habblaud Phone no celular e na nuvem?">Habblaud Phone & Nuvem?</button>
              </div>
              <div class="xp-meeting-ask-row">
                <input id="xp-meeting-ask-input" type="text" class="xp-meeting-input" placeholder="Digite sua pergunta ou ajuste para os agentes responderem ao vivo..." />
                <button type="button" id="xp-meeting-ask-send" class="ui-btn">Enviar</button>
              </div>
            </div>
          </div>

          <aside id="xp-meeting-editor" class="xp-meeting-editor" hidden>
            <div class="xp-meeting-editor-head">
              <strong>Editor de Slides</strong>
              <button type="button" id="xp-meeting-add-slide" class="ui-btn">+ Novo Slide</button>
            </div>
            <div class="xp-meeting-editor-body">
              <label>Título do Slide
                <input id="xp-ed-title" type="text" class="xp-meeting-input" />
              </label>
              <label>Subtítulo
                <input id="xp-ed-subtitle" type="text" class="xp-meeting-input" />
              </label>
              <label>Apresentador no Púlpito
                <select id="xp-ed-presenter" class="xp-vp-select">
                  ${PRESENTER_OPTIONS.map((p) => `<option value="${p.key}">${p.name} (${p.role})</option>`).join('')}
                </select>
              </label>
              <label>Tópicos no Telão (1 por linha)
                <textarea id="xp-ed-bullets" rows="4" class="xp-meeting-textarea"></textarea>
              </label>
              <label>Fala Narrada do Agente
                <textarea id="xp-ed-narration" rows="3" class="xp-meeting-textarea"></textarea>
              </label>
              <button type="button" id="xp-ed-apply" class="ui-btn xp-meeting-apply-btn">Projetar no Telão 3D</button>
            </div>
          </aside>
        </div>

        <div class="xp-meeting-dock">
          <div class="xp-meeting-playback">
            <button type="button" id="xp-meeting-prev" class="ui-btn" title="Slide anterior">◀ Anterior</button>
            <button type="button" id="xp-meeting-play" class="ui-btn xp-meeting-play-btn">Pausar</button>
            <button type="button" id="xp-meeting-next" class="ui-btn" title="Próximo slide">Próximo ▶</button>
          </div>

          <div id="xp-meeting-pills" class="xp-meeting-pills"></div>

          <div class="xp-meeting-founder-actions">
            <button type="button" id="xp-meeting-ask-btn" class="ui-btn">Perguntar</button>
            <button type="button" id="xp-meeting-changes-btn" class="ui-btn">Pedir Ajuste</button>
            <button type="button" id="xp-meeting-approve-btn" class="ui-btn xp-meeting-approve-btn">Aprovar Entrega</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    this.modal.querySelector('#xp-meeting-close-btn')?.addEventListener('click', () => this.close());
    this.modal.querySelector('#xp-meeting-fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());
    this.modal.querySelector('#xp-meeting-slidefull-btn')?.addEventListener('click', () => this.toggleSlideTheater());
    this.modal.querySelector('#xp-meeting-theater-back')?.addEventListener('click', () => this.toggleSlideTheater(false));

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-meeting-cam-btn[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cam = btn.dataset.cam as CameraPreset | undefined;
        if (!cam) return;
        if (this.isSlideTheater) this.toggleSlideTheater(false);
        this.activePreset = cam;
        this.room?.setCameraPreset(cam);
        this.modal.querySelectorAll('.xp-meeting-cam-btn[data-cam]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.voice.playFoley?.('mouse');
      });
    });

    this.modal.querySelector('#xp-meeting-prev')?.addEventListener('click', () => {
      if (!this.deck) return;
      this.goToSlide((this.slideIndex - 1 + this.deck.slides.length) % this.deck.slides.length, this.isPlaying);
    });

    this.modal.querySelector('#xp-meeting-next')?.addEventListener('click', () => {
      if (!this.deck) return;
      this.goToSlide((this.slideIndex + 1) % this.deck.slides.length, this.isPlaying);
    });

    this.modal.querySelector('#xp-meeting-play')?.addEventListener('click', () => {
      if (this.isPlaying) {
        this.stopPresentation();
      } else {
        void this.startPresentation();
      }
    });

    this.modal.querySelector('#xp-meeting-refresh-btn')?.addEventListener('click', async () => {
      this.voice.playFoley?.('paper');
      try {
        const res = await fetch('/api/presentation/deck');
        if (!res.ok) return;
        this.deck = (await res.json()) as PresentationDeck;
        this.slideIndex = Math.min(this.slideIndex, this.deck.slides.length - 1);
        preloadDeckImages(this.deck, () => {
          if (this.deck) {
            this.room?.updatePresentation(this.deck, this.slideIndex, this.approved);
            this.syncTheaterCanvas();
          }
        });
        this.syncSlideUI();
      } catch {
        // ignore
      }
    });

    this.modal.querySelector('#xp-meeting-edit-btn')?.addEventListener('click', () => {
      this.editorOpen = !this.editorOpen;
      const ed = this.modal.querySelector('#xp-meeting-editor') as HTMLElement | null;
      if (ed) ed.hidden = !this.editorOpen;
      if (this.editorOpen) this.populateEditor();
      setTimeout(() => this.room?.forceResize(), 60);
    });

    this.modal.querySelector('#xp-meeting-add-slide')?.addEventListener('click', () => {
      if (!this.deck) return;
      const newSlide: PresentationSlide = {
        id: `slide-custom-${Date.now()}`,
        kind: 'custom',
        title: `Slide Personalizado #${this.deck.slides.length + 1}`,
        subtitle: 'Adicionado ao vivo pelo fundador na Sala 3D',
        presenterKey: 'vicente',
        presenterName: 'Vicente',
        presenterRole: 'Pesquisador & Líder',
        narration: 'Este novo slide foi inserido ao vivo durante a reunião para destacarmos um ponto estratégico importante!',
        bullets: [
          'Ponto estratégico definido pelo fundador',
          'Ação imediata alinhada com toda a equipe do andar',
        ],
        laserTargets: [{ x: 0.45, y: 0.45 }],
      };
      this.deck.slides.push(newSlide);
      this.goToSlide(this.deck.slides.length - 1, false);
      this.populateEditor();
      this.voice.playFoley?.('paper');
    });

    this.modal.querySelector('#xp-ed-apply')?.addEventListener('click', () => {
      if (!this.deck) return;
      const slide = this.deck.slides[this.slideIndex];
      if (!slide) return;
      const title = (this.modal.querySelector('#xp-ed-title') as HTMLInputElement).value.trim();
      const subtitle = (this.modal.querySelector('#xp-ed-subtitle') as HTMLInputElement).value.trim();
      const presenterKey = (this.modal.querySelector('#xp-ed-presenter') as HTMLSelectElement).value;
      const bulletsRaw = (this.modal.querySelector('#xp-ed-bullets') as HTMLTextAreaElement).value;
      const narration = (this.modal.querySelector('#xp-ed-narration') as HTMLTextAreaElement).value.trim();

      const pInfo = PRESENTER_OPTIONS.find((p) => p.key === presenterKey) ?? PRESENTER_OPTIONS[0];
      if (title) slide.title = title;
      slide.subtitle = subtitle || slide.subtitle;
      slide.presenterKey = pInfo.key;
      slide.presenterName = pInfo.name;
      slide.presenterRole = pInfo.role;
      slide.bullets = bulletsRaw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (narration) slide.narration = narration;

      this.syncSlideUI();
      this.voice.playFoley?.('mouse');
    });

    const toggleAsk = (open: boolean, presetPlaceholder?: string) => {
      this.askOpen = open;
      const drawer = this.modal.querySelector('#xp-meeting-ask-drawer') as HTMLElement | null;
      if (drawer) drawer.hidden = !open;
      if (open) {
        this.stopPresentation();
        const inp = this.modal.querySelector('#xp-meeting-ask-input') as HTMLInputElement | null;
        if (inp) {
          if (presetPlaceholder) inp.placeholder = presetPlaceholder;
          inp.focus();
        }
      }
    };

    this.modal.querySelector('#xp-meeting-ask-btn')?.addEventListener('click', () => {
      toggleAsk(!this.askOpen, 'Digite sua pergunta para os agentes responderem ao vivo...');
    });
    this.modal.querySelector('#xp-meeting-ask-close')?.addEventListener('click', () => toggleAsk(false));

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-meeting-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.q;
        if (q) void this.submitFounderQuestion(q);
      });
    });

    this.modal.querySelector('#xp-meeting-ask-send')?.addEventListener('click', () => {
      const inp = this.modal.querySelector('#xp-meeting-ask-input') as HTMLInputElement | null;
      const q = inp?.value.trim();
      if (q) {
        if (inp) inp.value = '';
        void this.submitFounderQuestion(q);
      }
    });

    this.modal.querySelector('#xp-meeting-ask-input')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        const inp = e.target as HTMLInputElement;
        const q = inp.value.trim();
        if (q) {
          inp.value = '';
          void this.submitFounderQuestion(q);
        }
      }
    });

    this.modal.querySelector('#xp-meeting-changes-btn')?.addEventListener('click', () => {
      const note = window.prompt('Qual ajuste você quer registrar para a equipe?')?.trim();
      if (!note) return;
      void this.submitFounderAction('changes', note);
    });

    this.modal.querySelector('#xp-meeting-approve-btn')?.addEventListener('click', () => {
      void this.submitFounderAction('approve', 'Entrega aprovada ao vivo na Sala 3D');
    });
  }

  private populateEditor() {
    if (!this.deck) return;
    const slide = this.deck.slides[this.slideIndex];
    if (!slide) return;
    (this.modal.querySelector('#xp-ed-title') as HTMLInputElement).value = slide.title;
    (this.modal.querySelector('#xp-ed-subtitle') as HTMLInputElement).value = slide.subtitle;
    (this.modal.querySelector('#xp-ed-presenter') as HTMLSelectElement).value = slide.presenterKey;
    (this.modal.querySelector('#xp-ed-bullets') as HTMLTextAreaElement).value = slide.bullets.join('\n');
    (this.modal.querySelector('#xp-ed-narration') as HTMLTextAreaElement).value = slide.narration;
  }

  private syncSlideUI() {
    if (!this.deck) return;
    const slide = this.deck.slides[this.slideIndex];
    if (!slide) return;

    const comp = this.modal.querySelector('#xp-meeting-company');
    if (comp) comp.textContent = `${this.deck.companyName} · ${this.deck.floorName}`;

    const sessSprint = this.modal.querySelector('#xp-sess-sprint');
    if (sessSprint) sessSprint.textContent = this.deck.sprintTitle;
    const sessSlide = this.modal.querySelector('#xp-sess-slide');
    if (sessSlide) sessSlide.textContent = `Slide ${this.slideIndex + 1}/${this.deck.slides.length}: ${slide.title}`;
    const sessPres = this.modal.querySelector('#xp-sess-presenter');
    if (sessPres) sessPres.textContent = `No púlpito: ${slide.presenterName} (${slide.presenterRole})`;
    const sessMetrics = this.modal.querySelector('#xp-sess-metrics');
    if (sessMetrics) {
      sessMetrics.textContent = `${this.deck.totalAgents} agentes (${this.deck.workingAgents} ativos) · ${this.approved ? 'APROVADA' : 'Em revisão'}`;
    }

    this.room?.updatePresentation(this.deck, this.slideIndex, this.approved);
    this.room?.setSpeakerState(slide.presenterKey, this.isPlaying);
    if (this.isSlideTheater) this.syncTheaterCanvas();

    const pillsEl = this.modal.querySelector('#xp-meeting-pills');
    if (pillsEl) {
      pillsEl.innerHTML = this.deck.slides
        .map(
          (s, idx) =>
            `<button type="button" class="xp-meeting-pill ${idx === this.slideIndex ? 'is-active' : ''}" data-idx="${idx}" title="${s.title}">${idx + 1}. ${s.presenterName}</button>`,
        )
        .join('');
      pillsEl.querySelectorAll<HTMLButtonElement>('.xp-meeting-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.idx);
          if (!Number.isNaN(i)) this.goToSlide(i, this.isPlaying);
        });
      });
    }

    const playBtn = this.modal.querySelector('#xp-meeting-play');
    if (playBtn) playBtn.textContent = this.isPlaying ? 'Pausar' : 'Apresentar';

    if (this.editorOpen) this.populateEditor();
    if (!this.isPlaying) {
      this.setSubtitle(slide.presenterName, slide.narration, false);
    }
  }

  private setSubtitle(speaker: string, text: string, live: boolean) {
    const sp = this.modal.querySelector('#xp-meeting-sub-speaker');
    const st = this.modal.querySelector('#xp-meeting-sub-status');
    const tx = this.modal.querySelector('#xp-meeting-sub-text');
    if (sp) sp.textContent = speaker;
    if (st) st.textContent = live ? 'Apresentando ao vivo (laser ativo)' : 'Pausado';
    if (tx) tx.textContent = text;
  }

  private prefetchUpcoming(idx: number) {
    if (!this.deck) return;
    const cur = this.deck.slides[idx];
    const next = this.deck.slides[idx + 1];
    if (cur) this.voice.prefetchPresenterLine(cur.presenterKey, cur.narration);
    if (next) this.voice.prefetchPresenterLine(next.presenterKey, next.narration);
  }

  private goToSlide(idx: number, continuePlaying: boolean) {
    if (!this.deck) return;
    this.stopPresentation();
    this.slideIndex = idx;
    this.voice.playFoley?.('paper');
    this.syncSlideUI();
    if (continuePlaying) {
      void this.startPresentation();
    }
  }

  private stopPresentation() {
    this.playRunId++;
    this.isPlaying = false;
    this.voice.stopMeetingAudio();
    this.room?.setSpeakerState(null, false);
    const playBtn = this.modal.querySelector('#xp-meeting-play');
    if (playBtn) playBtn.textContent = '▶ Apresentar';
  }

  private async startPresentation() {
    if (!this.deck || !this.isOpen) return;
    const runId = ++this.playRunId;
    this.isPlaying = true;
    const playBtn = this.modal.querySelector('#xp-meeting-play');
    if (playBtn) playBtn.textContent = '⏸ Pausar';

    for (let i = this.slideIndex; i < this.deck.slides.length; i++) {
      if (runId !== this.playRunId || !this.isOpen) return;
      this.slideIndex = i;
      this.syncSlideUI();
      this.prefetchUpcoming(i);

      const slide = this.deck.slides[i];
      const completed = await this.voice.speakPresenterLine(slide.presenterKey, slide.narration, () => {
        if (runId !== this.playRunId || !this.isOpen) return;
        this.room?.setSpeakerState(slide.presenterKey, true);
        this.setSubtitle(`${slide.presenterName} (${slide.presenterRole})`, slide.narration, true);
      });

      if (!completed || runId !== this.playRunId || !this.isOpen) return;
      this.room?.setSpeakerState(slide.presenterKey, false);

      if (i < this.deck.slides.length - 1) {
        await new Promise((r) => setTimeout(r, 850));
      }
    }

    if (runId === this.playRunId) {
      this.isPlaying = false;
      this.room?.setSpeakerState(null, false);
      if (playBtn) playBtn.textContent = '▶ Reapresentar';
      const last = this.deck.slides[this.slideIndex];
      if (last) {
        this.setSubtitle(
          last.presenterName,
          'Apresentação concluída! Você pode fazer uma pergunta, pedir ajuste ou clicar em ✅ Aprovar.',
          false,
        );
      }
    }
  }

  private async submitFounderQuestion(question: string) {
    if (!this.deck) return;
    this.stopPresentation();
    const drawer = this.modal.querySelector('#xp-meeting-ask-drawer') as HTMLElement | null;
    if (drawer) drawer.hidden = true;
    this.askOpen = false;

    const slide = this.deck.slides[this.slideIndex];
    this.setSubtitle('Fundador', `Pergunta enviada: "${question}"`, false);

    try {
      const res = await fetch('/api/presentation/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, slideTitle: slide?.title ?? 'Apresentação' }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { turns?: Array<{ agentKey: string; name: string; text: string }> };
      await this.playLiveTurns(data.turns ?? []);
    } catch {
      // ignore
    }
  }

  private async submitFounderAction(action: 'approve' | 'changes', note: string) {
    if (!this.deck) return;
    this.stopPresentation();
    if (action === 'approve') {
      this.approved = true;
      this.slideIndex = this.deck.slides.length - 1;
      this.syncSlideUI();
      this.room?.triggerCelebration();
      this.voice.playFoley?.('cheer');
    }

    try {
      const res = await fetch('/api/presentation/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { turns?: Array<{ agentKey: string; name: string; text: string }> };
      await this.playLiveTurns(data.turns ?? []);
    } catch {
      // ignore
    }
  }

  private async playLiveTurns(turns: Array<{ agentKey: string; name: string; text: string }>) {
    const runId = ++this.playRunId;
    for (const t of turns) {
      this.voice.prefetchPresenterLine(t.agentKey, t.text);
    }
    for (const t of turns) {
      if (runId !== this.playRunId || !this.isOpen) return;
      const ok = await this.voice.speakPresenterLine(t.agentKey, t.text, () => {
        if (runId !== this.playRunId || !this.isOpen) return;
        this.room?.setSpeakerState(t.agentKey, true);
        this.setSubtitle(t.name, t.text, true);
      });
      if (!ok) return;
      this.room?.setSpeakerState(t.agentKey, false);
      await new Promise((r) => setTimeout(r, 320));
    }
  }
}
