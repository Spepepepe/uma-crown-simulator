import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
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

/** ラーク判定に必要な未出走レース名（これが残っていなければラーク不要） */
const LARC_REQUIRED_NAMES = new Set(['凱旋門賞', 'ニエル賞', 'フォワ賞']);
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 指定ウマ娘の残レースから育成ローテーションパターン一覧を生成する
   *
   * Phase 1: スロット圧力によるパターン数決定
   * Phase 2: グリッドへの一括割り当て（スコアリングによる最良手選択）
   * Phase 3: パターン後処理（ラーク変換・シナリオ確定・因子計算）
   *
   * @param userId - 対象ユーザーの UUID
   * @param umamusumeId - 対象ウマ娘 ID
   * @returns 育成パターン配列と対象ウマ娘名
   * @throws {InternalServerErrorException} 登録ウマ娘が見つからない場合
   */
  async getRacePattern(userId: string, umamusumeId: number) {
    // --- Phase 1: データ取得 ---
    const registData = await this.prisma.registUmamusumeTable.findUnique({
      where: { user_id_umamusume_id: { user_id: userId, umamusume_id: umamusumeId } },
      include: { umamusume: true },
    });
    if (!registData) throw new InternalServerErrorException('登録ウマ娘が見つかりません');
    const umaData: UmamusumeRow = registData.umamusume;

    const registRaceRows = await this.prisma.registUmamusumeRaceTable.findMany({
      where: { user_id: userId, umamusume_id: umamusumeId },
      select: { race_id: true },
    });
    const registRaceIds = new Set(registRaceRows.map((r) => r.race_id));

    const allGRaces: RaceRow[] = await this.prisma.raceTable.findMany({
      where: { race_rank: { in: [1, 2, 3] } },
    });
    const remainingRacesAll = allGRaces.filter((r) => !registRaceIds.has(r.race_id));

    const scenarioRacesRaw = await this.prisma.scenarioRaceTable.findMany({
      where: { umamusume_id: umamusumeId },
      include: { race: true },
    });
    const scenarioRaces: ScenarioRaceRow[] = scenarioRacesRaw;

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
    const hasRemainingLarc = remainingRacesAll.some((r) => LARC_REQUIRED_NAMES.has(r.race_name));

    // シナリオレースIDセット（メイクラパターンへの誤配置を防ぐ）
    const scenarioRaceIds = new Set(scenarioRaces.map((sr) => sr.race.race_id));

    // シナリオレース・ラーク専用レースは通常割り当てから除外
    const racesToAssign = remainingRacesAll.filter(
      (r) =>
        !scenarioRaceIds.has(r.race_id) &&
        !(hasRemainingLarc && LARC_EXCLUSIVE_NAMES.has(r.race_name)),
    );

    // --- Phase 3: 必要パターン数の決定 ---
    const nMakera = calcRequiredMakeraCount(racesToAssign);
    const nTotal = nMakera + (hasScenario ? 1 : 0);

    // 伝説パターン: index 0（hasScenario のとき）
    // ラーク候補パターン: メイクラ先頭（hasScenario ? 1 : 0）
    const larcPatternIndex = hasRemainingLarc ? (hasScenario ? 1 : 0) : -1;

    // 因子戦略の割り当て（伝説パターンは null 固定、メイクラは循環）
    const strategies = getReinforcementStrategies(umaData, remainingRacesAll);
    const patternStrategies: (Record<string, number> | null)[] = Array.from(
      { length: nTotal },
      (_, i) => {
        if (hasScenario && i === 0) return null;
        const makeraIdx = hasScenario ? i - 1 : i;
        return strategies[makeraIdx % strategies.length];
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

    // --- Phase 5: スロット圧力計算・レースソート ---
    const pressure = calcSlotPressure(racesToAssign);

    const sortedRaces = [...racesToAssign].sort((a, b) => {
      const slotsA = getAvailableSlots(a);
      const slotsB = getAvailableSlots(b);
      // スロット自由度が低い（制約が厳しい）順
      if (slotsA.length !== slotsB.length) return slotsA.length - slotsB.length;
      // 同スロット数なら最大圧力が高い方を先に
      const maxPA = Math.max(
        ...slotsA.map((s) => pressure.get(sk(s.grade, s.month, s.half)) ?? 0),
      );
      const maxPB = Math.max(
        ...slotsB.map((s) => pressure.get(sk(s.grade, s.month, s.half)) ?? 0),
      );
      if (maxPA !== maxPB) return maxPB - maxPA;
      // G1優先
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
          if (isConsecutiveViolation(grid[pi], slotK, scenarioSlotSet)) continue;

          const score = calcAssignmentScore(
            pi, slot.grade, slot.month, slot.half, race,
            patternStrategies, grid[pi], scenarioSlotSet,
          );
          candidates.push({ patternIndex: pi, grade: slot.grade, month: slot.month, half: slot.half, score });
        }
      }

      if (candidates.length === 0) continue; // 収まらない場合はスキップ

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      grid[best.patternIndex].set(sk(best.grade, best.month, best.half), race);
    }

    // --- Phase 7: PatternData の構築とシナリオ仮決定 ---
    const patterns: PatternData[] = grid.map((patternGrid, pi) => {
      const pattern = buildPatternFromGrid(patternGrid);
      pattern.strategy = patternStrategies[pi];
      if (hasScenario && pi === 0) {
        pattern.scenario = '伝説';
      } else if (pi === larcPatternIndex) {
        pattern.scenario = 'ラーク候補'; // Phase 8 で確定
      } else {
        pattern.scenario = 'メイクラ';
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
        // ラーク専用レースを強制配置
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
        larcPattern.scenario = 'ラーク';
      } else {
        larcPattern.scenario = 'メイクラ';

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
      const isLarc = pattern.scenario === 'ラーク';
      const finalRaces = getAllRacesInPattern(pattern, allGRaces);
      calculateAndSetMainConditions(pattern, finalRaces);
      pattern.factors = calculateFactorComposition(
        umaData, finalRaces, pattern.strategy ?? null, isLarc,
      );
      pattern.totalRaces = finalRaces.length;
    }

    // レースが1件もないパターンは除外（余分なパターン数を抑制）
    const finalPatterns = patterns.filter((p) => (p.totalRaces ?? 0) > 0);
    return { patterns: finalPatterns, umamusumeName: umaData.umamusume_name };
  }
}
