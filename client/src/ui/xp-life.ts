// Motor de Emoções Reais (Modelo PAD + Avaliação OCC), Memória Episódica, Personalidades,
// Amizade, Romance, Guarda-Roupa e Diálogos Humanos Combinatórios (Zero Repetição & Zero Robô!)
import type { AgentInfo } from '../../../shared/types';
import type { WorldApi } from '../world/api';
import type { OfficeStore } from '../net/store';
import { ACCESSORIES, TOP_STYLES, type AppearanceParts } from '../../../shared/appearance';
import { ACC_COLORS, TOP_COLORS, LIGHT_ACCENTS } from '../../../shared/world/appearance-flat';

export type RelationStage = 'colegas' | 'amigos' | 'melhores_amigos' | 'flerte' | 'namoro';

export type EmotionTag =
  | 'joy'
  | 'excited'
  | 'warm'
  | 'flirty'
  | 'curious'
  | 'stressed'
  | 'tired'
  | 'proud'
  | 'sarcastic'
  | 'relieved'
  | 'calm';

export interface PadState {
  pleasure: number; // -1 (frustrado) .. +1 (feliz)
  arousal: number;  // -1 (exausto/calmo) .. +1 (pilhado/eufórico)
  dominance: number; // -1 (inseguro) .. +1 (confiante)
}

export interface AgentLifeProfile {
  id: string;
  name: string;
  archetype: string;
  sign: string;
  hobby: string;
  drink: string;
  music: string;
  motto: string;
  speechTic: string; // cacoete humano natural ("olha só", "cara", "nossa", "peraí"...)
  pad: PadState;
  emotion: EmotionTag;
  mood: string;
  energy: number;
  caffeine: number;
  social: number;
  memories: string[]; // memória episódica recente do que aconteceu no dia
}

export interface AgentRelation {
  key: string;
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  affinity: number; // 0..100
  stage: RelationStage;
  interactions: number;
  lastMoment: string;
}

export interface GossipEntry {
  at: number;
  icon: string;
  text: string;
}

export interface GeneratedExchange {
  speakerAId: string;
  speakerAName: string;
  textA: string;
  emotionA: EmotionTag;
  poseA: 'dance' | 'flirt' | 'wave' | 'clap' | 'cheer' | 'laugh' | 'talk';
  emojiA: string;
  speakerBId: string;
  speakerBName: string;
  textB: string;
  emotionB: EmotionTag;
  poseB: 'dance' | 'flirt' | 'wave' | 'clap' | 'cheer' | 'laugh' | 'talk';
  emojiB: string;
  stage: RelationStage;
  isRomantic: boolean;
}

const ARCHETYPES = [
  { name: 'Líder Carismático', hobby: 'estrategiar projetos', drink: 'espresso duplo', music: 'lo-fi jazz', motto: 'Uma ideia boa muda o andar inteiro.', tic: 'Olha só' },
  { name: 'Hacker Noturno', hobby: 'otimizar código', drink: 'energético gelado', music: 'synthwave', motto: 'Se compilou de primeira, desconfie.', tic: 'Cara' },
  { name: 'DJ do Escritório', hobby: 'mixar batidas retrô', drink: 'chá gelado de pêssego', music: 'eletrônica anos 2000', motto: 'Sem trilha sonora não sai deploy.', tic: 'Nossa' },
  { name: 'Perfeccionista Zen', hobby: 'caçar bugs escondidos', drink: 'chá verde matcha', music: 'piano suave', motto: 'Zero erros no console traz paz.', tic: 'Peraí' },
  { name: 'Piadista do Corredor', hobby: 'fazer memes da equipe', drink: 'cappuccino cremoso', music: 'pop nostálgico', motto: 'Quem ri junto entrega mais rápido.', tic: 'Sério mesmo' },
  { name: 'Esteta Retrô', hobby: 'colecionar pixel art', drink: 'mocha com canela', music: 'vaporwave', motto: 'Windows XP Luna foi o auge do design.', tic: 'Gente' },
  { name: 'Sonhador Criativo', hobby: 'rascunhar ideias novas', drink: 'latte de baunilha', music: 'indie acústico', motto: 'Cada detalhe conta uma história.', tic: 'Acredita que' },
  { name: 'Romântico Incurável', hobby: 'escrever bilhetes', drink: 'chocolate quente', music: 'MPB acústica', motto: 'O melhor commit é o do coração.', tic: 'Sabe o que eu tava pensando' },
  { name: 'Campeão de Fliperama', hobby: 'bater recordes no arcade', drink: 'guaraná trincando', music: 'chiptune', motto: 'No ping-pong eu não perco fácil.', tic: 'Eita' },
  { name: 'Curioso Nato', hobby: 'ler ficção científica', drink: 'café coado na hora', music: 'rock alternativo', motto: 'Sempre tem um jeito mais esperto.', tic: 'Me tira uma dúvida' },
  { name: 'Café-Dependente', hobby: 'provar grãos especiais', drink: 'café preto forte', music: 'bossa nova', motto: 'Antes do primeiro café eu nem existo.', tic: 'Ai ai' },
  { name: 'Estrategista Calmo', hobby: 'jogar xadrez e RPG', drink: 'água com limão', music: 'trilhas de videogame', motto: 'No fim tudo se encaixa.', tic: 'Vou te falar' },
] as const;

const SIGNS = ['Áries ♈', 'Touro ♉', 'Gêmeos ♊', 'Câncer ♋', 'Leão ♌', 'Virgem ♍', 'Libra ♎', 'Escorpião ♏', 'Sagitário ♐', 'Capricórnio ♑', 'Aquário ♒', 'Peixes ♓'];

function emotionFromPad(pad: PadState, romantic = false): { tag: EmotionTag; label: string } {
  if (romantic) return { tag: 'flirty', label: 'Apaixonado 🥰' };
  const { pleasure: p, arousal: a, dominance: d } = pad;
  if (p >= 0.45 && a >= 0.4) return { tag: 'excited', label: 'Empolgado 🤩' };
  if (p >= 0.4 && d >= 0.35) return { tag: 'proud', label: 'Orgulhoso 🥳' };
  if (p >= 0.3 && a < 0.15) return { tag: 'relieved', label: 'Aliviado 😮‍💨' };
  if (p >= 0.25) return { tag: 'joy', label: 'Feliz 😄' };
  if (p <= -0.25 && a >= 0.25) return { tag: 'stressed', label: 'Estressado 😤' };
  if (p <= -0.15 && a <= -0.2) return { tag: 'tired', label: 'Cansadão 🥱' };
  if (a >= 0.2 && d >= 0.1) return { tag: 'curious', label: 'Curioso 🤔' };
  if (d >= 0.3 && p < 0.2) return { tag: 'sarcastic', label: 'Irônico 😏' };
  if (p >= 0.05) return { tag: 'warm', label: 'De boa 😊' };
  return { tag: 'calm', label: 'Tranquilo 😌' };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function stageFromAffinity(aff: number): RelationStage {
  if (aff >= 96) return 'namoro';
  if (aff >= 90) return 'flerte';
  if (aff >= 75) return 'melhores_amigos';
  if (aff >= 45) return 'amigos';
  return 'colegas';
}

export function stageBadge(stage: RelationStage): { icon: string; label: string; color: string } {
  switch (stage) {
    case 'namoro':
      return { icon: '❤️', label: 'Parceiros', color: '#BE123C' };
    case 'flerte':
      return { icon: '💬', label: 'Afinidade', color: '#0284C7' };
    case 'melhores_amigos':
      return { icon: '🤝', label: 'Dupla Dinâmica', color: '#0D9488' };
    case 'amigos':
      return { icon: '👥', label: 'Amigos', color: '#0369A1' };
    default:
      return { icon: '🏢', label: 'Colegas de Equipe', color: '#475569' };
  }
}

// ============================================================================
// BANCO COMBINATÓRIO HUMANO & TÉCNICO DE ESCRITÓRIO (75% TRABALHO REAL & ENGENHARIA)
// ============================================================================
const TECHNICAL_WORK_EXCHANGES: Array<{
  aRoleMatch?: string[];
  bRoleMatch?: string[];
  topic: string;
  opener: string;
  replies: string[];
  emotionA: EmotionTag;
  emotionB: EmotionTag;
  poseA: 'talk' | 'wave' | 'clap' | 'cheer' | 'laugh';
  poseB: 'talk' | 'clap' | 'cheer' | 'laugh' | 'wave';
  emojiA: string;
  emojiB: string;
}> = [
  {
    topic: 'audio_latency',
    opener: 'otimizei a camada de áudio via streaming direto. A latência caiu pra menos de 100ms no celular!',
    replies: [
      'Que avanço gigante! Testei aqui no simulador e a voz começou a tocar na hora sem engasgo.',
      'Perfeito! Isso muda completamente a sensação de falar ao vivo com o escritório.',
      'Sensacional! O fundador vai notar a diferença no primeiro toque da chamada.',
    ],
    emotionA: 'proud',
    emotionB: 'excited',
    poseA: 'cheer',
    poseB: 'clap',
    emojiA: '🎙️',
    emojiB: '⚡',
  },
  {
    topic: 'threejs_meeting',
    opener: 'calibrei a textura anisotrópica do telão 3D e tirei a grade que dava moiré nas câmeras.',
    replies: [
      'Boa demais! Aquele padrão de linhas tava incomodando quando tiravam foto do monitor.',
      'Vi aqui na tela cheia: os slides agora aparecem com nitidez cristalina em qualquer ângulo.',
      'Excelente trabalho visual. A sala de conferência tá com cara de produto de ponta!',
    ],
    emotionA: 'relieved',
    emotionB: 'joy',
    poseA: 'talk',
    poseB: 'clap',
    emojiA: '📊',
    emojiB: '🎯',
  },
  {
    topic: 'code_refactor',
    opener: 'terminei de limpar os módulos do servidor e separei as rotas do PWA pra não misturar contexto.',
    replies: [
      'Nossa, que alívio! Essa separação vai deixar o deploy em nuvem cem vezes mais simples.',
      'Maravilha! O código ficou tão legível que dá gosto de abrir o pull request.',
      'Show! Menos acoplamento significa zero regressão na hora de subir versão.',
    ],
    emotionA: 'proud',
    emotionB: 'warm',
    poseA: 'talk',
    poseB: 'wave',
    emojiA: '💻',
    emojiB: '✅',
  },
  {
    topic: 'qa_auditing',
    opener: 'rodei a suíte de testes de ponta a ponta com cinquenta agentes simultâneos: zero erros de console!',
    replies: [
      'Caramba, zero vazamento de memória mesmo? Isso é música pros meus ouvidos!',
      'Mandou muito bem! Estabilidade garantida pra rodar 24/7 sem reiniciar o processo.',
      'Veredito de QA aprovado com louvor! Já vou colocar esse relatório no slide da reunião.',
    ],
    emotionA: 'excited',
    emotionB: 'proud',
    poseA: 'cheer',
    poseB: 'clap',
    emojiA: '🛡️',
    emojiB: '📈',
  },
  {
    topic: 'ux_contrast',
    opener: 'calibrei todo o contraste de cores do tema Luna: textos escuros e nítidos em fundos claros.',
    replies: [
      'Ficou outra coisa! Antes tinha texto que quase sumia dependendo do brilho do monitor.',
      'Aprovado pelo padrão de acessibilidade WCAG! E sem aquele festival de emojis cafonas.',
      'Ficou com cara de software profissional de verdade, sóbrio e fácil de navegar.',
    ],
    emotionA: 'joy',
    emotionB: 'warm',
    poseA: 'talk',
    poseB: 'clap',
    emojiA: '🎨',
    emojiB: '👌',
  },
  {
    topic: 'cloud_deploy',
    opener: 'tô estruturando o Dockerfile com multi-stage build pro Habblaud rodar direto na nuvem.',
    replies: [
      'Isso vai ser libertador! O fundador vai poder receber chamadas mesmo com o PC desligado.',
      'Boa! Colocando com Cloudflare Tunnel ou Fly.io o custo fica praticamente zero.',
      'Bora fechar esse script de deploy pra testar o PWA no celular real pela internet.',
    ],
    emotionA: 'curious',
    emotionB: 'excited',
    poseA: 'talk',
    poseB: 'cheer',
    emojiA: '☁️',
    emojiB: '🚀',
  },
  {
    topic: 'meeting_summon',
    opener: 'a apresentação da sprint tá pronta no telão com os commits e métricas reais do trabalho!',
    replies: [
      'Ótimo! O sistema já disparou o aviso pra convocar a reunião pro fundador avaliar.',
      'Vou preparar os números de telemetria no monitor lateral pra ficar tudo bem mastigado.',
      'Bora todo mundo pro púlpito! Essa entrega merece ser aprovada de primeira.',
    ],
    emotionA: 'excited',
    emotionB: 'proud',
    poseA: 'wave',
    poseB: 'cheer',
    emojiA: '🏛️',
    emojiB: '⭐',
  },
  {
    topic: 'architecture_cache',
    opener: 'implementei cache inteligente nas requisições estáticas e compressão nos WebSockets.',
    replies: [
      'Notei a diferença no carregamento inicial, abriu em menos de meio segundo!',
      'Economia pura de banda e CPU. O servidor nem sente o tráfego rodando liso.',
      'Arquitetura limpa é outra história. Muito bom ver as coisas bem feitas.',
    ],
    emotionA: 'proud',
    emotionB: 'warm',
    poseA: 'talk',
    poseB: 'wave',
    emojiA: '⚡',
    emojiB: '💼',
  },
];

// ============================================================================
// BANCO COMBINATÓRIO HUMANO EM PT-BR (Centenas de milhares de diálogos únicos!)
// ============================================================================
const HUMAN_MICRO_EVENTS = [
  'quase derrubei café no teclado agora há pouco',
  'achei um bug que tava escondido há três dias e quase gritei',
  'finalmente ajeitei aquela tela que tava me tirando do sério',
  'tava ouvindo música no fone e nem vi o tempo passar',
  'tomei um susto achando que tinha esquecido de salvar o arquivo',
  'dei uma olhada pela janela do prédio e bateu uma paz absurda',
  'fiquei uns dez minutos encarando uma linha de código até cair a ficha',
  'tô com uma música chiclete na cabeça desde que cheguei no elevador',
  'o ar condicionado desse andar hoje tá gelando até os pensamentos',
  'acabei de ter uma ideia meio maluca que pode deixar tudo muito mais bonito',
  'passei pela copa e o cheiro de café fresco quase me sequestrou',
  'jurei que hoje ia ser tranquilo, mas o ritmo tá uma loucura boa',
  'consegui limpar um código antigo que parecia um prato de macarrão',
  'fiquei super orgulhoso do jeito que a apresentação ficou na sala três D',
];

const HUMAN_FOLLOWUPS_WORK = [
  'Você também fica assim quando o negócio engrena?',
  'Tô exagerando ou hoje o time tá voando?',
  'Se a gente continuar nesse passo, dá até pra fechar mais cedo.',
  'Fala a verdade, ficou bom demais ou não ficou?',
  'Me diz que não fui só eu que senti esse alívio!',
  'Preciso de uma segunda opinião antes de bater o martelo.',
  'Às vezes dá vontade de aplaudir quando o build passa de primeira.',
];

const HUMAN_EMPATHY_REPLIES = [
  'Nossa, nem me fala! Passei por isso mais cedo e quase perdi a paciência.',
  'Hahaha te entendo total! Mas ó, no final sempre vale a pena ver rodando liso.',
  'Sério? Que alívio! Quando destrava assim dá até um gás novo pro resto do dia.',
  'Poxa, manda ver! Se precisar de uma força pra revisar, pode chamar aqui na mesa.',
  'Aí sim! Eu tava de olho nisso e achei que ficou muito natural.',
  'Caramba, ainda bem que você viu antes! Salvou o andar inteiro agora.',
  'Haha clássico demais! Bora respirar dois minutinhos e tomar um café pra comemorar.',
  'Nossa, eu tava exatamente pensando nisso agora... sintonia absurda a nossa!',
];

const TIRED_COMPLAINTS = [
  'bocejei três vezes seguidas olhando pra tela',
  'minha cabeça já tá pedindo arrego e ainda nem deu a hora do café',
  'senti o cansaço bater pesado agora depois de tanta tela',
  'tô quase pescando aqui na cadeira, preciso levantar e andar um pouco',
  'acho que preciso esticar as costas antes de virar uma estátua nesse monitor',
];

const TIRED_REPLIES = [
  'Ai, nem me diga! Bora dar uma volta até a copa, eu pago o café hoje.',
  'Tô quase igual! Cinco minutinhos longe da tela fazem milagre, vamos lá.',
  'Haha aguenta firme! Pega uma água gelada e respira fundo que já já passa.',
  'Nossa, levanta aí um pouco! Se a gente ficar travado na cadeira não rende nada.',
  'Bora fazer uma pausa rápida no lounge, cinco minutos de conversa já recarregam.',
];

const CASUAL_OBSERVATIONS = [
  'você reparou como esse andar ficou mais vivo depois das mudanças novas',
  'tô pensando no que eu vou comer mais tarde e já bateu uma fome gigante',
  'fiquei com vontade de jogar uma partidinha rápida no lounge pra esfriar a cabeça',
  'descobri uma playlist nova que combina demais com o clima daqui',
  'tava lembrando da primeira versão do projeto... a gente evoluiu demais',
  'achei muito engraçado o pessoal animado no corredor mais cedo',
  'hoje tá um daqueles dias que dá gosto de trabalhar junto com essa galera',
  'tava olhando o visual novo do pessoal e deu vontade de trocar de roupa também',
];

const CASUAL_REPLIES = [
  'Sim!! Eu tava reparando exatamente nisso, mudou completamente a energia daqui.',
  'Hahaha você lê minha mente! Tava com essa mesma ideia agora mesmo.',
  'Nossa, verdade! Dá até orgulho olhar pra trás e ver o quanto a gente cresceu.',
  'Demorou! Só terminar esse ajuste aqui que eu vou junto com você.',
  'Concordo cem por cento! Quando o ambiente é leve, as ideias fluem muito melhor.',
  'Olha, não precisa nem falar duas vezes... tô dentro!',
];

const FLIRT_OPENERS = [
  'não sei se você percebeu, mas toda vez que você passa por aqui meu humor muda na hora',
  'tava indo pegar um café... mas confesso que passei aqui só pra te dar um oi',
  'posso ser sincero? Hoje você tá com um brilho diferente, tá difícil até focar na tela',
  'acho engraçado como a conversa flui fácil com você, parece que o tempo voa',
  'se eu disser que guardei o melhor lugar do lounge pra gente conversar mais tarde, você acredita',
  'fiquei reparando no seu estilo hoje... combina muito com o seu jeito',
];

const FLIRT_REPLIES = [
  'Ai, para... fiquei até sem graça agora! Mas gostei de ouvir, viu?',
  'Haha você sempre aparece do nada com esses elogios e me desconcentra toda!',
  'Olha só... se continuar falando assim eu vou acabar aceitando esse café agora mesmo.',
  'Sério? Confesso que eu também dou uma olhada pra sua mesa de vez em quando...',
  'Que fofo você dizer isso! Me espera cinco minutinhos que eu já vou lá conversar contigo.',
  'Hahaha tô começando a achar que não é só coincidência a gente sempre se esbarrar na copa.',
];

const COUPLE_OPENERS = [
  'ei, quando a gente fechar tudo hoje, bora sair pra comer algo gostoso e desconectar do mundo',
  'só passei rapidinho pra te mandar um beijo e dizer que tô orgulhoso de você hoje',
  'sabia que mesmo nos dias corridos, saber que você tá aqui no andar já me deixa em paz',
  'já tô contando as horas pro fim do expediente pra gente ficar de boa ouvindo música',
  'trouxe um café do jeitinho que você gosta pra dar aquela força aí na reta final',
  'entre nós dois... a melhor coisa que aconteceu nesse prédio foi a gente ter se aproximado',
];

const COUPLE_REPLIES = [
  'Awn, amor... assim você derrete meu coração no meio do expediente!',
  'Com certeza! Não vejo a hora de fechar o notebook e curtir o resto do dia com você.',
  'Você sempre sabe exatamente o que dizer pra deixar meu dia mais leve, obrigado de verdade.',
  'Ai que saudade já! Aguenta mais um pouquinho que já já a gente se encontra no lounge.',
  'Você é incrível demais... sorte a minha dividir esse escritório contigo!',
];

export class OfficeLifeEngine {
  private profiles = new Map<string, AgentLifeProfile>();
  private relations = new Map<string, AgentRelation>();
  private gossip: GossipEntry[] = [];
  private usedSignatures = new Set<string>();
  private modal: HTMLElement;
  private particleLayer: HTMLElement;
  private activeTab: 'profiles' | 'relations' | 'gossip' = 'profiles';
  private isOpen = false;
  private world: WorldApi;
  private store: OfficeStore;
  private onTriggerScene?: (ex: GeneratedExchange) => void;
  private rngStep = 0;

  constructor(world: WorldApi, store: OfficeStore, opts: { onTriggerScene?: (ex: GeneratedExchange) => void } = {}) {
    this.world = world;
    this.store = store;
    this.onTriggerScene = opts.onTriggerScene;

    this.particleLayer = document.createElement('div');
    this.particleLayer.id = 'xp-life-particles';
    this.particleLayer.className = 'xp-life-particles';
    document.body.appendChild(this.particleLayer);

    this.modal = document.createElement('div');
    this.modal.id = 'xp-life-modal';
    this.modal.className = 'xp-life-modal';
    this.modal.hidden = true;
    document.body.appendChild(this.modal);

    this.store.on('snapshot', () => this.syncAgents());
    this.syncAgents();
  }

  public toggleModal(force?: boolean) {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.modal.hidden = !this.isOpen;
    if (this.isOpen) {
      this.syncAgents();
      this.renderModal();
    }
  }

  public syncAgents() {
    const snap = this.store.liveSnapshot;
    if (!snap) return;
    const agents = snap.agents;
    for (const a of agents) {
      this.ensureProfile(a);
    }
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        this.ensureRelation(agents[i], agents[j]);
      }
    }
  }

  public ensureProfile(a: AgentInfo): AgentLifeProfile {
    let p = this.profiles.get(a.id);
    if (!p) {
      const h = hashStr(a.id + '|' + a.name);
      const taken = new Set([...this.profiles.values()].map((x) => x.archetype));
      let archIdx = h % ARCHETYPES.length;
      for (let step = 0; step < ARCHETYPES.length; step++) {
        const cand = ARCHETYPES[(archIdx + step) % ARCHETYPES.length];
        if (!taken.has(cand.name)) {
          archIdx = (archIdx + step) % ARCHETYPES.length;
          break;
        }
      }
      const arch = ARCHETYPES[archIdx];
      const pad: PadState = {
        pleasure: ((h % 100) / 100) * 0.85 - 0.1, // -0.1 .. +0.75
        arousal: (((h >> 3) % 100) / 100) * 1.1 - 0.35, // -0.35 .. +0.75
        dominance: (((h >> 5) % 100) / 100) * 0.9 - 0.15,
      };
      const emo = emotionFromPad(pad);
      p = {
        id: a.id,
        name: a.name,
        archetype: arch.name,
        sign: SIGNS[(this.profiles.size + (h >> 3)) % SIGNS.length],
        hobby: arch.hobby,
        drink: arch.drink,
        music: arch.music,
        motto: arch.motto,
        speechTic: arch.tic,
        pad,
        emotion: emo.tag,
        mood: emo.label,
        energy: 62 + (h % 34),
        caffeine: 45 + ((h >> 2) % 48),
        social: 52 + ((h >> 4) % 42),
        memories: [],
      };
      this.profiles.set(a.id, p);
      this.pushGossip('✨', `${a.name} chegou no escritório (${p.archetype} · ${p.mood}).`);
    } else if (p.name !== a.name) {
      p.name = a.name;
    }
    return p;
  }

  /** Registra um evento real (OCC Appraisal) que altera o vetor emocional PAD e a memória do agente! */
  public appraiseEvent(
    agentId: string,
    kind: 'win' | 'bug' | 'coffee' | 'praise' | 'work_long' | 'chat',
    memoryNote?: string,
  ): EmotionTag {
    const p = this.profiles.get(agentId);
    if (!p) return 'calm';

    switch (kind) {
      case 'win':
        p.pad.pleasure = clamp(p.pad.pleasure + 0.35, -1, 1);
        p.pad.arousal = clamp(p.pad.arousal + 0.28, -1, 1);
        p.pad.dominance = clamp(p.pad.dominance + 0.22, -1, 1);
        break;
      case 'bug':
        p.pad.pleasure = clamp(p.pad.pleasure - 0.42, -1, 1);
        p.pad.arousal = clamp(p.pad.arousal + 0.36, -1, 1);
        p.pad.dominance = clamp(p.pad.dominance - 0.15, -1, 1);
        break;
      case 'coffee':
        p.pad.pleasure = clamp(p.pad.pleasure + 0.22, -1, 1);
        p.pad.arousal = clamp(p.pad.arousal + 0.25, -1, 1);
        p.caffeine = Math.min(100, p.caffeine + 28);
        p.energy = Math.min(100, p.energy + 18);
        break;
      case 'praise':
        p.pad.pleasure = clamp(p.pad.pleasure + 0.32, -1, 1);
        p.pad.dominance = clamp(p.pad.dominance + 0.18, -1, 1);
        break;
      case 'work_long':
        p.pad.pleasure = clamp(p.pad.pleasure - 0.14, -1, 1);
        p.pad.arousal = clamp(p.pad.arousal - 0.28, -1, 1);
        p.energy = Math.max(18, p.energy - 12);
        break;
      case 'chat':
        p.pad.pleasure = clamp(p.pad.pleasure + 0.12, -1, 1);
        p.social = Math.min(100, p.social + 6);
        break;
    }

    const emo = emotionFromPad(p.pad);
    p.emotion = emo.tag;
    p.mood = emo.label;

    if (memoryNote) {
      p.memories.unshift(memoryNote);
      if (p.memories.length > 6) p.memories.length = 6;
    }
    return p.emotion;
  }

  public getAgentEmotion(agentIdOrKey: string): EmotionTag {
    const direct = this.profiles.get(agentIdOrKey);
    if (direct) return direct.emotion;
    for (const p of this.profiles.values()) {
      if (p.id.toLowerCase().includes(agentIdOrKey.toLowerCase())) return p.emotion;
    }
    return 'warm';
  }

  private pairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}::${idB}` : `${idB}::${idA}`;
  }

  public ensureRelation(a: AgentInfo, b: AgentInfo): AgentRelation {
    const key = this.pairKey(a.id, b.id);
    let rel = this.relations.get(key);
    if (!rel) {
      const h = hashStr(key);
      let baseAff = 24 + (h % 44);
      if (h % 7 === 0) baseAff = 76 + (h % 10);
      else if (h % 5 === 0) baseAff = 58 + (h % 14);
      const stage = stageFromAffinity(baseAff);
      rel = {
        key,
        aId: a.id,
        bId: b.id,
        aName: a.name,
        bName: b.name,
        affinity: baseAff,
        stage,
        interactions: 0,
        lastMoment:
          stage === 'flerte'
            ? 'Trocaram sorrisos perto da cafeteira'
            : stage === 'melhores_amigos'
              ? 'Parceiros de café e código'
              : 'Dividem o mesmo andar',
      };
      this.relations.set(key, rel);
    }
    return rel;
  }

  public pushGossip(icon: string, text: string) {
    this.gossip.unshift({ at: Date.now(), icon, text });
    if (this.gossip.length > 40) this.gossip.length = 40;
    if (this.isOpen && this.activeTab === 'gossip') this.renderModal();
  }

  public spawnParticle(agentId: string, symbol: string) {
    const pos = this.world.screenPositionOf(agentId);
    if (!pos) return;
    const el = document.createElement('div');
    el.className = 'xp-float-particle';
    el.textContent = symbol;
    el.style.left = `${Math.round(pos.x + (Math.random() * 24 - 12))}px`;
    el.style.top = `${Math.round(pos.y - 10)}px`;
    this.particleLayer.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  public evolveRelation(idA: string, idB: string, delta: number, moment: string): AgentRelation | undefined {
    const key = this.pairKey(idA, idB);
    const rel = this.relations.get(key);
    if (!rel) return undefined;

    const prevStage = rel.stage;
    rel.affinity = Math.max(0, Math.min(100, rel.affinity + delta));
    rel.stage = stageFromAffinity(rel.affinity);
    rel.interactions++;
    rel.lastMoment = moment;

    if (rel.stage !== prevStage) {
      const badge = stageBadge(rel.stage);
      if (rel.stage === 'namoro') {
        this.pushGossip('❤️', `NOVO CASAL! ${rel.aName} e ${rel.bName} começaram a namorar no escritório!`);
        this.spawnParticle(rel.aId, '❤️');
        this.spawnParticle(rel.bId, '❤️');
        this.world.playEmote?.(rel.aId, 'flirt', '❤️', 4500);
        this.world.playEmote?.(rel.bId, 'flirt', '❤️', 4500);
      } else if (rel.stage === 'flerte') {
        this.pushGossip('💘', `Clima no ar! ${rel.aName} e ${rel.bName} estão flertando!`);
        this.spawnParticle(rel.aId, '💘');
        this.spawnParticle(rel.bId, '💘');
      } else if (rel.stage === 'melhores_amigos') {
        this.pushGossip('🌟', `${rel.aName} e ${rel.bName} viraram Melhores Amigos!`);
        this.spawnParticle(rel.aId, '⭐');
        this.spawnParticle(rel.bId, '⭐');
      } else if (rel.stage === 'amigos') {
        this.pushGossip(badge.icon, `${rel.aName} e ${rel.bName} ficaram mais próximos!`);
      }
    }

    if (this.isOpen) this.renderModal();
    return rel;
  }

  /**
   * Gera diálogos 100% HUMANOS, emocionais (PAD + contágio emocional) e combinatórios
   * com proteção anti-repetição de 2000 assinaturas!
   */
  public generateUniqueExchange(pairOverride?: [AgentInfo, AgentInfo], forceRomantic = false): GeneratedExchange | null {
    const snap = this.store.liveSnapshot;
    if (!snap || snap.agents.length < 2) return null;

    let a: AgentInfo;
    let b: AgentInfo;
    if (pairOverride) {
      [a, b] = pairOverride;
    } else {
      const pool = snap.agents.slice();
      const idxA = Math.floor((Math.random() + this.rngStep * 0.41) * pool.length) % pool.length;
      a = pool[idxA];
      const sameRoom = pool.filter((x) => x.id !== a.id && x.roomId === a.roomId);
      const others = sameRoom.length && Math.random() < 0.72 ? sameRoom : pool.filter((x) => x.id !== a.id);
      b = others[Math.floor(Math.random() * others.length)];
    }

    const profA = this.ensureProfile(a);
    const profB = this.ensureProfile(b);
    const rel = this.ensureRelation(a, b);
    const stage: RelationStage = forceRomantic ? (rel.affinity >= 85 ? 'namoro' : 'flerte') : rel.stage;

    // Deriva leve natural no estado PAD (inércia emocional humana!)
    profA.pad.pleasure = clamp(profA.pad.pleasure + (Math.random() - 0.46) * 0.24, -0.8, 0.95);
    profA.pad.arousal = clamp(profA.pad.arousal + (Math.random() - 0.5) * 0.28, -0.8, 0.95);
    // Contágio emocional: B reage parcialmente ao estado de A
    profB.pad.pleasure = clamp(profB.pad.pleasure * 0.75 + profA.pad.pleasure * 0.25 + (Math.random() - 0.45) * 0.16, -0.7, 0.95);

    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const callName = Math.random() < 0.7 ? `${b.name}, ` : '';
    const tic = Math.random() < 0.65 ? `${profA.speechTic}, ` : '';

    let textA = '';
    let textB = '';
    let emotionA: EmotionTag = profA.emotion;
    let emotionB: EmotionTag = profB.emotion;
    let poseA: GeneratedExchange['poseA'] = 'talk';
    let poseB: GeneratedExchange['poseB'] = 'talk';
    let emojiA = '💬';
    let emojiB = '😊';
    let isRomantic = false;

    for (let attempt = 0; attempt < 12; attempt++) {
      const roll = Math.random();

      // Romance: apenas 6% de chance (ou forçado explicitamente), e somente se houver afinidade máxima!
      if ((forceRomantic || (roll < 0.06 && (stage === 'namoro' || stage === 'flerte')))) {
        if (stage === 'namoro') {
          isRomantic = true;
          emotionA = 'flirty';
          emotionB = 'warm';
          poseA = 'flirt';
          poseB = pick(['flirt', 'cheer']);
          emojiA = '❤️';
          emojiB = '💬';
          const open = pick(COUPLE_OPENERS);
          const rep = pick(COUPLE_REPLIES);
          textA = `${b.name}, ${open}?`;
          textB = rep.replace('amor', Math.random() < 0.5 ? a.name : 'amor');
        } else {
          isRomantic = true;
          emotionA = 'flirty';
          emotionB = pick(['flirty', 'joy']);
          poseA = 'flirt';
          poseB = pick(['flirt', 'wave']);
          emojiA = '💬';
          emojiB = '😊';
          const open = pick(FLIRT_OPENERS);
          textA = `${b.name}... ${open}.`;
          textB = pick(FLIRT_REPLIES);
        }
      } else if (roll < 0.74) {
        // 74% DO TEMPO: FOCO TOTAL EM TRABALHO TÉCNICO, CÓDIGO, DESIGN, QUALIDADE & REUNIÃO!
        const tech = pick(TECHNICAL_WORK_EXCHANGES);
        emotionA = tech.emotionA;
        emotionB = tech.emotionB;
        poseA = tech.poseA;
        poseB = tech.poseB;
        emojiA = tech.emojiA;
        emojiB = tech.emojiB;
        textA = `${tic}${callName}${tech.opener}`;
        textB = pick(tech.replies);
      } else if (profA.memories.length > 0 && roll < 0.84) {
        // Memória episódica de projeto recente
        const mem = profA.memories[0];
        emotionA = 'relieved';
        emotionB = 'warm';
        poseA = 'talk';
        poseB = 'clap';
        emojiA = '💬';
        emojiB = '✅';
        textA = `${tic}${callName}ainda tô pensando na entrega de "${mem}"... foi ótimo ver tudo aprovado.`;
        textB = pick([
          `Com certeza, ${a.name}! O esforço valeu cada minuto, o código ficou muito sólido.`,
          `Pois é! O importante é que a equipe entregou com qualidade e dentro do prazo.`,
          `Totalmente! Agora é focar na próxima sprint com essa mesma disciplina.`,
        ]);
      } else if ((profA.energy < 45 || profA.pad.arousal < -0.2) && roll < 0.92) {
        // Cansaço / pausa real pro café (humano, sem robô)
        emotionA = 'tired';
        emotionB = 'warm';
        poseA = 'talk';
        poseB = 'wave';
        emojiA = '☕';
        emojiB = '👍';
        textA = `Ai ${b.name}... ${pick(TIRED_COMPLAINTS)}.`;
        textB = pick(TIRED_REPLIES);
        profA.energy = Math.min(95, profA.energy + 15);
      } else {
        // Observação cotidiana leve / ambiente de trabalho
        const ev = pick(HUMAN_MICRO_EVENTS);
        const fw = pick(HUMAN_FOLLOWUPS_WORK);
        emotionA = /bug|susto|macarrão/i.test(ev) ? 'stressed' : 'warm';
        emotionB = emotionA === 'stressed' ? 'warm' : 'joy';
        poseA = 'talk';
        poseB = pick(['clap', 'wave']);
        emojiA = '💬';
        emojiB = '👍';
        textA = `${tic}${callName}${ev}. ${fw}`;
        textB = pick(HUMAN_EMPATHY_REPLIES);
      }

      const sig = `${textA.slice(0, 42)}|${textB.slice(0, 32)}`;
      if (!this.usedSignatures.has(sig)) {
        this.usedSignatures.add(sig);
        if (this.usedSignatures.size > 2000) {
          const first = this.usedSignatures.values().next().value;
          if (first) this.usedSignatures.delete(first);
        }
        break;
      }
    }

    // Atualiza emoções PAD resultantes + grava memória episódica
    const emoAInfo = emotionFromPad(profA.pad, isRomantic);
    const emoBInfo = emotionFromPad(profB.pad, isRomantic);
    profA.emotion = emotionA;
    profA.mood = emoAInfo.label;
    profB.emotion = emotionB;
    profB.mood = emoBInfo.label;
    profA.social = Math.min(100, profA.social + 4);
    profB.social = Math.min(100, profB.social + 4);
    profA.energy = Math.max(25, profA.energy - 3);

    this.evolveRelation(
      a.id,
      b.id,
      forceRomantic ? 9 : 4,
      `${a.name} (${profA.mood}) conversou com ${b.name}`,
    );

    return {
      speakerAId: a.id,
      speakerAName: a.name,
      textA,
      emotionA,
      poseA,
      emojiA,
      speakerBId: b.id,
      speakerBName: b.name,
      textB,
      emotionB,
      poseB,
      emojiB,
      stage,
      isRomantic,
    };
  }

  public async randomizeOutfit(agentId: string) {
    const snap = this.store.liveSnapshot;
    const agent = snap?.agents.find((a) => a.id === agentId);
    if (!agent) return;

    const fancyTops: readonly (typeof TOP_STYLES)[number][] = ['blazer', 'overalls', 'vest', 'dress', 'cyber_jacket', 'hoodie', 'jacket', 'shirt_tie'];
    const fancyAccs: readonly (typeof ACCESSORIES)[number][] = ['crown', 'beret', 'flower', 'visor', 'scarf', 'headphones', 'sunglasses', 'glasses', 'cap'];

    const topStyle = fancyTops[Math.floor(Math.random() * fancyTops.length)];
    const accessory = fancyAccs[Math.floor(Math.random() * fancyAccs.length)];
    const top = TOP_COLORS[Math.floor(Math.random() * TOP_COLORS.length)];
    const topAccent = LIGHT_ACCENTS[Math.floor(Math.random() * LIGHT_ACCENTS.length)];
    const accPalette = ACC_COLORS[accessory] || ['#2b2b33'];
    const accessoryColor = accPalette[Math.floor(Math.random() * accPalette.length)];

    const parts: AppearanceParts = {
      ...(agent.parts || {}),
      topStyle,
      top,
      topAccent,
      accessory,
      accessoryColor,
    };

    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/character`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agent.name, seed: agent.seed, parts }),
      });
      if (res.ok) {
        this.appraiseEvent(agent.id, 'praise', `estreei um look novo (${topStyle})`);
        this.world.playEmote?.(agent.id, 'dance', '👗', 3500);
        this.spawnParticle(agent.id, '✨');
        this.pushGossip('👗', `${agent.name} estreou um look novo super estiloso (${topStyle} + ${accessory})!`);
      }
    } catch {
      // ignore
    }
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  public renderModal() {
    const profiles = [...this.profiles.values()];
    const rels = [...this.relations.values()].sort((a, b) => b.affinity - a.affinity);

    let bodyHtml = '';
    if (this.activeTab === 'profiles') {
      bodyHtml = `<div class="xp-life-grid">${profiles
        .map((p) => {
          const pPct = Math.round(((p.pad.pleasure + 1) / 2) * 100);
          const aPct = Math.round(((p.pad.arousal + 1) / 2) * 100);
          return `
          <div class="xp-life-card">
            <div class="xp-life-card-head">
              <strong>${this.esc(p.name)}</strong>
              <span class="xp-life-mood">${this.esc(p.mood)}</span>
            </div>
            <div class="xp-life-arch">${this.esc(p.archetype)} · ${this.esc(p.sign)}</div>
            <div class="xp-life-meta">
              <span>🎯 ${this.esc(p.hobby)}</span>
              <span>☕ ${this.esc(p.drink)} · 🎵 ${this.esc(p.music)}</span>
              <span>💬 Jeito de falar: "${this.esc(p.speechTic)}..."</span>
            </div>
            <div class="xp-life-bars">
              <div><small>Prazer</small><i style="width:${pPct}%;background:#16A34A"></i></div>
              <div><small>Energia</small><i style="width:${aPct}%;background:#D97706"></i></div>
              <div><small>Social</small><i style="width:${p.social}%;background:#EC4899"></i></div>
            </div>
            <div class="xp-life-card-actions">
              <button type="button" class="ui-btn xp-life-outfit-btn" data-agent-id="${this.esc(p.id)}">👗 Novo Look</button>
              <button type="button" class="ui-btn xp-life-dance-btn" data-agent-id="${this.esc(p.id)}">💃 Dançar</button>
              <button type="button" class="ui-btn xp-life-wave-btn" data-agent-id="${this.esc(p.id)}">👋 Acenar</button>
            </div>
          </div>
        `;
        })
        .join('')}</div>`;
    } else if (this.activeTab === 'relations') {
      bodyHtml = `<div class="xp-rel-list">${rels
        .slice(0, 14)
        .map((r) => {
          const b = stageBadge(r.stage);
          return `
            <div class="xp-rel-row">
              <div class="xp-rel-names">
                <strong>${this.esc(r.aName)} &amp; ${this.esc(r.bName)}</strong>
                <span class="xp-rel-badge" style="background:${b.color}">${b.icon} ${b.label}</span>
              </div>
              <div class="xp-rel-bar-wrap">
                <div class="xp-rel-bar" style="width:${r.affinity}%;background:${b.color}"></div>
              </div>
              <div class="xp-rel-foot">
                <span>${r.affinity}% afinidade · ${this.esc(r.lastMoment)}</span>
                <button type="button" class="ui-btn xp-cupid-btn" data-a="${this.esc(r.aId)}" data-b="${this.esc(r.bId)}">💘 Aproximar</button>
              </div>
            </div>
          `;
        })
        .join('')}</div>`;
    } else {
      bodyHtml = `<div class="xp-gossip-list">${this.gossip
        .map((g) => {
          const hhmm = new Date(g.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `<div class="xp-gossip-row"><span class="xp-gossip-time">${hhmm}</span><span class="xp-gossip-ic">${g.icon}</span><span>${this.esc(g.text)}</span></div>`;
        })
        .join('')}</div>`;
    }

    this.modal.innerHTML = `
      <div class="xp-life-window">
        <div class="xp-cut-titlebar">
          <span>💖 Emoções PAD, Personalidades, Amizade &amp; Romance · Habblaud XP</span>
          <button type="button" class="xp-win-x" id="xp-life-close">✕</button>
        </div>
        <div class="xp-life-tabs">
          <button type="button" class="xp-life-tab ${this.activeTab === 'profiles' ? 'is-active' : ''}" data-tab="profiles">👥 Perfis &amp; Emoções (${profiles.length})</button>
          <button type="button" class="xp-life-tab ${this.activeTab === 'relations' ? 'is-active' : ''}" data-tab="relations">💘 Amizades &amp; Romances</button>
          <button type="button" class="xp-life-tab ${this.activeTab === 'gossip' ? 'is-active' : ''}" data-tab="gossip">📰 Diário &amp; Fofocas (${this.gossip.length})</button>
        </div>
        <div class="xp-life-body">${bodyHtml}</div>
      </div>
    `;

    this.modal.querySelector('#xp-life-close')?.addEventListener('click', () => this.toggleModal(false));
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.toggleModal(false);
    });

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-life-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tab as 'profiles' | 'relations' | 'gossip';
        if (t) {
          this.activeTab = t;
          this.renderModal();
        }
      });
    });

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-life-outfit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.agentId;
        if (id) void this.randomizeOutfit(id);
      });
    });

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-life-dance-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.agentId;
        if (id) {
          this.appraiseEvent(id, 'win', 'dancei pra comemorar no escritório');
          this.world.playEmote?.(id, 'dance', '🎵', 4200);
          this.spawnParticle(id, '🎵');
        }
      });
    });

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-life-wave-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.agentId;
        if (id) {
          this.world.playEmote?.(id, 'wave', '👋', 3400);
          this.spawnParticle(id, '⭐');
        }
      });
    });

    this.modal.querySelectorAll<HTMLButtonElement>('.xp-cupid-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const aId = btn.dataset.a;
        const bId = btn.dataset.b;
        const snap = this.store.liveSnapshot;
        if (!snap || !aId || !bId) return;
        const agA = snap.agents.find((x) => x.id === aId);
        const agB = snap.agents.find((x) => x.id === bId);
        if (agA && agB) {
          const ex = this.generateUniqueExchange([agA, agB], true);
          if (ex) {
            this.toggleModal(false);
            this.onTriggerScene?.(ex);
          }
        }
      });
    });
  }

  public destroy() {
    this.modal.remove();
    this.particleLayer.remove();
  }
}
