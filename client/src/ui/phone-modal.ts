// Janela Habblaud Phone no Escritório (Simulador de Smartphone ao vivo + Pareamento Wi-Fi / PWA)

export class PhoneModalUI {
  private modal: HTMLElement;
  private isOpen = false;
  private lanUrl = 'http://localhost:4747/phone';
  private localUrl = 'http://localhost:4747/phone';

  constructor() {
    this.modal = document.createElement('div');
    this.modal.id = 'xp-phone-modal';
    this.modal.className = 'xp-phone-modal';
    this.modal.hidden = true;
    document.body.appendChild(this.modal);

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  public async open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.modal.hidden = false;

    try {
      const res = await fetch('/api/phone/state');
      if (res.ok) {
        const data = await res.json();
        this.lanUrl = data.lanUrl || this.lanUrl;
        this.localUrl = data.localUrl || this.localUrl;
      }
    } catch {
      // fallback
    }

    this.render();
  }

  public close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.modal.hidden = true;
    this.modal.innerHTML = '';
  }

  private render() {
    this.modal.innerHTML = `
      <div class="xp-phone-window">
        <div class="xp-cut-titlebar">
          <span>PixPhone PWA · Ligações, Dúvidas &amp; Autorizações Remotas</span>
          <button type="button" class="xp-win-x" id="xp-phone-close">✕</button>
        </div>

        <div class="xp-phone-body">
          <!-- Smartphone Interativo ao Vivo (mesmo PWA /phone que roda no seu celular!) -->
          <div class="xp-phone-device">
            <div class="xp-phone-notch"></div>
            <iframe id="xp-phone-frame" class="xp-phone-frame" src="/phone" allow="microphone; autoplay"></iframe>
          </div>

          <!-- Painel de Pareamento + Gatilhos de Teste -->
          <div class="xp-phone-side">
            <div class="xp-phone-card">
              <h4>📡 Conectar seu Celular Real (PWA)</h4>
              <p>Abra este endereço no celular (no mesmo Wi-Fi ou Tailscale) e toque em <strong>Adicionar à Tela de Início</strong>:</p>
              <div class="xp-phone-url-row">
                <input id="xp-phone-url-input" type="text" readonly value="${this.lanUrl}" class="xp-meeting-input" />
                <button type="button" id="xp-phone-copy" class="ui-btn">📋 Copiar</button>
              </div>
              <div class="xp-phone-url-actions">
                <a href="/phone" target="_blank" rel="noopener" class="ui-btn" style="text-decoration:none;text-align:center">🔗 Abrir em Nova Aba</a>
              </div>
              <small class="xp-phone-tip">Dica: para acesso de outro aparelho na rede Wi-Fi, rode o servidor com <code>npm run remote:setup</code> ou <code>HABBLAUD_HOST=0.0.0.0</code>.</small>
            </div>

            <div class="xp-phone-card">
              <h4>📞 Disparar Ligação do Escritório Agora</h4>
              <p>Teste o fluxo completo: toque no telefone → atender → voz neural emocional PT-BR → responder por microfone ou 1 toque:</p>
              <div class="xp-phone-sim-btns">
                <button type="button" class="ui-btn xp-meeting-approve-btn" data-preset="permission">🔐 Dev: Pedir Autorização de Deploy</button>
                <button type="button" class="ui-btn" data-preset="question">❓ Vicente: Dúvida Rápida de Produto</button>
                <button type="button" class="ui-btn" data-preset="delivery">🚀 Release: Aviso de Entrega Pronta</button>
              </div>
            </div>

            <div class="xp-phone-card">
              <h4>🎙️ Como funciona quando você está fora</h4>
              <ul class="xp-phone-list">
                <li><strong>Chamada real:</strong> os agentes ligam falando com prosódia emocional natural.</li>
                <li><strong>Resposta por voz:</strong> toque no 🎤 para responder falando ou use 1 toque (Autorizar / Recusar).</li>
                <li><strong>Discagem direta:</strong> na aba <em>Ligar p/ Time</em>, você liga pra qualquer agente pedir status!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modal.querySelector('#xp-phone-close')?.addEventListener('click', () => this.close());

    this.modal.querySelector('#xp-phone-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.lanUrl);
        const btn = this.modal.querySelector('#xp-phone-copy');
        if (btn) {
          btn.textContent = '✅ Copiado!';
          setTimeout(() => {
            btn.textContent = '📋 Copiar';
          }, 1800);
        }
      } catch {
        // ignore
      }
    });

    this.modal.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const preset = btn.dataset.preset || 'question';
        await fetch('/api/phone/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset }),
        });
      });
    });
  }
}
