import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createRadialShadowTexture,
  createStudioFloorTexture,
  createTank3D,
  disposeObject3D,
} from './intro/tankModel';

interface IntroAnimationProps {
  onExitStart?: () => void;
  onComplete: () => void;
}

// Pre-allocated math helpers (zero per-frame GC allocations)
const _dummy = new THREE.Object3D();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0.85, 0);
const _boltStartA = new THREE.Vector3();
const _boltStartB = new THREE.Vector3();
const _boltStartC = new THREE.Vector3();
const _convergencePt = new THREE.Vector3(0, 1.55, 0.85);

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function easeOutBack(t: number, overshoot = 1.70158): number {
  const c = Math.max(0, Math.min(1, t));
  const m = c - 1;
  return 1 + (overshoot + 1) * Math.pow(m, 3) + overshoot * Math.pow(m, 2);
}

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface ShardParticle {
  dirX: number;
  dirY: number;
  dirZ: number;
  speed: number;
  rotSpeed: number;
  baseScale: number;
}

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onExitStart, onComplete }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onExitStartRef = useRef(onExitStart);
  onExitStartRef.current = onExitStart;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finishedRef = useRef(false);
  const [logoStage, setLogoStage] = useState<'hidden' | 'pop' | 'settle'>('hidden');
  const [exiting, setExiting] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const triggerExit = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setExiting(true);
    onExitStartRef.current?.();
    window.setTimeout(() => {
      onCompleteRef.current();
    }, 650);
  }, []);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setLogoStage('pop');
      const timer = window.setTimeout(triggerExit, 900);
      return () => window.clearTimeout(timer);
    }

    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      setLogoStage('pop');
      const fallbackTimer = window.setTimeout(triggerExit, 1400);
      return () => window.clearTimeout(fallbackTimer);
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.FogExp2(0x0d1117, 0.036);

    const initW = Math.max(1, mountEl.clientWidth || window.innerWidth);
    const initH = Math.max(1, mountEl.clientHeight || window.innerHeight);
    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 100);
    camera.position.set(0, 4.2, 10.5);
    _currentLookAt.set(0, 0.85, 0);
    camera.lookAt(_currentLookAt);
    renderer.setSize(initW, initH, false);

    // Studio reflection environment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    envScene.dispose();
    pmrem.dispose();

    // 3-Point Warm/Cool Studio Lighting
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.72);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.35);
    keyLight.position.set(6, 9, 7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    keyLight.shadow.camera.left = -7.5;
    keyLight.shadow.camera.right = 7.5;
    keyLight.shadow.camera.top = 7.5;
    keyLight.shadow.camera.bottom = -7.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.35);
    rimLight.position.set(-6, 4.5, -6);
    scene.add(rimLight);

    // Procedural Ground & Studio Portal Platform
    const floorTex = createStudioFloorTexture(renderer.capabilities.getMaxAnisotropy());
    const floorMesh = new THREE.Mesh(
      new THREE.CircleGeometry(24, 64),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.72,
        metalness: 0.25,
      })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createRadialShadowTexture();

    // Central Geometric Portal Rings (BeGLAD kinetic geometric emblem motif)
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0.03, 0);
    scene.add(portalGroup);

    const outerPortalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.6,
    });
    const outerPortalRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.045, 16, 64),
      outerPortalMat
    );
    outerPortalRing.rotation.x = Math.PI / 2;
    portalGroup.add(outerPortalRing);

    const innerPortalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.7,
      roughness: 0.2,
      metalness: 0.7,
    });
    const innerPortalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.038, 12, 6),
      innerPortalMat
    );
    innerPortalRing.rotation.x = Math.PI / 2;
    portalGroup.add(innerPortalRing);

    // Assemble 3 Composite Procedural 3D Tanks
    const heroTank = createTank3D('spartan', shadowTex);
    const leftWingman = createTank3D('wingman-cyan', shadowTex);
    const rightWingman = createTank3D('wingman-violet', shadowTex);
    scene.add(heroTank.root, leftWingman.root, rightWingman.root);

    heroTank.root.position.set(0, 6.5, 0);
    heroTank.root.scale.setScalar(1.08);
    leftWingman.root.position.set(-9.5, 0, -1.6);
    leftWingman.root.scale.setScalar(0.84);
    rightWingman.root.position.set(9.5, 0, -1.6);
    rightWingman.root.scale.setScalar(0.84);

    // Three Synchronized Salvo Tracer Bolts
    const boltGeo = new THREE.CapsuleGeometry(0.08, 0.36, 6, 12);
    boltGeo.rotateX(Math.PI / 2);
    const boltHeroMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const boltCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const boltVioletMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const boltHero = new THREE.Mesh(boltGeo, boltHeroMat);
    const boltCyan = new THREE.Mesh(boltGeo, boltCyanMat);
    const boltViolet = new THREE.Mesh(boltGeo, boltVioletMat);
    boltHero.visible = false;
    boltCyan.visible = false;
    boltViolet.visible = false;
    scene.add(boltHero, boltCyan, boltViolet);

    // Kinetic Burst Shockwave Ring + Instanced Prism Shards (at convergence impact)
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shockWaveRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.58, 48), shockMat);
    shockWaveRing.position.copy(_convergencePt);
    scene.add(shockWaveRing);

    const shardCount = 34;
    const shardGeo = new THREE.OctahedronGeometry(0.11, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.22,
      metalness: 0.75,
    });
    const shardsMesh = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    shardsMesh.frustumCulled = false;
    shardsMesh.visible = false;
    const shardData: ShardParticle[] = [];
    const shardColor = new THREE.Color();
    const paletteColors = [0xf59e0b, 0x38bdf8, 0xa855f7, 0xfef08a];
    for (let i = 0; i < shardCount; i++) {
      const theta = (i / shardCount) * Math.PI * 2 + (i % 3) * 0.25;
      const phi = ((i % 5) - 2) * 0.28;
      shardData.push({
        dirX: Math.cos(theta) * Math.cos(phi),
        dirY: Math.sin(phi) + 0.22,
        dirZ: Math.sin(theta) * Math.cos(phi),
        speed: 3.4 + (i % 4) * 1.15,
        rotSpeed: 4 + (i % 5) * 1.8,
        baseScale: 0.65 + (i % 3) * 0.35,
      });
      shardColor.setHex(paletteColors[i % paletteColors.length]);
      shardsMesh.setColorAt(i, shardColor);
    }
    if (shardsMesh.instanceColor) shardsMesh.instanceColor.needsUpdate = true;
    scene.add(shardsMesh);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // ResizeObserver keeps aspect ratio crisp across desktop, portrait, and rotated landscape
    const handleResize = () => {
      const w = Math.max(1, mountEl.clientWidth || window.innerWidth);
      const h = Math.max(1, mountEl.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      // Widen FOV slightly on narrow portrait screens so all 3 tanks stay framed
      camera.fov = w < h ? 54 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(mountEl);
    window.addEventListener('resize', handleResize);

    let contextLost = false;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    let frameId = 0;
    let disposed = false;
    let logoTriggered = false;
    let settledTriggered = false;
    let salvoSampled = false;
    const startTime = performance.now();
    let prevTime = startTime;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      const t = (now - startTime) / 1000;

      // Portal turntable continuous kinetic spin
      outerPortalRing.rotation.z = t * 0.9;
      innerPortalRing.rotation.z = -t * 1.35;
      const portalAppear = easeOutBack(Math.min(1, t / 0.55), 1.4);
      portalGroup.scale.setScalar(Math.max(0.01, portalAppear));

      // --- Beat 1 (0.0s - 0.9s): Kinetic Hero Drop + Flanking Wingmen Roll-In ---
      if (t < 0.72) {
        const dropProgress = easeInOutCubic(Math.min(1, t / 0.52));
        heroTank.root.position.set(0, THREE.MathUtils.lerp(5.8, 0, dropProgress), 0);
        // Squash-and-stretch on impact (0.50s -> 0.85s)
        if (t > 0.48) {
          const impactP = (t - 0.48) / 0.24;
          const squash = Math.sin(impactP * Math.PI) * 0.22;
          heroTank.bodyPivot.scale.set(1 + squash * 0.65, 1 - squash, 1 + squash * 0.65);
        } else {
          heroTank.bodyPivot.scale.set(0.92, 1.12, 0.92);
        }
      } else {
        heroTank.root.position.y = 0;
        heroTank.bodyPivot.scale.x = THREE.MathUtils.damp(heroTank.bodyPivot.scale.x, 1, 12, dt);
        heroTank.bodyPivot.scale.y = THREE.MathUtils.damp(heroTank.bodyPivot.scale.y, 1, 12, dt);
        heroTank.bodyPivot.scale.z = THREE.MathUtils.damp(heroTank.bodyPivot.scale.z, 1, 12, dt);
      }

      // Impact portal pulse ring under Hero Tank
      const heroRingMat = heroTank.energyRing.material as THREE.MeshBasicMaterial;
      if (t >= 0.48 && t <= 1.15) {
        const rp = (t - 0.48) / 0.67;
        heroTank.energyRing.scale.setScalar(1 + rp * 2.1);
        heroRingMat.opacity = (1 - rp) * 0.85;
      } else {
        heroRingMat.opacity = 0;
      }

      // Wingmen roll-in -> hold formation -> peel-out (t > 1.85s)
      if (t < 1.85) {
        const rollIn = easeOutBack(Math.min(1, t / 0.85), 1.1);
        const lx = THREE.MathUtils.lerp(-9.0, -3.15, rollIn);
        const rx = THREE.MathUtils.lerp(9.0, 3.15, rollIn);
        const zArc = THREE.MathUtils.lerp(-2.4, -0.55, easeOutCubic(Math.min(1, t / 0.85)));
        leftWingman.root.position.set(lx, 0, zArc);
        rightWingman.root.position.set(rx, 0, zArc);
        leftWingman.root.rotation.y = THREE.MathUtils.lerp(Math.PI * 0.42, 0.28, rollIn);
        rightWingman.root.rotation.y = THREE.MathUtils.lerp(-Math.PI * 0.42, -0.28, rollIn);

        const wheelSpin = t < 0.85 ? dt * 14 : 0;
        for (const w of leftWingman.wheels) w.rotation.x += wheelSpin;
        for (const w of rightWingman.wheels) w.rotation.x += wheelSpin;
      } else {
        const peel = easeInOutCubic(Math.min(1, (t - 1.85) / 0.75));
        leftWingman.root.position.set(
          THREE.MathUtils.lerp(-3.15, -10.5, peel),
          0,
          THREE.MathUtils.lerp(-0.55, 3.6, peel)
        );
        rightWingman.root.position.set(
          THREE.MathUtils.lerp(3.15, 10.5, peel),
          0,
          THREE.MathUtils.lerp(-0.55, 3.6, peel)
        );
        leftWingman.root.rotation.y = THREE.MathUtils.lerp(0.28, -0.8, peel);
        rightWingman.root.rotation.y = THREE.MathUtils.lerp(-0.28, 0.8, peel);
        for (const w of leftWingman.wheels) w.rotation.x += dt * 16;
        for (const w of rightWingman.wheels) w.rotation.x += dt * 16;
      }

      // --- Beat 2 (0.82s - 1.85s): Synchronized Aim, Recoil & Salvo Convergence ---
      if (t < 1.7) {
        const aimP = easeOutCubic(Math.min(1, Math.max(0, (t - 0.65) / 0.45)));
        heroTank.turretPivot.rotation.y = THREE.MathUtils.lerp(-0.85, 0, aimP);
        heroTank.barrelPivot.rotation.x = THREE.MathUtils.lerp(0, -0.24, aimP);
        leftWingman.turretPivot.rotation.y = THREE.MathUtils.lerp(0, 0.62, aimP);
        leftWingman.barrelPivot.rotation.x = THREE.MathUtils.lerp(0, -0.26, aimP);
        rightWingman.turretPivot.rotation.y = THREE.MathUtils.lerp(0, -0.62, aimP);
        rightWingman.barrelPivot.rotation.x = THREE.MathUtils.lerp(0, -0.26, aimP);
      } else {
        // Hero showcase sweep
        const showcaseT = t - 1.7;
        heroTank.root.rotation.y = Math.sin(showcaseT * 1.1) * 0.38 + showcaseT * 0.25;
        heroTank.turretPivot.rotation.y = Math.sin(showcaseT * 1.8) * 0.34;
        heroTank.barrelPivot.rotation.x = THREE.MathUtils.damp(
          heroTank.barrelPivot.rotation.x,
          -0.06,
          6,
          dt
        );
      }

      // Salvo fire at t = 1.15s -> impact at t = 1.48s
      if (t >= 1.15 && t <= 1.48) {
        if (!salvoSampled) {
          salvoSampled = true;
          heroTank.root.updateMatrixWorld(true);
          leftWingman.root.updateMatrixWorld(true);
          rightWingman.root.updateMatrixWorld(true);
          heroTank.muzzleAnchor.getWorldPosition(_boltStartA);
          leftWingman.muzzleAnchor.getWorldPosition(_boltStartB);
          rightWingman.muzzleAnchor.getWorldPosition(_boltStartC);
        }
        const bp = (t - 1.15) / 0.33;
        const recoil = Math.sin(Math.min(1, bp * 2.2) * Math.PI) * 0.26;
        heroTank.barrelPivot.position.z = 0.45 - recoil;
        leftWingman.barrelPivot.position.z = 0.45 - recoil;
        rightWingman.barrelPivot.position.z = 0.45 - recoil;

        boltHero.visible = true;
        boltCyan.visible = true;
        boltViolet.visible = true;

        boltHero.position.lerpVectors(_boltStartA, _convergencePt, bp);
        boltCyan.position.lerpVectors(_boltStartB, _convergencePt, bp);
        boltViolet.position.lerpVectors(_boltStartC, _convergencePt, bp);
        boltHero.lookAt(_convergencePt);
        boltCyan.lookAt(_convergencePt);
        boltViolet.lookAt(_convergencePt);
      } else {
        heroTank.barrelPivot.position.z = THREE.MathUtils.damp(
          heroTank.barrelPivot.position.z,
          0.45,
          14,
          dt
        );
        leftWingman.barrelPivot.position.z = 0.45;
        rightWingman.barrelPivot.position.z = 0.45;
        boltHero.visible = false;
        boltCyan.visible = false;
        boltViolet.visible = false;
      }

      // Impact kinetic burst + BeGLAD-style Logo Pop at t = 1.48s
      if (t >= 1.48) {
        if (!logoTriggered) {
          logoTriggered = true;
          setLogoStage('pop');
        }
        if (t >= 2.0 && !settledTriggered) {
          settledTriggered = true;
          setLogoStage('settle');
        }

        const burstT = t - 1.48;
        if (burstT < 0.85) {
          const bp = burstT / 0.85;
          shockWaveRing.visible = true;
          shockWaveRing.scale.setScalar(1 + easeOutCubic(bp) * 6.5);
          shockMat.opacity = (1 - bp) * 0.92;
          shockWaveRing.lookAt(camera.position);

          shardsMesh.visible = true;
          const shrink = Math.max(0.001, 1 - easeInOutCubic(bp));
          for (let i = 0; i < shardCount; i++) {
            const s = shardData[i];
            const dist = easeOutCubic(bp) * s.speed;
            _dummy.position.set(
              _convergencePt.x + s.dirX * dist,
              _convergencePt.y + s.dirY * dist - bp * bp * 1.1,
              _convergencePt.z + s.dirZ * dist
            );
            _dummy.rotation.set(burstT * s.rotSpeed, burstT * s.rotSpeed * 0.7, 0);
            _dummy.scale.setScalar(s.baseScale * shrink);
            _dummy.updateMatrix();
            shardsMesh.setMatrixAt(i, _dummy.matrix);
          }
          shardsMesh.instanceMatrix.needsUpdate = true;
        } else {
          shockWaveRing.visible = false;
          shardsMesh.visible = false;
        }
      }

      // --- Smooth Camera Choreography ---
      if (t < 1.55) {
        const introZoom = easeOutCubic(Math.min(1, t / 1.1));
        _targetCamPos.set(
          Math.sin(t * 0.4) * 0.4,
          THREE.MathUtils.lerp(4.6, 2.55, introZoom),
          THREE.MathUtils.lerp(10.8, 7.6, introZoom)
        );
        _targetLookAt.set(0, 0.95, 0.25);
      } else {
        const orbitT = t - 1.55;
        _targetCamPos.set(
          Math.sin(orbitT * 0.65) * 3.1,
          2.05 + Math.sin(orbitT * 0.8) * 0.2,
          5.75 - Math.min(0.6, orbitT * 0.3)
        );
        // Shift camera target slightly downward so hero tank frames cleanly beneath the logo lockup
        _targetLookAt.set(0, 1.35, 0);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 5.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 5.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 5.5, dt);
      _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _targetLookAt.x, 6.5, dt);
      _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _targetLookAt.y, 6.5, dt);
      _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _targetLookAt.z, 6.5, dt);
      camera.lookAt(_currentLookAt);

      if (!contextLost) {
        renderer.render(scene, camera);
      }

      if (t >= 3.05) {
        triggerExit();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      disposeObject3D(scene);
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, [triggerExit]);

  return (
    <div
      className={`absolute inset-0 z-40 overflow-hidden bg-[#0d1117] transition-[opacity,transform] duration-[650ms] ease-out ${
        exiting ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Isolated WebGL Mount (never shares DOM children with React HUD) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* BeGLAD-Inspired Kinetic Logo Reveal Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-start pt-5 @[640px]:pt-8 px-4 @[640px]:px-6"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Elastic Title Reveal Lockup (positioned high so center 3D tank stays unobstructed) */}
        <div className="w-full max-w-2xl flex flex-col items-center text-center">
          <div
            className="overflow-hidden"
            style={{
              transform:
                logoStage === 'hidden'
                  ? 'translateY(28px) scale(0.72)'
                  : logoStage === 'pop'
                  ? 'translateY(0px) scale(1.06)'
                  : 'translateY(0px) scale(1)',
              opacity: logoStage === 'hidden' ? 0 : 1,
              transition:
                'transform 480ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 260ms ease-out',
            }}
          >
            <h1 className="font-display text-3xl @[640px]:text-5xl group-data-[compact=false]/root:@[768px]:text-7xl font-bold tracking-tight text-white uppercase leading-none drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]">
              Tank Spartan
            </h1>
          </div>

          <div
            className="mt-1.5 flex items-center justify-center gap-2.5"
            style={{
              transform:
                logoStage === 'hidden'
                  ? 'translateY(14px) scaleX(0.6)'
                  : 'translateY(0px) scaleX(1)',
              opacity: logoStage === 'hidden' ? 0 : 1,
              transition:
                'transform 520ms cubic-bezier(0.16, 1, 0.3, 1) 90ms, opacity 320ms ease-out 90ms',
            }}
          >
            <span className="h-[2px] w-6 @[640px]:w-10 bg-sky-400 rounded-full" />
            <span className="text-xs @[640px]:text-sm group-data-[compact=false]/root:@[768px]:text-base font-semibold tracking-[0.28em] text-amber-400 uppercase whitespace-nowrap">
              Portal Siege
            </span>
            <span className="h-[2px] w-6 @[640px]:w-10 bg-purple-400 rounded-full" />
          </div>

          {webglUnavailable && (
            <p className="mt-3 text-xs text-slate-400">Loading tactical battlefield...</p>
          )}
        </div>
      </div>
    </div>
  );
};
