import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GradeName } from '@uma-crown/shared';
import type {
  RaceRow,
  ScenarioRaceRow,
  UmamusumeRow,
  RaceSlotData,
  PatternData,
} from './race.types.js';

// ============================================================
// 定数
// ============================================================

const APTITUDE_MAP: Record<string, number> = {
  S: 4, A: 3, B: 2, C: 1, D: 0, E: -1, F: -2, G: -3,
};
const DISTANCE_MAP: Record<number, string> = {
  1: '短距離', 2: 'マイル', 3: '中距離', 4: '長距離',
};
const SURFACE_NAMES: Record<number, string> = { 0: '芝', 1: 'ダート' };
const DISTANCE_NAMES: Record<number, string> = {
  1: '短距離', 2: 'マイル', 3: '中距離', 4: '長距離',
};

/** ラーク候補パターンの通常割り当てから除外するレース名
 * 日本ダービーも含む（classic 5月後半はラーク強制配置スロットのため） */
const LARC_EXCLUSIVE_NAMES = new Set(['凱旋門賞', 'ニエル賞', 'フォワ賞', '宝塚記念', '日本ダービー']);
/** ラーク候補パターンに強制配置するレース定義 [grade, race_name, month, half] */
const LARC_MANDATORY: [GradeName, string, number, boolean][] = [
  ['classic', '日本ダービー', 5, true],
  ['classic', 'ニエル賞', 9, false],
  ['classic', '凱旋門賞', 10, false],
  ['senior', '宝塚記念', 6, true],
  ['senior', 'フォワ賞', 9, false],
  ['senior', '凱旋門賞', 10, false],
];

/** BC最終レースのスロット（全BCレース共通：シニア11月前半） */
const BC_FINAL_SLOT: { grade: GradeName; month: number; half: boolean } = {
  grade: 'senior', month: 11, half: false,
};

/**
 * BCシナリオ各最終レースへのルートで走る必要がある中間 G1/G2/G3 レース定義
 * [grade, race_name, month, half]
 */
const BC_MANDATORY: Record<string, [GradeName, string, number, boolean][]> = {
  'BCターフ': [
    ['junior',  'ホープフルステークス',               12, true],
    ['classic', '日本ダービー',                        5,  true],
    ['classic', 'ジャパンカップ',                      11, true],
    ['senior',  '宝塚記念',                            6,  true],
  ],
  'BCフィリー＆メアターフ': [
    ['junior',  '阪神ジュベナイルフィリーズ',          12, false],
    ['classic', 'オークス',                            5,  true],
    ['classic', 'エリザベス女王杯',                    11, false],
    ['senior',  'ヴィクトリアマイル',                  5,  false],
  ],
  'BCターフスプリント': [
    ['junior',  '京王杯ジュニアステークス',            11, false],
    ['classic', '葵ステークス',                        5,  true],
    ['classic', 'スプリンターズステークス',             9,  true],
    ['senior',  '高松宮記念',                          3,  true],
  ],
  'BCマイル': [
    ['junior',  '朝日杯フューチュリティステークス',    12, false],
    ['classic', 'NHKマイルカップ',                     5,  false],
    ['classic', 'マイルチャンピオンシップ',             11, true],
    ['senior',  '安田記念',                            6,  false],
  ],
  'BCスプリント': [
    ['junior',  'オキザリス賞',                        11, false],
    ['classic', '昇竜ステークス',                      3,  false],
    ['classic', 'JBCスプリント',                       11, false],
    ['senior',  '根岸ステークス',                      1,  true],
  ],
  'BCフィリー＆メアスプリント': [
    ['junior',  'オキザリス賞',                        11, false],
    ['classic', '昇竜ステークス',                      3,  false],
    ['classic', 'JBCスプリント',                       11, false],
    ['senior',  '根岸ステークス',                      1,  true],
  ],
  'BCダートマイル': [
    ['junior',  '全日本ジュニア優駿',                  12, true],
    ['classic', 'ユニコーンステークス',                 6,  true],
    ['classic', 'マイルチャンピオンシップ南部杯',       10, false],
    ['senior',  'フェブラリーステークス',               2,  true],
  ],
  'BCディスタフ': [
    ['junior',  '全日本ジュニア優駿',                  12, true],
    ['classic', '関東オークス',                        6,  false],
    ['classic', 'JBCレディスクラシック',               11, false],
    ['senior',  'TCK女王盃',                           1,  true],
  ],
  'BCクラシック': [
    ['junior',  '全日本ジュニア優駿',                  12, true],
    ['classic', 'ジャパンダートダービー',               7,  false],
    ['classic', 'JBCクラシック',                       11, false],
    ['senior',  '帝王賞',                              6,  true],
  ],
};

// ============================================================
// スロット線形順序（連続出走判定用）
// junior: 7月前〜12月後（index 0-11）
// classic: 1月前〜12月後（index 12-35）
// senior: 1月前〜12月後（index 36-59）
// ============================================================

const ORDERED_SLOTS: { grade: GradeName; month: number; half: boolean }[] = [];
for (let m = 7; m <= 12; m++) {
  ORDERED_SLOTS.push({ grade: 'junior', month: m, half: false });
  ORDERED_SLOTS.push({ grade: 'junior', month: m, half: true });
}
for (let m = 1; m <= 12; m++) {
  ORDERED_SLOTS.push({ grade: 'classic', month: m, half: false });
  ORDERED_SLOTS.push({ grade: 'classic', month: m, half: true });
}
for (let m = 1; m <= 12; m++) {
  ORDERED_SLOTS.push({ grade: 'senior', month: m, half: false });
  ORDERED_SLOTS.push({ grade: 'senior', month: m, half: true });
}

const SLOT_INDEX_MAP = new Map<string, number>();
ORDERED_SLOTS.forEach((s, i) => {
  SLOT_INDEX_MAP.set(`${s.grade}|${s.month}|${s.half}`, i);
});

// ============================================================
// 純粋ヘルパー関数
// ============================================================

/**
 * 適性ランク文字を数値スコアに変換する
 * @param char - 適性ランク文字 (S / A / B / C / D / E / F / G)
 * @returns 対応する数値スコア（S=4 〜 G=-3。不明の場合は 0）
 */
function getApt(char: string): number {
  return APTITUDE_MAP[char] ?? 0;
}

/**
 * 配列から k 個の組み合わせを列挙する
 * @param arr - 組み合わせの元となる配列
 * @param k - 選択する要素数（現在 k=2 のみサポート）
 * @returns k 個の要素からなる組み合わせ配列
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 2) {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        result.push([arr[i], arr[j]]);
      }
    }
    return result;
  }
  return [];
}

/**
 * レースが属する育成期カテゴリを返す
 * シナリオ固定レースの場合は `scenarioInfo.senior_flag` によりクラシック/シニアを判別する
 * @param race - 判定対象のレース行データ
 * @param scenarioInfo - シナリオ固定情報（通常レースの場合は省略可）
 * @returns 育成期カテゴリ ('junior' / 'classic' / 'senior')
 */
function getRaceGrade(race: RaceRow, scenarioInfo?: ScenarioRaceRow | null): GradeName {
  if (scenarioInfo) {
    if (scenarioInfo.senior_flag == null) {
      if (race.junior_flag) return 'junior';
      if (race.classic_flag) return 'classic';
      if (race.senior_flag) return 'senior';
    } else if (scenarioInfo.senior_flag === false) {
      return 'classic';
    } else {
      return 'senior';
    }
  }
  if (race.classic_flag) return 'classic';
  if (race.senior_flag) return 'senior';
  return 'junior';
}

/** スロットキー文字列を生成する */
function sk(grade: GradeName, month: number, half: boolean): string {
  return `${grade}|${month}|${half}`;
}

/** 線形インデックスからスロットキー文字列を取得する */
function skFromIdx(idx: number): string {
  const s = ORDERED_SLOTS[idx];
  return `${s.grade}|${s.month}|${s.half}`;
}

/** レースが走れるスロット一覧を返す（classic+senior 両方走れるなら両方返す） */
function getAvailableSlots(
  race: RaceRow,
): { grade: GradeName; month: number; half: boolean }[] {
  const slots: { grade: GradeName; month: number; half: boolean }[] = [];
  if (race.junior_flag) slots.push({ grade: 'junior', month: race.race_months, half: race.half_flag });
  if (race.classic_flag) slots.push({ grade: 'classic', month: race.race_months, half: race.half_flag });
  if (race.senior_flag) slots.push({ grade: 'senior', month: race.race_months, half: race.half_flag });
  return slots;
}

/** ラークシナリオで走行不可のスロットかどうか判定する */
function isLarcRestrictedSlot(grade: GradeName, month: number, half: boolean): boolean {
  if (grade === 'classic') {
    if (month === 5 && half) return true;  // 5月後半: 日本ダービー強制配置スロット
    if (month >= 7 && month <= 9) return true;
    if (month === 10 && !half) return true;
  }
  if (grade === 'senior') {
    if (month >= 7) return true;
    if (month === 6 && half) return true;
  }
  return false;
}

/**
 * BCシナリオで走行不可のスロットかどうか判定する
 * BC最終レース（シニア11月前半）より後のスロットは走れない
 */
function isBCRestrictedSlot(grade: GradeName, month: number, half: boolean): boolean {
  if (grade === 'senior') {
    if (month === 11 && half) return true; // 11月後半以降走行不可
    if (month === 12) return true;
  }
  return false;
}

/**
 * 指定スロットを含む連続出走長を返す（提案スロット含む）
 * シナリオレース（scenarioSlotSet）は連続カウントから除外する
 */
function getConsecutiveLength(
  patternGrid: Map<string, RaceRow>,
  proposedSk: string,
  scenarioSlotSet: Set<string>,
): number {
  const idx = SLOT_INDEX_MAP.get(proposedSk);
  if (idx === undefined) return 1;

  let runStart = idx;
  let i = idx - 1;
  while (i >= 0) {
    const key = skFromIdx(i);
    if (patternGrid.has(key) && !scenarioSlotSet.has(key)) { runStart = i; i--; }
    else break;
  }

  let runEnd = idx;
  i = idx + 1;
  while (i < ORDERED_SLOTS.length) {
    const key = skFromIdx(i);
    if (patternGrid.has(key) && !scenarioSlotSet.has(key)) { runEnd = i; i++; }
    else break;
  }

  return runEnd - runStart + 1;
}

/** 配置した場合に4連続出走になるか判定する */
function isConsecutiveViolation(
  patternGrid: Map<string, RaceRow>,
  proposedSk: string,
  scenarioSlotSet: Set<string>,
): boolean {
  return getConsecutiveLength(patternGrid, proposedSk, scenarioSlotSet) >= 4;
}

/** 全残レースのスロット圧力を計算する（各スロットのウェイト合計） */
function calcSlotPressure(races: RaceRow[]): Map<string, number> {
  const pressure = new Map<string, number>();
  for (const race of races) {
    const slots = getAvailableSlots(race);
    if (slots.length === 0) continue;
    const weight = 1 / slots.length;
    for (const slot of slots) {
      const key = sk(slot.grade, slot.month, slot.half);
      pressure.set(key, (pressure.get(key) ?? 0) + weight);
    }
  }
  return pressure;
}

/** 必要なメイクラパターン数を計算する（スロット最大圧力の切り上げ） */
function calcRequiredMakeraCount(racesToAssign: RaceRow[]): number {
  const pressure = calcSlotPressure(racesToAssign);
  let maxPressure = 0;
  for (const p of pressure.values()) {
    if (p > maxPressure) maxPressure = p;
  }
  return Math.max(1, Math.ceil(maxPressure));
}

/**
 * 割り当てスコアを計算する（高いほど優先）
 * 因子戦略マッチ(+4/+2) + 連続出走ペナルティ(-n) + G1優先(+3/+2/+1)
 */
function calcAssignmentScore(
  patternIndex: number,
  grade: GradeName,
  month: number,
  half: boolean,
  race: RaceRow,
  patternStrategies: (Record<string, number> | null)[],
  patternGrid: Map<string, RaceRow>,
  scenarioSlotSet: Set<string>,
): number {
  let score = 0;

  const strategy = patternStrategies[patternIndex];
  if (strategy) {
    const surface = race.race_state === 0 ? '芝' : 'ダート';
    const distance = DISTANCE_MAP[race.distance];
    const inStrat = (key: string) => key in strategy;
    if (inStrat(surface) && distance && inStrat(distance)) score += 4;
    else if (inStrat(surface) || (distance && inStrat(distance))) score += 2;
  }

  const consec = getConsecutiveLength(patternGrid, sk(grade, month, half), scenarioSlotSet);
  score -= consec;

  score += (4 - race.race_rank); // G1=3, G2=2, G3=1

  return score;
}

/** グリッドから PatternData を構築する（全スロットを出力） */
function buildPatternFromGrid(patternGrid: Map<string, RaceRow>): PatternData {
  const pattern: PatternData = { junior: [], classic: [], senior: [] };

  const gradeRanges: [GradeName, number, number][] = [
    ['junior', 7, 12],
    ['classic', 1, 12],
    ['senior', 1, 12],
  ];
  for (const [grade, startMonth, endMonth] of gradeRanges) {
    for (let month = startMonth; month <= endMonth; month++) {
      for (const half of [false, true]) {
        const race = patternGrid.get(sk(grade, month, half));
        pattern[grade].push({
          race_name: race?.race_name ?? '',
          race_id: race?.race_id ?? null,
          distance: race?.distance ?? null,
          race_state: race?.race_state ?? null,
          month,
          half,
        });
      }
    }
  }
  return pattern;
}

/** パターン内の全レースの RaceRow を取得する */
function getAllRacesInPattern(pattern: PatternData, allGRaces: RaceRow[]): RaceRow[] {
  const idMap = new Map(allGRaces.map((r) => [r.race_id, r]));
  const result: RaceRow[] = [];
  for (const gradeRaces of [pattern.junior, pattern.classic, pattern.senior]) {
    for (const rd of gradeRaces) {
      if (rd.race_id) {
        const obj = idMap.get(rd.race_id);
        if (obj) result.push(obj);
      }
    }
  }
  return result;
}

/** パターンの主馬場・主距離を集計してパターンに設定する */
function calculateAndSetMainConditions(pattern: PatternData, racesInPattern: RaceRow[]) {
  const surfCount: Record<number, number> = { 0: 0, 1: 0 };
  const distCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of racesInPattern) {
    surfCount[r.race_state]++;
    distCount[r.distance]++;
  }
  const maxKey = (obj: Record<number, number>, fallback: number) => {
    let mk = fallback;
    let mv = -1;
    for (const [k, v] of Object.entries(obj)) {
      if (v > mv) { mv = v; mk = Number(k); }
    }
    return mk;
  };
  const surf = Object.values(surfCount).some((v) => v > 0) ? maxKey(surfCount, 0) : 0;
  const dist = Object.values(distCount).some((v) => v > 0) ? maxKey(distCount, 1) : 1;
  pattern.surface = SURFACE_NAMES[surf];
  pattern.distance = DISTANCE_NAMES[dist];
}

/** 適性の低い属性を補強するための戦略候補リストを生成する */
function getReinforcementStrategies(
  uma: UmamusumeRow,
  remainingRaces: RaceRow[],
): (Record<string, number> | null)[] {
  const aptitudes: Record<string, number> = {
    '芝': getApt(uma.turf_aptitude),
    'ダート': getApt(uma.dirt_aptitude),
    '短距離': getApt(uma.sprint_aptitude),
    'マイル': getApt(uma.mile_aptitude),
    '中距離': getApt(uma.classic_aptitude),
    '長距離': getApt(uma.long_distance_aptitude),
  };
  const lowAptitudes = Object.entries(aptitudes).filter(([, v]) => v <= 0).map(([k]) => k);

  const raceCombinations = new Set<string>();
  for (const race of remainingRaces) {
    const surface = race.race_state === 0 ? '芝' : 'ダート';
    const distance = DISTANCE_MAP[race.distance];
    raceCombinations.add(`${surface}|${distance}`);
  }

  const strategies: Record<string, number>[] = [];
  if (lowAptitudes.length >= 2) {
    for (const combo of combinations(lowAptitudes, 2)) {
      let comboNeeded = false;
      for (const rc of raceCombinations) {
        const [surface, distance] = rc.split('|');
        if (combo.includes(surface) && combo.includes(distance)) { comboNeeded = true; break; }
      }
      if (comboNeeded) strategies.push({ [combo[0]]: 3, [combo[1]]: 3 });
    }
  }
  return strategies.length > 0 ? strategies : [null];
}

/**
 * BCシナリオ最終レースに向けた適性補修戦略を計算する
 *
 * ウマ娘の現在適性と BC 最終レースの馬場・距離を比較し、
 * C 適性（スコア=1）に到達するために必要な因子数を算出する。
 * 両適性が C 以上なら null（補修不要 = B パターン）を返す。
 *
 * @param bcRace - BC 最終レース (bc_flag=true のレース行)
 * @param uma - 対象ウマ娘の行データ
 * @returns 補修戦略オブジェクト（A パターン）または null（B パターン）
 */
function calcBCStrategy(bcRace: RaceRow, uma: UmamusumeRow): Record<string, number> | null {
  const surface = bcRace.race_state === 0 ? '芝' : 'ダート';
  const distance = DISTANCE_MAP[bcRace.distance];

  const surfaceAptChar = bcRace.race_state === 0 ? uma.turf_aptitude : uma.dirt_aptitude;
  const distanceAptChar = bcRace.distance === 1
    ? uma.sprint_aptitude
    : bcRace.distance === 2
      ? uma.mile_aptitude
      : bcRace.distance === 3
        ? uma.classic_aptitude
        : uma.long_distance_aptitude;

  const surfaceApt = getApt(surfaceAptChar);
  const distanceApt = getApt(distanceAptChar);

  // C 適性（スコア=1）に到達するために必要な段階数
  const surfaceNeeded = Math.max(0, 1 - surfaceApt);
  const distanceNeeded = Math.max(0, 1 - distanceApt);

  if (surfaceNeeded === 0 && distanceNeeded === 0) {
    return null; // B パターン: 補修不要
  }

  // A パターン: 補修が必要な因子を戦略として返す
  const strategy: Record<string, number> = {};
  if (surfaceNeeded > 0) strategy[surface] = surfaceNeeded;
  if (distanceNeeded > 0 && distance) strategy[distance] = distanceNeeded;
  return strategy;
}

/** パターンのレース構成と適性から推奨因子構成を計算する */
function calculateFactorComposition(
  uma: UmamusumeRow,
  patternRaces: RaceRow[],
  strategy: Record<string, number> | null = null,
  isLarc = false,
): string[] {
  const factors: string[] = [];
  let currentStrategy = strategy ? { ...strategy } : null;

  if (isLarc && currentStrategy) {
    currentStrategy = Object.fromEntries(
      Object.entries(currentStrategy).filter(([k]) => k !== '芝' && k !== '中距離'),
    );
    const aptData: Record<string, string> = {
      '芝': uma.turf_aptitude, 'ダート': uma.dirt_aptitude,
      '短距離': uma.sprint_aptitude, 'マイル': uma.mile_aptitude,
      '中距離': uma.classic_aptitude, '長距離': uma.long_distance_aptitude,
    };
    const temp: Record<string, number> = {};
    let total = 0;
    for (const [factor, num] of Object.entries(currentStrategy)) {
      const aptChar = aptData[factor] ?? 'A';
      let newNum = num;
      if (getApt(aptChar) <= -3) newNum = 3;
      if (total + newNum <= 6) { temp[factor] = newNum; total += newNum; }
      else if (total + num <= 6) { temp[factor] = num; total += num; }
    }
    currentStrategy = Object.keys(temp).length > 0 ? temp : null;
  }

  if (currentStrategy) {
    for (const [factor, num] of Object.entries(currentStrategy)) {
      for (let i = 0; i < num; i++) factors.push(factor);
    }
    while (factors.length < 6) factors.push('自由');
    return factors.slice(0, 6);
  }

  let turfApt = getApt(uma.turf_aptitude);
  let dirtApt = getApt(uma.dirt_aptitude);
  let sprintApt = getApt(uma.sprint_aptitude);
  let mileApt = getApt(uma.mile_aptitude);
  let classicApt = getApt(uma.classic_aptitude);
  let longApt = getApt(uma.long_distance_aptitude);

  if (isLarc) { turfApt = 3; classicApt = 3; }

  const surfUsage: Record<number, boolean> = { 0: false, 1: false };
  const distUsage: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
  for (const r of patternRaces) {
    surfUsage[r.race_state] = true;
    distUsage[r.distance] = true;
  }

  const toFix: [number, string][] = [];
  if (distUsage[4] && longApt <= 1) toFix.push([longApt, '長距離']);
  if (distUsage[3] && classicApt <= 1) toFix.push([classicApt, '中距離']);
  if (distUsage[2] && mileApt <= 1) toFix.push([mileApt, 'マイル']);
  if (distUsage[1] && sprintApt <= 1) toFix.push([sprintApt, '短距離']);
  if (surfUsage[1] && dirtApt <= 1) toFix.push([dirtApt, 'ダート']);
  if (surfUsage[0] && turfApt <= 1) toFix.push([turfApt, '芝']);
  toFix.sort((a, b) => a[0] - b[0]);

  const lowCount = toFix.filter(([apt]) => apt <= -1).length;
  for (const [aptitude, name] of toFix) {
    if (factors.length >= 6) break;
    if (factors.includes(name)) continue;
    let needed = 0;
    if (aptitude <= -1) needed = lowCount >= 2 ? 3 : 4;
    else if (aptitude === 0) needed = 3;
    else if (aptitude === 1) needed = 2;
    if (factors.length + needed <= 6) {
      for (let i = 0; i < needed; i++) factors.push(name);
    }
  }
  while (factors.length < 6) factors.push('自由');
  return factors.slice(0, 6);
}

// ============================================================
// メインサービス
// ============================================================

/**
 * 育成ローテーションパターン生成サービス
 *
 * ウマ娘の残レースをグリッドベース一括割り当てアルゴリズムで複数の育成パターンに分配し、
 * 適性・シナリオ制約・連続出走制限を考慮した最適なローテーションを生成する。
 *
 * @see {@link https://github.com/Spepepepe/uma-crown-simulator} README のアルゴリズム解説セクション
 */
@Injectable()
export class RacePatternService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(RacePatternService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * 指定ウマ娘の残レースから育成ローテーションパターン一覧を生成する
   *
   * Phase 1: データ取得
   * Phase 2: 事前準備（シナリオ・ラーク・BC 検出）
   * Phase 3: 必要パターン数の決定
   * Phase 4: グリッド初期化（シナリオ・BC最終・BC中間レースの初期配置）
   * Phase 5: スロット圧力計算・レースソート（初期配置済みを除外）
   * Phase 6: グリッドへの一括割り当て
   * Phase 6b: BC オーバーフロー処理
   * Phase 7: PatternData 構築・シナリオ仮決定
   * Phase 8: ラーク確定処理
   * Phase 9: 各パターン後処理（因子計算・主馬場距離集計）
   *
   * @param userId - 対象ユーザーの UUID
   * @param umamusumeId - 対象ウマ娘 ID
   * @returns 育成パターン配列と対象ウマ娘名
   * @throws {InternalServerErrorException} 登録ウマ娘が見つからない場合
   */
  async getRacePattern(userId: string, umamusumeId: number) {
    this.logger.info({ userId, umamusumeId }, 'パターン生成開始');

    // --- Phase 1: データ取得 ---
    const registData = await this.prisma.registUmamusumeTable.findUnique({
      where: { user_id_umamusume_id: { user_id: userId, umamusume_id: umamusumeId } },
      include: { umamusume: true },
    });
    if (!registData) {
      this.logger.error({ userId, umamusumeId }, '登録ウマ娘が見つかりません');
      throw new InternalServerErrorException('登録ウマ娘が見つかりません');
    }
    const umaData: UmamusumeRow = registData.umamusume;

    const registRaceRows = await this.prisma.registUmamusumeRaceTable.findMany({
      where: { user_id: userId, umamusume_id: umamusumeId },
      select: { race_id: true },
    });
    const registRaceIds = new Set(registRaceRows.map((r) => r.race_id));

    // G1/G2/G3 に加え、BC必須中間レース名（rank=4等）も取得する
    const bcMandatoryAllNames = Array.from(
      new Set(Object.values(BC_MANDATORY).flat().map(([, name]) => name)),
    );
    const allGRaces: RaceRow[] = await this.prisma.raceTable.findMany({
      where: {
        OR: [
          { race_rank: { in: [1, 2, 3] } },
          { race_name: { in: bcMandatoryAllNames } },
        ],
      },
    });
    const remainingRacesAll = allGRaces.filter((r) => !registRaceIds.has(r.race_id));

    const scenarioRacesRaw = await this.prisma.scenarioRaceTable.findMany({
      where: { umamusume_id: umamusumeId },
      include: { race: true },
    });
    const scenarioRaces: ScenarioRaceRow[] = scenarioRacesRaw;

    this.logger.debug(
      { umamusumeName: umaData.umamusume_name, remainingCount: remainingRacesAll.length, scenarioCount: scenarioRaces.length },
      'Phase 1 完了: データ取得',
    );

    if (remainingRacesAll.length === 0) {
      return { patterns: [], umamusumeName: umaData.umamusume_name };
    }

    // --- Phase 2: 事前準備 ---

    // シナリオレースのスロットセット（連続出走カウント除外・競合判定用）
    const scenarioSlotSet = new Set<string>();
    for (const sr of scenarioRaces) {
      const grade = getRaceGrade(sr.race, sr);
      scenarioSlotSet.add(sk(grade, sr.race.race_months, sr.race.half_flag));
    }

    const hasScenario = scenarioRaces.length > 0;
    // larc_flag でラーク残存を判定
    const hasRemainingLarc = remainingRacesAll.some((r) => r.larc_flag);
    // bc_flag でBC残存レースを抽出
    const remainingBCRaces = remainingRacesAll.filter((r) => r.bc_flag);
    const hasRemainingBC = remainingBCRaces.length > 0;

    // シナリオレースIDセット（誤配置防止）
    const scenarioRaceIds = new Set(scenarioRaces.map((sr) => sr.race.race_id));

    // シナリオレース・ラーク専用レース・BC最終レースは通常割り当てから除外
    // （BC中間レースはここでは除外しない — Phase 4 で pre-place 後に Phase 5 で除外）
    const racesToAssign = remainingRacesAll.filter(
      (r) =>
        !scenarioRaceIds.has(r.race_id) &&
        !(hasRemainingLarc && LARC_EXCLUSIVE_NAMES.has(r.race_name)) &&
        !r.bc_flag,
    );

    // --- Phase 3: 必要パターン数の決定 ---

    // BC残存時: 1BC最終レースにつき1パターン（メイクラ不要）
    // BC不在時: スロット圧力によるメイクラパターン数を計算
    const nBC = hasRemainingBC ? remainingBCRaces.length : 0;
    const nMakera = hasRemainingBC ? 0 : calcRequiredMakeraCount(racesToAssign);
    let nTotal = (hasScenario ? 1 : 0) + (hasRemainingLarc ? 1 : 0) + (hasRemainingBC ? nBC : nMakera);

    // パターンインデックス定義
    const larcPatternIndex = hasRemainingLarc ? (hasScenario ? 1 : 0) : -1;
    const bcPatternStartIndex = (hasScenario ? 1 : 0) + (hasRemainingLarc ? 1 : 0);

    // BC最終レースを補修アリ(A)→補修ナシ(B)の順にソート
    const sortedBCRaces = hasRemainingBC
      ? [...remainingBCRaces].sort((a, b) => {
          const stratA = calcBCStrategy(a, umaData);
          const stratB = calcBCStrategy(b, umaData);
          if (stratA && !stratB) return -1; // A（補修あり）優先
          if (!stratA && stratB) return 1;
          return 0;
        })
      : [];

    this.logger.debug(
      { nBC, nMakera, nTotal, hasScenario, hasRemainingLarc, hasRemainingBC },
      'Phase 3 完了: パターン数決定',
    );

    // 因子戦略の割り当て
    const strategies = getReinforcementStrategies(umaData, remainingRacesAll);
    const patternStrategies: (Record<string, number> | null)[] = Array.from(
      { length: nTotal },
      (_, i) => {
        if (hasScenario && i === 0) return null;
        if (hasRemainingBC && i >= bcPatternStartIndex) {
          const bcIdx = i - bcPatternStartIndex;
          return sortedBCRaces[bcIdx] ? calcBCStrategy(sortedBCRaces[bcIdx], umaData) : null;
        }
        const nonScenarioIdx = hasScenario ? i - 1 : i;
        return strategies[nonScenarioIdx % strategies.length];
      },
    );

    // --- Phase 4: グリッド初期化 ---
    const grid: Map<string, RaceRow>[] = Array.from({ length: nTotal }, () => new Map());

    // 伝説パターンにシナリオレースを初期配置
    if (hasScenario) {
      for (const sr of scenarioRaces) {
        const grade = getRaceGrade(sr.race, sr);
        grid[0].set(sk(grade, sr.race.race_months, sr.race.half_flag), sr.race);
      }
    }

    // BC パターンに各 BC 最終レースを初期配置（シニア11月前半）
    if (hasRemainingBC) {
      const bcFinalSlotKey = sk(BC_FINAL_SLOT.grade, BC_FINAL_SLOT.month, BC_FINAL_SLOT.half);
      for (let i = 0; i < sortedBCRaces.length; i++) {
        grid[bcPatternStartIndex + i].set(bcFinalSlotKey, sortedBCRaces[i]);
      }
    }

    // BC パターンに各ルートの中間レース（BC_MANDATORY）を初期配置
    // 同じ中間レースが複数の BC パターンに必要な場合は全パターンに配置する
    // （異なる育成計画として同じレースを走る可能性があるため）
    const bcMandatoryPrePlacedIds = new Set<number>();
    if (hasRemainingBC) {
      for (let i = 0; i < sortedBCRaces.length; i++) {
        const pi = bcPatternStartIndex + i;
        const bcFinalName = sortedBCRaces[i].race_name;
        const mandatory = BC_MANDATORY[bcFinalName] ?? [];

        for (const [grade, raceName, month, half] of mandatory) {
          const slotK = sk(grade, month, half);
          if (grid[pi].has(slotK)) continue; // スロット既に占有

          const race = remainingRacesAll.find((r) => r.race_name === raceName);
          if (!race) continue; // 既に勝利済み

          grid[pi].set(slotK, race);
          bcMandatoryPrePlacedIds.add(race.race_id);
        }
      }
    }

    // --- Phase 5: スロット圧力計算・レースソート ---
    // BC中間レースは Phase 4 で配置済みのため sortedRaces から除外する
    const pressure = calcSlotPressure(racesToAssign);

    const sortedRaces = [...racesToAssign]
      .filter((r) => r.race_id != null && !bcMandatoryPrePlacedIds.has(r.race_id))
      .sort((a, b) => {
        const slotsA = getAvailableSlots(a);
        const slotsB = getAvailableSlots(b);
        if (slotsA.length !== slotsB.length) return slotsA.length - slotsB.length;
        const maxPA = Math.max(
          ...slotsA.map((s) => pressure.get(sk(s.grade, s.month, s.half)) ?? 0),
        );
        const maxPB = Math.max(
          ...slotsB.map((s) => pressure.get(sk(s.grade, s.month, s.half)) ?? 0),
        );
        if (maxPA !== maxPB) return maxPB - maxPA;
        return a.race_rank - b.race_rank;
      });

    // --- Phase 6: グリッドへの一括割り当て ---
    for (const race of sortedRaces) {
      const availableSlots = getAvailableSlots(race);
      const candidates: {
        patternIndex: number;
        grade: GradeName;
        month: number;
        half: boolean;
        score: number;
      }[] = [];

      for (const slot of availableSlots) {
        const slotK = sk(slot.grade, slot.month, slot.half);
        for (let pi = 0; pi < nTotal; pi++) {
          if (grid[pi].has(slotK)) continue;
          if (pi === larcPatternIndex && isLarcRestrictedSlot(slot.grade, slot.month, slot.half)) continue;
          // BC パターンは BC最終レース（シニア11月前半）より後のスロットには配置不可
          if (hasRemainingBC && pi >= bcPatternStartIndex && isBCRestrictedSlot(slot.grade, slot.month, slot.half)) continue;
          if (isConsecutiveViolation(grid[pi], slotK, scenarioSlotSet)) continue;

          const score = calcAssignmentScore(
            pi, slot.grade, slot.month, slot.half, race,
            patternStrategies, grid[pi], scenarioSlotSet,
          );
          candidates.push({ patternIndex: pi, grade: slot.grade, month: slot.month, half: slot.half, score });
        }
      }

      if (candidates.length === 0) {
        this.logger.debug({ raceName: race.race_name }, 'Phase 6: 候補スロットなし、スキップ');
        continue;
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      grid[best.patternIndex].set(sk(best.grade, best.month, best.half), race);
    }

    // --- Phase 6b: BC オーバーフロー処理 ---
    if (hasRemainingBC) {
      const assignedRaceIds = new Set<number>();
      for (const g of grid) {
        for (const r of g.values()) {
          if (r.race_id != null) assignedRaceIds.add(r.race_id);
        }
      }
      let unassigned = sortedRaces.filter(
        (r) => r.race_id != null && !assignedRaceIds.has(r.race_id),
      );

      let overflowCycleIdx = 0;
      const maxOverflowPatterns = sortedBCRaces.length * 3;
      const bcFinalSlotKey = sk(BC_FINAL_SLOT.grade, BC_FINAL_SLOT.month, BC_FINAL_SLOT.half);

      while (unassigned.length > 0 && overflowCycleIdx < maxOverflowPatterns) {
        const newBCFinal = sortedBCRaces[overflowCycleIdx % sortedBCRaces.length];
        overflowCycleIdx++;

        const newGrid = new Map<string, RaceRow>();
        newGrid.set(bcFinalSlotKey, newBCFinal);

        // BC_MANDATORY 中間レースも追加パターンに配置
        const mandatory = BC_MANDATORY[newBCFinal.race_name] ?? [];
        for (const [grade, raceName, month, half] of mandatory) {
          const slotK = sk(grade, month, half);
          if (newGrid.has(slotK)) continue;
          const race = remainingRacesAll.find((r) => r.race_name === raceName);
          if (race) newGrid.set(slotK, race);
        }

        grid.push(newGrid);
        const newStrategy = calcBCStrategy(newBCFinal, umaData);
        patternStrategies.push(newStrategy);
        nTotal++;

        const stillUnassigned: RaceRow[] = [];
        for (const race of unassigned) {
          let placed = false;
          for (const slot of getAvailableSlots(race)) {
            const slotK = sk(slot.grade, slot.month, slot.half);
            if (newGrid.has(slotK)) continue;
            if (isBCRestrictedSlot(slot.grade, slot.month, slot.half)) continue;
            if (isConsecutiveViolation(newGrid, slotK, scenarioSlotSet)) continue;
            newGrid.set(slotK, race);
            placed = true;
            break;
          }
          if (!placed) stillUnassigned.push(race);
        }
        unassigned = stillUnassigned;

        this.logger.debug(
          { overflowCycleIdx, bcFinalName: newBCFinal.race_name, remainingCount: unassigned.length },
          'Phase 6b: BCオーバーフローパターン追加',
        );
      }

      if (unassigned.length > 0) {
        this.logger.warn(
          { count: unassigned.length },
          'Phase 6b: オーバーフロー上限に達したため一部レースを未割り当てのまま終了',
        );
      }
    }

    // --- Phase 7: PatternData の構築とシナリオ仮決定 ---
    const patterns: PatternData[] = grid.map((patternGrid, pi) => {
      const pattern = buildPatternFromGrid(patternGrid);
      pattern.strategy = patternStrategies[pi] ?? null;
      if (hasScenario && pi === 0) {
        pattern.scenario = 'legend';
      } else if (pi === larcPatternIndex) {
        pattern.scenario = 'larc'; // Phase 8 で確定
      } else if (hasRemainingBC) {
        pattern.scenario = 'bc';
      } else {
        pattern.scenario = 'makura';
      }
      return pattern;
    });

    // --- Phase 8: ラーク確定処理 ---
    if (larcPatternIndex >= 0) {
      const larcPattern = patterns[larcPatternIndex];
      const larcGrid = grid[larcPatternIndex];

      const classicBlocked = larcPattern.classic.some(
        (r: RaceSlotData) => r.race_name && ([7, 8, 9].includes(r.month) || (r.month === 10 && !r.half)),
      );
      const seniorBlocked = larcPattern.senior.some(
        (r: RaceSlotData) => r.race_name && (r.month >= 7 || (r.month === 6 && r.half)),
      );
      const larcConflict = larcPattern.classic.some(
        (r: RaceSlotData) => r.month === 5 && r.half && r.race_name && r.race_name !== '日本ダービー',
      );

      if (!classicBlocked && !seniorBlocked && !larcConflict) {
        for (const [grade, name, month, half] of LARC_MANDATORY) {
          const slotK = sk(grade, month, half);
          if (!larcGrid.has(slotK)) {
            const larcRace = allGRaces.find(
              (r) => r.race_name === name && r.race_months === month && r.half_flag === half,
            );
            if (larcRace) {
              larcGrid.set(slotK, larcRace);
              const slot = (larcPattern[grade] as RaceSlotData[]).find(
                (s) => s.month === month && s.half === half,
              );
              if (slot) {
                slot.race_name = larcRace.race_name;
                slot.race_id = larcRace.race_id;
                slot.distance = larcRace.distance;
                slot.race_state = larcRace.race_state;
              }
            }
          }
        }
        larcPattern.scenario = 'larc';
        this.logger.info({ umamusumeId }, 'Phase 8: ラーク確定');
      } else {
        larcPattern.scenario = 'makura';
        this.logger.info({ umamusumeId }, 'Phase 8: ラーク不成立、メイクラに変更');

        // --- Phase 8b: ラーク失敗時 — 専用レースを他パターンに救済配置 ---
        const orphanRaces = remainingRacesAll.filter((r) => LARC_EXCLUSIVE_NAMES.has(r.race_name));
        for (const race of orphanRaces) {
          let placed = false;
          for (const slot of getAvailableSlots(race)) {
            if (placed) break;
            const slotK = sk(slot.grade, slot.month, slot.half);
            for (let pi = 0; pi < nTotal; pi++) {
              if (grid[pi].has(slotK)) continue;
              if (isConsecutiveViolation(grid[pi], slotK, scenarioSlotSet)) continue;
              grid[pi].set(slotK, race);
              const gradeList = patterns[pi][slot.grade] as RaceSlotData[];
              const slotData = gradeList.find((s) => s.month === slot.month && s.half === slot.half);
              if (slotData) {
                slotData.race_name = race.race_name;
                slotData.race_id = race.race_id;
                slotData.distance = race.distance;
                slotData.race_state = race.race_state;
              }
              placed = true;
              break;
            }
          }
        }
      }
    }

    // --- Phase 9: 各パターンの後処理 ---
    for (const pattern of patterns) {
      const isLarc = pattern.scenario === 'larc';
      const finalRaces = getAllRacesInPattern(pattern, allGRaces);
      calculateAndSetMainConditions(pattern, finalRaces);
      pattern.factors = calculateFactorComposition(
        umaData, finalRaces, pattern.strategy ?? null, isLarc,
      );
      pattern.totalRaces = finalRaces.length;
    }

    const finalPatterns = patterns.filter((p) => (p.totalRaces ?? 0) > 0);

    this.logger.info(
      { umamusumeName: umaData.umamusume_name, patternCount: finalPatterns.length },
      'パターン生成完了',
    );
    return { patterns: finalPatterns, umamusumeName: umaData.umamusume_name };
  }
}
