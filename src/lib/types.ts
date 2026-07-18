export type ShotStats = {
  total_shots: number;
  makes: number;
  fg_pct: number;
  two_pt_shots: number;
  two_pt_makes: number;
  three_pt_shots: number;
  three_pt_makes: number;
  fg3_pct: number;
  paint_shots: number;
  paint_makes: number;
  paint_pct: number;
  perimeter_shots: number;
  perimeter_makes: number;
  perimeter_pct: number;
  paint_share: number;
  perimeter_share: number;
  ppg_est: number;
  games: number;
  label: string;
};

export type Vec2 = { x: number; y: number };
export type Vec3 = [number, number, number];

export type Shot = {
  shotOrder: number;
  sequenceNumber: string | number | null;
  quarter: string | number | null;
  clock: string | null;
  made: boolean;
  text: string | null;
  espn: Vec2;
  halfcourt: Vec2;
  courtRight: Vec2;
  courtLeft: Vec2;
  /** Polyline points [x,y,z] release → left rim */
  arcLeft: Vec3[];
  shotDistance: number | null;
  zone: "paint" | "midrange" | "three" | string;
  isPaint: boolean;
  isPerimeter: boolean;
  isThree: boolean;
};

export type Game = {
  gameId: number;
  label: string;
  stats: ShotStats;
  shotCount: number;
  shots: Shot[];
};

export type PlayoffDataset = {
  meta: {
    player: string;
    season: number;
    exportedAt: string;
    source: string;
    gameCount: number;
    totalShots: number;
    leftRim: { x: number; y: number; z: number };
    rightRim: { x: number; y: number; z: number };
    courtLength: number;
    courtWidth: number;
  };
  fullPlayoffStats: ShotStats;
  games: Game[];
};
