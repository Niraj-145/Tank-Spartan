export type GamePhase =
  | 'TITLE'
  | 'PLAYING'
  | 'INTER_WAVE_STORE'
  | 'PAUSED'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type TileType = 0 | 1 | 2 | 3 | 4 | 5;
// 0: Empty, 1: Brick (player destructible, monster indestructible), 2: Steel (indestructible),
// 3: Water (blocks movement, bullets pass), 4: Bush (cover), 5: Portal

export type WeaponId = 'cannon' | 'twin' | 'shotgun' | 'railgun' | 'plasma';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  shortName: string;
  description: string;
  unlockLevel: number;
  baseCost: number;
  baseDamage: number;
  cooldown: number; // seconds
  projectileSpeed: number;
  projectileRadius: number;
  pellets: number;
  spreadRad: number;
  pierce: number;
  splashRadius: number;
  brickDamage: number;
  color: string;
}

export type MonsterArchetype = 'fast' | 'strong' | 'high_hp' | 'spitter' | 'boss' | 'mega_boss';

export interface Monster {
  id: number;
  archetype: MonsterArchetype;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  contactDamage: number;
  rangedDamage: number;
  goldDrop: number;
  expDrop: number;
  color: string;
  accentColor: string;
  hitFlash: number;
  attackTimer: number;
  telegraphTimer: number;
  telegraphMax: number;
  telegraphKind: 'none' | 'radial' | 'dash' | 'bolt';
  dashVx: number;
  dashVy: number;
  dashTime: number;
  spawnAnim: number; // 0 -> 1
  facingAngle: number;
  stuckTimer: number;
  detourTimer: number;
  detourX: number;
  detourY: number;
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  brickDamage: number;
  pierceLeft: number;
  hitIds: Set<number>;
  splashRadius: number;
  color: string;
  life: number;
  isRail?: boolean;
}

export interface DropItem {
  id: number;
  kind: 'gold' | 'exp' | 'heal';
  x: number;
  y: number;
  value: number;
  life: number;
  bobPhase: number;
  magnetized: boolean;
}

export interface Portal {
  id: number;
  x: number;
  y: number;
  col: number;
  row: number;
  pulse: number;
  spawningFlash: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  ring?: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale?: number;
}

export interface PlayerTank {
  x: number;
  y: number;
  radius: number;
  dir: Direction;
  turretAngle: number;
  hp: number;
  maxHp: number;
  gold: number;
  exp: number;
  expToNext: number;
  rpgLevel: number;
  powerTier: number;
  activeWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  weaponLevels: Record<WeaponId, { damageLv: number; rateLv: number }>;
  chassis: {
    armorLv: number;
    engineLv: number;
    firepowerLv: number;
    magnetLv: number;
  };
  fireCooldown: number;
  invulnTimer: number;
  hitFlash: number;
  trackOffset: number;
  recoil: number;
}

export interface WaveDefinition {
  waveNumber: number;
  isBossWave: boolean;
  bossName?: string;
  spawns: { archetype: MonsterArchetype; count: number }[];
  spawnInterval: number;
}

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  bossName: string;
  isMegaBossLevel: boolean;
  isPowerUpgradeLevel: boolean;
  totalWaves: number;
  waves: WaveDefinition[];
  grid: TileType[][];
}

export type TutorialStepId =
  | 'MOVE'
  | 'SHOOT'
  | 'COLLECT'
  | 'RADAR'
  | 'STORE'
  | 'DONE';

export interface HudSnapshot {
  phase: GamePhase;
  level: number;
  levelName: string;
  wave: number;
  totalWaves: number;
  isMegaBossLevel: boolean;
  isPowerUpgradeLevel: boolean;
  powerTier: number;
  tankFormName: string;
  monstersRemaining: number;
  interWaveTimer: number;
  hp: number;
  maxHp: number;
  gold: number;
  exp: number;
  expToNext: number;
  rpgLevel: number;
  activeWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  weaponLevels: Record<WeaponId, { damageLv: number; rateLv: number }>;
  chassis: {
    armorLv: number;
    engineLv: number;
    firepowerLv: number;
    magnetLv: number;
  };
  bossActive: { name: string; hp: number; maxHp: number } | null;
  totalKills: number;
  levelKills: number;
  score: number;
  highScore: number;
  comboCount: number;
  comboTimer: number;
  comboMaxTime: number;
  scoreMultiplier: number;
  bestCombo: number;
  storeTier: number;
  isTutorial: boolean;
  tutorialStep: TutorialStepId;
  tutorialProgressText: string;
  tutorialBoughtUpgrade: boolean;
  unlockedMaxLevel: number;
  gamepadConnected: boolean;
}
