import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Blocker } from './simulation';
import { ENEMY_TIERS, BOSS_TUNING, advanceBolt, pointBlocked, segmentBlocked, type Position3 } from './combat';
import { FACILITY_WALLS, FACILITY_DOORWAYS, VAULT_DOOR } from './facility';
import { CAPTURE_RADIUS, advanceCapture, type CaptureState } from './objectives';

export type GraphicsTier = 'low' | 'medium' | 'high';
export interface ShotResult {
  kind: 'hostile' | 'neutral' | 'objective' | 'miss';
  destroyed: boolean;
  point: THREE.Vector3;
  targetId?: string;
}

interface Drone {
  group: THREE.Group;
  meshes: THREE.Object3D[];
  id: string;
  hostile: boolean;
  health: number;
  maxHealth: number;
  spawn: THREE.Vector3;
  phase: number;
  active: boolean;
  halo: THREE.Mesh;
  route: readonly { x: number; z: number }[];
  routeIndex: number;
  attackClock: number;
  boss: boolean;
  limbParts?: THREE.Object3D[];
  dropId?: string;
  respawnDelay?: number;
  respawnClock: number;
  initialDelay?: number;
}

interface EnemyBolt {
  mesh: THREE.Mesh;
  velocity: Position3;
  life: number;
  damage: number;
}

interface MissionMarker {
  id: string;
  group: THREE.Group;
  meshes: THREE.Object3D[];
  position: THREE.Vector3;
  active: boolean;
  halo: THREE.Mesh;
  capture: CaptureState;
}

interface Fragment {
  id: string;
  group: THREE.Group;
  position: THREE.Vector3;
  collected: boolean;
}

interface Impact {
  object: THREE.Mesh;
  life: number;
  duration: number;
}

const COLOR = {
  cyan: 0x00e5ff,
  cyanDeep: 0x087892,
  magenta: 0xfa3d87,
  orange: 0xffbf56,
  dark: 0x07101b,
};

const darkMetal = new THREE.MeshStandardMaterial({ color: 0x172533, roughness: 0.36, metalness: 0.76 });
const deepMetal = new THREE.MeshStandardMaterial({ color: 0x0d1b28, roughness: 0.55, metalness: 0.7 });
const trim = new THREE.MeshStandardMaterial({ color: 0x25465a, roughness: 0.32, metalness: 0.8 });
const cyanEmissive = new THREE.MeshBasicMaterial({ color: COLOR.cyan, toneMapped: false });
const subtleCyan = new THREE.MeshBasicMaterial({ color: 0x127d9b, toneMapped: false });
const orangeEmissive = new THREE.MeshBasicMaterial({ color: COLOR.orange, toneMapped: false });
const magentaEmissive = new THREE.MeshBasicMaterial({ color: COLOR.magenta, toneMapped: false });

function seededRandom(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 0x100000000;
  };
}

/** Original, generated grunge map. Runs in Node tests without Canvas or external assets. */
function createMetalTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const random = seededRandom(137);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const seam = x % 32 === 0 || y % 32 === 0 ? -37 : 0;
      const scratch = x % 17 === 0 && y % 3 === 0 ? 21 : 0;
      const value = Math.max(78, Math.min(235, 180 + (random() - 0.5) * 31 + seam + scratch));
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = Math.min(255, value + 6);
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const grungeTexture = createMetalTexture();
darkMetal.map = grungeTexture;
deepMetal.map = grungeTexture;
trim.map = grungeTexture;

export class RelayNineArena {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(74, 1, 0.06, 170);
  readonly blockers: Blocker[] = [];
  readonly weapon = new THREE.Group();
  readonly muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x9ffaff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );

  private readonly raycaster = new THREE.Raycaster();
  private readonly solidSurfaces: THREE.Object3D[] = [];
  private readonly staticArchitecture: THREE.Mesh[] = [];
  private readonly drones: Drone[] = [];
  private readonly terminals: MissionMarker[] = [];
  private readonly captureZones = new Map<string, THREE.Group>();
  private readonly fragments: Fragment[] = [];
  private readonly impacts: Impact[] = [];
  private readonly enemyBolts: EnemyBolt[] = [];
  private readonly boltGeometry = new THREE.SphereGeometry(0.15, 8, 6);
  private readonly boltMaterial = new THREE.MeshBasicMaterial({ color: 0xff597b, toneMapped: false });
  private readonly bossBoltMaterial = new THREE.MeshBasicMaterial({ color: 0xffa857, toneMapped: false });
  private readonly animatedRings: { ring: THREE.Mesh; speed: number }[] = [];
  private readonly dataPackets: { mesh: THREE.Mesh; progress: number; speed: number; rail: number }[] = [];
  private readonly particleField: THREE.Points;
  private weaponKick = 0;
  private muzzleTime = 0;
  private readonly coreLight: THREE.PointLight;
  private readonly ambientLight: THREE.HemisphereLight;
  private readonly vaultShutter: THREE.Mesh | null;
  private readonly shutdownConsole: THREE.Group;
  private shutdownComplete = false;
  private readonly mission: number;

  constructor(mission = 0) {
    if (![0, 1, 2].includes(mission)) throw new RangeError('Unknown level');
    this.mission = mission;
    this.scene.background = new THREE.Color(0x050d17);
    this.scene.fog = new THREE.FogExp2(0x06121e, 0.011);
    this.camera.position.set(0, 1.72, 42);
    this.scene.add(this.camera);

    this.ambientLight = new THREE.HemisphereLight(0x92dbff, 0x06111c, 1.15);
    this.scene.add(this.ambientLight);
    const moon = new THREE.DirectionalLight(0x6cbeef, 1.5);
    moon.position.set(-12, 24, 11);
    this.scene.add(moon);
    const warm = new THREE.PointLight(0xff9a49, 35, 24, 2);
    warm.position.set(-14, 4, -9);
    this.scene.add(warm);
    this.coreLight = new THREE.PointLight(COLOR.cyan, 75, 37, 1.6);
    this.coreLight.position.set(0, 6.5, mission === 0 ? -39 : mission === 1 ? -5 : -12);
    this.scene.add(this.coreLight);

    this.buildFloor();
    if (mission !== 2) this.buildArchitecture();
    if (mission === 0) { this.buildFacility(); this.buildCore(); this.buildCover(); }
    else if (mission === 1) this.buildFoundry();
    else this.buildBossArena();
    this.buildDrones();
    if (mission === 1) this.buildMissionMarkers();
    this.shutdownConsole = mission === 0 ? this.buildShutdownConsole() : new THREE.Group();
    this.vaultShutter = mission === 0 ? this.buildVaultShutter() : null;
    this.buildWeapon();
    this.particleField = this.buildParticles();
    this.batchStaticArchitecture();
    this.setMission(mission);
  }

  private box(
    x: number, y: number, z: number, w: number, h: number, d: number,
    material: THREE.Material, parent: THREE.Object3D = this.scene, solid = false,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (solid) this.solidSurfaces.push(mesh);
    // Top-level, non-collidable architecture does not need its own draw call.
    if (parent === this.scene && !solid) this.staticArchitecture.push(mesh);
    return mesh;
  }

  private batchStaticArchitecture(): void {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const mesh of this.staticArchitecture) {
      const material = mesh.material as THREE.Material;
      const existing = batches.get(material) ?? [];
      existing.push(mesh);
      batches.set(material, existing);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const geometryParts = meshes.map((mesh) => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrix);
        return geometry;
      });
      const merged = mergeGeometries(geometryParts, false);
      for (const part of geometryParts) part.dispose();
      if (!merged) throw new Error('Unable to batch arena architecture.');
      for (const mesh of meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
      const combined = new THREE.Mesh(merged, material);
      combined.name = `Batched static architecture (${meshes.length} pieces)`;
      this.scene.add(combined);
    }
    this.staticArchitecture.length = 0;
  }

  private strip(x: number, y: number, z: number, w: number, h: number, d: number, warm = false): void {
    this.box(x, y, z, w, h, d, warm ? orangeEmissive : cyanEmissive);
  }

  private buildFloor(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 112),
      new THREE.MeshStandardMaterial({ color: 0x253c4a, map: grungeTexture, roughness: 0.55, metalness: 0.64 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.solidSurfaces.push(floor);

    const grid = new THREE.GridHelper(90, 45, 0x176c9b, 0x1e4151);
    grid.position.y = 0.018;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.29;
    this.scene.add(grid);

    // Conduit runs serve as a readable wayfinding system.
    for (const x of [-34, -12, -5.5, 5.5, 12, 34]) {
      this.strip(x, 0.032, 0, 0.055, 0.012, 106);
      this.strip(x + 0.2, 0.032, 0, 0.025, 0.012, 106);
    }
    for (const z of [-48, -36, -24, -12, 0, 12, 24, 36, 48]) {
      this.box(0, 0.017, z, 82, 0.025, 0.25, deepMetal);
      this.strip(0, 0.038, z, 82, 0.014, 0.028);
    }

    if (this.mission === 0) {
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 6.2, 0.19, 48), darkMetal);
      platform.position.set(0, 0.035, -39);
      this.scene.add(platform);
      const circle = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.075, 8, 64), cyanEmissive);
      circle.position.set(0, 0.15, -39);
      circle.rotation.x = Math.PI / 2;
      this.scene.add(circle);
    }
  }

  private buildArchitecture(): void {
    // Full-size industrial shell and overhead trusses; static panels are later batched.
    for (const side of [-1, 1]) {
      this.box(side * 44, 7.2, 0, 1.2, 14.4, 110, deepMetal);
      for (let i = 0; i < 12; i += 1) {
        const z = -50 + i * 9;
        this.box(side * 42.5, 7, z, 1.5, 14, 1.7, darkMetal);
        this.strip(side * 41.65, 4.3, z, 0.08, 6.5, 0.14);
        this.box(side * 43, 8.2, z + 2.2, 0.35, 9, 3.5, trim);
      }
      for (let i = 0; i < 9; i += 1) {
        const z = -46 + i * 11;
        this.box(side * 37, 7.8, z, 9.5, 0.38, 2, darkMetal);
        this.strip(side * 37, 8, z - 0.83, 9.5, 0.035, 0.045);
        this.box(side * 37, 8.6, z - 0.94, 9.5, 1.1, 0.06, trim);
      }
    }
    this.box(0, 8, -55, 88, 16, 1, deepMetal);
    this.box(0, 8, 55, 88, 16, 1, deepMetal);

    for (const z of [-48, -36, -24, -12, 0, 12, 24, 36, 48]) {
      for (const x of [-40, 40]) {
        this.box(x, 6.4, z, 2.5, 12.8, 2.3, darkMetal);
        this.strip(x + (x > 0 ? -1.28 : 1.28), 5.8, z, 0.06, 9.5, 0.18);
        this.box(x, 12.4, z, 3.8, 0.8, 3.2, trim);
      }
    }

    for (const z of [-48, -36, -24, -12, 0, 12, 24, 36, 48]) {
      this.box(0, 14.5, z, 84, 0.8, 1.3, deepMetal);
      this.strip(0, 14.08, z + 0.2, 80, 0.065, 0.11);
    }
    for (let i = 0; i < 30; i += 1) {
      const side = i % 2 ? -1 : 1;
      const z = -51 + Math.floor(i / 2) * 7;
      const x = side * (47.4 + (i % 3) * 1.2);
      const height = 8 + (i % 5) * 2.1;
      this.box(x, height * 0.5 + 3, z, 2.5, height, 2.7, darkMetal);
      for (let band = 0; band < 4; band += 1) {
        this.strip(x + (side > 0 ? -1.3 : 1.3), 5 + band * 1.6, z, 0.06, 0.12, 1.9);
      }
    }
  }

  private buildFacility(): void {
    // Thin but full-height partition walls make movement and line-of-sight meaningful.
    for (const wall of FACILITY_WALLS) {
      this.box(wall.x, 3.5, wall.z, wall.halfWidth * 2, 7, wall.halfDepth * 2, darkMetal, this.scene, true);
      this.blockers.push({ x: wall.x, z: wall.z, halfWidth: wall.halfWidth, halfDepth: wall.halfDepth });
      if (wall.halfWidth < 1) {
        this.box(wall.x, 7.06, wall.z, 0.17, 0.12, wall.halfDepth * 2, cyanEmissive);
        this.box(wall.x, 1, wall.z, 0.17, 0.05, wall.halfDepth * 2, trim);
      } else {
        this.box(wall.x, 7.06, wall.z, wall.halfWidth * 2, 0.12, 0.14, cyanEmissive);
      }
    }
    for (const door of FACILITY_DOORWAYS) {
      if (door.axis === 'x') {
        for (const z of [door.z - 5.35, door.z + 5.35]) this.box(door.x, 3.8, z, 0.95, 7.6, 0.45, trim);
        this.box(door.x, 7.65, door.z, 0.95, 0.4, 11.6, cyanEmissive);
      } else {
        const opening = door.z === -34 ? 13.8 : 5.35;
        for (const x of [door.x - opening, door.x + opening]) this.box(x, 3.8, door.z, 0.45, 7.6, 0.95, trim);
        this.box(door.x, 7.65, door.z, opening * 2 + 0.9, 0.4, 0.95, cyanEmissive);
      }
    }
    // Server racks and control kiosks are recognizable environment props, not blank boxes.
    for (const [x, z] of [[-36, -13], [-36, 15], [36, -13], [36, 15], [-8, 30], [8, 30]]) {
      this.box(x, 1.9, z, 1.5, 3.8, 2.0, deepMetal);
      this.box(x, 2.0, z + 1.04, 1.2, 3.2, 0.07, trim);
      for (let y = 0.7; y < 3.2; y += 0.5) this.box(x, y, z + 1.1, 0.98, 0.08, 0.075, y % 1 < 0.5 ? subtleCyan : orangeEmissive);
    }
  }

  private buildCore(): void {
    const core = new THREE.Group();
    core.position.set(0, 0, -40);
    this.scene.add(core);
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(2.95, 3.25, 14.2, 32, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0x14688d, transparent: true, opacity: 0.27, metalness: 0.55, roughness: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    outer.position.y = 7.7;
    core.add(outer);
    const central = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.7, 15.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x16d8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    central.position.y = 8.1;
    core.add(central);

    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * 3.3;
      const z = Math.sin(angle) * 3.3;
      this.box(x, 7.0, z, 0.5, 14, 0.68, darkMetal, core);
      this.box(x * 1.04, 8, z * 1.04, 0.12, 12.2, 0.14, cyanEmissive, core);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 15, 8), subtleCyan);
      rail.position.set(x * 0.65, 8.0, z * 0.65);
      core.add(rail);
    }

    for (let i = 0; i < 5; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.35 + (i % 2) * 0.3, 0.18, 8, 72), i % 2 ? trim : cyanEmissive);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.6 + i * 2.75;
      core.add(ring);
      this.animatedRings.push({ ring, speed: (i % 2 ? 1 : -1) * (0.06 + i * 0.012) });
    }

    for (let i = 0; i < 10; i += 1) {
      const beam = this.box(0, 1.8 + i * 1.4, 0, 1.1, 0.12, 1.1, cyanEmissive, core);
      beam.rotation.y = i * 0.35;
    }
    // The reactor is a physical obstacle, even though the luminous cylinder is transparent.
    this.blockers.push({ x: 0, z: -40, halfWidth: 3.3, halfDepth: 3.3 });
  }

  private buildCover(): void {
    const positions = [
      [-7, 29, 2.4, 1.6], [7, 24, 2.4, 1.6],
      [-8, 8, 2.1, 2.1], [8, -6, 2.7, 1.55],
      [-6.5, -22, 2, 1.6], [7, -25, 2, 1.8],
      [-25, 23, 2.2, 1.5], [-30, -8, 2.5, 1.4],
      [26, 24, 2.3, 1.5], [32, -8, 1.9, 1.6],
      [-7, -47, 2.5, 1.5], [8, -47, 2.5, 1.5],
    ];
    for (const [x, z, w, d] of positions) {
      const height = 1.55;
      this.box(x, height / 2, z, w, height, d, darkMetal, this.scene, true);
      this.box(x, height + 0.035, z, w + 0.12, 0.1, d + 0.12, trim);
      this.box(x, 0.53, z + d * 0.5 + 0.02, w * 0.82, 0.75, 0.04, deepMetal);
      this.box(x, 0.55, z + d * 0.5 + 0.05, w * 0.62, 0.05, 0.05, subtleCyan);
      for (const side of [-1, 1]) {
        this.strip(x + side * (w * 0.5 + 0.006), 0.72, z, 0.018, 0.07, d * 0.75);
      }
      this.blockers.push({ x, z, halfWidth: w / 2, halfDepth: d / 2 });
    }
  }

  /** Foundry: three separated capture courtyards connected by broad, flanked lanes. */
  private buildFoundry(): void {
    const violet = new THREE.MeshBasicMaterial({ color: 0xa88bff, toneMapped: false });
    const walls: readonly [number, number, number, number][] = [
      [-37, 2, 1.2, 67], [37, 2, 1.2, 67], [-19, 39, 32, 1.2], [19, 39, 32, 1.2],
      [-15, 8, 1.4, 22], [15, -13, 1.4, 21], [-21, -38, 24, 1.2], [21, -38, 24, 1.2],
      [-14, -40, 1.4, 19], [14, 29, 1.4, 19],
    ];
    for (const [x, z, w, d] of walls) {
      this.box(x, 3.3, z, w, 6.6, d, darkMetal, this.scene, true);
      this.blockers.push({ x, z, halfWidth: w / 2, halfDepth: d / 2 });
      this.box(x, 6.66, z, w, 0.15, d, violet);
    }
    // Industrial refinery rigs are recognizably different from server-room corridors.
    for (const [x, z] of [[-31, -12], [31, 27], [-30, -28], [31, -32], [-6, -47], [8, 45]]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.4, 6, 12), trim);
      tank.position.set(x, 3, z);
      this.scene.add(tank);
      for (const y of [1.6, 4.3]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.11, 6, 20), orangeEmissive);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x, y, z);
        this.scene.add(rim);
      }
      this.blockers.push({ x, z, halfWidth: 2.3, halfDepth: 2.3 });
      this.solidSurfaces.push(tank);
    }
    for (const [x, z] of [[-16, -25], [17, 23], [-24, 40], [23, -20], [0, 13], [0, -11]]) {
      this.box(x, 1.15, z, 3.3, 2.3, 2.4, deepMetal, this.scene, true);
      this.strip(x, 2.34, z, 3.5, 0.08, 2.5);
      this.blockers.push({ x, z, halfWidth: 1.65, halfDepth: 1.2 });
    }
    for (const { id, x, z } of [
      { id: 'TRACE-A', x: -29, z: 18 },
      { id: 'TRACE-B', x: 27, z: 6 },
      { id: 'TRACE-C', x: 0, z: -30 },
    ]) {
      const zone = new THREE.Group();
      zone.position.set(x, 0, z);
      this.scene.add(zone);
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(CAPTURE_RADIUS, CAPTURE_RADIUS, 0.04, 48),
        new THREE.MeshBasicMaterial({ color: 0x7953cd, transparent: true, opacity: 0.13, depthWrite: false }));
      disk.position.set(0, 0.065, 0);
      zone.add(disk);
      const perimeter = new THREE.Mesh(new THREE.TorusGeometry(CAPTURE_RADIUS, 0.13, 6, 64), violet);
      perimeter.rotation.x = Math.PI / 2;
      perimeter.position.set(0, 0.1, 0);
      zone.add(perimeter);
      this.captureZones.set(id, zone);
    }
  }

  /** Unobstructed circular combat floor: clear sightlines, perimeter cover, mobile boss. */
  private buildBossArena(): void {
    const red = new THREE.MeshBasicMaterial({ color: 0xff597c, toneMapped: false });
    const violet = new THREE.MeshBasicMaterial({ color: 0x957aff, toneMapped: false });
    for (const radius of [11, 22, 34, 40]) {
      const circle = new THREE.Mesh(new THREE.TorusGeometry(radius, radius === 40 ? 0.23 : 0.09, 6, 96), radius % 2 ? violet : red);
      circle.rotation.x = Math.PI / 2;
      circle.position.y = 0.075;
      this.scene.add(circle);
    }
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const x = Math.sin(angle) * 41;
      const z = Math.cos(angle) * 42;
      this.box(x, 6.8, z, 2.6, 13.6, 2.6, darkMetal);
      this.box(x, 11.5, z, 2.9, 0.16, 2.9, red);
      this.strip(x, 4.3, z + (z < 0 ? 1.36 : -1.36), 0.11, 5.9, 0.1, true);
    }
    for (const [x, z, w, d] of [[-25, 22, 4, 6], [25, 22, 4, 6], [-28, -14, 5, 4], [28, -14, 5, 4], [-12, -34, 5, 4], [12, -34, 5, 4]]) {
      this.box(x, 1.45, z, w, 2.9, d, trim, this.scene, true);
      this.box(x, 2.95, z, w + 0.18, 0.12, d + 0.18, red);
      this.blockers.push({ x, z, halfWidth: w / 2, halfDepth: d / 2 });
    }
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 9.1, 0.24, 48), deepMetal);
    platform.position.set(0, 0.025, -12);
    this.scene.add(platform);
    this.scene.fog = new THREE.FogExp2(0x2b0c22, 0.007);
  }

  private buildDrones(): void {
    type Spec = { id: string; x: number; y: number; z: number; phase: number; hostile: boolean;
      route: number[][]; dropId?: string; respawnDelay?: number; initialDelay?: number };
    const base: Spec[] = [
      { id: 'I-01', x: -5, y: 2.8, z: 25, phase: 0, hostile: true, dropId: 'FRAG-A', route: [[-5, 25], [5, 23], [5, 14], [-5, 17]] },
      { id: 'I-02', x: 6, y: 3.1, z: -3, phase: 1.3, hostile: true, route: [[6, -3], [-6, -3], [-5, -16], [6, -16]] },
      { id: 'I-03', x: -26, y: 2.8, z: 13, phase: 2.1, hostile: true, route: [[-26, 13], [-32, 8], [-28, -15], [-22, -15]] },
      { id: 'I-04', x: 26, y: 3, z: -18, phase: 3.7, hostile: true, dropId: 'FRAG-B', route: [[26, -18], [32, -12], [27, 14], [22, 14]] },
      { id: 'I-05', x: -4, y: 2.8, z: 9, phase: 0.8, hostile: true, route: [[-4, 9], [4, 9], [4, 19], [-4, 19]] },
      { id: 'I-06', x: -27, y: 2.8, z: -22, phase: 2.8, hostile: true, route: [[-27, -22], [-31, -13], [-26, 0], [-22, 0]] },
      { id: 'I-07', x: 24, y: 2.8, z: 25, phase: 4.2, hostile: true, dropId: 'FRAG-C', route: [[24, 25], [29, 23], [29, 10], [23, 10]] },
      { id: 'I-08', x: 7, y: 2.8, z: -44, phase: 3.1, hostile: true, route: [[7, -44], [10, -49], [2, -49], [2, -44]] },
      { id: 'I-09', x: -5, y: 3.1, z: 35, phase: 5.4, hostile: true, route: [[-5, 35], [5, 35], [4, 27], [-5, 27]] },
      { id: 'I-10', x: 5, y: 3, z: -28, phase: 6.1, hostile: true, route: [[5, -28], [-5, -25], [-5, -19], [5, -19]] },
      { id: 'I-11', x: -25, y: 3.1, z: -6, phase: 6.8, hostile: true, route: [[-25, -6], [-31, -6], [-32, -18], [-24, -18]] },
      { id: 'I-12', x: 25, y: 2.9, z: 32, phase: 7.5, hostile: true, route: [[25, 32], [31, 30], [30, 20], [23, 20]] },
      { id: 'I-13', x: -6, y: 3.2, z: -47, phase: 8.2, hostile: true, route: [[-6, -47], [-8, -50], [-2, -50], [-2, -45]] },
      { id: 'I-14', x: 25, y: 2.8, z: -35, phase: 8.9, hostile: true, route: [[25, -35], [29, -29], [29, -18], [23, -18]] },
    ];
    const foundry: Spec[] = [
      { id: 'I-11', x: -27, y: 3, z: 30, phase: 0.3, hostile: true, respawnDelay: 7, route: [[-27, 30], [-30, 12], [-21, 15]] },
      { id: 'I-12', x: -5, y: 3, z: 22, phase: 1, hostile: true, respawnDelay: 8, route: [[-5, 22], [5, 25], [7, 10]] },
      { id: 'I-13', x: 26, y: 3, z: 21, phase: 1.7, hostile: true, respawnDelay: 6, route: [[26, 21], [29, 11], [22, 9]] },
      { id: 'I-14', x: 24, y: 3, z: -11, phase: 2.1, hostile: true, respawnDelay: 7, route: [[24, -11], [29, -2], [23, 6]] },
      { id: 'I-15', x: -26, y: 3, z: -12, phase: 2.8, hostile: true, respawnDelay: 7, route: [[-26, -12], [-28, 1], [-24, 16]] },
      { id: 'I-16', x: 5, y: 3, z: -17, phase: 3.4, hostile: true, respawnDelay: 8, route: [[5, -17], [8, -24], [4, -34]] },
      { id: 'I-17', x: -22, y: 3, z: -30, phase: 4.0, hostile: true, respawnDelay: 6, route: [[-22, -30], [-7, -29], [-5, -36]] },
      { id: 'I-18', x: 21, y: 3, z: -33, phase: 4.7, hostile: true, respawnDelay: 7, route: [[21, -33], [8, -35], [5, -28]] },
    ];
    const arena: Spec[] = [
      { id: 'I-21', x: -26, y: 3, z: -21, phase: 0, hostile: true, respawnDelay: 7.5, route: [[-26, -21], [-20, -5], [-28, 8]] },
      { id: 'I-22', x: 26, y: 3, z: -21, phase: 1.3, hostile: true, respawnDelay: 8, route: [[26, -21], [20, -5], [29, 8]] },
      { id: 'I-23', x: -18, y: 3, z: 19, phase: 2.4, hostile: true, respawnDelay: 9, route: [[-18, 19], [-6, 12], [-16, 1]] },
      { id: 'I-24', x: 18, y: 3, z: 19, phase: 3.8, hostile: true, respawnDelay: 8, route: [[18, 19], [6, 12], [16, 1]] },
      { id: 'I-25', x: -34, y: 3.2, z: 7, phase: 4.5, hostile: true, initialDelay: 11, respawnDelay: 10, route: [[-34, 7], [-25, 0], [-32, -11]] },
      { id: 'I-26', x: 34, y: 3.2, z: 7, phase: 5.2, hostile: true, initialDelay: 19, respawnDelay: 10, route: [[34, 7], [25, 0], [32, -11]] },
      { id: 'I-27', x: 0, y: 3.2, z: -35, phase: 5.9, hostile: true, initialDelay: 27, respawnDelay: 12, route: [[0, -35], [-8, -29], [8, -27]] },
    ];
    const specs = this.mission === 0 ? base : this.mission === 1 ? foundry : arena;

    for (const spec of specs) {
      const group = new THREE.Group();
      group.position.set(spec.x, spec.y, spec.z);
      this.scene.add(group);
      const shell = new THREE.MeshStandardMaterial({ color: spec.hostile ? 0x752e49 : 0x8c693b, roughness: 0.29, metalness: 0.88, map: grungeTexture });
      const glow = spec.hostile ? magentaEmissive : orangeEmissive;
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.hostile ? 0.78 : 0.54, 2), shell);
      group.add(body);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 10), glow);
      eye.position.z = spec.hostile ? 0.77 : 0.5;
      group.add(eye);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 9, 32), spec.dropId ? new THREE.MeshBasicMaterial({ color: 0xe6ff7b }) : glow);
      halo.rotation.x = 0.12;
      group.add(halo);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.13, 8, 28), darkMetal);
      rim.rotation.x = Math.PI / 2;
      group.add(rim);
      if (spec.hostile) {
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.2, 0.65, 2, 0.075), shell);
          wing.position.set(side * 0.98, 0.02, -0.22);
          wing.rotation.z = side * 0.21;
          group.add(wing);
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.055, 0.12), glow);
          blade.position.set(side * 1.44, 0.08, -0.12);
          group.add(blade);
          const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.4, 12), trim);
          engine.rotation.x = Math.PI / 2;
          engine.position.set(side * 0.84, -0.18, -0.53);
          group.add(engine);
        }
      } else {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), trim);
        leg.position.y = -0.55;
        group.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.48), darkMetal);
        foot.position.y = -0.85;
        group.add(foot);
      }

      const meshes: THREE.Object3D[] = [];
      group.traverse((obj) => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      this.drones.push({ group, meshes, id: spec.id, hostile: spec.hostile, health: 3, maxHealth: 3, phase: spec.phase, spawn: group.position.clone(), active: true, halo,
        route: spec.route.map(([x, z]) => ({ x, z })), routeIndex: 1, attackClock: 0.7 + spec.phase * 0.24, boss: false,
        dropId: spec.dropId, respawnDelay: spec.respawnDelay, respawnClock: 0, initialDelay: spec.initialDelay });
    }
    if (this.mission === 2) this.buildBossMech();
  }

  private buildBossMech(): void {
    const group = new THREE.Group();
    group.position.set(0, 0, -12);
    this.scene.add(group);
    const armor = new THREE.MeshStandardMaterial({ color: 0x41425d, map: grungeTexture, metalness: 0.85, roughness: 0.27 });
    const plating = new THREE.MeshStandardMaterial({ color: 0x9f3a52, map: grungeTexture, metalness: 0.83, roughness: 0.33 });
    const machinery = new THREE.MeshStandardMaterial({ color: 0x182433, metalness: 0.95, roughness: 0.4 });
    const assembly = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.18, w * 0.16, h * 0.16, d * 0.16)), mat);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    assembly(0, 4.6, 0, 3.6, 3.3, 2, armor); // armored torso
    assembly(0, 4.6, 1.05, 2.65, 2.5, 0.24, plating);
    assembly(0, 2.5, -0.1, 2.1, 1.2, 1.7, machinery);
    assembly(0, 7.1, 0.25, 2.0, 1.35, 1.48, armor);
    assembly(0, 7.2, 1.03, 1.3, 0.28, 0.18, magentaEmissive); // face visor
    assembly(0, 5.1, 1.25, 1.4, 0.75, 0.24, magentaEmissive); // exposed power core
    const limbs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      assembly(side * 2.05, 6.15, 0, 1.8, 1.15, 2, plating);
      const arm = new THREE.Group();
      arm.position.set(side * 2.7, 5.6, 0);
      group.add(arm);
      const upper = new THREE.Mesh(new RoundedBoxGeometry(1.05, 2.4, 1.2, 2, 0.13), armor);
      upper.position.y = -1.1;
      arm.add(upper);
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.58, 2.7, 16), machinery);
      cannon.rotation.x = Math.PI / 2;
      cannon.position.set(0, -2.4, 0.55);
      arm.add(cannon);
      const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 20), magentaEmissive);
      muzzle.position.set(0, -2.4, 1.95);
      arm.add(muzzle);
      limbs.push(arm);
      const leg = new THREE.Group();
      leg.position.set(side * 1.07, 2.2, 0);
      group.add(leg);
      const shin = new THREE.Mesh(new RoundedBoxGeometry(1.2, 2.8, 1.3, 3, 0.12), armor);
      shin.position.y = -0.8;
      leg.add(shin);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.58, 2, 2, 0.1), plating);
      foot.position.set(0, -2, 0.35);
      leg.add(foot);
      limbs.push(leg);
    }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.1, 12, 64), magentaEmissive);
    halo.position.y = 4.65;
    group.add(halo);
    const meshes: THREE.Object3D[] = [];
    group.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
    this.drones.push({ id: 'SENTINEL', group, meshes, hostile: true, health: BOSS_TUNING.health, maxHealth: BOSS_TUNING.health,
      spawn: group.position.clone(), phase: 0.7, active: true, halo,
      route: [{ x: 0, z: -12 }, { x: 15, z: -14 }, { x: 12, z: -27 }, { x: -14, z: -26 }, { x: -16, z: -7 }], routeIndex: 1,
      attackClock: 1.4, boss: true, limbParts: limbs, respawnClock: 0 });
  }

  private buildMissionMarkers(): void {
    const evidence = [
      { id: 'TRACE-A', x: -29, z: 18 },
      { id: 'TRACE-B', x: 27, z: 6 },
      { id: 'TRACE-C', x: 0, z: -30 },
    ];
    const purple = new THREE.MeshBasicMaterial({ color: 0xac8aff, toneMapped: false });
    for (const spec of evidence) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      this.scene.add(group);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 6.7, 8), purple);
      shaft.position.y = 3.35;
      group.add(shaft);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.75, 0.6, 8), darkMetal);
      pedestal.position.y = 0.3;
      group.add(pedestal);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 6, 32), purple);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.08;
      group.add(halo);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), purple);
      crystal.position.y = 2.3;
      group.add(crystal);
      const emitter = new THREE.PointLight(0xb796ff, 10, 12, 2);
      emitter.position.y = 3.1;
      group.add(emitter);
      this.terminals.push({ id: spec.id, group, meshes: [], position: group.position.clone(), active: true, halo,
        capture: { charge: 0, complete: false } });
    }
  }

  private buildShutdownConsole(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(0, 0, -47);
    const green = new THREE.MeshBasicMaterial({ color: 0xe6ff7b, toneMapped: false });
    this.scene.add(group);
    this.box(0, 1.2, 0, 1.8, 2.4, 0.9, darkMetal, group);
    this.box(0, 1.7, 0.52, 1.4, 0.85, 0.08, green, group);
    this.box(0, 2.35, 0, 2.2, 0.18, 1.1, trim, group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 6, 32), green);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.11;
    group.add(ring);
    // Tall lime locator makes the upload station readable from the approach corridor.
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 6.1, 10),
      new THREE.MeshBasicMaterial({ color: 0xe6ff7b, transparent: true, opacity: 0.26, depthWrite: false }));
    beacon.position.y = 4.1;
    group.add(beacon);
    const locator = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), green);
    locator.position.y = 7.1;
    group.add(locator);
    for (const side of [-1, 1]) {
      this.box(side * 1.4, 2.35, 0.28, 0.12, 4.7, 0.1, green, group);
      this.box(side * 1.4, 4.7, 0.28, 0.6, 0.12, 0.1, green, group);
    }
    const ambient = new THREE.PointLight(0xe6ff7b, 23, 18, 2);
    ambient.position.y = 3.5;
    group.add(ambient);
    group.visible = false;
    return group;
  }

  private buildVaultShutter(): THREE.Mesh {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(VAULT_DOOR.halfWidth * 2, 7.3, 0.85, 3, 0.14), darkMetal);
    mesh.position.set(0, 11, VAULT_DOOR.z);
    mesh.name = 'North vault blast door';
    this.scene.add(mesh);
    this.solidSurfaces.push(mesh);
    return mesh;
  }

  private buildWeapon(): void {
    this.camera.add(this.weapon);
    const receiver = new THREE.MeshStandardMaterial({ color: 0x71879b, metalness: 0.94, roughness: 0.23, map: grungeTexture, depthTest: false });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x17232c, metalness: 0.58, roughness: 0.63, depthTest: false });
    const ceramic = new THREE.MeshStandardMaterial({ color: 0x354f65, metalness: 0.82, roughness: 0.31, depthTest: false });
    const accent = new THREE.MeshStandardMaterial({ color: 0xb0a1ff, metalness: 0.47, roughness: 0.36, depthTest: false });
    const energy = new THREE.MeshBasicMaterial({ color: 0x84f5ff, toneMapped: false, depthTest: false });
    const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      this.weapon.add(mesh);
      return mesh;
    };
    const rounded = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material): THREE.Mesh =>
      add(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.04, w * 0.2, h * 0.2, d * 0.2)), x, y, z, material);
    const tube = (x: number, y: number, z: number, r: number, length: number, mat: THREE.Material): THREE.Mesh => {
      const mesh = add(new THREE.CylinderGeometry(r, r, length, 12), x, y, z, mat);
      mesh.rotation.x = Math.PI / 2;
      return mesh;
    };

    rounded(0, -0.035, -0.31, 0.25, 0.22, 0.65, receiver); // upper receiver
    rounded(0, -0.16, -0.14, 0.19, 0.17, 0.35, ceramic); // lower receiver
    rounded(0, -0.31, -0.025, 0.13, 0.33, 0.17, carbon).rotation.x = -0.18; // angled grip
    rounded(0, -0.215, -0.39, 0.16, 0.3, 0.21, accent).rotation.x = 0.13; // rechargeable magazine
    rounded(0, 0.01, 0.13, 0.17, 0.14, 0.35, carbon); // shoulder stock
    rounded(0, -0.005, 0.31, 0.21, 0.26, 0.09, ceramic); // buttpad
    rounded(0, -0.02, -0.72, 0.2, 0.19, 0.48, ceramic); // handguard
    tube(0, -0.025, -1.04, 0.078, 0.39, carbon); // barrel
    tube(0, -0.025, -1.24, 0.11, 0.19, receiver); // suppressor
    tube(0, -0.025, -1.35, 0.068, 0.075, energy); // muzzle emitter
    rounded(0, 0.19, -0.19, 0.11, 0.055, 0.75, carbon); // optic rail
    rounded(0, 0.265, -0.14, 0.15, 0.08, 0.21, receiver); // holo sight body
    tube(0, 0.31, -0.18, 0.075, 0.23, carbon); // optic tube
    tube(0, 0.31, -0.303, 0.055, 0.023, energy); // optic glass
    for (const side of [-1, 1]) {
      rounded(side * 0.137, -0.03, -0.42, 0.045, 0.16, 0.55, carbon);
      rounded(side * 0.158, -0.027, -0.67, 0.022, 0.075, 0.31, energy);
      rounded(side * 0.12, 0.075, -0.08, 0.055, 0.09, 0.23, ceramic);
      for (let i = 0; i < 7; i += 1) rounded(side * 0.12, 0.08, -0.51 - i * 0.045, 0.04, 0.09, 0.018, receiver);
      for (let i = 0; i < 4; i += 1) rounded(side * 0.088, -0.34 - i * 0.042, -0.007 + i * 0.006, 0.01, 0.014, 0.11, ceramic);
    }

    // Collapse the detailed receiver into a handful of per-material draw calls.
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const mesh of [...this.weapon.children]) {
      if (!(mesh instanceof THREE.Mesh)) continue;
      const material = mesh.material as THREE.Material;
      const items = byMaterial.get(material) ?? [];
      items.push(mesh);
      byMaterial.set(material, items);
    }
    for (const [material, meshes] of byMaterial) {
      const components = meshes.map((mesh) => {
        mesh.updateMatrix();
        const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        part.applyMatrix4(mesh.matrix);
        return part;
      });
      const merged = mergeGeometries(components, false);
      for (const part of components) part.dispose();
      if (!merged) throw new Error('Unable to merge carbine components.');
      for (const mesh of meshes) { this.weapon.remove(mesh); mesh.geometry.dispose(); }
      this.weapon.add(new THREE.Mesh(merged, material));
    }
    this.weapon.add(this.muzzleFlash);
    this.muzzleFlash.position.set(0, -0.025, -1.36);
    this.muzzleFlash.visible = false;
    this.weapon.position.set(0.48, -0.39, -0.68);
    this.weapon.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.renderOrder = 30; });
  }

  private buildParticles(): THREE.Points {
    const rng = seededRandom(91);
    const positions: number[] = [];
    for (let i = 0; i < 185; i += 1) positions.push((rng() - 0.5) * 48, 0.4 + rng() * 16, (rng() - 0.5) * 53);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x46c5ea, size: 0.052, transparent: true, opacity: 0.52, depthWrite: false }));
    this.scene.add(points);

    for (let i = 0; i < 20; i += 1) {
      const packet = new THREE.Mesh(new THREE.SphereGeometry(0.047, 5, 4), cyanEmissive);
      packet.position.set(0, -20, 0);
      this.scene.add(packet);
      this.dataPackets.push({ mesh: packet, progress: rng(), speed: 0.045 + rng() * 0.07, rail: i % 4 });
    }
    return points;
  }

  get activeHostiles(): number {
    return this.drones.filter((drone) => drone.hostile && drone.active).length;
  }

  get activeCaptureZones(): number {
    return [...this.captureZones.values()].filter((zone) => zone.visible).length;
  }

  get sentinelHealth(): number {
    return this.drones.find((drone) => drone.id === 'SENTINEL')?.health ?? 0;
  }

  get sentinelMaxHealth(): number { return BOSS_TUNING.health; }

  get tacticalBlips(): { x: number; z: number; type: 'hostile' | 'friendly' | 'objective' | 'boss' }[] {
    const hostileBlips = this.drones.filter((drone) => drone.active).map((drone) => ({
      x: drone.group.position.x, z: drone.group.position.z,
      type: drone.boss ? 'boss' as const : drone.hostile ? 'hostile' as const : 'friendly' as const,
    }));
    const missionBlips = this.mission === 1 ? this.terminals.filter((marker) => marker.active).map((marker) => marker.position)
      : this.mission === 0 ? [
        ...this.fragments.filter((fragment) => !fragment.collected).map((fragment) => fragment.position),
        ...(this.fragments.length === 3 && this.fragments.every((fragment) => fragment.collected) && !this.shutdownComplete ? [this.shutdownConsole.position] : []),
      ] : [];
    return [...hostileBlips, ...missionBlips.map((position) => ({ x: position.x, z: position.z, type: 'objective' as const }))];
  }

  setMission(mission: number): void {
    if (mission !== this.mission) throw new RangeError('Each mission requires its own map instance');
    if (this.vaultShutter) this.vaultShutter.position.y = 11;
    this.shutdownComplete = false;
    this.shutdownConsole.visible = false;
    for (const fragment of this.fragments) this.scene.remove(fragment.group);
    this.fragments.length = 0;
    for (const bolt of this.enemyBolts) this.scene.remove(bolt.mesh);
    this.enemyBolts.length = 0;
    const atmospheres = [0x050d17, 0x100d21, 0x220a17];
    const fogs = [0x06121e, 0x17102e, 0x220d1b];
    this.scene.background = new THREE.Color(atmospheres[mission]);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(fogs[mission]);
    this.coreLight.color.setHex([COLOR.cyan, 0xa888ff, 0xff577d][mission]);
    this.coreLight.intensity = 75;
    for (const drone of this.drones) {
      drone.health = drone.boss ? BOSS_TUNING.health : ENEMY_TIERS[mission].health;
      drone.maxHealth = drone.health;
      drone.active = !drone.initialDelay;
      drone.group.visible = drone.active;
      drone.group.position.copy(drone.spawn);
      drone.routeIndex = 1;
      drone.attackClock = drone.boss ? 1.4 : 0.7 + drone.phase * 0.24;
      drone.respawnClock = drone.initialDelay ?? 0;
    }
    for (const marker of this.terminals) {
      marker.active = true;
      marker.capture = { charge: 0, complete: false };
      marker.group.visible = true;
      const zone = this.captureZones.get(marker.id);
      if (zone) zone.visible = true;
    }
  }

  private spawnFragment(id: string, position: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    const lime = new THREE.MeshBasicMaterial({ color: 0xe6ff7b, toneMapped: false });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.63), lime);
    crystal.position.y = 1.05;
    group.add(crystal);
    const base = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.11, 7, 32), lime);
    base.position.y = 0.15;
    base.rotation.x = Math.PI / 2;
    group.add(base);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.7, 9),
      new THREE.MeshBasicMaterial({ color: 0xbaff6b, transparent: true, opacity: 0.27, depthWrite: false }));
    beacon.position.y = 1.85;
    group.add(beacon);
    this.scene.add(group);
    this.fragments.push({ id, group, position: group.position.clone(), collected: false });
  }

  /** Proximity pickups are mission-one only; towers charge automatically. */
  getInteraction(x: number, z: number): { kind: 'fragment' | 'upload'; id: string } | null {
    if (this.mission !== 0) return null;
    const fragment = this.fragments.find((piece) => !piece.collected && Math.hypot(piece.position.x - x, piece.position.z - z) <= 3.4);
    if (fragment) return { kind: 'fragment', id: fragment.id };
    if (!this.shutdownComplete && this.shutdownConsole.visible && Math.hypot(this.shutdownConsole.position.x - x, this.shutdownConsole.position.z - z) <= 3.5)
      return { kind: 'upload', id: 'UPLOAD' };
    return null;
  }

  scanNearby(x: number, z: number): string | null {
    const interaction = this.getInteraction(x, z);
    if (!interaction) return null;
    if (interaction.kind === 'fragment') {
      const fragment = this.fragments.find((piece) => piece.id === interaction.id);
      if (!fragment) return null;
      fragment.collected = true;
      fragment.group.visible = false;
      this.spawnImpact(fragment.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xe6ff7b, 0.9);
      if (this.fragments.length === 3 && this.fragments.every((piece) => piece.collected)) this.shutdownConsole.visible = true;
      return fragment.id;
    }
    if (interaction.kind === 'upload') {
      this.shutdownComplete = true;
      this.shutdownConsole.visible = false;
      this.spawnImpact(this.shutdownConsole.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xe6ff7b, 1.2);
      return 'UPLOAD';
    }
    return null;
  }

  updateCapture(x: number, z: number, delta: number): { id: string; percent: number; completed: boolean; inRange: boolean } | null {
    if (this.mission !== 1) return null;
    const nearest = this.terminals.filter((marker) => marker.active).map((marker) => ({ marker,
      distance: Math.hypot(marker.position.x - x, marker.position.z - z) })).sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) return null;
    const wasComplete = nearest.marker.capture.complete;
    nearest.marker.capture = advanceCapture(nearest.marker.capture, nearest.distance, delta);
    if (!wasComplete && nearest.marker.capture.complete) {
      nearest.marker.active = false;
      nearest.marker.group.visible = false;
      const zone = this.captureZones.get(nearest.marker.id);
      if (zone) zone.visible = false;
      this.spawnImpact(nearest.marker.position.clone().add(new THREE.Vector3(0, 3, 0)), 0xad8fff, 2);
    }
    return { id: nearest.marker.id, percent: Math.round(nearest.marker.capture.charge * 100),
      completed: !wasComplete && nearest.marker.capture.complete, inRange: nearest.distance <= CAPTURE_RADIUS };
  }

  getWaypoint(x: number, z: number): { id: string; distance: number; dx: number; dz: number } | null {
    const candidates: { id: string; position: THREE.Vector3 }[] = this.mission === 0
      ? this.fragments.length === 3 && this.fragments.every((fragment) => fragment.collected)
        ? this.shutdownComplete ? [] : [{ id: 'UPLOAD', position: this.shutdownConsole.position }]
        : [
          ...this.fragments.filter((fragment) => !fragment.collected).map((fragment) => ({ id: fragment.id, position: fragment.position })),
          ...this.drones.filter((drone) => drone.active && !!drone.dropId).map((drone) => ({ id: `CARRIER ${drone.dropId}`, position: drone.group.position })),
        ]
      : this.mission === 1 ? this.terminals.filter((marker) => marker.active).map((marker) => ({ id: marker.id, position: marker.position }))
        : this.drones.filter((drone) => drone.boss && drone.active).map((drone) => ({ id: drone.id, position: drone.group.position }));
    const closest = candidates.map((marker) => {
      const position = marker.position;
      const dx = position.x - x;
      const dz = position.z - z;
      return { id: marker.id, distance: Math.hypot(dx, dz), dx, dz };
    }).sort((a, b) => a.distance - b.distance);
    return closest[0] ?? null;
  }

  setGraphicsTier(tier: GraphicsTier): void {
    this.particleField.visible = tier !== 'low';
    this.ambientLight.intensity = tier === 'low' ? 1.3 : 1.15;
    this.coreLight.intensity = tier === 'low' ? 52 : 75;
    for (const packet of this.dataPackets) packet.mesh.visible = tier !== 'low';
  }

  resetDrones(): void {
    this.setMission(this.mission);
  }

  /** Release level-owned GPU meshes when transitioning maps or retrying a checkpoint. */
  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) geometries.add(object.geometry);
    });
    for (const geometry of geometries) geometry.dispose();
    this.boltGeometry.dispose();
  }

  fire(): ShotResult {
    this.weaponKick = 1;
    this.muzzleTime = 0.065;
    this.muzzleFlash.visible = true;
    // Raycasting must work before the first render and after target movement.
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 90;
    const hittable = this.drones.filter((drone) => drone.active).flatMap((drone) => drone.meshes);
    const hits = this.raycaster.intersectObjects([...hittable, ...this.solidSurfaces], false);
    const hit = hits[0];
    if (!hit) {
      return { kind: 'miss', destroyed: false, point: this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(50)) };
    }

    const drone = this.drones.find((item) => item.active && item.meshes.includes(hit.object));
    if (!drone) {
      this.spawnImpact(hit.point, COLOR.cyanDeep, 0.22);
      return { kind: 'miss', destroyed: false, point: hit.point };
    }

    this.spawnImpact(hit.point, drone.hostile ? COLOR.magenta : COLOR.orange, 0.5);
    if (!drone.hostile) return { kind: 'neutral', destroyed: false, point: hit.point, targetId: drone.id };
    drone.health -= 1;
    const destroyed = drone.health <= 0;
    if (destroyed) {
      drone.active = false;
      drone.group.visible = false;
      if (drone.dropId) this.spawnFragment(drone.dropId, drone.group.position.clone());
      if (drone.respawnDelay && (this.mission === 1 || this.sentinelHealth > 0))
        drone.respawnClock = drone.respawnDelay ?? 0;
      this.spawnImpact(drone.group.position.clone().add(new THREE.Vector3(0, drone.boss ? 4 : 0, 0)), COLOR.magenta, drone.boss ? 3.4 : 1.6);
    }
    return { kind: 'hostile', destroyed, point: hit.point, targetId: drone.id };
  }

  private spawnImpact(point: THREE.Vector3, color: number, size: number): void {
    const object = new THREE.Mesh(
      new THREE.SphereGeometry(size, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    object.position.copy(point);
    this.scene.add(object);
    this.impacts.push({ object, life: 0, duration: 0.4 });
  }

  private fireEnemyBolt(drone: Drone, player: Position3): void {
    const tuning = drone.boss ? BOSS_TUNING : ENEMY_TIERS[this.mission];
    const origin = drone.group.position.clone().add(new THREE.Vector3(0, drone.boss ? 5 : 0, 0));
    const target = new THREE.Vector3(player.x, player.y - 0.32, player.z);
    const velocity = target.sub(origin).normalize().multiplyScalar(tuning.projectileSpeed);
    const mesh = new THREE.Mesh(this.boltGeometry, drone.boss ? this.bossBoltMaterial : this.boltMaterial);
    mesh.position.copy(origin);
    mesh.scale.setScalar(drone.boss ? 2.25 : 1);
    this.scene.add(mesh);
    this.enemyBolts.push({ mesh, velocity: { x: velocity.x, y: velocity.y, z: velocity.z }, life: 3.5, damage: tuning.damage });
  }

  update(delta: number, time: number, walking: number, sliding: boolean, player?: Position3): number {
    let damage = 0;
    this.coreLight.intensity += (68 + Math.sin(time * 1.7) * 9 - this.coreLight.intensity) * Math.min(delta * 2, 1);
    for (const { ring, speed } of this.animatedRings) ring.rotation.z += delta * speed;
    if (this.vaultShutter) this.vaultShutter.position.y += (11 - this.vaultShutter.position.y) * Math.min(delta * 4.3, 1);

    for (const marker of this.terminals) {
      if (!marker.active) continue;
      marker.halo.rotation.z += delta * 0.55;
      marker.halo.scale.setScalar(1 + Math.sin(time * 2.4 + marker.position.x) * 0.08);
    }

    for (const drone of this.drones) {
      if (!drone.active) {
        if (player && drone.respawnClock > 0 && (this.mission !== 2 || this.sentinelHealth > 0)) {
          drone.respawnClock -= delta;
          if (drone.respawnClock <= 0) {
            drone.active = true;
            drone.group.visible = true;
            drone.health = drone.maxHealth;
            drone.group.position.copy(drone.spawn);
            drone.routeIndex = 1;
            drone.attackClock = 1.15;
            this.spawnImpact(drone.spawn, COLOR.magenta, 1.3);
          }
        }
        continue;
      }
      if (player && drone.hostile) {
        const destination = drone.route[drone.routeIndex] ?? drone.route[0];
        const dx = destination.x - drone.group.position.x;
        const dz = destination.z - drone.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 1.1) drone.routeIndex = (drone.routeIndex + 1) % drone.route.length;
        else {
          const speed = drone.boss ? BOSS_TUNING.speed : ENEMY_TIERS[this.mission].speed;
          const step = Math.min(distance, speed * delta);
          const x = drone.group.position.x + dx / distance * step;
          const z = drone.group.position.z + dz / distance * step;
          if (!pointBlocked(x, z, this.blockers, drone.boss ? 2.2 : 0.75)) {
            drone.group.position.x = x;
            drone.group.position.z = z;
          } else drone.routeIndex = (drone.routeIndex + 1) % drone.route.length;
        }
        const targetBearing = Math.atan2(player.x - drone.group.position.x, player.z - drone.group.position.z);
        drone.group.rotation.y += Math.atan2(Math.sin(targetBearing - drone.group.rotation.y), Math.cos(targetBearing - drone.group.rotation.y)) * Math.min(1, delta * 4);
        drone.attackClock -= delta;
        const range = drone.boss ? BOSS_TUNING.range : ENEMY_TIERS[this.mission].range;
        const enemyY = drone.boss ? 4.5 : drone.group.position.y;
        const distant = Math.hypot(player.x - drone.group.position.x, player.z - drone.group.position.z) > range;
        const covered = segmentBlocked(drone.group.position.x, drone.group.position.z, player.x, player.z, this.blockers, 0.25);
        if (drone.attackClock <= 0 && !distant && !covered && Math.abs(player.y - enemyY) < 7) {
          this.fireEnemyBolt(drone, player);
          drone.attackClock = drone.boss ? BOSS_TUNING.fireInterval : ENEMY_TIERS[this.mission].fireInterval;
        }
      }
      if (!drone.boss) drone.group.position.y = drone.spawn.y + Math.sin(time * 1.8 + drone.phase) * 0.2;
      if (drone.limbParts) {
        for (let i = 0; i < drone.limbParts.length; i += 1) drone.limbParts[i].rotation.x = Math.sin(time * 2.5 + i * Math.PI) * (i % 2 ? 0.12 : 0.2);
      }
      drone.halo.rotation.z += delta * (drone.hostile ? 0.5 : -0.2);
      drone.halo.scale.setScalar(1 + Math.sin(time * 2.6 + drone.phase) * 0.045);
    }

    if (player) {
      for (let i = this.enemyBolts.length - 1; i >= 0; i -= 1) {
        const bolt = this.enemyBolts[i];
        bolt.life -= delta;
        const step = advanceBolt(bolt.mesh.position, bolt.velocity, delta, player, this.blockers);
        bolt.mesh.position.set(step.position.x, step.position.y, step.position.z);
        if (step.result === 'hit') damage += bolt.damage;
        if (bolt.life <= 0 || step.result !== 'flying') {
          this.scene.remove(bolt.mesh);
          this.enemyBolts.splice(i, 1);
        }
      }
    }

    for (const packet of this.dataPackets) {
      packet.progress = (packet.progress + delta * packet.speed) % 1;
      const x = [-34, -5.5, 5.5, 34][packet.rail];
      packet.mesh.position.set(x, 0.09, 51 - packet.progress * 104);
    }

    this.muzzleTime = Math.max(0, this.muzzleTime - delta);
    this.muzzleFlash.visible = this.muzzleTime > 0;
    this.weaponKick = Math.max(0, this.weaponKick - delta * 6.8);
    const bob = Math.sin(time * (sliding ? 19 : 12)) * Math.min(walking, 1) * 0.011;
    const targetX = 0.48 + Math.sin(time * 5.6) * Math.min(walking, 1) * 0.009;
    const targetY = -0.39 + bob - (sliding ? 0.07 : 0) - this.weaponKick * 0.045;
    this.weapon.position.x += (targetX - this.weapon.position.x) * Math.min(delta * 12, 1);
    this.weapon.position.y += (targetY - this.weapon.position.y) * Math.min(delta * 12, 1);
    this.weapon.rotation.x = this.weaponKick * 0.095;

    for (let i = this.impacts.length - 1; i >= 0; i -= 1) {
      const impact = this.impacts[i];
      impact.life += delta;
      const progress = impact.life / impact.duration;
      impact.object.scale.setScalar(0.45 + progress * 2.0);
      (impact.object.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.72 * (1 - progress));
      if (progress >= 1) {
        this.scene.remove(impact.object);
        impact.object.geometry.dispose();
        (impact.object.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      }
    }
    return damage;
  }
}
