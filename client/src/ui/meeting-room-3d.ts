import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  appearanceFromSeed,
  characterSprite,
  drawFloor,
  drawRug,
  drawWallFace,
  furnitureSprites,
  hash32,
  type Appearance,
  type Dir,
  type FurnitureKind,
  type Pose,
} from '../art';
import type { AppearanceParts } from '../../../shared/appearance';
import {
  getSlideHotspots,
  renderLeftMonitor,
  renderRightMonitor,
  renderSlideToCanvas,
  type PresentationDeck,
} from './meeting-slides';

export type CameraPreset = 'overview' | 'screen' | 'podium' | 'table';

export interface LiveMeetingAgent {
  key: string;
  name: string;
  seed: number;
  look: 'f' | 'm';
  parts?: AppearanceParts;
  accent: number;
}

interface Habbo25DAgentRig {
  key: string;
  name: string;
  appearance: Appearance;
  accent: number;
  group: THREE.Group;
  spriteMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  seatPos: THREE.Vector3;
  facingAngle: number; // ângulo para onde o boneco "olha" no mundo 3D (radianos)
  lastFrameKey: string;
}

const DEFAULT_AGENT_SPECS: LiveMeetingAgent[] = [
  { key: 'vicente', name: 'Vicente', seed: hash32('ag_vicente'), look: 'm', accent: 0x0054e3 },
  { key: 'dev', name: 'Dev', seed: hash32('ag_dev'), look: 'm', accent: 0x0e7490 },
  { key: 'qa', name: 'QA Auditor', seed: hash32('ag_qa'), look: 'f', accent: 0x7c3aed },
  { key: 'art', name: 'Art XP', seed: hash32('ag_art'), look: 'f', accent: 0xdb2777 },
  { key: 'ux', name: 'UX/UI', seed: hash32('ag_ux'), look: 'f', accent: 0x059669 },
  { key: 'fx', name: 'FX Áudio', seed: hash32('ag_fx'), look: 'm', accent: 0xd97706 },
  { key: 'user', name: 'Usuário', seed: hash32('ag_user'), look: 'm', accent: 0x2563eb },
  { key: 'release', name: 'Release', seed: hash32('ag_release'), look: 'f', accent: 0x16a34a },
];

const CAMERA_PRESETS: Record<CameraPreset, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  overview: { pos: new THREE.Vector3(3.8, 3.2, 4.8), target: new THREE.Vector3(0, 2.1, -1.8) },
  screen: { pos: new THREE.Vector3(0, 2.5, 1.8), target: new THREE.Vector3(0, 2.6, -4.38) },
  podium: { pos: new THREE.Vector3(-1.1, 1.6, -0.6), target: new THREE.Vector3(-2.65, 1.15, -2.2) },
  table: { pos: new THREE.Vector3(-3.2, 2.4, 3.2), target: new THREE.Vector3(0.2, 1.1, 0.6) },
};

function makePixelTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function makeNameTagSprite(text: string, colorHex: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 60;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ctx.roundRect(16, 10, 224, 40, 10);
  ctx.fill();
  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 23px Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 38);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.05, 0.25, 1);
  return sprite;
}

/** Cria uma placa pixel-art 2.5D usando o sprite real da mobília 2D do Habblaud! */
function make2DFurnitureProp(
  kind: FurnitureKind,
  scaleHeight: number,
  variant?: string,
  state?: number,
): THREE.Mesh {
  const fs = furnitureSprites(kind, variant, state, { seed: 42 });
  const src = fs.base.canvas;
  // Escala 4x com imageSmoothingEnabled=false para manter pixels nítidos
  const c = document.createElement('canvas');
  c.width = src.width * 4;
  c.height = src.height * 4;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);

  const tex = makePixelTexture(c);
  const aspect = src.width / Math.max(1, src.height);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(scaleHeight * aspect, scaleHeight),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.y = scaleHeight / 2;
  return mesh;
}

export class MeetingRoom3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private slideCanvas: HTMLCanvasElement;
  private slideTexture: THREE.CanvasTexture;
  private leftMonCanvas: HTMLCanvasElement;
  private leftMonTexture: THREE.CanvasTexture;
  private rightMonCanvas: HTMLCanvasElement;
  private rightMonTexture: THREE.CanvasTexture;

  private agents = new Map<string, Habbo25DAgentRig>();
  private billboardProps: THREE.Object3D[] = [];
  private activePresenterKey = 'vicente';
  private speaking = false;
  private approved = false;

  // Laser pointer 3D
  private laserLine: THREE.Line;
  private laserDot: THREE.Mesh;
  private laserTargets: Array<{ x: number; y: number }> = [{ x: 0.5, y: 0.5 }];

  // Confetti de aprovação
  private confettiGroup: THREE.Group;
  private confettiVelocities: THREE.Vector3[] = [];
  private celebrationUntil = 0;

  // Transição suave de câmera
  private camLerpPos: THREE.Vector3 | null = null;
  private camLerpTarget: THREE.Vector3 | null = null;

  private rafId = 0;
  private disposed = false;
  private resizeObs: ResizeObserver | null = null;
  private clock = new THREE.Clock();

  private readonly screenCenter = new THREE.Vector3(0, 2.6, -4.38);
  private readonly screenWidth = 6.4;
  private readonly screenHeight = 3.6;
  private readonly podiumStandingPos = new THREE.Vector3(-2.65, 0, -2.4);

  constructor(container: HTMLElement, liveAgents?: LiveMeetingAgent[]) {
    this.container = container;

    this.scene = new THREE.Scene();
    // Céu ensolarado estilo Habblaud 2D (dia claro!)
    this.scene.background = new THREE.Color(0x9bd3f5);
    this.scene.fog = new THREE.Fog(0xbfe4fa, 18, 42);

    const w = Math.max(320, container.clientWidth || 960);
    const h = Math.max(240, container.clientHeight || 540);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 80);
    this.camera.position.copy(CAMERA_PRESETS.overview.pos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.12; // Impede descer além do chão
    this.controls.minPolarAngle = 0.40;              // Impede subir além do teto
    this.controls.minDistance = 2.0;                 // Evita colisão próxima
    this.controls.maxDistance = 7.6;                 // NUNCA sai da sala!
    this.controls.enablePan = false;                 // Impede arrastar a câmera para fora da sala
    this.controls.target.copy(CAMERA_PRESETS.overview.target);
    this.controls.addEventListener('start', () => {
      this.camLerpPos = null;
      this.camLerpTarget = null;
    });

    // Canvases de textura dinâmica dos slides e monitores laterais
    this.slideCanvas = document.createElement('canvas');
    this.slideCanvas.width = 1280;
    this.slideCanvas.height = 720;
    this.slideTexture = new THREE.CanvasTexture(this.slideCanvas);
    this.slideTexture.colorSpace = THREE.SRGBColorSpace;
    this.slideTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.slideTexture.magFilter = THREE.LinearFilter;
    this.slideTexture.generateMipmaps = true;
    this.slideTexture.anisotropy = 16;

    this.leftMonCanvas = document.createElement('canvas');
    this.leftMonCanvas.width = 512;
    this.leftMonCanvas.height = 512;
    this.leftMonTexture = new THREE.CanvasTexture(this.leftMonCanvas);
    this.leftMonTexture.colorSpace = THREE.SRGBColorSpace;
    this.leftMonTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.leftMonTexture.magFilter = THREE.LinearFilter;
    this.leftMonTexture.generateMipmaps = true;

    this.rightMonCanvas = document.createElement('canvas');
    this.rightMonCanvas.width = 512;
    this.rightMonCanvas.height = 512;
    this.rightMonTexture = new THREE.CanvasTexture(this.rightMonCanvas);
    this.rightMonTexture.colorSpace = THREE.SRGBColorSpace;
    this.rightMonTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.rightMonTexture.magFilter = THREE.LinearFilter;
    this.rightMonTexture.generateMipmaps = true;

    this.buildDaylightOfficeLights();
    this.buildHabblaud2DInspiredRoom();
    this.buildScreensAndPodium();
    this.buildConferenceTable();
    this.buildHabblaud2DProps();
    this.buildHabblaud2DAgents(liveAgents);

    // Laser pointer 3D (linha + ponto brilhante no telão)
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.3, 1.35, -2.4),
      new THREE.Vector3(0, 2.6, -4.34),
    ]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.92 });
    this.laserLine = new THREE.Line(laserGeo, laserMat);
    this.laserLine.visible = false;
    this.scene.add(this.laserLine);

    this.laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff2d55 }),
    );
    this.laserDot.visible = false;
    this.scene.add(this.laserDot);

    // Confetti 3D (escondido até aprovação)
    this.confettiGroup = new THREE.Group();
    this.confettiGroup.visible = false;
    this.scene.add(this.confettiGroup);
    this.initConfetti();

    this.resizeObs = new ResizeObserver(() => this.handleResize());
    this.resizeObs.observe(container);

    this.animate();
  }

  private buildDaylightOfficeLights() {
    // Iluminação clara e alegre igual ao escritório 2D do Habblaud!
    const ambient = new THREE.AmbientLight(0xffffff, 1.15);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0xe2d5be, 0.85);
    this.scene.add(hemi);

    // Luz solar entrando pelo janelão esquerdo
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sun.position.set(-7.5, 9.5, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 28;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    this.scene.add(sun);

    // Luz de preenchimento suave do teto do escritório
    const ceilingFill = new THREE.PointLight(0xffffff, 0.9, 18);
    ceilingFill.position.set(1.5, 5.1, 1.5);
    this.scene.add(ceilingFill);
  }

  private buildHabblaud2DInspiredRoom() {
    // 1. PISO REAL 2D DO HABBLAUD (porcelanato claro + rejunte pixel art!)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 256;
    floorCanvas.height = 256;
    const fctx = floorCanvas.getContext('2d')!;
    drawFloor(fctx, 'porcelain', 0, 0, 256, 256, { seed: 101, tint: '#ECE8DC', tint2: '#E1DCCD' });
    const floorTex = makePixelTexture(floorCanvas, 4, 4);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14.4, 12.2),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 1.3; // alinhado às paredes (z -4.8 .. 7.4)
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. TAPETE VERMELHO CLÁSSICO HABBLAUD COM BORDA DOURADA sob a mesa de reunião!
    const rugCanvas = document.createElement('canvas');
    rugCanvas.width = 224;
    rugCanvas.height = 160;
    const rctx = rugCanvas.getContext('2d')!;
    drawRug(rctx, 0, 0, 224, 160, '#B91C1C', 77);
    // Borda dourada extra igual aos corredores do escritório 2D!
    rctx.strokeStyle = '#F59E0B';
    rctx.lineWidth = 4;
    rctx.strokeRect(5, 5, 214, 150);
    const rugTex = makePixelTexture(rugCanvas);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 5.4),
      new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.92 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.25, 0.014, 0.75);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // 3. PAREDES CLARAS DO ESCRITÓRIO 2D (drawWallFace real do Habblaud!)
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 256;
    wallCanvas.height = 32;
    const wctx = wallCanvas.getContext('2d')!;
    drawWallFace(wctx, 0, 0, 256, { base: '#ECEAE0', trim: '#94A3B8', pattern: 'wainscot' });
    const wallTex = makePixelTexture(wallCanvas, 4, 1);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 });

    // Parede frontal clara (com moldura superior azul XP)
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(14.4, 5.4, 0.26), wallMat);
    frontWall.position.set(0, 2.7, -4.7);
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Faixa superior estilo barra Windows XP Luna / Habblaud
    const topTrim = new THREE.Mesh(
      new THREE.BoxGeometry(14.4, 0.24, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x0054e3, roughness: 0.45 }),
    );
    topTrim.position.set(0, 5.3, -4.66);
    this.scene.add(topTrim);

    // Rodapé de madeira clara (igual ao 2D!)
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.65 });
    const frontBase = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.26, 0.32), baseboardMat);
    frontBase.position.set(0, 0.13, -4.66);
    this.scene.add(frontBase);

    // Parede direita clara com janela/quadros estilo escritório 2D
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.26, 5.4, 12.2), wallMat);
    rightWall.position.set(7.1, 2.7, 1.3);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const rightBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 12.2), baseboardMat);
    rightBase.position.set(7.05, 0.13, 1.3);
    this.scene.add(rightBase);

    const rightTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.24, 12.2),
      new THREE.MeshStandardMaterial({ color: 0x0054e3, roughness: 0.45 }),
    );
    rightTrim.position.set(7.05, 5.3, 1.3);
    this.scene.add(rightTrim);

    // 4. JANELÃO PANORÂMICO ENSOLARADO À ESQUERDA (esquadrias brancas + cidade diurna estilo Habblaud!)
    const lowWall = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.05, 12.2), wallMat);
    lowWall.position.set(-7.0, 0.525, 1.3);
    this.scene.add(lowWall);

    const mullionMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
    for (let z = -4.2; z <= 6.2; z += 2.6) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.4, 0.14), mullionMat);
      col.position.set(-7.0, 3.2, z);
      this.scene.add(col);
    }
    const winHeader = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 12.2), mullionMat);
    winHeader.position.set(-7.0, 5.3, 1.3);
    this.scene.add(winHeader);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(11.8, 4.2),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.16,
        roughness: 0.08,
      }),
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(-7.0, 3.15, 1.0);
    this.scene.add(glass);

    // Prédios diurnos + árvores verdes lá fora (mesma paleta do gramado/cidade do Habblaud 2D!)
    const dayBldgColors = [0xdbeafe, 0xe2e8f0, 0xfef3c7, 0xcbd5e1];
    for (let i = 0; i < 10; i++) {
      const bw = 1.3 + (i % 3) * 0.5;
      const bh = 4.2 + ((i * 5) % 6);
      const bz = -6.0 + i * 1.65;
      const bx = -10.8 - (i % 3) * 2.1;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, bw),
        new THREE.MeshStandardMaterial({ color: dayBldgColors[i % dayBldgColors.length], roughness: 0.75 }),
      );
      bldg.position.set(bx, bh / 2 - 1.8, bz);
      this.scene.add(bldg);

      for (let wy = 0.5; wy < bh - 0.7; wy += 0.85) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(bw * 0.62, 0.28),
          new THREE.MeshBasicMaterial({ color: 0x60a5fa }),
        );
        win.rotation.y = Math.PI / 2;
        win.position.set(bx + bw / 2 + 0.02, wy - 1.3, bz);
        this.scene.add(win);
      }
    }

    // Nuvens fofas pixel-style no céu externo
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let c = 0; c < 4; c++) {
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 2.2), cloudMat);
      cloud.position.set(-15.5, 5.2 + (c % 2) * 0.8, -4.5 + c * 3.4);
      this.scene.add(cloud);
    }

    // 5. PAREDE DO FUNDO (fecha a sala atrás da câmera)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(14.4, 5.4, 0.26), wallMat);
    backWall.position.set(0, 2.7, 7.3);
    backWall.receiveShadow = true;
    this.scene.add(backWall);
    const backBase = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.26, 0.32), baseboardMat);
    backBase.position.set(0, 0.13, 7.25);
    this.scene.add(backBase);
    const backTrim = new THREE.Mesh(
      new THREE.BoxGeometry(14.4, 0.24, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x0054e3, roughness: 0.45 }),
    );
    backTrim.position.set(0, 5.3, 7.25);
    this.scene.add(backTrim);

    // 6. TETO com forro modular + luminárias embutidas
    const ceilCanvas = document.createElement('canvas');
    ceilCanvas.width = 64;
    ceilCanvas.height = 64;
    const cctx = ceilCanvas.getContext('2d')!;
    cctx.fillStyle = '#F4F2EA';
    cctx.fillRect(0, 0, 64, 64);
    cctx.strokeStyle = '#CFCAB8';
    cctx.lineWidth = 2;
    cctx.strokeRect(1, 1, 62, 62);
    const ceilTex = makePixelTexture(ceilCanvas, 14, 12);
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(14.4, 12.2),
      new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, side: THREE.DoubleSide }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 5.42, 1.3);
    this.scene.add(ceiling);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    for (const lx of [-3.6, 0, 3.6]) {
      for (const lz of [-2.2, 1.3, 4.8]) {
        const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), lampMat);
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set(lx, 5.4, lz);
        this.scene.add(lamp);
      }
    }
  }

  private buildScreensAndPodium() {
    // Moldura azul Windows XP Luna + aço escovado ao redor do telão LED gigante
    // (recuados em Z para ZERO Z-fighting com a superfície do telão!)
    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(this.screenWidth + 0.34, this.screenHeight + 0.34, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0054e3, roughness: 0.35, metalness: 0.25 }),
    );
    outerFrame.position.set(this.screenCenter.x, this.screenCenter.y, this.screenCenter.z - 0.14);
    this.scene.add(outerFrame);

    const innerBezel = new THREE.Mesh(
      new THREE.BoxGeometry(this.screenWidth + 0.14, this.screenHeight + 0.14, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }),
    );
    innerBezel.position.set(this.screenCenter.x, this.screenCenter.y, this.screenCenter.z - 0.09);
    this.scene.add(innerBezel);

    // Tela LED principal 1280x720 (0.04 à frente da moldura + polygonOffset)
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.screenWidth, this.screenHeight),
      new THREE.MeshBasicMaterial({
        map: this.slideTexture,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    screenMesh.position.copy(this.screenCenter);
    this.scene.add(screenMesh);

    // 2 Monitores laterais inclinados com moldura clara Habblaud
    const buildSideMonitor = (x: number, rotY: number, tex: THREE.CanvasTexture) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, -3.55);
      grp.rotation.y = rotY;

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.36, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5, roughness: 0.4 }),
      );
      base.position.y = 0.04;
      grp.add(base);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.075, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 }),
      );
      pole.position.y = 1.1;
      grp.add(pole);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.94, 1.94, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35 }),
      );
      frame.position.y = 2.5;
      grp.add(frame);

      const display = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.8),
        new THREE.MeshBasicMaterial({
          map: tex,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      display.position.set(0, 2.5, 0.075);
      grp.add(display);

      this.scene.add(grp);
    };

    buildSideMonitor(-4.55, 0.36, this.leftMonTexture);
    buildSideMonitor(4.55, -0.36, this.rightMonTexture);

    // Púlpito compacto ao LADO do apresentador (nunca na frente dele) — proporção humana (~0.8m)
    const podium = new THREE.Group();
    podium.position.set(-3.35, 0, -2.25);
    podium.rotation.y = 0.35;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.74, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xc99c6b, roughness: 0.55 }),
    );
    body.position.y = 0.37;
    body.castShadow = true;
    podium.add(body);

    const topDesk = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.05, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x8d5b34, roughness: 0.45 }),
    );
    topDesk.position.set(0, 0.77, 0.02);
    topDesk.rotation.x = 0.14;
    podium.add(topDesk);

    const xpStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.06, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x0054e3 }),
    );
    xpStripe.position.set(0, 0.6, 0.19);
    podium.add(xpStripe);

    const micStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }),
    );
    micStem.position.set(0.14, 0.88, -0.04);
    micStem.rotation.x = -0.32;
    podium.add(micStem);

    this.scene.add(podium);
  }

  private buildConferenceTable() {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(0.25, 0, 0.8);

    // Tampo de carvalho claro idêntico às mesas do escritório 2D!
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.14, 2.35),
      new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.45, metalness: 0.04 }),
    );
    top.position.y = 0.84;
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    // Borda escura sutil no contorno da mesa (look pixel-art outline!)
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(4.86, 0.06, 2.41),
      new THREE.MeshStandardMaterial({ color: 0x8d5b34, roughness: 0.6 }),
    );
    rim.position.y = 0.78;
    tableGroup.add(rim);

    // Pés brancos/cinza-claro modernos
    const legMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.35, roughness: 0.45 });
    for (const lx of [-1.8, 1.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 1.45), legMat);
      leg.position.set(lx, 0.4, 0);
      leg.castShadow = true;
      tableGroup.add(leg);
    }

    // Laptops + Canecas + Pastinhas coloridas estilo Habblaud 2D sobre a mesa
    const laptopCoords = [
      { x: -1.5, z: -0.68, ry: 0 },
      { x: 0.0, z: -0.68, ry: 0 },
      { x: 1.5, z: -0.68, ry: 0 },
      { x: -1.5, z: 0.68, ry: Math.PI },
      { x: 0.0, z: 0.68, ry: Math.PI },
      { x: 1.5, z: 0.68, ry: Math.PI },
    ];
    for (const lp of laptopCoords) {
      const lap = new THREE.Group();
      lap.position.set(lp.x, 0.92, lp.z);
      lap.rotation.y = lp.ry;

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.025, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 }),
      );
      lap.add(base);

      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.28, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 }),
      );
      lid.position.set(0, 0.14, 0.13);
      lid.rotation.x = 0.2;
      lap.add(lid);

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.36, 0.22),
        new THREE.MeshBasicMaterial({ color: 0x60a5fa }),
      );
      glow.position.set(0, 0.14, 0.116);
      glow.rotation.y = Math.PI;
      glow.rotation.x = -0.2;
      lap.add(glow);

      const mug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
      );
      mug.position.set(0.31, 0.05, 0);
      lap.add(mug);

      tableGroup.add(lap);
    }

    this.scene.add(tableGroup);
  }

  /** Decora o perímetro da sala 3D com os sprites REAIS da mobília 2D do Habblaud! */
  private buildHabblaud2DProps() {
    const placeProp = (
      kind: FurnitureKind,
      x: number,
      z: number,
      height: number,
      variant?: string,
      billboard = false,
      rotY = 0,
    ) => {
      const mesh = make2DFurnitureProp(kind, height, variant);
      mesh.position.x = x;
      mesh.position.z = z;
      mesh.rotation.y = rotY;
      this.scene.add(mesh);
      if (billboard) this.billboardProps.push(mesh);
    };

    // Plantinhas pixel-art flanqueando o telão e os cantos (iguais às da sala 2D!)
    placeProp('plant_tall', -5.75, -3.9, 1.7, 'monstera', true);
    placeProp('plant_tall', 5.75, -3.9, 1.7, 'ficus', true);
    placeProp('plant_tall', 6.1, 3.6, 1.65, 'palm', true);

    // Sofá verde Habbo Club + Estante + Bebedouro + Rack na parede direita!
    placeProp('hc_sofa', 6.3, 0.9, 1.45, undefined, false, -Math.PI / 2);
    placeProp('bookshelf', 6.35, -1.5, 1.9, undefined, false, -Math.PI / 2);
    placeProp('water_cooler', 6.2, -3.1, 1.5, undefined, true);
    placeProp('server_rack', -5.8, 3.6, 2.0, undefined, false, Math.PI / 3);
    placeProp('coffee_machine', -5.7, 1.4, 1.25, undefined, false, Math.PI / 2);
  }

  /** Renderiza os 8 agentes usando o MESMO motor pixel-art 2D (characterSprite + appearanceFromSeed)! */
  private buildHabblaud2DAgents(liveAgents?: LiveMeetingAgent[]) {
    const seats: Array<{ x: number; z: number; faceAngle: number }> = [
      { x: -1.25, z: -0.62, faceAngle: 0 },              // olha para +Z (mesa/frente)
      { x: 0.25, z: -0.62, faceAngle: 0 },
      { x: 1.75, z: -0.62, faceAngle: 0 },
      { x: -1.25, z: 2.22, faceAngle: Math.PI },         // olha para -Z (telão)
      { x: 0.25, z: 2.22, faceAngle: Math.PI },
      { x: 1.75, z: 2.22, faceAngle: Math.PI },
      { x: 3.05, z: 0.8, faceAngle: -Math.PI / 2 },      // olha para -X
      { x: -2.55, z: 0.8, faceAngle: Math.PI / 2 },      // olha para +X
    ];

    const chairMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55 });
    const list = liveAgents && liveAgents.length >= 4 ? liveAgents : DEFAULT_AGENT_SPECS;

    DEFAULT_AGENT_SPECS.forEach((fallback, idx) => {
      const spec = list.find((a) => a.key === fallback.key) ?? fallback;
      const seat = seats[idx];

      // Cadeira de escritório grafite (encosto baixo e recuado para nunca atravessar o sprite 2.5D!)
      const chair = new THREE.Group();
      chair.position.set(seat.x, 0, seat.z);
      chair.rotation.y = seat.faceAngle + Math.PI;
      const seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.50), chairMat);
      seatPad.position.y = 0.44;
      chair.add(seatPad);
      const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.06), chairMat);
      backPad.position.set(0, 0.63, 0.32);
      chair.add(backPad);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.16, 0.44, 8),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5 }),
      );
      stem.position.y = 0.22;
      chair.add(stem);
      this.scene.add(chair);

      const appearance = appearanceFromSeed(spec.seed, { look: spec.look, parts: spec.parts });

      // Canvas pixel-art dedicado do personagem (96×128 = 4x do sprite 24×32 do Habblaud!)
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const tex = makePixelTexture(c);

      const grp = new THREE.Group();
      const seatPos = new THREE.Vector3(seat.x, 0, seat.z);
      grp.position.copy(seatPos);

      // Sombra de contato no chão/cadeira
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 16),
        new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.22 }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.025;
      grp.add(shadow);

      // Standee 2.5D com o sprite 2D REAL do Habblaud!
      const spriteMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.38, 1.84),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.15,
          side: THREE.DoubleSide,
        }),
      );
      spriteMesh.position.y = 0.96;
      grp.add(spriteMesh);

      // Crachá flutuante claro estilo Habblaud
      const tag = makeNameTagSprite(spec.name, spec.accent);
      tag.position.set(0, 1.98, 0);
      grp.add(tag);

      this.scene.add(grp);

      const rig: Habbo25DAgentRig = {
        key: spec.key,
        name: spec.name,
        appearance,
        accent: spec.accent,
        group: grp,
        spriteMesh,
        canvas: c,
        ctx,
        texture: tex,
        seatPos,
        facingAngle: seat.faceAngle,
        lastFrameKey: '',
      };
      this.drawRigSprite(rig, 'down', 'sit', 0, true);
      this.agents.set(spec.key, rig);
    });
  }

  /** Redesenha o frame 2D real do personagem quando muda direção/pose/quadro (zero custo quando igual). */
  private drawRigSprite(rig: Habbo25DAgentRig, dir: Dir, pose: Pose, frame: number, seated: boolean) {
    const fKey = `${dir}|${pose}|${frame}|${seated ? 1 : 0}`;
    if (rig.lastFrameKey === fKey) return;
    rig.lastFrameKey = fKey;

    const spr = characterSprite({
      appearance: rig.appearance,
      dir,
      pose,
      frame,
      seated,
    });

    const ctx = rig.ctx;
    ctx.clearRect(0, 0, rig.canvas.width, rig.canvas.height);
    ctx.imageSmoothingEnabled = false;
    const scale = 3.5;
    const dw = Math.round(spr.canvas.width * scale);
    const dh = Math.round(spr.canvas.height * scale);
    const dx = Math.round((rig.canvas.width - dw) / 2);
    const dy = Math.round(rig.canvas.height - dh - 4);
    ctx.drawImage(spr.canvas, dx, dy, dw, dh);
    rig.texture.needsUpdate = true;
  }

  /** Calcula se o personagem aparece de frente ('down'), costas ('up'), 'left' ou 'right' para a câmera 3D! */
  private relativeDirForCamera(worldPos: THREE.Vector3, facingAngle: number): Dir {
    const camAngle = Math.atan2(this.camera.position.x - worldPos.x, this.camera.position.z - worldPos.z);
    let rel = camAngle - facingAngle;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    if (Math.abs(rel) <= Math.PI * 0.34) return 'down';
    if (Math.abs(rel) >= Math.PI * 0.66) return 'up';
    return rel > 0 ? 'right' : 'left';
  }

  private initConfetti() {
    const colors = [0x4ade80, 0x38bdf8, 0xfbbf24, 0xf472b6, 0xa78bfa, 0xef4444];
    const geo = new THREE.PlaneGeometry(0.14, 0.08);
    for (let i = 0; i < 95; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide,
      });
      const piece = new THREE.Mesh(geo, mat);
      piece.position.set((Math.random() - 0.5) * 7, 3.8 + Math.random() * 2.2, (Math.random() - 0.5) * 6);
      piece.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.confettiGroup.add(piece);
      this.confettiVelocities.push(
        new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.2 - Math.random() * 1.1, (Math.random() - 0.5) * 0.6),
      );
    }
  }

  public updatePresentation(deck: PresentationDeck, slideIndex: number, approved = false) {
    this.approved = approved;
    renderSlideToCanvas(this.slideCanvas, deck, slideIndex, approved);
    this.slideTexture.needsUpdate = true;

    renderLeftMonitor(this.leftMonCanvas, deck, slideIndex);
    this.leftMonTexture.needsUpdate = true;

    renderRightMonitor(this.rightMonCanvas, deck, slideIndex, approved);
    this.rightMonTexture.needsUpdate = true;

    const slide = deck.slides[slideIndex];
    if (slide) {
      this.activePresenterKey = this.agents.has(slide.presenterKey) ? slide.presenterKey : 'vicente';
      const spots = getSlideHotspots();
      this.laserTargets = spots.length
        ? spots.map((s) => ({ x: s.x, y: s.y }))
        : slide.laserTargets?.length
          ? slide.laserTargets
          : [{ x: 0.5, y: 0.5 }];
    }
  }

  public setSpeakerState(agentKey: string | null, speaking: boolean) {
    if (agentKey && this.agents.has(agentKey)) {
      this.activePresenterKey = agentKey;
    }
    this.speaking = speaking;
  }

  public triggerCelebration() {
    this.approved = true;
    this.celebrationUntil = performance.now() + 5500;
    this.confettiGroup.visible = true;
    this.confettiGroup.children.forEach((child) => {
      child.position.set((Math.random() - 0.5) * 7, 4.2 + Math.random() * 1.8, (Math.random() - 0.5) * 5.5);
    });
  }

  public setCameraPreset(preset: CameraPreset) {
    const p = CAMERA_PRESETS[preset];
    this.camLerpPos = p.pos.clone();
    this.camLerpTarget = p.target.clone();
  }

  public getSlideCanvas(): HTMLCanvasElement {
    return this.slideCanvas;
  }

  public forceResize() {
    this.handleResize();
  }

  private handleResize() {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const now = performance.now();
    const celebrating = now < this.celebrationUntil;

    // Transição suave de preset de câmera
    if (this.camLerpPos && this.camLerpTarget) {
      this.camera.position.lerp(this.camLerpPos, 0.09);
      this.controls.target.lerp(this.camLerpTarget, 0.09);
      if (
        this.camera.position.distanceTo(this.camLerpPos) < 0.04 &&
        this.controls.target.distanceTo(this.camLerpTarget) < 0.04
      ) {
        this.camLerpPos = null;
        this.camLerpTarget = null;
      }
    }

    // Props billboard (plantas & bebedouro) olham suavemente para a câmera no eixo Y
    for (const p of this.billboardProps) {
      p.lookAt(this.camera.position.x, p.position.y, this.camera.position.z);
    }

    // Atualiza todos os personagens 2D-em-3D (direção relativa à câmera + animação de pose real!)
    const animFrame = Math.floor(t * 4) % 2;
    this.agents.forEach((rig) => {
      const isPresenter = rig.key === this.activePresenterKey;
      const targetPos = isPresenter ? this.podiumStandingPos : rig.seatPos;
      rig.group.position.lerp(targetPos, 0.09);

      // Standee sempre gira no eixo Y para encarar a câmera (estilo Octopath / Habbo 2.5D),
      // enquanto o sprite escolhe 'down' / 'up' / 'left' / 'right' de acordo com o ângulo real!
      rig.spriteMesh.lookAt(this.camera.position.x, rig.spriteMesh.position.y + rig.group.position.y, this.camera.position.z);

      const faceAngle = isPresenter ? 0.55 : rig.facingAngle;
      const dir = this.relativeDirForCamera(rig.group.position, faceAngle);

      if (celebrating) {
        rig.group.position.y = Math.abs(Math.sin(t * 6.5 + rig.seatPos.x)) * 0.18;
        this.drawRigSprite(rig, 'down', isPresenter ? 'cheer' : 'clap', animFrame, !isPresenter);
      } else if (isPresenter) {
        rig.group.position.y = 0;
        const pose: Pose = this.speaking ? 'talk' : 'stand';
        this.drawRigSprite(rig, dir, pose, animFrame, false);
      } else {
        rig.group.position.y = 0.08;
        this.drawRigSprite(rig, dir, 'sit', Math.floor(t * 1.5 + rig.seatPos.x) % 2, true);
      }
    });

    // Laser pointer apontando para os hotspots reais desenhados no slide
    const presenter = this.agents.get(this.activePresenterKey);
    if (presenter && this.speaking) {
      const idx = Math.floor(t * 0.42) % this.laserTargets.length;
      const target = this.laserTargets[idx] ?? { x: 0.5, y: 0.5 };
      const worldX = this.screenCenter.x + (target.x - 0.5) * this.screenWidth + Math.sin(t * 1.8) * 0.03;
      const worldY = this.screenCenter.y + (0.5 - target.y) * this.screenHeight + Math.cos(t * 1.6) * 0.025;
      const worldZ = this.screenCenter.z + 0.04;

      const startPt = new THREE.Vector3(
        presenter.group.position.x + 0.16,
        presenter.group.position.y + 0.82,
        presenter.group.position.z + 0.14,
      );
      const endPt = new THREE.Vector3(worldX, worldY, worldZ);

      const posAttr = this.laserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, startPt.x, startPt.y, startPt.z);
      posAttr.setXYZ(1, endPt.x, endPt.y, endPt.z);
      posAttr.needsUpdate = true;

      this.laserDot.position.copy(endPt);
      const pulse = 1 + Math.sin(t * 12) * 0.22;
      this.laserDot.scale.setScalar(pulse);
      this.laserLine.visible = true;
      this.laserDot.visible = true;
    } else {
      this.laserLine.visible = false;
      this.laserDot.visible = false;
    }

    // Confetti 3D caindo durante celebração
    if (celebrating) {
      this.confettiGroup.children.forEach((child, i) => {
        const v = this.confettiVelocities[i];
        child.position.addScaledVector(v, dt);
        child.rotation.x += dt * 4;
        child.rotation.y += dt * 3;
        if (child.position.y < 0.1) child.position.y = 4.8;
      });
    } else if (this.confettiGroup.visible) {
      this.confettiGroup.visible = false;
    }

    this.controls.update();
    // Confinamento físico rigoroso da câmera dentro das 4 paredes e sob o teto
    this.camera.position.x = Math.max(-6.2, Math.min(6.2, this.camera.position.x));
    this.camera.position.y = Math.max(1.0, Math.min(4.9, this.camera.position.y));
    this.camera.position.z = Math.max(-3.9, Math.min(6.5, this.camera.position.z));
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    this.controls.dispose();
    this.slideTexture.dispose();
    this.leftMonTexture.dispose();
    this.rightMonTexture.dispose();
    this.agents.forEach((rig) => rig.texture.dispose());
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
