import * as THREE from 'three';

export type TankVariant = 'spartan' | 'wingman-cyan' | 'wingman-violet';

export interface ProceduralTankRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  turretPivot: THREE.Group;
  barrelPivot: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  wheels: THREE.Mesh[];
  energyRing: THREE.Mesh;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(3, 6, 12, 0.72)');
    grad.addColorStop(0.55, 'rgba(3, 6, 12, 0.34)');
    grad.addColorStop(1, 'rgba(3, 6, 12, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStudioFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f151f';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 2;
    const step = 64;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.06)';
    ctx.lineWidth = 1;
    for (let i = step / 2; i < size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  return tex;
}

function createHullGeometry(): THREE.ExtrudeGeometry {
  // Side-profile hull extruded symmetrically along Z, then rotated so forward is +Z
  const shape = new THREE.Shape();
  shape.moveTo(-1.05, 0.0);
  shape.lineTo(1.08, 0.0);
  shape.lineTo(1.28, 0.24);
  shape.lineTo(0.92, 0.48);
  shape.lineTo(-0.88, 0.48);
  shape.lineTo(-1.16, 0.24);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.18,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
    steps: 1,
  });
  geo.center();
  // Rotate so length runs along Z (+Z forward) and height along +Y
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createTurretGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.46, -0.58);
  shape.lineTo(0.46, -0.58);
  shape.lineTo(0.58, -0.15);
  shape.lineTo(0.42, 0.56);
  shape.lineTo(-0.42, 0.56);
  shape.lineTo(-0.58, -0.15);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
    steps: 1,
  });
  geo.center();
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function createTrackPodGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const r = 0.23;
  const halfLen = 1.04;
  shape.absarc(halfLen, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.absarc(-halfLen, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    steps: 1,
  });
  geo.center();
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createTank3D(
  variant: TankVariant,
  shadowTexture: THREE.Texture
): ProceduralTankRig {
  const palettes: Record<
    TankVariant,
    { primary: number; secondary: number; accent: number; glow: number }
  > = {
    spartan: {
      primary: 0xf59e0b,
      secondary: 0x334155,
      accent: 0xfef08a,
      glow: 0x38bdf8,
    },
    'wingman-cyan': {
      primary: 0x0ea5e9,
      secondary: 0x1e293b,
      accent: 0xbae6fd,
      glow: 0x38bdf8,
    },
    'wingman-violet': {
      primary: 0xa855f7,
      secondary: 0x1e293b,
      accent: 0xe9d5ff,
      glow: 0xc084fc,
    },
  };
  const pal = palettes[variant];

  // Distinct PBR roughness/metalness contrast (>= 0.25 roughness delta)
  const armorMat = new THREE.MeshPhysicalMaterial({
    color: pal.primary,
    metalness: 0.82,
    roughness: 0.24,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
  });
  const trimSteelMat = new THREE.MeshStandardMaterial({
    color: pal.secondary,
    metalness: 0.72,
    roughness: 0.42,
  });
  const treadMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.12,
    roughness: 0.86,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: pal.accent,
    metalness: 0.9,
    roughness: 0.2,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: pal.glow,
    emissive: pal.glow,
    emissiveIntensity: 2.2,
    metalness: 0.2,
    roughness: 0.25,
  });

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Ground contact shadow plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 4.1),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  // Portal energy pulse ring beneath tank
  const energyRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.38, 48),
    new THREE.MeshBasicMaterial({
      color: pal.glow,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  energyRing.rotation.x = -Math.PI / 2;
  energyRing.position.y = 0.03;
  root.add(energyRing);

  // 1. Primary Silhouette: Main Armored Hull (bottom flush with track height)
  const hullGeo = createHullGeometry();
  const hull = new THREE.Mesh(hullGeo, armorMat);
  hull.position.set(0, 0.42, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  bodyPivot.add(hull);

  // 2. Left & Right Track Sponsons (bottom touches Y=0)
  const trackGeo = createTrackPodGeometry();
  const leftTrack = new THREE.Mesh(trackGeo, treadMat);
  leftTrack.position.set(-0.76, 0.27, 0);
  leftTrack.castShadow = true;
  leftTrack.receiveShadow = true;
  bodyPivot.add(leftTrack);

  const rightTrack = new THREE.Mesh(trackGeo, treadMat);
  rightTrack.position.set(0.76, 0.27, 0);
  rightTrack.castShadow = true;
  rightTrack.receiveShadow = true;
  bodyPivot.add(rightTrack);

  // Armored side skirts
  const skirtGeo = new THREE.BoxGeometry(0.1, 0.22, 2.25);
  const leftSkirt = new THREE.Mesh(skirtGeo, trimSteelMat);
  leftSkirt.position.set(-0.96, 0.4, 0);
  leftSkirt.castShadow = true;
  bodyPivot.add(leftSkirt);

  const rightSkirt = new THREE.Mesh(skirtGeo, trimSteelMat);
  rightSkirt.position.set(0.96, 0.4, 0);
  rightSkirt.castShadow = true;
  bodyPivot.add(rightSkirt);

  // 3. Road Wheels (4 per side)
  const wheelGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.38, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const wheelZPositions = [-0.84, -0.28, 0.28, 0.84];
  for (const wz of wheelZPositions) {
    for (const wx of [-0.76, 0.76]) {
      const wheel = new THREE.Mesh(wheelGeo, trimSteelMat);
      wheel.position.set(wx, 0.22, wz);
      wheel.castShadow = true;
      bodyPivot.add(wheel);
      wheels.push(wheel);
    }
  }

  // 4. Front Glacis Visor Strip & Rear Twin Exhausts
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.08), glowMat);
  visor.position.set(0, 0.47, 1.12);
  bodyPivot.add(visor);

  const exhaustGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.42, 12);
  exhaustGeo.rotateX(Math.PI * 0.35);
  for (const ex of [-0.34, 0.34]) {
    const pipe = new THREE.Mesh(exhaustGeo, trimSteelMat);
    pipe.position.set(ex, 0.62, -1.12);
    pipe.castShadow = true;
    bodyPivot.add(pipe);
  }

  // 5. Secondary Read: Rotating Turret Assembly
  const turretPivot = new THREE.Group();
  turretPivot.position.set(0, 0.72, -0.06);
  bodyPivot.add(turretPivot);

  const turretRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.62, 0.12, 24),
    trimSteelMat
  );
  turretRing.position.y = 0.04;
  turretPivot.add(turretRing);

  const turretMesh = new THREE.Mesh(createTurretGeometry(), armorMat);
  turretMesh.position.y = 0.24;
  turretMesh.castShadow = true;
  turretMesh.receiveShadow = true;
  turretPivot.add(turretMesh);

  // Commander cupola + glowing core beacon
  const cupola = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.14, 16),
    trimSteelMat
  );
  cupola.position.set(-0.18, 0.48, -0.14);
  cupola.castShadow = true;
  turretPivot.add(cupola);

  const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat);
  coreGem.position.set(0, 0.48, -0.02);
  turretPivot.add(coreGem);

  // 6. Cannon Barrel Pivot + Stepped Muzzle Brake
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, 0.24, 0.45);
  turretPivot.add(barrelPivot);

  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.24), trimSteelMat);
  mantlet.castShadow = true;
  barrelPivot.add(mantlet);

  const barrelSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.48, 16),
    trimSteelMat
  );
  barrelSleeve.rotation.x = Math.PI / 2;
  barrelSleeve.position.z = 0.26;
  barrelSleeve.castShadow = true;
  barrelPivot.add(barrelSleeve);

  const mainTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 1.12, 16),
    barrelMat
  );
  mainTube.rotation.x = Math.PI / 2;
  mainTube.position.z = 0.88;
  mainTube.castShadow = true;
  barrelPivot.add(mainTube);

  const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), trimSteelMat);
  muzzleBrake.position.z = 1.46;
  muzzleBrake.castShadow = true;
  barrelPivot.add(muzzleBrake);

  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0, 1.62);
  barrelPivot.add(muzzleAnchor);

  return {
    root,
    bodyPivot,
    turretPivot,
    barrelPivot,
    muzzleAnchor,
    wheels,
    energyRing,
  };
}

export function disposeObject3D(obj: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        materials.add(m);
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) textures.add(std.map);
        if (std.roughnessMap) textures.add(std.roughnessMap);
        if (std.normalMap) textures.add(std.normalMap);
        if (std.emissiveMap) textures.add(std.emissiveMap);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
