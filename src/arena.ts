import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Blocker } from './simulation';

export type GraphicsTier = 'low' | 'medium' | 'high';
export interface ShotResult {
  kind: 'hostile' | 'neutral' | 'miss';
  destroyed: boolean;
  point: THREE.Vector3;
}

interface Drone {
  group: THREE.Group;
  meshes: THREE.Object3D[];
  id: string;
  hostile: boolean;
  health: number;
  spawn: THREE.Vector3;
  phase: number;
  respawn: number;
  active: boolean;
  halo: THREE.Mesh;
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
  private readonly impacts: Impact[] = [];
  private readonly animatedRings: { ring: THREE.Mesh; speed: number }[] = [];
  private readonly dataPackets: { mesh: THREE.Mesh; progress: number; speed: number; rail: number }[] = [];
  private readonly particleField: THREE.Points;
  private weaponKick = 0;
  private muzzleTime = 0;
  private readonly coreLight: THREE.PointLight;
  private readonly ambientLight: THREE.HemisphereLight;

  constructor() {
    this.scene.background = new THREE.Color(0x050d17);
    this.scene.fog = new THREE.FogExp2(0x06121e, 0.011);
    this.camera.position.set(0, 1.72, 17);
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
    this.coreLight.position.set(0, 6.5, -16);
    this.scene.add(this.coreLight);

    this.buildFloor();
    this.buildArchitecture();
    this.buildCore();
    this.buildCover();
    this.buildDrones();
    this.buildWeapon();
    this.particleField = this.buildParticles();
    this.batchStaticArchitecture();
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
      new THREE.PlaneGeometry(49, 57),
      new THREE.MeshStandardMaterial({ color: 0x0d2231, roughness: 0.29, metalness: 0.77 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    this.solidSurfaces.push(floor);

    const grid = new THREE.GridHelper(47, 47, 0x107b9b, 0x124154);
    grid.position.y = 0.018;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.29;
    this.scene.add(grid);

    // Conduit runs serve as a readable wayfinding system.
    for (const x of [-15.5, -5.5, 5.5, 15.5]) {
      this.strip(x, 0.032, 0, 0.055, 0.012, 48);
      this.strip(x + 0.2, 0.032, 0, 0.025, 0.012, 48);
    }
    for (const z of [-20, -9, 2, 13, 22]) {
      this.box(0, 0.017, z, 45, 0.025, 0.25, deepMetal);
      this.strip(0, 0.038, z, 45, 0.014, 0.028);
    }

    // Navigation platform underneath the network core.
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 6.2, 0.19, 48), darkMetal);
    platform.position.set(0, 0.035, -16);
    this.scene.add(platform);
    const circle = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.075, 8, 64), cyanEmissive);
    circle.position.set(0, 0.15, -16);
    circle.rotation.x = Math.PI / 2;
    this.scene.add(circle);
  }

  private buildArchitecture(): void {
    // Angled industrial wall modules. The tall silhouettes make the space feel vast.
    for (const side of [-1, 1]) {
      this.box(side * 24.2, 6.5, 0, 1.2, 13, 56, deepMetal);
      for (let i = 0; i < 7; i += 1) {
        const z = -23 + i * 7.5;
        this.box(side * 23.3, 7.2, z, 1.9, 14.5, 1.5, darkMetal);
        this.strip(side * 22.25, 4, z, 0.08, 6.5, 0.14);
        this.box(side * 23.1, 8.2, z + 2.2, 0.35, 9, 3.5, trim);
      }
      for (let i = 0; i < 5; i += 1) {
        const z = -19.5 + i * 9;
        const walkway = this.box(side * 19, 7.2, z, 9.5, 0.38, 2.0, darkMetal);
        walkway.rotation.y = 0;
        this.strip(side * 19, 7.46, z - 0.83, 9.5, 0.035, 0.045);
        this.box(side * 19, 8.05, z - 0.94, 9.5, 1.1, 0.06, trim);
        for (const offset of [-3.6, 0, 3.6]) this.box(side * 19 + offset, 7.8, z - 0.96, 0.08, 0.95, 0.08, trim);
      }
    }
    this.box(0, 8, -28, 49, 16, 1, deepMetal);
    this.box(0, 8, 28, 49, 16, 1, deepMetal);

    for (const z of [-23, -14, -5, 4, 13, 22]) {
      for (const x of [-21, 21]) {
        this.box(x, 6.4, z, 2.5, 12.8, 2.3, darkMetal);
        this.strip(x + (x > 0 ? -1.28 : 1.28), 5.8, z, 0.06, 9.5, 0.18);
        this.box(x, 12.4, z, 3.8, 0.8, 3.2, trim);
      }
    }

    // Ceiling frames and distant suspended server facades.
    for (const z of [-24, -12, 0, 12, 24]) {
      this.box(0, 14.5, z, 47, 0.8, 1.3, deepMetal);
      this.strip(0, 14.08, z + 0.2, 42, 0.065, 0.11);
    }
    for (let i = 0; i < 24; i += 1) {
      const side = i % 2 ? -1 : 1;
      const z = -25 + Math.floor(i / 2) * 4.7;
      const x = side * (26.4 + (i % 3) * 1.2);
      const height = 8 + (i % 5) * 2.1;
      this.box(x, height * 0.5 + 3, z, 2.5, height, 2.7, darkMetal);
      for (let band = 0; band < 4; band += 1) {
        this.strip(x + (side > 0 ? -1.3 : 1.3), 5 + band * 1.6, z, 0.06, 0.12, 1.9);
      }
    }
  }

  private buildCore(): void {
    const core = new THREE.Group();
    core.position.set(0, 0, -16);
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
    this.blockers.push({ x: 0, z: -16, halfWidth: 3.3, halfDepth: 3.3 });
  }

  private buildCover(): void {
    const positions = [
      [-8, 7, 2.4, 1.6], [8, 7.5, 2.4, 1.6],
      [-14, -1, 2.1, 2.1], [12, -4.5, 2.7, 1.55],
      [-7.5, -9.2, 2.0, 1.6], [9, -12, 2.0, 1.8],
      [-3, 3.4, 1.65, 1.25], [4.5, 12.5, 2.0, 1.5],
    ];
    for (const [x, z, w, d] of positions) {
      const height = 1.35;
      this.box(x, height / 2, z, w, height, d, darkMetal, this.scene, true);
      this.box(x, height + 0.035, z, w + 0.12, 0.1, d + 0.12, trim);
      for (const side of [-1, 1]) {
        this.strip(x + side * (w * 0.5 + 0.006), 0.72, z, 0.018, 0.07, d * 0.75);
      }
      this.blockers.push({ x, z, halfWidth: w / 2, halfDepth: d / 2 });
    }
  }

  private buildDrones(): void {
    const specs = [
      { id: 'I-01', x: -10, y: 2.3, z: -0.8, phase: 0, hostile: true },
      { id: 'I-02', x: 8.4, y: 3.1, z: -5.8, phase: 1.3, hostile: true },
      { id: 'I-03', x: -5.2, y: 2.8, z: -11, phase: 2.1, hostile: true },
      { id: 'I-04', x: 11.6, y: 2.1, z: 3.1, phase: 3.7, hostile: true },
      { id: 'M-01', x: 15.7, y: 1.8, z: 11.8, phase: 1.9, hostile: false },
    ];

    for (const spec of specs) {
      const group = new THREE.Group();
      group.position.set(spec.x, spec.y, spec.z);
      this.scene.add(group);
      const shell = new THREE.MeshStandardMaterial({ color: spec.hostile ? 0x4c1c31 : 0x665036, roughness: 0.35, metalness: 0.85 });
      const glow = spec.hostile ? magentaEmissive : orangeEmissive;
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.hostile ? 0.58 : 0.48, 1), shell);
      group.add(body);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), glow);
      eye.position.z = 0.5;
      group.add(eye);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.038, 7, 44), glow);
      halo.rotation.x = 0.12;
      group.add(halo);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.11, 8, 28), darkMetal);
      rim.rotation.x = Math.PI / 2;
      group.add(rim);
      if (spec.hostile) {
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.12, 0.4), shell);
          wing.position.set(side * 0.72, 0.02, -0.18);
          wing.rotation.z = side * 0.21;
          group.add(wing);
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.055, 0.12), glow);
          blade.position.set(side * 1.05, 0.08, -0.12);
          group.add(blade);
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
      this.drones.push({ group, meshes, id: spec.id, hostile: spec.hostile, health: 3, phase: spec.phase, spawn: group.position.clone(), respawn: 0, active: true, halo });
    }
  }

  private buildWeapon(): void {
    this.camera.add(this.weapon);
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x202f3e, roughness: 0.24, metalness: 0.8, depthTest: false });
    const grip = new THREE.MeshStandardMaterial({ color: 0x0b141e, roughness: 0.85, metalness: 0.25, depthTest: false });
    const energy = new THREE.MeshBasicMaterial({ color: COLOR.cyan, toneMapped: false, depthTest: false });
    const shell = this.box(0, -0.045, -0.3, 0.18, 0.20, 0.78, gunmetal, this.weapon);
    shell.rotation.x = 0.02;
    this.box(0, -0.19, -0.075, 0.12, 0.36, 0.19, grip, this.weapon).rotation.x = -0.12;
    this.box(0, 0.018, -0.27, 0.20, 0.08, 0.62, trim, this.weapon);
    this.box(0, 0.061, -0.39, 0.10, 0.025, 0.42, energy, this.weapon);
    for (const side of [-1, 1]) {
      this.box(side * 0.112, -0.02, -0.29, 0.035, 0.09, 0.58, energy, this.weapon);
      this.box(side * 0.1, 0.075, -0.03, 0.055, 0.10, 0.22, gunmetal, this.weapon);
    }
    this.box(0, -0.02, -0.82, 0.11, 0.11, 0.32, gunmetal, this.weapon);
    this.box(0, -0.01, -1.0, 0.065, 0.065, 0.10, energy, this.weapon);
    this.box(0, 0.14, -0.22, 0.1, 0.11, 0.1, gunmetal, this.weapon);
    this.box(0, 0.18, -0.24, 0.05, 0.035, 0.055, energy, this.weapon);
    this.weapon.add(this.muzzleFlash);
    this.muzzleFlash.position.set(0, -0.01, -1.06);
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

  setGraphicsTier(tier: GraphicsTier): void {
    this.particleField.visible = tier !== 'low';
    this.ambientLight.intensity = tier === 'low' ? 1.3 : 1.15;
    this.coreLight.intensity = tier === 'low' ? 52 : 75;
    for (const packet of this.dataPackets) packet.mesh.visible = tier !== 'low';
  }

  resetDrones(): void {
    for (const drone of this.drones) {
      drone.health = 3;
      drone.active = true;
      drone.respawn = 0;
      drone.group.visible = true;
      drone.group.position.copy(drone.spawn);
    }
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
    if (!drone.hostile) return { kind: 'neutral', destroyed: false, point: hit.point };
    drone.health -= 1;
    const destroyed = drone.health <= 0;
    if (destroyed) {
      drone.active = false;
      drone.respawn = 4.0;
      drone.group.visible = false;
      this.spawnImpact(drone.group.position, COLOR.magenta, 1.6);
    }
    return { kind: 'hostile', destroyed, point: hit.point };
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

  update(delta: number, time: number, walking: number, sliding: boolean): void {
    this.coreLight.intensity += (68 + Math.sin(time * 1.7) * 9 - this.coreLight.intensity) * Math.min(delta * 2, 1);
    for (const { ring, speed } of this.animatedRings) ring.rotation.z += delta * speed;

    for (const drone of this.drones) {
      if (!drone.active) {
        drone.respawn -= delta;
        if (drone.respawn <= 0) {
          drone.active = true;
          drone.health = 3;
          drone.group.visible = true;
        }
        continue;
      }
      const drift = Math.sin(time * 0.8 + drone.phase) * (drone.hostile ? 0.65 : 0.27);
      drone.group.position.set(
        drone.spawn.x + Math.cos(time * 0.65 + drone.phase) * (drone.hostile ? 0.5 : 0.15),
        drone.spawn.y + Math.sin(time * 1.8 + drone.phase) * 0.22,
        drone.spawn.z + drift,
      );
      drone.group.rotation.y = Math.sin(time * 0.8 + drone.phase) * 0.42;
      drone.halo.rotation.z += delta * (drone.hostile ? 0.5 : -0.2);
      drone.halo.scale.setScalar(1 + Math.sin(time * 2.6 + drone.phase) * 0.045);
    }

    for (const packet of this.dataPackets) {
      packet.progress = (packet.progress + delta * packet.speed) % 1;
      const x = [-15.5, -5.5, 5.5, 15.5][packet.rail];
      packet.mesh.position.set(x, 0.09, 23 - packet.progress * 47);
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
  }
}
