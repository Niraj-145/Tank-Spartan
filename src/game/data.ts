import { LevelConfig, MonsterArchetype, TileType, WeaponDef, WeaponId } from './types';

export const TILE_SIZE = 40;
export const MAX_GAME_LEVEL = 100;
export const INTER_WAVE_SECONDS = 30;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    shortName: 'Cannon',
    description: 'Starter shot. Breaks brick walls.',
    unlockLevel: 1,
    baseCost: 0,
    baseDamage: 28,
    cooldown: 0.34,
    projectileSpeed: 560,
    projectileRadius: 5,
    pellets: 1,
    spreadRad: 0,
    pierce: 1,
    splashRadius: 0,
    brickDamage: 1,
    color: '#FBBF24',
  },
  twin: {
    id: 'twin',
    name: 'Double Gun',
    shortName: 'Double',
    description: 'Shoots 2 fast bullets. Stronger than Cannon.',
    unlockLevel: 5,
    baseCost: 130,
    baseDamage: 19,
    cooldown: 0.23,
    projectileSpeed: 640,
    projectileRadius: 4,
    pellets: 2,
    spreadRad: 0.04,
    pierce: 1,
    splashRadius: 0,
    brickDamage: 1,
    color: '#38BDF8',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    shortName: 'Shotgun',
    description: 'Blasts 5 heavy bullets. Stronger than Double Gun.',
    unlockLevel: 10,
    baseCost: 220,
    baseDamage: 22,
    cooldown: 0.46,
    projectileSpeed: 540,
    projectileRadius: 4,
    pellets: 5,
    spreadRad: 0.34,
    pierce: 1,
    splashRadius: 0,
    brickDamage: 1,
    color: '#FB923C',
  },
  railgun: {
    id: 'railgun',
    name: 'Laser Gun',
    shortName: 'Laser',
    description: 'High-power beam hitting 5 monsters. Stronger than Shotgun.',
    unlockLevel: 15,
    baseCost: 340,
    baseDamage: 115,
    cooldown: 0.35,
    projectileSpeed: 980,
    projectileRadius: 5,
    pellets: 1,
    spreadRad: 0,
    pierce: 5,
    splashRadius: 0,
    brickDamage: 2,
    color: '#22D3EE',
  },
  plasma: {
    id: 'plasma',
    name: 'Bomb Gun',
    shortName: 'Bomb',
    description: 'Strongest gun. Massive splash blast for groups & bosses.',
    unlockLevel: 20,
    baseCost: 480,
    baseDamage: 195,
    cooldown: 0.44,
    projectileSpeed: 480,
    projectileRadius: 7,
    pellets: 1,
    spreadRad: 0,
    pierce: 1,
    splashRadius: 104,
    brickDamage: 3,
    color: '#C084FC',
  },
};

export const WEAPON_ORDER: WeaponId[] = ['cannon', 'twin', 'shotgun', 'railgun', 'plasma'];

export interface MonsterBaseStats {
  name: string;
  baseHp: number;
  baseSpeed: number;
  baseContactDamage: number;
  baseRangedDamage: number;
  radius: number;
  goldDrop: number;
  expDrop: number;
  scoreValue: number;
  color: string;
  accentColor: string;
}

export const MONSTER_STATS: Record<MonsterArchetype, MonsterBaseStats> = {
  fast: {
    name: 'Runner',
    baseHp: 34,
    baseSpeed: 145,
    baseContactDamage: 13,
    baseRangedDamage: 0,
    radius: 13,
    goldDrop: 4,
    expDrop: 16,
    scoreValue: 100,
    color: '#F97316',
    accentColor: '#FED7AA',
  },
  strong: {
    name: 'Fighter',
    baseHp: 72,
    baseSpeed: 96,
    baseContactDamage: 20,
    baseRangedDamage: 17,
    radius: 16,
    goldDrop: 7,
    expDrop: 28,
    scoreValue: 180,
    color: '#EF4444',
    accentColor: '#FCA5A5',
  },
  high_hp: {
    name: 'Giant',
    baseHp: 155,
    baseSpeed: 68,
    baseContactDamage: 22,
    baseRangedDamage: 0,
    radius: 19,
    goldDrop: 10,
    expDrop: 42,
    scoreValue: 260,
    color: '#6366F1',
    accentColor: '#C7D2FE',
  },
  spitter: {
    name: 'Shooter',
    baseHp: 54,
    baseSpeed: 86,
    baseContactDamage: 13,
    baseRangedDamage: 16,
    radius: 15,
    goldDrop: 6,
    expDrop: 25,
    scoreValue: 140,
    color: '#A855F7',
    accentColor: '#E9D5FF',
  },
  boss: {
    name: 'Boss',
    baseHp: 590,
    baseSpeed: 108,
    baseContactDamage: 36,
    baseRangedDamage: 28,
    radius: 26,
    goldDrop: 38,
    expDrop: 180,
    scoreValue: 1000,
    color: '#DC2626',
    accentColor: '#FDE047',
  },
  mega_boss: {
    name: 'Super Boss',
    baseHp: 1180,
    baseSpeed: 118,
    baseContactDamage: 46,
    baseRangedDamage: 34,
    radius: 32,
    goldDrop: 85,
    expDrop: 420,
    scoreValue: 2500,
    color: '#991B1B',
    accentColor: '#38BDF8',
  },
};

export const COMBO_WINDOW_SECONDS = 3.6;

export function getComboMultiplier(comboCount: number): number {
  if (comboCount >= 20) return 5;
  if (comboCount >= 12) return 4;
  if (comboCount >= 7) return 3;
  if (comboCount >= 4) return 2;
  if (comboCount >= 2) return 1.5;
  return 1;
}

export function getLevelGoldEconomy(level: number): { dropChance: number; goldScale: number } {
  const safeLv = Math.max(1, Math.min(MAX_GAME_LEVEL, level));
  const isMegaBossLevel = safeLv % 10 === 0;
  // Tight per-level drop rate scaling with level difficulty — just enough needed to clear the level
  const dropChance = Math.min(0.94, 0.54 + (safeLv - 1) * 0.008);
  const baseScale = 1 + (safeLv - 1) * 0.075;
  const goldScale = isMegaBossLevel ? baseScale * 0.8 : baseScale;
  return { dropChance, goldScale };
}

export interface PowerTankForm {
  tier: number;
  name: string;
  hullColor: string;
  turretColor: string;
  trimColor: string;
  speedBonus: number;
  firepowerBonus: number;
  bonusHp: number;
}

const POWER_FORM_PALETTES = [
  { hull: '#EAB308', turret: '#CA8A04', trim: '#FEF08A' },
  { hull: '#38BDF8', turret: '#0284C7', trim: '#BAE6FD' },
  { hull: '#10B981', turret: '#059669', trim: '#A7F3D0' },
  { hull: '#F97316', turret: '#C2410C', trim: '#FED7AA' },
  { hull: '#A855F7', turret: '#7E22CE', trim: '#E9D5FF' },
  { hull: '#F43F5E', turret: '#BE123C', trim: '#FECDD3' },
  { hull: '#22D3EE', turret: '#0E7490', trim: '#CFFAFE' },
];

export function getPowerTankTier(level: number): number {
  return Math.floor(Math.max(1, level) / 5);
}

export function getPowerTankForm(powerTier: number): PowerTankForm {
  const palette = POWER_FORM_PALETTES[powerTier % POWER_FORM_PALETTES.length];
  const name = powerTier === 0 ? 'Tank Lv.1' : `Power Tank ${powerTier + 1}`;

  return {
    tier: powerTier,
    name,
    hullColor: palette.hull,
    turretColor: palette.turret,
    trimColor: palette.trim,
    speedBonus: powerTier * 0.06,
    firepowerBonus: powerTier * 0.16,
    bonusHp: powerTier * 45,
  };
}

// '.' = 0 Empty, '#' = 1 Brick, '@' = 2 Steel, '~' = 3 Water, '*' = 4 Bush, 'P' = 5 Portal
const charToTile = (c: string): TileType => {
  switch (c) {
    case '#':
      return 1;
    case '@':
      return 2;
    case '~':
      return 3;
    case '*':
      return 4;
    case 'P':
      return 5;
    default:
      return 0;
  }
};

export function parseMap(rows: string[]): TileType[][] {
  return rows.map((row) => row.split('').map(charToTile));
}

const LARGE_MAP_TEMPLATES: string[][] = [
  [
    '.....P..........P..........P......',
    '..................................',
    '..###...###...@@@@...###...###....',
    '..###...###..........###...###....',
    '........*................*........',
    '..@@....####..........####....@@..',
    '........#..#...~~~~...#..#........',
    '..###..........~~~~..........###..',
    '..###...@@..............@@...###..',
    '..............######..............',
    '.P.....*..................*.....P.',
    '.......##......@@@@......##.......',
    '..###..##................##..###..',
    '..###......~~~......~~~......###..',
    '...........~~~......~~~...........',
    '..@@...###..............###...@@..',
    '.......###...@@....@@...###.......',
    '..*...........######...........*..',
    '..####......................####..',
    '..####...###..........###...####..',
    '..................................',
    '..................................',
  ],
  [
    '...P............P............P....',
    '..................................',
    '..@@...####..........####...@@....',
    '.......####...@@@@...####.........',
    '..###.........*..*.........###....',
    '..###...~~~~........~~~~...###....',
    '........~~~~...##...~~~~..........',
    '..##...........##...........##....',
    '..##...@@..............@@...##....',
    'P..............@@................P',
    '......###..............###........',
    '..*...###...########...###...*....',
    '............#......#..............',
    '..###...@@............@@...###....',
    '..###.......~~~~~~~~.......###....',
    '............~~~~~~~~..............',
    '..@@...###............###...@@....',
    '.......###...######...###.........',
    '..###........................###..',
    '..###...@@............@@.....###..',
    '..................................',
    '..................................',
  ],
  [
    '......P........P........P.........',
    '..................................',
    '..###...@@....####....@@...###....',
    '..#.#.........#..#.........#.#....',
    '........###..........###..........',
    '.@..*...###...~~~~...###...*..@...',
    'P.............~~~~.............P..',
    '....@@....###......###....@@......',
    '..........###..@@..###............',
    '..###....................###......',
    '..###...*....######....*..###.....',
    '.............#....#...............',
    '..@@...~~~............~~~...@@....',
    '.......~~~....@@@@....~~~.........',
    '..###......................###....',
    '..###...###..........###...###....',
    '........###...*..*...###..........',
    '..@@.........######.........@@....',
    '......###..............###........',
    '......###..............###........',
    '..................................',
    '..................................',
  ],
  [
    '..P......P............P......P....',
    '..................................',
    '..@@...###...@@@@@@...###...@@....',
    '.......###............###.........',
    '..###.......*......*.......###....',
    '..###..@@..............@@..###....',
    '.......##...~~~~~~~~...##.........',
    '..##........~~~~~~~~........##....',
    '..##...###............###...##....',
    '.......###...@@@@@@...###.........',
    '..*..........................*....',
    '......####............####........',
    '..@@..#..#....####....#..#..@@....',
    '..............#..#................',
    '..###...~~............~~...###....',
    '..###...~~....@@@@....~~...###....',
    '..............*..*................',
    '..####...###........###...####....',
    '..####...###........###...####....',
    '..................................',
    '..................................',
    '..................................',
  ],
];

export const TUTORIAL_MAP_TEMPLATE: string[] = [
  '...........P............',
  '........................',
  '....###..........###....',
  '....###....@@....###....',
  '........................',
  '...........*............',
  '....@@............@@....',
  '........................',
  '......###......###......',
  '........................',
  '........................',
  '....###..........###....',
  '........................',
  '........................',
  '........................',
  '........................',
];

const SIMPLE_BOSS_NAMES = [
  'Gate Boss',
  'Iron Boss',
  'Fire Boss',
  'Dark Boss',
  'King Boss',
];

const MEGA_BOSS_NAMES = [
  'Super Boss 1',
  'Super Boss 2',
  'Super Boss 3',
  'Super Boss 4',
  'Super Boss 5',
  'Super Boss 6',
  'Super Boss 7',
  'Super Boss 8',
  'Super Boss 9',
  'Final Boss',
];

export function getLevelConfig(level: number): LevelConfig {
  const safeLv = Math.max(1, Math.min(MAX_GAME_LEVEL, level));
  const idx = (safeLv - 1) % SIMPLE_BOSS_NAMES.length;
  const isMegaBossLevel = safeLv % 10 === 0;
  const isPowerUpgradeLevel = safeLv % 5 === 0;
  const totalWaves = isMegaBossLevel ? 5 : 3;

  const bossName = isMegaBossLevel
    ? MEGA_BOSS_NAMES[((safeLv / 10) - 1) % MEGA_BOSS_NAMES.length]
    : SIMPLE_BOSS_NAMES[idx];

  const mapRows = LARGE_MAP_TEMPLATES[(safeLv - 1) % LARGE_MAP_TEMPLATES.length];
  const countScale = 1 + Math.min(2.0, (safeLv - 1) * 0.09);

  if (isMegaBossLevel) {
    return {
      level: safeLv,
      name: `Level ${safeLv}`,
      subtitle: '5 Waves · Super Boss',
      bossName,
      isMegaBossLevel: true,
      isPowerUpgradeLevel,
      totalWaves: 5,
      grid: parseMap(mapRows),
      waves: [
        {
          waveNumber: 1,
          isBossWave: false,
          spawnInterval: 1.5,
          spawns: [
            { archetype: 'fast', count: Math.round(5 * countScale) },
            { archetype: 'strong', count: Math.round(2 * countScale) },
          ],
        },
        {
          waveNumber: 2,
          isBossWave: false,
          spawnInterval: 1.4,
          spawns: [
            { archetype: 'fast', count: Math.round(4 * countScale) },
            { archetype: 'strong', count: Math.round(3 * countScale) },
            { archetype: 'spitter', count: Math.round(2 * countScale) },
          ],
        },
        {
          waveNumber: 3,
          isBossWave: false,
          spawnInterval: 1.35,
          spawns: [
            { archetype: 'strong', count: Math.round(3 * countScale) },
            { archetype: 'high_hp', count: Math.round(2 * countScale) },
            { archetype: 'spitter', count: Math.round(2 * countScale) },
          ],
        },
        {
          waveNumber: 4,
          isBossWave: false,
          spawnInterval: 1.3,
          spawns: [
            { archetype: 'fast', count: Math.round(4 * countScale) },
            { archetype: 'strong', count: Math.round(3 * countScale) },
            { archetype: 'high_hp', count: Math.round(3 * countScale) },
          ],
        },
        {
          waveNumber: 5,
          isBossWave: true,
          bossName,
          spawnInterval: 1.25,
          spawns: [
            { archetype: 'mega_boss', count: 1 },
            { archetype: 'boss', count: 2 },
          ],
        },
      ],
    };
  }

  return {
    level: safeLv,
    name: `Level ${safeLv}`,
    subtitle: isPowerUpgradeLevel ? 'Power Tank Level' : '3 Waves',
    bossName,
    isMegaBossLevel: false,
    isPowerUpgradeLevel,
    totalWaves: 3,
    grid: parseMap(mapRows),
    waves: [
      {
        waveNumber: 1,
        isBossWave: false,
        spawnInterval: Math.max(1.15, 1.7 - Math.min(0.5, (safeLv - 1) * 0.02)),
        spawns: [
          { archetype: 'fast', count: Math.round(4 * countScale) },
          { archetype: 'strong', count: Math.round(2 * countScale) },
          ...(safeLv >= 2 ? [{ archetype: 'spitter' as MonsterArchetype, count: Math.round(1 + countScale * 0.7) }] : []),
        ],
      },
      {
        waveNumber: 2,
        isBossWave: false,
        spawnInterval: Math.max(1.1, 1.55 - Math.min(0.45, (safeLv - 1) * 0.02)),
        spawns: [
          { archetype: 'fast', count: Math.round(4 * countScale) },
          { archetype: 'strong', count: Math.round(2 * countScale) },
          { archetype: 'high_hp', count: Math.round(2 * countScale) },
          { archetype: 'spitter', count: Math.round(2 * countScale) },
        ],
      },
      {
        waveNumber: 3,
        isBossWave: true,
        bossName,
        spawnInterval: Math.max(1.15, 1.5 - Math.min(0.35, (safeLv - 1) * 0.015)),
        spawns: [
          { archetype: 'boss', count: 1 },
          { archetype: 'fast', count: Math.round(2 * countScale) },
          { archetype: 'strong', count: Math.round(2 * countScale) },
        ],
      },
    ],
  };
}

export function getMaxUpgradeCap(gameLevel: number): number {
  return 4 + Math.floor((gameLevel - 1) * 1.2);
}

export function getWeaponUpgradeCost(base: number, currentLv: number): number {
  return Math.round(base * (1 + currentLv * 0.45));
}

export function getChassisUpgradeCost(kind: 'armor' | 'engine' | 'firepower' | 'magnet', currentLv: number): number {
  const baseMap = {
    armor: 75,
    engine: 70,
    firepower: 95,
    magnet: 55,
  };
  return Math.round(baseMap[kind] * Math.pow(1.36, currentLv));
}
