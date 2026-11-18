import {
  INTER_WAVE_SECONDS,
  MAX_GAME_LEVEL,
  MONSTER_STATS,
  TILE_SIZE,
  TUTORIAL_MAP_TEMPLATE,
  WEAPONS,
  getChassisUpgradeCost,
  getLevelConfig,
  getLevelGoldEconomy,
  getMaxUpgradeCap,
  getPowerTankForm,
  getPowerTankTier,
  getWeaponUpgradeCost,
  parseMap,
} from './data';
import { sound } from './sound';
import {
  Direction,
  DropItem,
  FloatingText,
  GamePhase,
  HudSnapshot,
  LevelConfig,
  Monster,
  MonsterArchetype,
  Particle,
  PlayerTank,
  Portal,
  Projectile,
  TileType,
  TutorialStepId,
  WeaponId,
} from './types';

const STORAGE_KEY_MAX_LEVEL = 'tank1990_portal_siege_max_level';

export class TankGameEngine {
  private mainCanvas: HTMLCanvasElement | null = null;
  private radarCanvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private lastTime = 0;

  private phase: GamePhase = 'TITLE';
  private currentLevel = 1;
  private unlockedMaxLevel = 1;
  private levelConfig: LevelConfig = getLevelConfig(1);
  private grid: TileType[][] = [];
  private gridCols = 34;
  private gridRows = 22;
  private arenaWidth = 34 * TILE_SIZE;
  private arenaHeight = 22 * TILE_SIZE;
  private brickHp: number[][] = [];
  private flowDist: number[][] = [];
  private bossFlowDist: number[][] = [];
  private megaBossFlowDist: number[][] = [];
  private flowTimer = 0;

  private wave = 1;
  private spawnQueue: MonsterArchetype[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1.5;
  private interWaveTimer = INTER_WAVE_SECONDS;

  private portals: Portal[] = [];
  private monsters: Monster[] = [];
  private projectiles: Projectile[] = [];
  private drops: DropItem[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];

  private nextEntityId = 1;
  private tank: PlayerTank;

  // Input state
  private heldKeys = new Set<string>();
  private mouseScreenX = 640;
  private mouseScreenY = 360;
  private mouseWorldX = 680;
  private mouseWorldY = 440;
  private mouseActive = false;
  private mouseDown = false;
  private onHomePage = true;
  private lastMouseUseTime = 0;
  private lastMouseMoveTime = -10;

  // Virtual Dual-Stick & Hardware Gamepad state
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualAimX = 0;
  private virtualAimY = 0;
  private virtualAimActive = false;
  private virtualAimFiring = false;
  private virtualFireButton = false;
  private lastVirtualAimTime = -10;
  private touchControlsUsed = false;

  private gamepadConnected = false;
  private gpMoveX = 0;
  private gpMoveY = 0;
  private gpAimX = 0;
  private gpAimY = 0;
  private gpAimActive = false;
  private gpFire = false;
  private lastGpAimTime = -10;
  private gpPrevPauseBtn = false;
  private gpPrevCycleNextBtn = false;
  private gpPrevCyclePrevBtn = false;

  // Camera & Juice
  private cameraX = 0;
  private cameraY = 0;
  private renderScale = 1;
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;
  private hitstopTimer = 0;
  private globalTime = 0;
  private bannerText = '';
  private bannerSub = '';
  private bannerTimer = 0;

  // Stats
  private totalKills = 0;
  private levelKills = 0;

  // Tutorial state
  private isTutorial = false;
  private tutorialStep: TutorialStepId = 'MOVE';
  private tutorialWaypoint = { x: 480, y: 400, radius: 36 };
  private tutorialBoughtUpgrade = false;

  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private hudSyncTimer = 0;

  constructor(onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.onHudUpdate = onHudUpdate;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MAX_LEVEL);
      if (saved) {
        this.unlockedMaxLevel = Math.max(1, Math.min(MAX_GAME_LEVEL, parseInt(saved, 10) || 1));
      }
    } catch {
      this.unlockedMaxLevel = 1;
    }

    this.tank = this.createFreshTank(1);
    this.loadMapOnly(1);
    this.bindWindowEvents();
  }

  private createFreshTank(level: number): PlayerTank {
    const powerTier = getPowerTankTier(level);
    const form = getPowerTankForm(powerTier);
    const autoLevelHp = (level - 1) * 14;
    const baseMaxHp = 120 + autoLevelHp + form.bonusHp;

    return {
      x: this.arenaWidth / 2,
      y: this.arenaHeight - TILE_SIZE * 1.5,
      radius: 15,
      dir: 'UP',
      turretAngle: -Math.PI / 2,
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      gold: level > 1 ? (level - 1) * 32 : 0,
      exp: 0,
      expToNext: 80,
      rpgLevel: Math.max(1, Math.floor(1 + (level - 1) * 0.4)),
      powerTier,
      activeWeapon: 'cannon',
      unlockedWeapons: ['cannon'],
      weaponLevels: {
        cannon: { damageLv: 0, rateLv: 0 },
        twin: { damageLv: 0, rateLv: 0 },
        shotgun: { damageLv: 0, rateLv: 0 },
        railgun: { damageLv: 0, rateLv: 0 },
        plasma: { damageLv: 0, rateLv: 0 },
      },
      chassis: {
        armorLv: 0,
        engineLv: 0,
        firepowerLv: 0,
        magnetLv: 0,
      },
      fireCooldown: 0,
      invulnTimer: 0,
      hitFlash: 0,
      trackOffset: 0,
      recoil: 0,
    };
  }

  public attachCanvases(main: HTMLCanvasElement | null, radar: HTMLCanvasElement | null) {
    this.mainCanvas = main;
    this.radarCanvas = radar;
  }

  public startLoop() {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unbindWindowEvents();
  }

  // --- Window & Input Binding ---
  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      if (this.phase === 'PLAYING' || this.phase === 'INTER_WAVE_STORE') {
        e.preventDefault();
      }
    }

    this.heldKeys.add(code);

    if (code === 'Escape') {
      if (this.phase === 'PLAYING') {
        this.phase = 'PAUSED';
        this.heldKeys.clear();
        this.pushHud(true);
      } else if (this.phase === 'PAUSED') {
        this.phase = 'PLAYING';
        this.pushHud(true);
      }
      return;
    }

    if (this.phase === 'PLAYING') {
      if (code === 'Digit1') this.selectWeapon('cannon');
      if (code === 'Digit2') this.selectWeapon('twin');
      if (code === 'Digit3') this.selectWeapon('shotgun');
      if (code === 'Digit4') this.selectWeapon('railgun');
      if (code === 'Digit5') this.selectWeapon('plasma');
    }

    if (this.phase === 'INTER_WAVE_STORE' && code === 'Enter') {
      if (!this.isTutorial || this.tutorialStep === 'STORE') {
        this.launchNextWaveEarly();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.resetVirtualInputs();
  };

  private handleGamepadChange = () => {
    this.syncGamepadConnected();
    this.pushHud(true);
  };

  private syncGamepadConnected() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      this.gamepadConnected = false;
      return;
    }
    const pads = navigator.getGamepads();
    this.gamepadConnected = Array.from(pads).some((p) => Boolean(p && p.connected));
  }

  public setVirtualMove(x: number, y: number) {
    this.virtualMoveX = Math.max(-1, Math.min(1, x));
    this.virtualMoveY = Math.max(-1, Math.min(1, y));
    if (Math.hypot(x, y) > 0.05) {
      this.touchControlsUsed = true;
    }
  }

  public setVirtualAim(x: number, y: number, firing: boolean) {
    const mag = Math.hypot(x, y);
    if (mag > 0.14) {
      this.virtualAimX = x / mag;
      this.virtualAimY = y / mag;
      this.virtualAimActive = true;
      this.virtualAimFiring = firing;
      this.lastVirtualAimTime = this.globalTime;
      this.touchControlsUsed = true;
    } else {
      this.virtualAimActive = false;
      this.virtualAimFiring = false;
    }
  }

  public setVirtualFireButton(firing: boolean) {
    this.virtualFireButton = firing;
    if (firing) this.touchControlsUsed = true;
  }

  public resetVirtualInputs() {
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualAimActive = false;
    this.virtualAimFiring = false;
    this.virtualFireButton = false;
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.mainCanvas) return;
    const rect = this.mainCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    this.mouseScreenX = cx;
    this.mouseScreenY = cy;
    this.mouseWorldX = cx / this.renderScale + this.cameraX;
    this.mouseWorldY = cy / this.renderScale + this.cameraY;
    this.mouseActive = true;
    this.lastMouseMoveTime = this.globalTime;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || this.phase !== 'PLAYING') return;
    if (!this.mainCanvas || e.target !== this.mainCanvas) return;
    this.handleMouseMove(e);
    this.mouseDown = true;
    this.lastMouseUseTime = this.globalTime;
  };

  private handleMouseUp = () => {
    this.mouseDown = false;
  };

  private bindWindowEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('gamepadconnected', this.handleGamepadChange);
    window.addEventListener('gamepaddisconnected', this.handleGamepadChange);
  }

  private unbindWindowEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('gamepadconnected', this.handleGamepadChange);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadChange);
  }

  // --- Game Flow Control ---
  private loadMapOnly(level: number, tutorialMode = false) {
    this.isTutorial = tutorialMode;
    this.levelConfig = getLevelConfig(level);
    this.grid = tutorialMode
      ? parseMap(TUTORIAL_MAP_TEMPLATE)
      : this.levelConfig.grid.map((r) => [...r]);

    this.gridRows = this.grid.length;
    this.gridCols = this.grid[0]?.length ?? 34;
    this.arenaWidth = this.gridCols * TILE_SIZE;
    this.arenaHeight = this.gridRows * TILE_SIZE;

    this.brickHp = this.grid.map((row) => row.map((t) => (t === 1 ? 2 : 0)));
    this.portals = [];
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c] === 5) {
          this.portals.push({
            id: this.nextEntityId++,
            col: c,
            row: r,
            x: (c + 0.5) * TILE_SIZE,
            y: (r + 0.5) * TILE_SIZE,
            pulse: Math.random() * Math.PI * 2,
            spawningFlash: 0,
          });
        }
      }
    }

    this.monsters = [];
    this.projectiles = [];
    this.drops = [];
    this.particles = [];
    this.floatingTexts = [];
    this.flowDist = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(999));
    this.bossFlowDist = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(999));
    this.megaBossFlowDist = Array.from({ length: this.gridRows }, () => Array(this.gridCols).fill(999));
    this.flowTimer = 0;
  }

  public startNewCampaign(startLevel = 1) {
    this.currentLevel = Math.max(1, Math.min(MAX_GAME_LEVEL, startLevel));
    this.loadMapOnly(this.currentLevel, false);
    this.tank = this.createFreshTank(this.currentLevel);
    this.totalKills = 0;
    this.startLevel(this.currentLevel, true);
  }

  public startTutorial() {
    this.currentLevel = 1;
    this.loadMapOnly(1, true);
    this.tank = this.createFreshTank(1);
    this.tank.gold = 130;
    this.totalKills = 0;
    this.tutorialStep = 'MOVE';
    this.tutorialBoughtUpgrade = false;
    this.tutorialWaypoint = { x: this.arenaWidth / 2, y: 390, radius: 36 };
    this.placeTankAtSpawn();
    this.snapCameraToTank();
    this.wave = 1;
    this.spawnQueue = [];
    this.phase = 'PLAYING';
    this.showBanner('How to Play', '5 quick steps to master Tank Spartan', 2.4);
    this.pushHud(true);
  }

  public skipTutorial() {
    if (!this.isTutorial) return;
    this.isTutorial = false;
    this.tutorialStep = 'DONE';
    this.startNewCampaign(1);
  }

  public setHomePageActive(active: boolean) {
    this.onHomePage = active;
  }

  public startLevel(level: number, keepUpgrades = true) {
    const prevLevel = this.currentLevel;
    this.currentLevel = Math.max(1, Math.min(MAX_GAME_LEVEL, level));
    this.loadMapOnly(this.currentLevel, false);

    if (!keepUpgrades) {
      this.tank = this.createFreshTank(this.currentLevel);
    } else {
      // Auto-upgrade Tank every level (+HP, +Speed, +Power) + Power Tank evolution on multiples of 5!
      if (this.currentLevel > prevLevel) {
        const autoHpGain = 14 * (this.currentLevel - prevLevel);
        this.tank.maxHp += autoHpGain;
        this.tank.hp = Math.min(this.tank.maxHp, this.tank.hp + autoHpGain);
      }
      const newPowerTier = getPowerTankTier(this.currentLevel);
      if (newPowerTier > this.tank.powerTier) {
        const prevForm = getPowerTankForm(this.tank.powerTier);
        const nextForm = getPowerTankForm(newPowerTier);
        const hpGain = nextForm.bonusHp - prevForm.bonusHp;
        this.tank.powerTier = newPowerTier;
        this.tank.maxHp += hpGain;
        this.tank.hp = Math.min(this.tank.maxHp, this.tank.hp + hpGain + Math.round(this.tank.maxHp * 0.35));
        sound.playLevelUp();
      } else {
        this.tank.hp = Math.min(this.tank.maxHp, Math.round(this.tank.hp + this.tank.maxHp * 0.45));
      }
    }

    this.levelKills = 0;
    this.placeTankAtSpawn();
    this.snapCameraToTank();
    this.beginWave(1);
    this.phase = 'PLAYING';
    this.pushHud(true);
  }

  private placeTankAtSpawn() {
    this.tank.x = this.arenaWidth / 2;
    this.tank.y = this.arenaHeight - TILE_SIZE * 1.6;
    this.tank.dir = 'UP';
    this.tank.turretAngle = -Math.PI / 2;
    this.tank.invulnTimer = 1.5;
    this.tank.fireCooldown = 0;

    const c = Math.floor(this.tank.x / TILE_SIZE);
    const r = Math.floor(this.tank.y / TILE_SIZE);
    for (let dr = -1; dr <= 0; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < this.gridRows && cc >= 0 && cc < this.gridCols) {
          if (this.grid[rr][cc] === 1 || this.grid[rr][cc] === 3) {
            this.grid[rr][cc] = 0;
          }
        }
      }
    }
  }

  private snapCameraToTank() {
    const cssW = this.mainCanvas?.clientWidth || window.innerWidth;
    const cssH = this.mainCanvas?.clientHeight || window.innerHeight;
    const scale = this.computeRenderScale(cssW, cssH);
    const viewW = cssW / scale;
    const viewH = cssH / scale;
    this.cameraX = Math.max(0, Math.min(Math.max(0, this.arenaWidth - viewW), this.tank.x - viewW / 2));
    this.cameraY = Math.max(0, Math.min(Math.max(0, this.arenaHeight - viewH), this.tank.y - viewH / 2));
  }

  private beginWave(waveNum: number) {
    this.wave = waveNum;
    const waveDef = this.levelConfig.waves[waveNum - 1];
    this.spawnInterval = waveDef.spawnInterval;
    this.spawnTimer = 0.45;

    const queue: MonsterArchetype[] = [];
    for (const group of waveDef.spawns) {
      for (let i = 0; i < group.count; i++) {
        queue.push(group.archetype);
      }
    }

    const bosses: MonsterArchetype[] = queue.filter((a) => a === 'boss' || a === 'mega_boss');
    const others: MonsterArchetype[] = queue.filter((a) => a !== 'boss' && a !== 'mega_boss');
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    if (bosses.length > 0) {
      if (this.levelConfig.isMegaBossLevel && waveNum === 5) {
        // Put the Mega Boss right in front alongside the 2 normal Bosses
        bosses.sort((a, b) => (a === 'mega_boss' ? -1 : b === 'mega_boss' ? 1 : 0));
        others.unshift(...bosses);
      } else {
        const insertAt = Math.min(2, others.length);
        others.splice(insertAt, 0, ...bosses);
      }
    }
    this.spawnQueue = others;

    if (waveDef.isBossWave) {
      const label = this.levelConfig.isMegaBossLevel
        ? `Wave 5 · Super Boss + 2 Bosses`
        : `Wave ${waveNum} · Boss`;
      this.showBanner(label, `${waveDef.bossName ?? 'Boss'} is coming!`, 3.2);
      sound.playWaveBanner(true);
    } else if (waveNum === 1 && this.levelConfig.isPowerUpgradeLevel) {
      const form = getPowerTankForm(this.tank.powerTier);
      const hasNewGun =
        this.currentLevel === 5 ||
        this.currentLevel === 10 ||
        this.currentLevel === 15 ||
        this.currentLevel === 20;
      const sub = hasNewGun
        ? `Level ${this.currentLevel} · New Gun in Shop + Stronger Tank`
        : `Level ${this.currentLevel} · Faster, Stronger & More HP`;
      this.showBanner(`Power Tank: ${form.name}`, sub, 2.8);
      sound.playLevelUp();
    } else {
      const sub =
        waveNum === 1 && this.currentLevel > 1
          ? 'Tank Auto-Upgraded (+HP, +Speed, +Power)'
          : 'Monsters Coming';
      this.showBanner(
        `Level ${this.currentLevel} · Wave ${waveNum}/${this.levelConfig.totalWaves}`,
        sub,
        2.2
      );
      sound.playWaveBanner(false);
    }

    this.computeFlowField();
    this.pushHud(true);
  }

  public launchNextWaveEarly() {
    if (this.phase !== 'INTER_WAVE_STORE') return;
    if (this.isTutorial) {
      this.isTutorial = false;
      this.tutorialStep = 'DONE';
      this.startNewCampaign(1);
      return;
    }
    const nextWave = this.wave + 1;
    this.phase = 'PLAYING';
    this.beginWave(nextWave);
    this.pushHud(true);
  }

  public openStoreFromLevelComplete() {
    if (this.phase === 'LEVEL_COMPLETE') {
      this.phase = 'INTER_WAVE_STORE';
      this.interWaveTimer = 999;
      this.pushHud(true);
    }
  }

  public proceedToNextLevelFromStoreOrComplete() {
    const nextLv = Math.min(MAX_GAME_LEVEL, this.currentLevel + 1);
    this.startLevel(nextLv, true);
  }

  public resumeGame() {
    if (this.phase === 'PAUSED') {
      this.phase = 'PLAYING';
      this.pushHud(true);
    }
  }

  public pauseGame() {
    if (this.phase === 'PLAYING') {
      this.phase = 'PAUSED';
      this.heldKeys.clear();
      this.pushHud(true);
    }
  }

  public returnToTitle() {
    this.phase = 'TITLE';
    this.isTutorial = false;
    this.heldKeys.clear();
    this.loadMapOnly(1, false);
    this.pushHud(true);
  }

  public selectWeapon(id: WeaponId) {
    if (this.tank.unlockedWeapons.includes(id) && this.tank.activeWeapon !== id) {
      this.tank.activeWeapon = id;
      sound.playWeaponSwitch();
      this.pushHud(true);
    }
  }

  // --- RPG Store Actions ---
  private getEffectiveStoreLevel(): number {
    return this.phase === 'INTER_WAVE_STORE' && this.wave >= this.levelConfig.totalWaves
      ? Math.min(MAX_GAME_LEVEL, this.currentLevel + 1)
      : this.currentLevel;
  }

  public buyWeaponUnlock(id: WeaponId): boolean {
    const def = WEAPONS[id];
    if (this.tank.unlockedWeapons.includes(id)) return false;
    if (this.getEffectiveStoreLevel() < def.unlockLevel) return false;
    if (this.tank.gold < def.baseCost) return false;

    this.tank.gold -= def.baseCost;
    this.tank.unlockedWeapons.push(id);
    this.tank.activeWeapon = id;
    if (this.isTutorial) this.tutorialBoughtUpgrade = true;
    sound.playStoreBuy();
    this.pushHud(true);
    return true;
  }

  public upgradeWeaponStat(id: WeaponId, stat: 'damageLv' | 'rateLv'): boolean {
    if (!this.tank.unlockedWeapons.includes(id)) return false;
    const cap = getMaxUpgradeCap(this.getEffectiveStoreLevel());
    const cur = this.tank.weaponLevels[id][stat];
    if (cur >= cap) return false;

    const baseCost = stat === 'damageLv' ? 65 : 60;
    const cost = getWeaponUpgradeCost(baseCost, cur);
    if (this.tank.gold < cost) return false;

    this.tank.gold -= cost;
    this.tank.weaponLevels[id][stat] = cur + 1;
    if (this.isTutorial) this.tutorialBoughtUpgrade = true;
    sound.playStoreBuy();
    this.pushHud(true);
    return true;
  }

  public upgradeChassis(kind: 'armor' | 'engine' | 'firepower' | 'magnet'): boolean {
    const cap = getMaxUpgradeCap(this.getEffectiveStoreLevel());
    const keyMap = {
      armor: 'armorLv',
      engine: 'engineLv',
      firepower: 'firepowerLv',
      magnet: 'magnetLv',
    } as const;
    const key = keyMap[kind];
    const cur = this.tank.chassis[key];
    if (cur >= cap) return false;

    const cost = getChassisUpgradeCost(kind, cur);
    if (this.tank.gold < cost) return false;

    this.tank.gold -= cost;
    this.tank.chassis[key] = cur + 1;
    if (kind === 'armor') {
      const hpBonus = 25 + (this.currentLevel - 1) * 5;
      this.tank.maxHp += hpBonus;
      this.tank.hp = Math.min(this.tank.maxHp, this.tank.hp + hpBonus);
    }
    if (this.isTutorial) this.tutorialBoughtUpgrade = true;
    sound.playStoreBuy();
    this.pushHud(true);
    return true;
  }

  public buyRepairKit(): boolean {
    if (this.tank.hp >= this.tank.maxHp) return false;
    const cost = 40 + (this.currentLevel - 1) * 10;
    if (this.tank.gold < cost) return false;
    this.tank.gold -= cost;
    this.tank.hp = Math.min(this.tank.maxHp, this.tank.hp + Math.round(this.tank.maxHp * 0.45));
    if (this.isTutorial) this.tutorialBoughtUpgrade = true;
    sound.playStoreBuy();
    this.pushHud(true);
    return true;
  }

  private showBanner(text: string, sub: string, duration: number) {
    this.bannerText = text;
    this.bannerSub = sub;
    this.bannerTimer = duration;
  }

  private pollGamepad() {
    this.gpMoveX = 0;
    this.gpMoveY = 0;
    this.gpAimActive = false;
    this.gpFire = false;

    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const gp = Array.from(pads).find((p) => p && p.connected);
    if (!gp) {
      if (this.gamepadConnected) {
        this.gamepadConnected = false;
        this.pushHud(true);
      }
      this.gpPrevPauseBtn = false;
      this.gpPrevCycleNextBtn = false;
      this.gpPrevCyclePrevBtn = false;
      return;
    }

    if (!this.gamepadConnected) {
      this.gamepadConnected = true;
      this.pushHud(true);
    }

    // Start / Menu button (9) toggles Pause / Resume
    const pausePressed = Boolean(gp.buttons[9]?.pressed);
    if (pausePressed && !this.gpPrevPauseBtn) {
      if (this.phase === 'PLAYING') {
        this.pauseGame();
      } else if (this.phase === 'PAUSED') {
        this.resumeGame();
      }
    }
    this.gpPrevPauseBtn = pausePressed;

    if (this.phase !== 'PLAYING') return;

    // Left Stick + D-Pad movement
    let mx = gp.axes[0] ?? 0;
    let my = gp.axes[1] ?? 0;
    if (Math.hypot(mx, my) < 0.18) {
      mx = 0;
      my = 0;
    }
    if (gp.buttons[14]?.pressed) mx -= 1; // D-Pad Left
    if (gp.buttons[15]?.pressed) mx += 1; // D-Pad Right
    if (gp.buttons[12]?.pressed) my -= 1; // D-Pad Up
    if (gp.buttons[13]?.pressed) my += 1; // D-Pad Down
    const moveMag = Math.hypot(mx, my);
    if (moveMag > 1) {
      mx /= moveMag;
      my /= moveMag;
    }
    this.gpMoveX = mx;
    this.gpMoveY = my;

    // Right Stick 360 aim + auto-fire
    const rx = gp.axes[2] ?? 0;
    const ry = gp.axes[3] ?? 0;
    const aimMag = Math.hypot(rx, ry);
    if (aimMag > 0.22) {
      this.gpAimX = rx / aimMag;
      this.gpAimY = ry / aimMag;
      this.gpAimActive = true;
      this.lastGpAimTime = this.globalTime;
      if (aimMag > 0.38) {
        this.gpFire = true;
      }
    }

    // RT (7), RB (5), A (0), X (2) fire
    if (
      gp.buttons[7]?.pressed ||
      (gp.buttons[7]?.value ?? 0) > 0.3 ||
      gp.buttons[5]?.pressed ||
      gp.buttons[0]?.pressed ||
      gp.buttons[2]?.pressed
    ) {
      this.gpFire = true;
    }

    // LB (4) / Y (3) cycle unlocked weapons
    const cycleNext = Boolean(gp.buttons[3]?.pressed);
    const cyclePrev = Boolean(gp.buttons[4]?.pressed);
    if (cycleNext && !this.gpPrevCycleNextBtn && this.tank.unlockedWeapons.length > 1) {
      const idx = this.tank.unlockedWeapons.indexOf(this.tank.activeWeapon);
      const next = this.tank.unlockedWeapons[(idx + 1) % this.tank.unlockedWeapons.length];
      this.selectWeapon(next);
    }
    if (cyclePrev && !this.gpPrevCyclePrevBtn && this.tank.unlockedWeapons.length > 1) {
      const idx = this.tank.unlockedWeapons.indexOf(this.tank.activeWeapon);
      const prev =
        this.tank.unlockedWeapons[
          (idx - 1 + this.tank.unlockedWeapons.length) % this.tank.unlockedWeapons.length
        ];
      this.selectWeapon(prev);
    }
    this.gpPrevCycleNextBtn = cycleNext;
    this.gpPrevCyclePrevBtn = cyclePrev;
  }

  // --- Simulation Update ---
  private update(dt: number) {
    this.globalTime += dt;
    this.pollGamepad();

    for (const p of this.portals) {
      p.pulse += dt * 3.2;
      if (p.spawningFlash > 0) p.spawningFlash = Math.max(0, p.spawningFlash - dt * 2.5);
    }

    if (this.phase === 'TITLE') {
      const cssW = this.mainCanvas?.clientWidth || window.innerWidth;
      const cssH = this.mainCanvas?.clientHeight || window.innerHeight;
      const isPhoneOrTouch =
        typeof window !== 'undefined' &&
        (window.matchMedia('(pointer: coarse)').matches || Math.min(cssW, cssH) < 520);

      if (this.onHomePage && !isPhoneOrTouch) {
        // Gentle arena camera auto-scroll only on desktop Home Page
        const scale = this.computeRenderScale(cssW, cssH);
        const maxX = Math.max(0, this.arenaWidth - cssW / scale);
        const maxY = Math.max(0, this.arenaHeight - cssH / scale);
        const targetX = maxX * (0.5 + 0.42 * Math.sin(this.globalTime * 0.22));
        const targetY = maxY * (0.38 + 0.28 * Math.cos(this.globalTime * 0.17));
        const smooth = 1 - Math.exp(-4.5 * dt);
        this.cameraX += (targetX - this.cameraX) * smooth;
        this.cameraY += (targetY - this.cameraY) * smooth;
      } else if (isPhoneOrTouch) {
        // Static centered fit on phone — no background scroll effect needed
        const scale = this.computeRenderScale(cssW, cssH);
        const maxX = Math.max(0, this.arenaWidth - cssW / scale);
        const maxY = Math.max(0, this.arenaHeight - cssH / scale);
        this.cameraX = maxX * 0.5;
        this.cameraY = maxY * 0.5;
      }
      this.updateParticles(dt);
      return;
    }

    if (this.phase === 'PAUSED' || this.phase === 'LEVEL_COMPLETE' || this.phase === 'GAME_OVER') {
      return;
    }

    if (this.phase === 'INTER_WAVE_STORE') {
      if (!this.isTutorial && this.wave < this.levelConfig.totalWaves) {
        this.interWaveTimer -= dt;
        if (this.interWaveTimer <= 0) {
          this.launchNextWaveEarly();
          return;
        }
      }
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.15) {
        this.hudSyncTimer = 0;
        this.pushHud(false);
      }
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.35);
      return;
    }

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
      }
    }
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);

    this.updateTank(dt);
    this.updateCamera(dt);
    this.updateSpawning(dt);

    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.22;
      this.computeFlowField();
    }

    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.checkWaveOrTutorialProgress();

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.pushHud(false);
    }
  }

  private updateCamera(dt: number) {
    const cssW = this.mainCanvas?.clientWidth || window.innerWidth;
    const cssH = this.mainCanvas?.clientHeight || window.innerHeight;
    const scale = this.computeRenderScale(cssW, cssH);
    const viewW = cssW / scale;
    const viewH = cssH / scale;

    const targetX = Math.max(0, Math.min(Math.max(0, this.arenaWidth - viewW), this.tank.x - viewW / 2));
    const targetY = Math.max(0, Math.min(Math.max(0, this.arenaHeight - viewH), this.tank.y - viewH / 2));

    const smooth = 1 - Math.exp(-9 * dt);
    this.cameraX += (targetX - this.cameraX) * smooth;
    this.cameraY += (targetY - this.cameraY) * smooth;
  }

  private updateTank(dt: number) {
    const t = this.tank;
    if (t.fireCooldown > 0) t.fireCooldown -= dt;
    if (t.invulnTimer > 0) t.invulnTimer -= dt;
    if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 6);
    if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 18);

    let dx = 0;
    let dy = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) dy -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) dy += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) dx -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) dx += 1;

    // Combine touch joystick and hardware gamepad left stick
    if (Math.hypot(this.virtualMoveX, this.virtualMoveY) > 0.12) {
      dx += this.virtualMoveX;
      dy += this.virtualMoveY;
    }
    if (Math.hypot(this.gpMoveX, this.gpMoveY) > 0.12) {
      dx += this.gpMoveX;
      dy += this.gpMoveY;
    }

    const inputLen = Math.hypot(dx, dy);
    if (inputLen > 0.05) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        t.dir = dx > 0 ? 'RIGHT' : 'LEFT';
      } else {
        t.dir = dy > 0 ? 'DOWN' : 'UP';
      }
      const scaleFactor = inputLen > 1 ? 1 / inputLen : Math.min(1, inputLen);
      const nx = (dx / inputLen) * scaleFactor;
      const ny = (dy / inputLen) * scaleFactor;

      // Tank speed scales with Level + Power Tank Tier + Engine Chassis Upgrades!
      const form = getPowerTankForm(t.powerTier);
      const levelSpeedBonus = Math.min(0.65, (this.currentLevel - 1) * 0.014);
      const moveSpeed = 168 * (1 + t.chassis.engineLv * 0.08 + levelSpeedBonus + form.speedBonus);
      this.moveEntityWithCornerAssist(t, nx * moveSpeed * dt, ny * moveSpeed * dt);
      t.trackOffset = (t.trackOffset + moveSpeed * scaleFactor * dt * 0.4) % 12;
    }

    if (this.mouseActive) {
      this.mouseWorldX = this.mouseScreenX / this.renderScale + this.cameraX;
      this.mouseWorldY = this.mouseScreenY / this.renderScale + this.cameraY;
    }

    const touchAimRecent =
      this.virtualAimActive || this.globalTime - this.lastVirtualAimTime < 1.2;
    const gpAimRecent =
      this.gpAimActive || this.globalTime - this.lastGpAimTime < 1.2;
    const mouseAimActive =
      this.mouseActive &&
      (this.mouseDown ||
        this.globalTime - this.lastMouseUseTime < 1.5 ||
        this.globalTime - this.lastMouseMoveTime < 2.2);

    if (this.virtualAimActive || (touchAimRecent && !mouseAimActive && !this.gpAimActive)) {
      t.turretAngle = Math.atan2(this.virtualAimY, this.virtualAimX);
    } else if (this.gpAimActive || (gpAimRecent && !mouseAimActive)) {
      t.turretAngle = Math.atan2(this.gpAimY, this.gpAimX);
    } else if (mouseAimActive) {
      t.turretAngle = Math.atan2(this.mouseWorldY - t.y, this.mouseWorldX - t.x);
    } else {
      const targetAngle = this.dirToAngle(t.dir);
      let diff = targetAngle - t.turretAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t.turretAngle += diff * Math.min(1, dt * 18);
    }

    const firing =
      this.heldKeys.has('Space') ||
      this.mouseDown ||
      this.virtualAimFiring ||
      this.virtualFireButton ||
      this.gpFire;

    if (firing && t.fireCooldown <= 0) {
      this.firePlayerWeapon();
    }
  }

  private dirToAngle(d: Direction): number {
    switch (d) {
      case 'UP':
        return -Math.PI / 2;
      case 'DOWN':
        return Math.PI / 2;
      case 'LEFT':
        return Math.PI;
      case 'RIGHT':
        return 0;
    }
  }

  private moveEntityWithCornerAssist(ent: { x: number; y: number; radius: number }, mx: number, my: number) {
    const nextX = ent.x + mx;
    if (!this.collidesMap(nextX, ent.y, ent.radius)) {
      ent.x = nextX;
    } else if (mx !== 0 && my === 0) {
      const nudge = Math.abs(mx);
      if (!this.collidesMap(nextX, ent.y - 10, ent.radius)) ent.y -= nudge * 0.7;
      else if (!this.collidesMap(nextX, ent.y + 10, ent.radius)) ent.y += nudge * 0.7;
    }

    const nextY = ent.y + my;
    if (!this.collidesMap(ent.x, nextY, ent.radius)) {
      ent.y = nextY;
    } else if (my !== 0 && mx === 0) {
      const nudge = Math.abs(my);
      if (!this.collidesMap(ent.x - 10, nextY, ent.radius)) ent.x -= nudge * 0.7;
      else if (!this.collidesMap(ent.x + 10, nextY, ent.radius)) ent.x += nudge * 0.7;
    }

    ent.x = Math.max(ent.radius + 4, Math.min(this.arenaWidth - ent.radius - 4, ent.x));
    ent.y = Math.max(ent.radius + 4, Math.min(this.arenaHeight - ent.radius - 4, ent.y));
  }

  private collidesMap(x: number, y: number, radius: number): boolean {
    const minC = Math.floor((x - radius) / TILE_SIZE);
    const maxC = Math.floor((x + radius) / TILE_SIZE);
    const minR = Math.floor((y - radius) / TILE_SIZE);
    const maxR = Math.floor((y + radius) / TILE_SIZE);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return true;
        const tile = this.grid[r][c];
        if (tile === 1 || tile === 2 || tile === 3) {
          const rx = c * TILE_SIZE;
          const ry = r * TILE_SIZE;
          const closestX = Math.max(rx, Math.min(x, rx + TILE_SIZE));
          const closestY = Math.max(ry, Math.min(y, ry + TILE_SIZE));
          const dx = x - closestX;
          const dy = y - closestY;
          if (dx * dx + dy * dy < radius * radius) return true;
        }
      }
    }
    return false;
  }

  private firePlayerWeapon() {
    const t = this.tank;
    const def = WEAPONS[t.activeWeapon];
    const wLv = t.weaponLevels[t.activeWeapon];
    const form = getPowerTankForm(t.powerTier);

    const rateMultiplier = 1 + wLv.rateLv * 0.11;
    t.fireCooldown = def.cooldown / rateMultiplier;
    t.recoil = 5;

    const rpgBonus = 1 + (t.rpgLevel - 1) * 0.05;
    const levelAutoPowerBonus = (this.currentLevel - 1) * 0.08;
    const chassisBonus = 1 + t.chassis.firepowerLv * 0.12 + form.firepowerBonus + levelAutoPowerBonus;
    const weaponDmgBonus = 1 + wLv.damageLv * 0.18;
    const finalDamage = Math.round(def.baseDamage * weaponDmgBonus * chassisBonus * rpgBonus);

    const muzzleDist = 20;
    const baseAngle = t.turretAngle;

    if (def.id === 'twin') {
      const perpX = -Math.sin(baseAngle) * 6;
      const perpY = Math.cos(baseAngle) * 6;
      for (const side of [-1, 1]) {
        const angle = baseAngle + (Math.random() - 0.5) * def.spreadRad;
        this.spawnProjectile({
          fromPlayer: true,
          x: t.x + Math.cos(baseAngle) * muzzleDist + perpX * side,
          y: t.y + Math.sin(baseAngle) * muzzleDist + perpY * side,
          vx: Math.cos(angle) * def.projectileSpeed,
          vy: Math.sin(angle) * def.projectileSpeed,
          radius: def.projectileRadius,
          damage: finalDamage,
          brickDamage: def.brickDamage,
          pierce: def.pierce,
          splashRadius: def.splashRadius,
          color: def.color,
        });
      }
    } else {
      for (let i = 0; i < def.pellets; i++) {
        const offset =
          def.pellets === 1
            ? 0
            : (i / (def.pellets - 1) - 0.5) * def.spreadRad + (Math.random() - 0.5) * 0.03;
        const angle = baseAngle + offset;
        this.spawnProjectile({
          fromPlayer: true,
          x: t.x + Math.cos(baseAngle) * muzzleDist,
          y: t.y + Math.sin(baseAngle) * muzzleDist,
          vx: Math.cos(angle) * def.projectileSpeed,
          vy: Math.sin(angle) * def.projectileSpeed,
          radius: def.projectileRadius,
          damage: finalDamage,
          brickDamage: def.brickDamage,
          pierce: def.pierce,
          splashRadius: def.splashRadius,
          color: def.color,
          isRail: def.id === 'railgun',
        });
      }
    }

    const mx = t.x + Math.cos(baseAngle) * (muzzleDist + 4);
    const my = t.y + Math.sin(baseAngle) * (muzzleDist + 4);
    this.emitBurst(mx, my, def.color, 5, 110, 0.14);
    sound.playShoot(def.id);
  }

  private spawnProjectile(opts: {
    fromPlayer: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    damage: number;
    brickDamage: number;
    pierce: number;
    splashRadius: number;
    color: string;
    isRail?: boolean;
  }) {
    this.projectiles.push({
      id: this.nextEntityId++,
      fromPlayer: opts.fromPlayer,
      x: opts.x,
      y: opts.y,
      vx: opts.vx,
      vy: opts.vy,
      radius: opts.radius,
      damage: opts.damage,
      brickDamage: opts.brickDamage,
      pierceLeft: opts.pierce,
      hitIds: new Set<number>(),
      splashRadius: opts.splashRadius,
      color: opts.color,
      life: 2.6,
      isRail: opts.isRail,
    });
  }

  private updateSpawning(dt: number) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      const arch = this.spawnQueue.shift()!;
      // Choose an uncrowded portal so monsters stay spaced apart
      const portal = this.pickBestPortal();
      if (portal) {
        this.spawnMonsterAt(arch, portal);
      }
    }
  }

  private pickBestPortal(): Portal | null {
    if (this.portals.length === 0) return null;
    if (this.portals.length === 1) return this.portals[0];

    let bestPortal = this.portals[0];
    let bestMinDist = -1;

    // Sample portals in random order so ties rotate naturally
    const shuffled = [...this.portals].sort(() => Math.random() - 0.5);
    for (const p of shuffled) {
      let nearest = 9999;
      for (const m of this.monsters) {
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestMinDist) {
        bestMinDist = nearest;
        bestPortal = p;
      }
    }
    return bestPortal;
  }

  private spawnMonsterAt(archetype: MonsterArchetype, portal: Portal) {
    const base = MONSTER_STATS[archetype];
    const lvScale = 1 + (this.currentLevel - 1) * 0.25;
    const waveScale = 1 + (this.wave - 1) * 0.12;
    const hpScale = this.isTutorial ? 0.65 : lvScale * waveScale;
    const dmgScale = this.isTutorial ? 0.55 : 1 + (this.currentLevel - 1) * 0.16;
    const spdScale = 1 + Math.min(0.5, (this.currentLevel - 1) * 0.016);
    const { dropChance, goldScale } = getLevelGoldEconomy(this.currentLevel);
    const expScale = 1 + (this.currentLevel - 1) * 0.18;

    const isAnyBoss = archetype === 'boss' || archetype === 'mega_boss';
    const dropsGold = isAnyBoss || this.isTutorial || Math.random() < dropChance;
    const goldDrop = dropsGold ? Math.max(2, Math.round(base.goldDrop * goldScale)) : 0;
    const bossTitle =
      archetype === 'mega_boss'
        ? this.levelConfig.bossName
        : archetype === 'boss'
        ? this.levelConfig.isMegaBossLevel
          ? 'Boss'
          : this.levelConfig.bossName
        : base.name;

    portal.spawningFlash = 1.0;
    this.emitBurst(portal.x, portal.y, '#A855F7', 12, 130, 0.35);

    this.monsters.push({
      id: this.nextEntityId++,
      archetype,
      name: bossTitle,
      x: portal.x + (Math.random() - 0.5) * 14,
      y: portal.y + 10,
      vx: 0,
      vy: 0,
      radius: base.radius,
      hp: Math.round(base.baseHp * hpScale),
      maxHp: Math.round(base.baseHp * hpScale),
      speed: base.baseSpeed * spdScale,
      contactDamage: Math.round(base.baseContactDamage * dmgScale),
      rangedDamage: Math.round(base.baseRangedDamage * dmgScale),
      goldDrop,
      expDrop: Math.round(base.expDrop * expScale),
      color: base.color,
      accentColor: base.accentColor,
      hitFlash: 0,
      attackTimer: 1.5 + Math.random() * 1.1,
      telegraphTimer: 0,
      telegraphMax: 0.5,
      telegraphKind: 'none',
      dashVx: 0,
      dashVy: 0,
      dashTime: 0,
      spawnAnim: 0,
      facingAngle: Math.PI / 2,
      stuckTimer: 0,
      detourTimer: 0,
      detourX: 0,
      detourY: 0,
    });
  }

  private isTileBlockedFor(r: number, c: number, breakBrick: boolean, breakSteel: boolean): boolean {
    if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return true;
    const tile = this.grid[r][c];
    if (tile === 3) return true;
    if (tile === 1 && !breakBrick) return true;
    if (tile === 2 && !breakSteel) return true;
    return false;
  }

  private canFitThroughTile(r: number, c: number, m: Monster): boolean {
    const breakBrick = m.archetype === 'boss' || m.archetype === 'mega_boss';
    const breakSteel = m.archetype === 'mega_boss';
    if (this.isTileBlockedFor(r, c, breakBrick, breakSteel)) return false;

    // If monster diameter cannot comfortably pass a 1-tile pinch between two walls, force another route
    if (m.radius * 2 + 2 >= TILE_SIZE) {
      const blockedLeft = this.isTileBlockedFor(r, c - 1, breakBrick, breakSteel);
      const blockedRight = this.isTileBlockedFor(r, c + 1, breakBrick, breakSteel);
      const blockedUp = this.isTileBlockedFor(r - 1, c, breakBrick, breakSteel);
      const blockedDown = this.isTileBlockedFor(r + 1, c, breakBrick, breakSteel);
      if ((blockedLeft && blockedRight) || (blockedUp && blockedDown)) {
        return false;
      }
    }
    return true;
  }

  private computeFlowField() {
    const startC = Math.max(0, Math.min(this.gridCols - 1, Math.floor(this.tank.x / TILE_SIZE)));
    const startR = Math.max(0, Math.min(this.gridRows - 1, Math.floor(this.tank.y / TILE_SIZE)));

    const runBfs = (distGrid: number[][], breakBrick: boolean, breakSteel: boolean) => {
      for (let r = 0; r < this.gridRows; r++) {
        for (let c = 0; c < this.gridCols; c++) {
          distGrid[r][c] = 999;
        }
      }
      const queue: [number, number][] = [[startR, startC]];
      distGrid[startR][startC] = 0;
      let head = 0;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      while (head < queue.length) {
        const [r, c] = queue[head++];
        const d = distGrid[r][c] + 1;
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= this.gridRows || nc < 0 || nc >= this.gridCols) continue;
          const tile = this.grid[nr][nc];
          if (tile === 3 || (tile === 2 && !breakSteel) || (tile === 1 && !breakBrick)) continue;
          if (distGrid[nr][nc] > d) {
            distGrid[nr][nc] = d;
            queue.push([nr, nc]);
          }
        }
      }
    };

    runBfs(this.flowDist, false, false);
    runBfs(this.bossFlowDist, true, false);
    runBfs(this.megaBossFlowDist, true, true);
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 16);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const c = Math.floor(px / TILE_SIZE);
      const r = Math.floor(py / TILE_SIZE);
      if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return false;
      const tile = this.grid[r][c];
      if (tile === 1 || tile === 2) return false;
    }
    return true;
  }

  private hasClearPassage(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
    ignoreBrick = false,
    ignoreSteel = false
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.ceil(dist / 12));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const minC = Math.floor((px - radius) / TILE_SIZE);
      const maxC = Math.floor((px + radius) / TILE_SIZE);
      const minR = Math.floor((py - radius) / TILE_SIZE);
      const maxR = Math.floor((py + radius) / TILE_SIZE);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return false;
          const tile = this.grid[r][c];
          if (tile === 3 || (tile === 1 && !ignoreBrick) || (tile === 2 && !ignoreSteel)) {
            const rx = c * TILE_SIZE;
            const ry = r * TILE_SIZE;
            const closestX = Math.max(rx, Math.min(px, rx + TILE_SIZE));
            const closestY = Math.max(ry, Math.min(py, ry + TILE_SIZE));
            const dx = px - closestX;
            const dy = py - closestY;
            if (dx * dx + dy * dy < radius * radius) return false;
          }
        }
      }
    }
    return true;
  }

  private findAlternateDetour(m: Monster, avoidR: number, avoidC: number): boolean {
    const startC = Math.max(0, Math.min(this.gridCols - 1, Math.floor(m.x / TILE_SIZE)));
    const startR = Math.max(0, Math.min(this.gridRows - 1, Math.floor(m.y / TILE_SIZE)));
    const goalC = Math.max(0, Math.min(this.gridCols - 1, Math.floor(this.tank.x / TILE_SIZE)));
    const goalR = Math.max(0, Math.min(this.gridRows - 1, Math.floor(this.tank.y / TILE_SIZE)));

    const rows = this.gridRows;
    const cols = this.gridCols;
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const parentR = Array.from({ length: rows }, () => Array(cols).fill(-1));
    const parentC = Array.from({ length: rows }, () => Array(cols).fill(-1));

    const queue: [number, number][] = [[startR, startC]];
    visited[startR][startC] = true;
    let head = 0;
    let found = false;

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (head < queue.length) {
      const [r, c] = queue[head++];
      if (r === goalR && c === goalC) {
        found = true;
        break;
      }
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (visited[nr][nc]) continue;
        if (nr === avoidR && nc === avoidC && !(nr === goalR && nc === goalC)) continue;
        if (!this.canFitThroughTile(nr, nc, m)) continue;
        visited[nr][nc] = true;
        parentR[nr][nc] = r;
        parentC[nr][nc] = c;
        queue.push([nr, nc]);
      }
    }

    if (!found) return false;

    // Walk back from goal to pick 2 steps ahead on the alternate route
    let cr = goalR;
    let cc = goalC;
    const path: [number, number][] = [];
    while (!(cr === startR && cc === startC)) {
      path.push([cr, cc]);
      const pr = parentR[cr][cc];
      const pc = parentC[cr][cc];
      if (pr < 0 || pc < 0) break;
      cr = pr;
      cc = pc;
    }

    if (path.length === 0) return false;
    const nextStep = path[path.length - 1];
    const secondStep = path.length >= 2 ? path[path.length - 2] : nextStep;
    const chosen =
      this.hasClearPassage(
        m.x,
        m.y,
        (secondStep[1] + 0.5) * TILE_SIZE,
        (secondStep[0] + 0.5) * TILE_SIZE,
        m.radius - 1,
        m.archetype === 'boss' || m.archetype === 'mega_boss',
        m.archetype === 'mega_boss'
      )
        ? secondStep
        : nextStep;

    m.detourX = (chosen[1] + 0.5) * TILE_SIZE;
    m.detourY = (chosen[0] + 0.5) * TILE_SIZE;
    m.detourTimer = 0.72;
    return true;
  }

  private updateMonsters(dt: number) {
    const t = this.tank;

    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];
      if (m.spawnAnim < 1) m.spawnAnim = Math.min(1, m.spawnAnim + dt * 3);
      if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt * 6);
      if (m.detourTimer > 0) m.detourTimer = Math.max(0, m.detourTimer - dt);

      const toTankX = t.x - m.x;
      const toTankY = t.y - m.y;
      const distToTank = Math.hypot(toTankX, toTankY) || 1;
      const seesTank = this.hasLineOfSight(m.x, m.y, t.x, t.y);
      const isBoss = m.archetype === 'boss' || m.archetype === 'mega_boss';
      const isMegaBoss = m.archetype === 'mega_boss';
      const clearPathToTank = this.hasClearPassage(
        m.x,
        m.y,
        t.x,
        t.y,
        m.radius + 1,
        isBoss,
        isMegaBoss
      );

      if (m.dashTime > 0) {
        m.dashTime -= dt;
        this.moveMonsterSafely(m, m.dashVx * dt, m.dashVy * dt);
        this.resolveTankMonsterGap(m);
        this.checkMonsterContactDamage(m);
        continue;
      }

      if (m.telegraphTimer > 0) {
        m.telegraphTimer -= dt;
        m.facingAngle = Math.atan2(toTankY, toTankX);
        // Bosses stay mobile while charging their telegraph instead of stopping dead
        if (isBoss && distToTank > this.tank.radius + m.radius + 14) {
          const creep = m.speed * 0.45;
          this.moveMonsterSafely(
            m,
            (toTankX / distToTank) * creep * dt,
            (toTankY / distToTank) * creep * dt
          );
          this.resolveTankMonsterGap(m);
        }
        if (m.telegraphTimer <= 0) {
          this.executeMonsterTelegraph(m);
        }
        continue;
      }

      m.attackTimer -= dt;
      if (m.attackTimer <= 0 && m.spawnAnim >= 1) {
        if (isBoss) {
          const dashChance = distToTank > 170 ? 0.5 : 0.35;
          m.telegraphKind = Math.random() < dashChance ? 'dash' : 'radial';
          m.telegraphMax = 0.5;
          m.telegraphTimer = 0.5;
          m.attackTimer = m.archetype === 'mega_boss' ? 1.85 : 2.15;
          continue;
        } else if (m.archetype === 'spitter' && seesTank && distToTank < 380) {
          m.telegraphKind = 'bolt';
          m.telegraphMax = 0.4;
          m.telegraphTimer = 0.4;
          m.attackTimer = 2.25;
          continue;
        } else if (m.archetype === 'strong' && seesTank && clearPathToTank && distToTank < 220) {
          m.telegraphKind = 'dash';
          m.telegraphMax = 0.42;
          m.telegraphTimer = 0.42;
          m.attackTimer = 2.6;
          continue;
        } else {
          m.attackTimer = 0.9;
        }
      }

      let dirX = 0;
      let dirY = 0;

      const mc = Math.max(0, Math.min(this.gridCols - 1, Math.floor(m.x / TILE_SIZE)));
      const mr = Math.max(0, Math.min(this.gridRows - 1, Math.floor(m.y / TILE_SIZE)));

      if (m.detourTimer > 0) {
        const ddx = m.detourX - m.x;
        const ddy = m.detourY - m.y;
        const dd = Math.hypot(ddx, ddy);
        if (dd < 12) {
          m.detourTimer = 0;
        } else {
          dirX = ddx / dd;
          dirY = ddy / dd;
        }
      }

      if (dirX === 0 && dirY === 0) {
        if (clearPathToTank && (isBoss || seesTank)) {
          dirX = toTankX / distToTank;
          dirY = toTankY / distToTank;
          // Boss tactical strafe-weave when closing in at mid-range
          if (isBoss && distToTank > 130 && distToTank < 360) {
            const strafeSign = m.id % 2 === 0 ? 1 : -1;
            const weave = Math.sin(this.globalTime * 2.1 + m.id) * 0.34 * strafeSign;
            dirX += -dirY * weave;
            dirY += (toTankX / distToTank) * weave;
          } else if (m.archetype === 'spitter' && distToTank < 165) {
            dirX *= -0.25;
            dirY *= -0.25;
          }
        } else {
          // Pac-Man style continuous maze hunting via flow-field, avoiding tight wall squeezes
          const activeFlow = isMegaBoss
            ? this.megaBossFlowDist
            : m.archetype === 'boss'
            ? this.bossFlowDist
            : this.flowDist;
          let bestR = mr;
          let bestC = mc;
          let bestD = activeFlow[mr][mc];
          const neighbors = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ];
          for (const [dr, dc] of neighbors) {
            const nr = mr + dr;
            const nc = mc + dc;
            if (nr < 0 || nr >= this.gridRows || nc < 0 || nc >= this.gridCols) continue;
            if (!this.canFitThroughTile(nr, nc, m)) continue;
            if (activeFlow[nr][nc] < bestD) {
              bestD = activeFlow[nr][nc];
              bestR = nr;
              bestC = nc;
            }
          }

          // If all neighbors in standard flow were tight squeezes, compute an alternate detour route
          if (bestR === mr && bestC === mc && activeFlow[mr][mc] > 1) {
            const aheadC = Math.max(0, Math.min(this.gridCols - 1, mc + Math.sign(toTankX)));
            const aheadR = Math.max(0, Math.min(this.gridRows - 1, mr + Math.sign(toTankY)));
            this.findAlternateDetour(m, aheadR, aheadC);
          }

          const cellCenterX = (mc + 0.5) * TILE_SIZE;
          const cellCenterY = (mr + 0.5) * TILE_SIZE;
          let targetX = (bestC + 0.5) * TILE_SIZE;
          let targetY = (bestR + 0.5) * TILE_SIZE;

          // Prevent corner-clipping: align to tile center first if turning into another tile clips a corner
          if (
            (bestR !== mr || bestC !== mc) &&
            !this.hasClearPassage(m.x, m.y, targetX, targetY, m.radius - 1, isBoss, isMegaBoss)
          ) {
            targetX = cellCenterX;
            targetY = cellCenterY;
          }

          const nd = Math.hypot(targetX - m.x, targetY - m.y) || 1;
          dirX = (targetX - m.x) / nd;
          dirY = (targetY - m.y) / nd;
        }
      }

      // Spacing between two monsters so they don't stack
      for (let j = 0; j < this.monsters.length; j++) {
        if (i === j) continue;
        const o = this.monsters[j];
        const sx = m.x - o.x;
        const sy = m.y - o.y;
        const sd = Math.hypot(sx, sy);
        const minSep = m.radius + o.radius + 20;
        if (sd > 0 && sd < minSep) {
          const push = ((minSep - sd) / minSep) * 1.4;
          dirX += (sx / sd) * push;
          dirY += (sy / sd) * push;
        }
      }

      const dLen = Math.hypot(dirX, dirY) || 1;
      dirX /= dLen;
      dirY /= dLen;

      // +20% speed boost when regular monster sees tank, +25% for Bosses
      const sightSpeedBoost = seesTank ? (isBoss ? 1.25 : 1.2) : 1.0;
      const effectiveSpeed = m.speed * sightSpeedBoost;

      const minGap = this.tank.radius + m.radius + 8;
      if (distToTank > minGap + 2) {
        const prevX = m.x;
        const prevY = m.y;
        m.vx = dirX * effectiveSpeed;
        m.vy = dirY * effectiveSpeed;
        this.moveMonsterSafely(m, m.vx * dt, m.vy * dt);

        // If blocked by walls / narrow gap, switch to another route around the walls!
        const moved = Math.hypot(m.x - prevX, m.y - prevY);
        if (moved < effectiveSpeed * dt * 0.25) {
          m.stuckTimer += dt;
          if (m.stuckTimer >= 0.14) {
            const aheadC = Math.max(
              0,
              Math.min(this.gridCols - 1, Math.floor((m.x + dirX * TILE_SIZE * 0.75) / TILE_SIZE))
            );
            const aheadR = Math.max(
              0,
              Math.min(this.gridRows - 1, Math.floor((m.y + dirY * TILE_SIZE * 0.75) / TILE_SIZE))
            );
            this.findAlternateDetour(m, aheadR, aheadC);
            m.stuckTimer = 0;
          }
        } else {
          m.stuckTimer = 0;
        }
      } else {
        m.vx = 0;
        m.vy = 0;
        m.stuckTimer = 0;
      }

      m.facingAngle = Math.atan2(toTankY, toTankX);
      this.resolveTankMonsterGap(m);
      this.checkMonsterContactDamage(m);
    }
  }

  private bossBreakWallsAt(x: number, y: number, radius: number, breakSteel: boolean) {
    const minC = Math.floor((x - radius) / TILE_SIZE);
    const maxC = Math.floor((x + radius) / TILE_SIZE);
    const minR = Math.floor((y - radius) / TILE_SIZE);
    const maxR = Math.floor((y + radius) / TILE_SIZE);
    let brokeAny = false;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) continue;
        const tile = this.grid[r][c];
        if (tile === 1 || (breakSteel && tile === 2)) {
          this.grid[r][c] = 0;
          this.brickHp[r][c] = 0;
          brokeAny = true;
          this.emitBurst(
            (c + 0.5) * TILE_SIZE,
            (r + 0.5) * TILE_SIZE,
            tile === 2 ? '#94A3B8' : '#B4533C',
            12,
            150,
            0.35
          );
        }
      }
    }

    if (brokeAny) {
      sound.playWallBreak(breakSteel);
      this.triggerShake(4, 0.12);
      this.computeFlowField();
    }
  }

  private moveMonsterSafely(m: Monster, mx: number, my: number) {
    const isBoss = m.archetype === 'boss' || m.archetype === 'mega_boss';
    if (isBoss) {
      // Boss monsters smash brick walls (and Mega Boss smashes steel walls too!)
      this.bossBreakWallsAt(m.x + mx, m.y + my, m.radius + 2, m.archetype === 'mega_boss');
    }

    // Corner slide assist so searching monsters & large bosses glide smoothly around obstacles
    const slideOffsets = isBoss ? [12, 22] : [10];
    const nextX = m.x + mx;
    if (!this.collidesMap(nextX, m.y, m.radius)) {
      m.x = nextX;
    } else if (Math.abs(mx) > 0.01) {
      const nudge = Math.abs(mx) * 0.9;
      for (const off of slideOffsets) {
        if (!this.collidesMap(nextX, m.y - off, m.radius)) {
          m.y -= nudge;
          break;
        } else if (!this.collidesMap(nextX, m.y + off, m.radius)) {
          m.y += nudge;
          break;
        }
      }
    }

    const nextY = m.y + my;
    if (!this.collidesMap(m.x, nextY, m.radius)) {
      m.y = nextY;
    } else if (Math.abs(my) > 0.01) {
      const nudge = Math.abs(my) * 0.9;
      for (const off of slideOffsets) {
        if (!this.collidesMap(m.x - off, nextY, m.radius)) {
          m.x -= nudge;
          break;
        } else if (!this.collidesMap(m.x + off, nextY, m.radius)) {
          m.x += nudge;
          break;
        }
      }
    }
  }

  private executeMonsterTelegraph(m: Monster) {
    const angle = Math.atan2(this.tank.y - m.y, this.tank.x - m.x);
    if (m.telegraphKind === 'dash') {
      const isBoss = m.archetype === 'boss' || m.archetype === 'mega_boss';
      const dashSpeed = m.archetype === 'mega_boss' ? 430 : m.archetype === 'boss' ? 390 : 285;
      m.dashVx = Math.cos(angle) * dashSpeed;
      m.dashVy = Math.sin(angle) * dashSpeed;
      m.dashTime = isBoss ? 0.42 : 0.3;
      this.emitBurst(m.x, m.y, m.accentColor, isBoss ? 14 : 8, 150, 0.28);
    } else if (m.telegraphKind === 'bolt') {
      this.spawnProjectile({
        fromPlayer: false,
        x: m.x + Math.cos(angle) * (m.radius + 4),
        y: m.y + Math.sin(angle) * (m.radius + 4),
        vx: Math.cos(angle) * 310,
        vy: Math.sin(angle) * 310,
        radius: 5,
        damage: m.rangedDamage,
        brickDamage: 0,
        pierce: 1,
        splashRadius: 0,
        color: '#C084FC',
      });
    } else if (m.telegraphKind === 'radial') {
      const count = m.archetype === 'mega_boss' ? 12 : 8;
      for (let k = 0; k < count; k++) {
        const a = angle + (k / count) * Math.PI * 2;
        this.spawnProjectile({
          fromPlayer: false,
          x: m.x + Math.cos(a) * (m.radius + 4),
          y: m.y + Math.sin(a) * (m.radius + 4),
          vx: Math.cos(a) * 265,
          vy: Math.sin(a) * 265,
          radius: m.archetype === 'mega_boss' ? 7 : 6,
          damage: m.rangedDamage,
          brickDamage: 2, // Boss shots can break brick walls!
          pierce: 1,
          splashRadius: 0,
          color: m.archetype === 'mega_boss' ? '#38BDF8' : '#FB7185',
        });
      }
      this.triggerShake(5, 0.16);
    }
    m.telegraphKind = 'none';
  }

  private resolveTankMonsterGap(m: Monster) {
    const t = this.tank;
    const minGap = t.radius + m.radius + 8;
    let dx = m.x - t.x;
    let dy = m.y - t.y;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      dx = 0;
      dy = -1;
      dist = 1;
    }

    if (dist < minGap) {
      const overlap = minGap - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      // First push monster back out to keep the gap
      const prevMx = m.x;
      const prevMy = m.y;
      this.moveMonsterSafely(m, nx * overlap, ny * overlap);

      const newDist = Math.hypot(m.x - t.x, m.y - t.y);
      if (newDist < minGap) {
        // If monster hit a wall behind it, push tank cleanly away so they still never overlap
        const rem = minGap - newDist;
        this.moveEntityWithCornerAssist(t, -nx * rem, -ny * rem);
      }

      // Guard against NaN
      if (Number.isNaN(m.x) || Number.isNaN(m.y)) {
        m.x = prevMx;
        m.y = prevMy;
      }
    }
  }

  private checkMonsterContactDamage(m: Monster) {
    const minGap = this.tank.radius + m.radius + 8;
    const dist = Math.hypot(this.tank.x - m.x, this.tank.y - m.y);
    if (dist <= minGap + 6) {
      this.damageTank(m.contactDamage);
    }
  }

  private damageTank(rawDamage: number) {
    const t = this.tank;
    if (t.invulnTimer > 0 || this.phase !== 'PLAYING') return;

    const armorMitigation = Math.min(0.45, t.chassis.armorLv * 0.04);
    const mitigated = Math.max(4, Math.round(rawDamage * (1 - armorMitigation)));
    // Cap any single hit so even Boss / Super Boss attacks cannot kill the tank immediately
    const maxSingleHit = Math.max(18, Math.round(t.maxHp * 0.34));
    const dmg = Math.min(maxSingleHit, mitigated);

    t.hp = Math.max(0, t.hp - dmg);
    t.invulnTimer = 0.65;
    t.hitFlash = 1;
    this.triggerShake(9, 0.24);
    sound.playTankHit();
    this.addFloatingText(t.x, t.y - 20, `-${dmg}`, '#EF4444', 1.1);
    this.particles.push({
      x: t.x,
      y: t.y,
      vx: 0,
      vy: 0,
      size: 38,
      color: '#F59E0B',
      life: 0.22,
      maxLife: 0.22,
      ring: true,
    });
    this.emitBurst(t.x, t.y, '#EF4444', 12, 165, 0.3);
    this.emitBurst(t.x, t.y, '#F59E0B', 10, 185, 0.26);

    if (t.hp <= 0) {
      this.phase = 'GAME_OVER';
      this.shakeTime = 0;
      this.shakeDuration = 0;
      this.shakeIntensity = 0;
      this.hitstopTimer = 0;
      this.heldKeys.clear();
      this.mouseDown = false;
      this.emitBurst(t.x, t.y, '#F59E0B', 32, 235, 0.6);
      this.emitBurst(t.x, t.y, '#EF4444', 18, 190, 0.5);
      sound.playGameOver();
      this.pushHud(true);
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.isRail && Math.random() < 0.7) {
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          size: 3,
          color: '#22D3EE',
          life: 0.12,
          maxLife: 0.12,
        });
      }

      if (p.x < 0 || p.x > this.arenaWidth || p.y < 0 || p.y > this.arenaHeight) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const c = Math.floor(p.x / TILE_SIZE);
      const r = Math.floor(p.y / TILE_SIZE);
      if (r >= 0 && r < this.gridRows && c >= 0 && c < this.gridCols) {
        const tile = this.grid[r][c];
        if (tile === 1 || tile === 2) {
          if (tile === 1 && p.brickDamage > 0) {
            this.brickHp[r][c] -= p.brickDamage;
            this.emitBurst(p.x, p.y, '#D97757', 7, 120, 0.25);
            if (this.brickHp[r][c] <= 0) {
              this.grid[r][c] = 0;
              this.emitBurst((c + 0.5) * TILE_SIZE, (r + 0.5) * TILE_SIZE, '#B4533C', 14, 150, 0.35);
              sound.playWallBreak(false);
              this.computeFlowField();
            }
          } else {
            this.emitBurst(p.x, p.y, '#94A3B8', 5, 90, 0.18);
          }

          if (p.splashRadius > 0) {
            this.triggerSplash(p.x, p.y, p.splashRadius, p.damage, p.color);
          }
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      if (p.fromPlayer) {
        let destroyed = false;
        for (let j = this.monsters.length - 1; j >= 0; j--) {
          const m = this.monsters[j];
          if (p.hitIds.has(m.id)) continue;
          const dist = Math.hypot(p.x - m.x, p.y - m.y);
          if (dist < p.radius + m.radius) {
            p.hitIds.add(m.id);
            if (p.splashRadius > 0) {
              this.triggerSplash(p.x, p.y, p.splashRadius, p.damage, p.color);
              destroyed = true;
              break;
            } else {
              this.damageMonster(j, p.damage, p.color, p.x, p.y);
              p.pierceLeft -= 1;
              if (p.pierceLeft <= 0) {
                destroyed = true;
                break;
              }
            }
          }
        }
        if (destroyed) {
          this.projectiles.splice(i, 1);
        }
      } else {
        const dist = Math.hypot(p.x - this.tank.x, p.y - this.tank.y);
        if (dist < p.radius + this.tank.radius) {
          this.damageTank(p.damage);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private triggerSplash(x: number, y: number, radius: number, damage: number, color: string) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: radius,
      color,
      life: 0.25,
      maxLife: 0.25,
      ring: true,
    });
    this.emitBurst(x, y, color, 18, 195, 0.36);
    this.emitBurst(x, y, '#FDE047', 10, 150, 0.26);
    sound.playExplosion(radius > 75);
    this.triggerShake(5.5, 0.16);

    for (let j = this.monsters.length - 1; j >= 0; j--) {
      const m = this.monsters[j];
      const d = Math.hypot(m.x - x, m.y - y);
      if (d <= radius + m.radius) {
        const falloff = d < radius * 0.45 ? 1 : 0.72;
        this.damageMonster(j, Math.round(damage * falloff), color, x, y);
      }
    }
  }

  private damageMonster(
    index: number,
    dmg: number,
    hitColor: string,
    impactX?: number,
    impactY?: number
  ) {
    const m = this.monsters[index];
    if (!m) return;
    const isBoss = m.archetype === 'boss' || m.archetype === 'mega_boss';
    const ix = impactX ?? m.x;
    const iy = impactY ?? m.y;

    m.hp -= dmg;
    m.hitFlash = 1;

    // Impact particle explosion + shockwave ring + crisp screen shake
    this.particles.push({
      x: ix,
      y: iy,
      vx: 0,
      vy: 0,
      size: isBoss ? 34 : 24,
      color: hitColor,
      life: 0.18,
      maxLife: 0.18,
      ring: true,
    });
    this.emitBurst(ix, iy, hitColor, 9, 150, 0.24);
    this.emitBurst(ix, iy, '#FEF08A', 5, 115, 0.16);
    this.triggerShake(isBoss ? 4.5 : dmg >= 45 ? 3.5 : 2.2, isBoss ? 0.14 : 0.1);

    this.addFloatingText(m.x, m.y - m.radius, `${dmg}`, '#F8FAFC', 0.9);
    sound.playHit(isBoss);

    if (m.hp <= 0) {
      this.killMonster(index);
    }
  }

  private killMonster(index: number) {
    const m = this.monsters[index];
    const isBoss = m.archetype === 'boss' || m.archetype === 'mega_boss';
    this.monsters.splice(index, 1);

    this.totalKills++;
    this.levelKills++;

    sound.playKill(isBoss);
    this.emitBurst(m.x, m.y, m.color, isBoss ? 40 : 16, isBoss ? 250 : 160, isBoss ? 0.55 : 0.32);
    if (isBoss) {
      this.hitstopTimer = 0.06;
      this.triggerShake(10, 0.35);
    } else if (m.archetype === 'high_hp') {
      this.hitstopTimer = 0.03;
      this.triggerShake(4, 0.12);
    }

    if (m.goldDrop > 0) {
      const goldCount = isBoss ? 4 : 1;
      for (let i = 0; i < goldCount; i++) {
        this.drops.push({
          id: this.nextEntityId++,
          kind: 'gold',
          x: m.x + (Math.random() - 0.5) * (isBoss ? 52 : 16),
          y: m.y + (Math.random() - 0.5) * (isBoss ? 52 : 16),
          value: Math.max(1, Math.round(m.goldDrop / goldCount)),
          life: 30,
          bobPhase: Math.random() * Math.PI * 2,
          magnetized: false,
        });
      }
    }
    const expCount = isBoss ? 5 : 1;
    for (let i = 0; i < expCount; i++) {
      this.drops.push({
        id: this.nextEntityId++,
        kind: 'exp',
        x: m.x + (Math.random() - 0.5) * (isBoss ? 52 : 18),
        y: m.y + (Math.random() - 0.5) * (isBoss ? 52 : 18),
        value: Math.round(m.expDrop / expCount),
        life: 30,
        bobPhase: Math.random() * Math.PI * 2,
        magnetized: false,
      });
    }

    if (this.tank.hp < this.tank.maxHp * 0.78 && Math.random() < 0.18) {
      this.drops.push({
        id: this.nextEntityId++,
        kind: 'heal',
        x: m.x,
        y: m.y,
        value: Math.round(this.tank.maxHp * 0.18),
        life: 25,
        bobPhase: 0,
        magnetized: false,
      });
    }
  }

  private updateDrops(dt: number) {
    const t = this.tank;
    const magnetRange = 68 + t.chassis.magnetLv * 32;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.bobPhase += dt * 4.5;
      d.life -= dt;
      if (d.life <= 0) {
        this.drops.splice(i, 1);
        continue;
      }

      const dx = t.x - d.x;
      const dy = t.y - d.y;
      const dist = Math.hypot(dx, dy);

      if (dist < magnetRange) d.magnetized = true;

      if (d.magnetized && dist > 1) {
        const pullSpeed = 400;
        d.x += (dx / dist) * pullSpeed * dt;
        d.y += (dy / dist) * pullSpeed * dt;
      }

      if (dist < t.radius + 14) {
        this.collectDrop(d);
        this.drops.splice(i, 1);
      }
    }
  }

  private collectDrop(d: DropItem) {
    const t = this.tank;
    sound.playPickup(d.kind);
    if (d.kind === 'gold') {
      t.gold += d.value;
      this.addFloatingText(t.x, t.y - 24, `+${d.value}G`, '#FBBF24', 1.0);
    } else if (d.kind === 'exp') {
      t.exp += d.value;
      this.addFloatingText(t.x + 12, t.y - 34, `+${d.value} XP`, '#34D399', 0.92);
      while (t.exp >= t.expToNext) {
        t.exp -= t.expToNext;
        t.rpgLevel += 1;
        t.expToNext = Math.round(t.expToNext * 1.32);
        t.maxHp += 15;
        t.hp = Math.min(t.maxHp, t.hp + Math.round(t.maxHp * 0.25));
        sound.playLevelUp();
        this.emitBurst(t.x, t.y, '#10B981', 20, 170, 0.45);
        this.addFloatingText(t.x, t.y - 46, `RPG LEVEL ${t.rpgLevel}!`, '#10B981', 1.25);
      }
    } else if (d.kind === 'heal') {
      t.hp = Math.min(t.maxHp, t.hp + d.value);
      this.addFloatingText(t.x, t.y - 24, `+${d.value} HP`, '#38BDF8', 1.0);
    }
  }

  private collectAllRemainingDrops() {
    for (const d of this.drops) {
      this.collectDrop(d);
    }
    this.drops = [];
  }

  private checkWaveOrTutorialProgress() {
    if (this.isTutorial) {
      this.updateTutorialProgress();
      return;
    }

    if (this.spawnQueue.length === 0 && this.monsters.length === 0) {
      this.collectAllRemainingDrops();

      if (this.wave < this.levelConfig.totalWaves) {
        this.phase = 'INTER_WAVE_STORE';
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.hitstopTimer = 0;
        this.interWaveTimer = INTER_WAVE_SECONDS;
        this.projectiles = [];
        this.heldKeys.clear();
        this.mouseDown = false;
        sound.playWaveBanner(false);
        this.pushHud(true);
      } else {
        this.phase = 'LEVEL_COMPLETE';
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.hitstopTimer = 0;
        this.projectiles = [];
        this.heldKeys.clear();
        this.mouseDown = false;
        this.unlockedMaxLevel = Math.min(
          MAX_GAME_LEVEL,
          Math.max(this.unlockedMaxLevel, this.currentLevel + 1)
        );
        try {
          localStorage.setItem(STORAGE_KEY_MAX_LEVEL, String(this.unlockedMaxLevel));
        } catch {
          // ignore storage errors
        }
        sound.playVictory();
        this.pushHud(true);
      }
    }
  }

  private updateTutorialProgress() {
    if (this.tutorialStep === 'MOVE') {
      const dist = Math.hypot(
        this.tank.x - this.tutorialWaypoint.x,
        this.tank.y - this.tutorialWaypoint.y
      );
      if (dist < this.tutorialWaypoint.radius + 10) {
        this.tutorialStep = 'SHOOT';
        sound.playPickup('exp');
        if (this.portals[0]) {
          this.spawnMonsterAt('fast', this.portals[0]);
        }
        this.pushHud(true);
      }
    } else if (this.tutorialStep === 'SHOOT') {
      if (this.monsters.length === 0) {
        this.tutorialStep = 'COLLECT';
        // Ensure new players always see & collect Gold + XP drops in Step 3
        if (this.drops.length === 0) {
          this.drops.push(
            {
              id: this.nextEntityId++,
              kind: 'gold',
              x: Math.max(80, this.tank.x - 70),
              y: Math.max(120, this.tank.y - 60),
              value: 25,
              life: 30,
              bobPhase: 0,
              magnetized: false,
            },
            {
              id: this.nextEntityId++,
              kind: 'exp',
              x: Math.min(this.arenaWidth - 80, this.tank.x + 70),
              y: Math.max(120, this.tank.y - 60),
              value: 30,
              life: 30,
              bobPhase: 1.5,
              magnetized: false,
            }
          );
        }
        this.pushHud(true);
      }
    } else if (this.tutorialStep === 'COLLECT') {
      if (this.drops.length === 0) {
        this.tutorialStep = 'RADAR';
        sound.playWaveBanner(false);
        const topPortal = this.portals[this.portals.length - 1] || this.portals[0];
        if (topPortal) {
          this.spawnMonsterAt('strong', topPortal);
        }
        this.pushHud(true);
      }
    } else if (this.tutorialStep === 'RADAR') {
      if (this.monsters.length === 0 && this.drops.length === 0) {
        this.tutorialStep = 'STORE';
        this.phase = 'INTER_WAVE_STORE';
        this.interWaveTimer = INTER_WAVE_SECONDS;
        this.heldKeys.clear();
        this.mouseDown = false;
        this.pushHud(true);
      }
    }
  }

  private emitBurst(x: number, y: number, color: string, count: number, speed: number, life: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 2.5 + Math.random() * 3.5,
        color,
        life,
        maxLife: life,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, scale = 1) {
    this.floatingTexts.push({
      x,
      y,
      vy: -38,
      text,
      color,
      life: 0.78,
      maxLife: 0.78,
      scale,
    });
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeDuration = Math.max(this.shakeDuration, duration, this.shakeTime);
  }

  private computeRenderScale(cssW: number, cssH: number): number {
    // Full-screen edge-to-edge coverage with balanced tactical zoom on Android landscape phones
    const mobileFriendlyZoom = Math.min(1.05, Math.max(0.62, cssH / 620));
    return Math.max(mobileFriendlyZoom, cssW / this.arenaWidth, cssH / this.arenaHeight);
  }

  // --- Rendering ---
  private render() {
    this.renderMainArena();
    this.renderRadarMiniMap();
  }

  private renderMainArena() {
    const canvas = this.mainCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || window.innerWidth;
    const cssH = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const scale = this.computeRenderScale(cssW, cssH);
    this.renderScale = scale;

    let shakeX = 0;
    let shakeY = 0;
    if (this.phase === 'PLAYING' && this.shakeTime > 0) {
      const decay = this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 1;
      const amp = this.shakeIntensity * decay;
      shakeX = (Math.random() - 0.5) * amp * 2;
      shakeY = (Math.random() - 0.5) * amp * 2;
    }

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.scale(scale, scale);
    ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

    // Arena floor merged cleanly with dark theme background
    ctx.fillStyle = '#111720';
    ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);

    // Subtle tactical grid lines across full scrolling map
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.gridCols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, this.arenaHeight);
      ctx.stroke();
    }
    for (let r = 0; r <= this.gridRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(this.arenaWidth, r * TILE_SIZE);
      ctx.stroke();
    }

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const tile = this.grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        if (tile === 1) {
          this.drawBrickTile(ctx, x, y, this.brickHp[r][c]);
        } else if (tile === 2) {
          this.drawSteelTile(ctx, x, y);
        } else if (tile === 3) {
          this.drawWaterTile(ctx, x, y);
        }
      }
    }

    for (const portal of this.portals) {
      this.drawPortal(ctx, portal);
    }

    if (this.isTutorial && this.tutorialStep === 'MOVE') {
      const wp = this.tutorialWaypoint;
      const pulse = 0.65 + 0.35 * Math.sin(this.globalTime * 5);
      ctx.save();
      // Guiding dashed line from tank to waypoint
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(this.tank.x, this.tank.y);
      ctx.lineTo(wp.x, wp.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = `rgba(16, 185, 129, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.fill();
      ctx.fillStyle = '#34D399';
      ctx.font = '700 12px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DRIVE HERE', wp.x, wp.y + 4);
      ctx.restore();
    }

    if (this.isTutorial && (this.tutorialStep === 'SHOOT' || this.tutorialStep === 'RADAR')) {
      for (const m of this.monsters) {
        const pulse = 0.55 + 0.35 * Math.sin(this.globalTime * 6);
        ctx.save();
        ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const drop of this.drops) {
      this.drawDrop(ctx, drop);
    }

    for (const m of this.monsters) {
      this.drawMonster(ctx, m);
    }

    this.drawTank(ctx, this.tank);

    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.isRail ? 12 : 7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (this.grid[r][c] === 4) {
          this.drawBushTile(ctx, c * TILE_SIZE, r * TILE_SIZE);
        }
      }
    }

    for (const pt of this.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (pt.ring) {
        const progress = 1 - alpha;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.restore();
    }

    for (const f of this.floatingTexts) {
      const alpha = Math.min(1, (f.life / f.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = `700 ${Math.round(13 * (f.scale || 1))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // Perimeter boundary trim
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, this.arenaWidth - 4, this.arenaHeight - 4);

    ctx.restore();

    // Screen-space Wave Banner centered cleanly in viewport
    if (this.bannerTimer > 0 && this.phase === 'PLAYING') {
      const alpha = Math.min(1, this.bannerTimer * 1.5);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.globalAlpha = alpha;
      const bw = 420;
      const bh = 84;
      const bx = cssW / 2 - bw / 2;
      const by = cssH / 2 - bh / 2;
      ctx.fillStyle = 'rgba(13, 17, 23, 0.88)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 26px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.bannerText.toUpperCase(), cssW / 2, by + 38);

      ctx.fillStyle = '#F59E0B';
      ctx.font = '600 13px "DM Sans", sans-serif';
      ctx.fillText(this.bannerSub, cssW / 2, by + 62);
      ctx.restore();
    }
  }

  private drawBrickTile(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number) {
    ctx.fillStyle = hp <= 1 ? '#7C3225' : '#A84432';
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    ctx.strokeStyle = '#2A1612';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + TILE_SIZE / 2);
    ctx.lineTo(x + TILE_SIZE - 1, y + TILE_SIZE / 2);
    ctx.moveTo(x + TILE_SIZE / 2, y + 1);
    ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    ctx.moveTo(x + TILE_SIZE * 0.25, y + TILE_SIZE / 2);
    ctx.lineTo(x + TILE_SIZE * 0.25, y + TILE_SIZE - 1);
    ctx.moveTo(x + TILE_SIZE * 0.75, y + TILE_SIZE / 2);
    ctx.lineTo(x + TILE_SIZE * 0.75, y + TILE_SIZE - 1);
    ctx.stroke();

    if (hp <= 1) {
      ctx.strokeStyle = '#140B09';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 8);
      ctx.lineTo(x + 22, y + 20);
      ctx.lineTo(x + 16, y + 32);
      ctx.stroke();
    }
  }

  private drawSteelTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.fillStyle = '#64748B';
    ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    ctx.fillStyle = '#CBD5E1';
    for (const [rx, ry] of [
      [x + 4, y + 4],
      [x + TILE_SIZE - 6, y + 4],
      [x + 4, y + TILE_SIZE - 6],
      [x + TILE_SIZE - 6, y + TILE_SIZE - 6],
    ]) {
      ctx.fillRect(rx, ry, 2, 2);
    }
  }

  private drawWaterTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#0E3A5C';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    const waveOffset = Math.sin(this.globalTime * 3 + x * 0.05) * 3;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 14 + waveOffset);
    ctx.lineTo(x + TILE_SIZE - 6, y + 14 - waveOffset);
    ctx.moveTo(x + 8, y + 28 - waveOffset);
    ctx.lineTo(x + TILE_SIZE - 8, y + 28 + waveOffset);
    ctx.stroke();
  }

  private drawBushTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(x + 13, y + 14, 10, 0, Math.PI * 2);
    ctx.arc(x + 27, y + 15, 10, 0, Math.PI * 2);
    ctx.arc(x + 15, y + 27, 10, 0, Math.PI * 2);
    ctx.arc(x + 26, y + 26, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22C55E';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x + 20, y + 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, portal: Portal) {
    const r = 17 + Math.sin(portal.pulse) * 2.5 + portal.spawningFlash * 6;
    ctx.save();
    ctx.translate(portal.x, portal.y);

    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 8);
    grad.addColorStop(0, 'rgba(216, 180, 254, 0.95)');
    grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.55)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(this.globalTime * 2.2);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(-this.globalTime * 4.1);
    ctx.strokeStyle = '#E879F9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private drawDrop(ctx: CanvasRenderingContext2D, drop: DropItem) {
    const bob = Math.sin(drop.bobPhase) * 2.5;
    ctx.save();
    ctx.translate(drop.x, drop.y + bob);

    if (drop.kind === 'gold') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#78350F';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);
    } else if (drop.kind === 'exp') {
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#A7F3D0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#0EA5E9';
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillRect(-5, -2, 10, 4);
    }
    ctx.restore();
  }

  private drawMonster(ctx: CanvasRenderingContext2D, m: Monster) {
    ctx.save();
    ctx.translate(m.x, m.y);
    const scale = 0.35 + 0.65 * m.spawnAnim;
    ctx.scale(scale, scale);

    if (m.telegraphTimer > 0) {
      const prog = 1 - m.telegraphTimer / m.telegraphMax;
      ctx.save();
      ctx.strokeStyle = m.telegraphKind === 'radial' ? '#FB7185' : '#FBBF24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius + 8 + prog * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(m.facingAngle);

    const fill = m.hitFlash > 0 ? '#FFFFFF' : m.color;
    const accent = m.hitFlash > 0 ? '#FFFFFF' : m.accentColor;

    if (m.archetype === 'fast') {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(m.radius + 3, 0);
      ctx.lineTo(-m.radius * 0.7, -m.radius * 0.9);
      ctx.lineTo(-m.radius * 0.4, 0);
      ctx.lineTo(-m.radius * 0.7, m.radius * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(3, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.archetype === 'high_hp') {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * m.radius;
        const py = Math.sin(a) * m.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (m.archetype === 'boss' || m.archetype === 'mega_boss') {
      const isMega = m.archetype === 'mega_boss';
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = isMega ? 4 : 3;
      ctx.stroke();

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(m.radius - 2, -12);
      ctx.lineTo(m.radius + (isMega ? 18 : 12), -20);
      ctx.lineTo(m.radius + 2, -4);
      ctx.moveTo(m.radius - 2, 12);
      ctx.lineTo(m.radius + (isMega ? 18 : 12), 20);
      ctx.lineTo(m.radius + 2, 4);
      ctx.fill();

      ctx.fillStyle = isMega ? '#38BDF8' : '#FEF08A';
      ctx.beginPath();
      ctx.arc(7, 0, isMega ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(2, -6, m.radius - 1, 4);
      ctx.fillRect(2, 2, m.radius - 1, 4);
    }

    ctx.restore();

    if (m.hp < m.maxHp || m.archetype === 'high_hp' || m.archetype === 'boss' || m.archetype === 'mega_boss') {
      const bw = m.archetype === 'mega_boss' ? 58 : m.archetype === 'boss' ? 48 : 28;
      const bh = 4;
      const bx = -bw / 2;
      const by = -m.radius - 10;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = m.archetype === 'boss' || m.archetype === 'mega_boss' ? '#F59E0B' : '#EF4444';
      ctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), bh);
    }

    ctx.restore();
  }

  private drawTank(ctx: CanvasRenderingContext2D, t: PlayerTank) {
    const form = getPowerTankForm(t.powerTier);
    ctx.save();
    ctx.translate(t.x, t.y);

    if (t.invulnTimer > 0 && Math.floor(this.globalTime * 16) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    ctx.save();
    ctx.rotate(this.dirToAngle(t.dir));

    const hullColor = t.hitFlash > 0 ? '#FFFFFF' : form.hullColor;
    const treadColor = '#334155';

    // Treads
    ctx.fillStyle = treadColor;
    ctx.fillRect(-16, -16, 32, 6);
    ctx.fillRect(-16, 10, 32, 6);
    ctx.fillStyle = '#0F172A';
    for (let x = -14 + (t.trackOffset % 6); x < 14; x += 6) {
      ctx.fillRect(x, -16, 2, 6);
      ctx.fillRect(x, 10, 2, 6);
    }

    // Power Tank Chassis Upgrade Visuals (Tier >= 1 adds angled front prow & energy vents)
    ctx.fillStyle = hullColor;
    if (t.powerTier >= 1) {
      ctx.beginPath();
      ctx.moveTo(-13, -11);
      ctx.lineTo(10, -11);
      ctx.lineTo(16, -6);
      ctx.lineTo(16, 6);
      ctx.lineTo(10, 11);
      ctx.lineTo(-13, 11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = form.trimColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Side armor power vents
      ctx.fillStyle = form.trimColor;
      ctx.fillRect(-10, -12, 7, 2);
      ctx.fillRect(-10, 10, 7, 2);
    } else {
      ctx.fillRect(-12, -10, 24, 20);
      ctx.strokeStyle = '#854D0E';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-12, -10, 24, 20);
    }
    ctx.restore();

    // Turret + Weapon Barrel
    ctx.save();
    ctx.rotate(t.turretAngle);
    const barrelOffset = -t.recoil;
    const weaponDef = WEAPONS[t.activeWeapon];

    ctx.fillStyle = weaponDef.color;
    if (t.activeWeapon === 'twin') {
      ctx.fillRect(4 + barrelOffset, -5, 17, 3);
      ctx.fillRect(4 + barrelOffset, 2, 17, 3);
    } else if (t.activeWeapon === 'shotgun') {
      ctx.fillRect(4 + barrelOffset, -4, 15, 8);
    } else {
      ctx.fillRect(4 + barrelOffset, -2.5, 18, 5);
    }

    if (t.powerTier >= 2) {
      // Heavy reinforced collar on higher-tier Power Tanks
      ctx.fillStyle = form.trimColor;
      ctx.fillRect(5 + barrelOffset, -4.5, 6, 9);
    }

    ctx.fillStyle = t.hitFlash > 0 ? '#FFFFFF' : form.turretColor;
    ctx.beginPath();
    ctx.arc(0, 0, t.powerTier >= 1 ? 9 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = form.trimColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  private renderRadarMiniMap() {
    const canvas = this.radarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    const radarRangeWorld = 420;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(13, 18, 26, 0.92)';
    ctx.fillRect(0, 0, size, size);

    const scale = (half - 6) / radarRangeWorld;

    ctx.save();
    ctx.translate(half, half);

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const tile = this.grid[r][c];
        if (tile === 0 || tile === 4) continue;
        const wx = (c + 0.5) * TILE_SIZE - this.tank.x;
        const wy = (r + 0.5) * TILE_SIZE - this.tank.y;
        if (Math.abs(wx) > radarRangeWorld + 30 || Math.abs(wy) > radarRangeWorld + 30) continue;
        const sx = wx * scale;
        const sy = wy * scale;
        const ts = TILE_SIZE * scale;

        if (tile === 1) ctx.fillStyle = 'rgba(180, 83, 60, 0.65)';
        else if (tile === 2) ctx.fillStyle = 'rgba(100, 116, 139, 0.78)';
        else if (tile === 3) ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
        else if (tile === 5) ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';

        ctx.fillRect(sx - ts / 2, sy - ts / 2, ts, ts);
      }
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    for (const frac of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.arc(0, 0, (half - 6) * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.moveTo(0, -half);
    ctx.lineTo(0, half);
    ctx.stroke();

    ctx.save();
    ctx.rotate(this.tank.turretAngle);
    const fovGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, half * 0.75);
    fovGrad.addColorStop(0, 'rgba(250, 204, 21, 0.28)');
    fovGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = fovGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, half * 0.75, -0.45, 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    for (const d of this.drops) {
      const rx = (d.x - this.tank.x) * scale;
      const ry = (d.y - this.tank.y) * scale;
      if (Math.hypot(rx, ry) < half - 6) {
        ctx.fillStyle = d.kind === 'gold' ? '#FBBF24' : d.kind === 'exp' ? '#34D399' : '#38BDF8';
        ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
      }
    }

    for (const m of this.monsters) {
      const dx = m.x - this.tank.x;
      const dy = m.y - this.tank.y;
      const dist = Math.hypot(dx, dy);
      const isBoss = m.archetype === 'boss' || m.archetype === 'mega_boss';

      if (dist <= radarRangeWorld - 10) {
        const rx = dx * scale;
        const ry = dy * scale;
        ctx.fillStyle = isBoss ? '#F43F5E' : m.archetype === 'fast' ? '#FB923C' : '#EF4444';
        ctx.beginPath();
        ctx.arc(rx, ry, isBoss ? 5.5 : 3.4, 0, Math.PI * 2);
        ctx.fill();
        if (isBoss) {
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else {
        const ang = Math.atan2(dy, dx);
        const edgeR = half - 7;
        const px = Math.cos(ang) * edgeR;
        const py = Math.sin(ang) * edgeR;
        ctx.fillStyle = isBoss ? '#FDE047' : '#EF4444';
        ctx.beginPath();
        ctx.arc(px, py, isBoss ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.rotate(this.dirToAngle(this.tank.dir));
    ctx.fillStyle = getPowerTankForm(this.tank.powerTier).hullColor;
    ctx.beginPath();
    ctx.moveTo(6.5, 0);
    ctx.lineTo(-4.5, -4.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-4.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', half, 12);

    ctx.restore();
  }

  public getSnapshot(): HudSnapshot {
    const boss =
      this.monsters.find((m) => m.archetype === 'mega_boss') ||
      this.monsters.find((m) => m.archetype === 'boss') ||
      null;
    const form = getPowerTankForm(this.tank.powerTier);
    let tutorialProgressText = '';
    const usingController = this.touchControlsUsed || this.gamepadConnected;
    if (this.isTutorial) {
      switch (this.tutorialStep) {
        case 'MOVE':
          tutorialProgressText = usingController
            ? 'Move the Left Stick into the green circle.'
            : 'Drive with Left Stick, WASD, or Arrow Keys into the green circle.';
          break;
        case 'SHOOT':
          tutorialProgressText = usingController
            ? 'Drag the Right Stick to aim and auto-shoot, or tap Fire.'
            : 'Drag Right Stick (or aim with mouse & Click) to shoot.';
          break;
        case 'COLLECT':
          tutorialProgressText = 'Pick up Gold Coins (Shop) and Green Gems (Tank Level Up).';
          break;
        case 'RADAR':
          tutorialProgressText = 'Follow the red dot on your top-right Mini Map and defeat the Fighter.';
          break;
        case 'STORE':
          tutorialProgressText = 'Buy a Gun or Upgrade in the Shop, then tap Start Level 1.';
          break;
        default:
          tutorialProgressText = '';
      }
    }

    return {
      phase: this.phase,
      level: this.currentLevel,
      levelName: this.levelConfig.name,
      wave: this.wave,
      totalWaves: this.levelConfig.totalWaves,
      isMegaBossLevel: this.levelConfig.isMegaBossLevel,
      isPowerUpgradeLevel: this.levelConfig.isPowerUpgradeLevel,
      powerTier: this.tank.powerTier,
      tankFormName: form.name,
      monstersRemaining: this.monsters.length + this.spawnQueue.length,
      interWaveTimer: Math.max(0, Math.ceil(this.interWaveTimer)),
      hp: Math.ceil(this.tank.hp),
      maxHp: this.tank.maxHp,
      gold: this.tank.gold,
      exp: this.tank.exp,
      expToNext: this.tank.expToNext,
      rpgLevel: this.tank.rpgLevel,
      activeWeapon: this.tank.activeWeapon,
      unlockedWeapons: [...this.tank.unlockedWeapons],
      weaponLevels: {
        cannon: { ...this.tank.weaponLevels.cannon },
        twin: { ...this.tank.weaponLevels.twin },
        shotgun: { ...this.tank.weaponLevels.shotgun },
        railgun: { ...this.tank.weaponLevels.railgun },
        plasma: { ...this.tank.weaponLevels.plasma },
      },
      chassis: { ...this.tank.chassis },
      bossActive: boss ? { name: boss.name, hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
      totalKills: this.totalKills,
      levelKills: this.levelKills,
      storeTier: this.getEffectiveStoreLevel(),
      isTutorial: this.isTutorial,
      tutorialStep: this.tutorialStep,
      tutorialProgressText,
      tutorialBoughtUpgrade: this.tutorialBoughtUpgrade,
      unlockedMaxLevel: this.unlockedMaxLevel,
      gamepadConnected: this.gamepadConnected,
    };
  }

  private pushHud(_force: boolean) {
    this.onHudUpdate(this.getSnapshot());
  }
}
