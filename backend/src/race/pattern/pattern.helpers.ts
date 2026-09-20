// =============================================
// race-pattern 専用ヘルパー関数
// race-pattern.service.ts から分離した純粋関数群
// =============================================

import type { GradeName } from '@uma-crown/shared';
import type {
  RaceRow,
  UmamusumeRow,
  PatternData,
  AptitudeState,
} from '../race.types.js';
import {
  APTITUDE_MAP,
  SURFACE_NAMES,
  DISTANCE_NAMES,
  ORDERED_SLOTS,
  SLOT_INDEX_MAP,
  RANK_ORDER,
} from './pattern.constants.js';

// ============================================================
// 適性スコア変換
// ============================================================

/**
 * 適性ランク文字を数値スコアに変換する
 * @param char - 適性ランク文字 (S / A / B / C / D / E / F / G)
 * @returns 対応する数値スコア（S=4 〜 G=-3。不明の場合は 0）
 */
export function getApt(char: string): number {
  return APTITUDE_MAP[char] ?? 0;
}

// ============================================================
// スロットキー生成
// ============================================================

/**
 * スロットキー文字列を生成する
 * @param grade - 育成期カテゴリ ('junior' / 'classic' / 'senior')
 * @param month - 月（1〜12）
 * @param half - 後半フラグ（false=前半, true=後半）
 * @returns `"grade|month|half"` 形式のキー文字列
 */
export function sk(grade: GradeName, month: number, half: boolean): string {
  return `${grade}|${month}|${half}`;
}

/**
 * ORDERED_SLOTS の線形インデックスからスロットキー文字列を取得する
 * @param idx - ORDERED_SLOTS のインデックス
 * @returns `"grade|month|half"` 形式のキー文字列
 */
export function skFromIdx(idx: number): string {
  const s = ORDERED_SLOTS[idx];
  return `${s.grade}|${s.month}|${s.half}`;
}

// ============================================================
// スロット判定
// ============================================================

/**
 * レースが走れるスロット一覧を返す（classic と senior の両方に出走できるレースは両方返す）
 * @param race - 対象レース行データ
 * @returns 走れるスロット（grade / month / half）の配列
 */
export function getAvailableSlots(
  race: RaceRow,
): { grade: GradeName; month: number; half: boolean }[] {
  const slots: { grade: GradeName; month: number; half: boolean }[] = [];
  if (race.junior_flag)
    slots.push({
      grade: 'junior',
      month: race.race_months,
      half: race.half_flag,
    });
  if (race.classic_flag)
    slots.push({
      grade: 'classic',
      month: race.race_months,
      half: race.half_flag,
    });
  if (race.senior_flag)
    slots.push({
      grade: 'senior',
      month: race.race_months,
      half: race.half_flag,
    });
  return slots;
}

/** ラーク classic 期の走行不可判定 */
function isLarcRestrictedClassic(month: number, half: boolean): boolean {
  if (month === 5 && half) return true; // 5月後半: 日本ダービー強制配置スロット
  if (month >= 7 && month <= 9) return true;
  return month === 10 && !half;
}

/** ラーク senior 期の走行不可判定 */
function isLarcRestrictedSenior(month: number, half: boolean): boolean {
  if (month >= 7) return true;
  return month === 6 && half;
}

/**
 * ラークシナリオで走行不可のスロットかどうか判定する
 * classic の 5月後半・7〜9月・10月前半、および senior の 6月後半以降は走行不可
 * @param grade - 育成期カテゴリ
 * @param month - 月（1〜12）
 * @param half - 後半フラグ
 * @returns 走行不可の場合 true
 */
export function isLarcRestrictedSlot(
  grade: GradeName,
  month: number,
  half: boolean,
): boolean {
  if (grade === 'classic') return isLarcRestrictedClassic(month, half);
  if (grade === 'senior') return isLarcRestrictedSenior(month, half);
  return false;
}

/**
 * BCシナリオで走行不可のスロットかどうか判定する
 * BC最終レース（シニア11月前半）より後のスロットは走れない
 * @param grade - 育成期カテゴリ
 * @param month - 月（1〜12）
 * @param _half - 後半フラグ（BC判定では未使用。スロット判定関数のシグネチャ統一のため受け取る）
 * @returns 走行不可の場合 true
 */
export function isBCRestrictedSlot(
  grade: GradeName,
  month: number,
  _half: boolean,
): boolean {
  if (grade === 'senior') {
    if (month === 11) return true; // BC最終レース配置スロット(11月前半)および11月後半は割り当て不可
    if (month === 12) return true;
  }
  return false;
}

// ============================================================
// 連続出走チェック
// ============================================================

/**
 * 指定スロットを含む連続出走ブロックの長さを返す
 * patternGrid に登録済みのスロットと提案スロットをまとめて連続判定する
 * @param patternGrid - 現在のパターングリッド
 * @param proposedSk - 追加を検討しているスロットのキー文字列
 * @returns 提案スロットを含む連続出走の長さ（スロット数）
 */
export function getConsecutiveLength(
  patternGrid: Map<string, RaceRow>,
  proposedSk: string,
): number {
  const idx = SLOT_INDEX_MAP.get(proposedSk);
  if (idx === undefined) return 1;

  let runStart = idx;
  let i = idx - 1;
  while (i >= 0) {
    const key = skFromIdx(i);
    if (patternGrid.has(key)) {
      runStart = i;
      i--;
    } else break;
  }

  let runEnd = idx;
  i = idx + 1;
  while (i < ORDERED_SLOTS.length) {
    const key = skFromIdx(i);
    if (patternGrid.has(key)) {
      runEnd = i;
      i++;
    } else break;
  }

  return runEnd - runStart + 1;
}

/**
 * 配置した場合に 4 連続出走になるかどうか判定する
 * @param patternGrid - 現在のパターングリッド
 * @param proposedSk - 追加を検討しているスロットのキー文字列
 * @returns 4 連続以上になる場合 true
 */
export function isConsecutiveViolation(
  patternGrid: Map<string, RaceRow>,
  proposedSk: string,
): boolean {
  return getConsecutiveLength(patternGrid, proposedSk) >= 4;
}

// ============================================================
// パターンデータ構築
// ============================================================

/** 空スロットのデフォルトエントリ */
function emptySlotEntry(month: number, half: boolean) {
  return {
    race_name: '',
    race_id: null,
    distance: null,
    race_state: null,
    race_rank: null,
    month,
    half,
  };
}

/** グリッドの1スロットからパターンデータの1エントリを生成する */
function buildSlotEntry(
  patternGrid: Map<string, RaceRow>,
  grade: GradeName,
  month: number,
  half: boolean,
) {
  const race = patternGrid.get(sk(grade, month, half));
  if (!race) return emptySlotEntry(month, half);
  return {
    race_name: race.race_name,
    race_id: race.race_id,
    distance: race.distance,
    race_state: race.race_state,
    race_rank: race.race_rank,
    month,
    half,
  };
}

/**
 * グリッドから PatternData を構築する（全スロットを出力）
 * @param patternGrid - レースが配置されたスロットのグリッド
 * @returns 全スロット（空スロットは空文字列）を含む PatternData
 */
export function buildPatternFromGrid(
  patternGrid: Map<string, RaceRow>,
): PatternData {
  const pattern: PatternData = { junior: [], classic: [], senior: [] };

  const gradeRanges: [GradeName, number, number][] = [
    ['junior', 7, 12],
    ['classic', 1, 12],
    ['senior', 1, 12],
  ];
  for (const [grade, startMonth, endMonth] of gradeRanges) {
    for (let month = startMonth; month <= endMonth; month++) {
      for (const half of [false, true]) {
        pattern[grade].push(buildSlotEntry(patternGrid, grade, month, half));
      }
    }
  }
  return pattern;
}

/**
 * パターン内の全レースに対応する RaceRow を取得する
 * @param pattern - 対象の育成パターンデータ
 * @param allGRaces - 全 G1/G2/G3 レースの RaceRow 配列
 * @returns パターン内に含まれるレースの RaceRow 配列
 */
export function getAllRacesInPattern(
  pattern: PatternData,
  allGRaces: RaceRow[],
): RaceRow[] {
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

/**
 * パターンの主馬場・主距離を集計してパターンに設定する
 * 最も出走数の多い馬場・距離区分を `pattern.surface` / `pattern.distance` に設定する
 * @param pattern - 更新対象のパターンデータ
 * @param racesInPattern - パターン内の全レース RaceRow 配列
 */
export function calculateAndSetMainConditions(
  pattern: PatternData,
  racesInPattern: RaceRow[],
) {
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
      if (v > mv) {
        mv = v;
        mk = Number(k);
      }
    }
    return mk;
  };
  const surf = Object.values(surfCount).some((v) => v > 0)
    ? maxKey(surfCount, 0)
    : 0;
  const dist = Object.values(distCount).some((v) => v > 0)
    ? maxKey(distCount, 1)
    : 1;
  pattern.surface = SURFACE_NAMES[surf];
  pattern.distance = DISTANCE_NAMES[dist];
}

// ============================================================
// 適性・戦略計算
// ============================================================

/** レースの馬場適性スコアを取得する */
function getSurfaceApt(race: RaceRow, uma: UmamusumeRow): number {
  return race.race_state === 0
    ? getApt(uma.turf_aptitude)
    : getApt(uma.dirt_aptitude);
}

/** レースの距離適性スコアを取得する */
function getDistanceApt(race: RaceRow, uma: UmamusumeRow): number {
  const aptitudes = [
    uma.sprint_aptitude,
    uma.mile_aptitude,
    uma.classic_aptitude,
    uma.long_distance_aptitude,
  ];
  return getApt(aptitudes[race.distance - 1]);
}

/** レースの馬場名を取得する */
function getSurfaceName(race: RaceRow): string {
  return race.race_state === 0 ? '芝' : 'ダート';
}

/** レースの距離に対応する AptitudeState キーを取得する */
const DIST_KEYS: (keyof AptitudeState)[] = [
  'sprint',
  'mile',
  'classic',
  'long',
];

/** レースの馬場に対応する AptitudeState キーを取得する */
function surfKeyOf(race: RaceRow): keyof AptitudeState {
  return race.race_state === 0 ? 'turf' : 'dirt';
}

/** BC最終・中間レースに必要な因子数を属性ごとに集計する */
function collectNeededFactors(
  bcRace: RaceRow,
  uma: UmamusumeRow,
  mandatoryRaces: RaceRow[],
): Record<string, number> {
  const needed: Record<string, number> = {};

  // BC最終レース: C（スコア=1）到達が閾値
  const bcSurfNeeded = Math.max(0, 1 - getSurfaceApt(bcRace, uma));
  const bcDistNeeded = Math.max(0, 1 - getDistanceApt(bcRace, uma));
  if (bcSurfNeeded > 0) needed[getSurfaceName(bcRace)] = bcSurfNeeded;
  if (bcDistNeeded > 0) needed[DISTANCE_NAMES[bcRace.distance]] = bcDistNeeded;

  // 中間必須レース: D（スコア=0）到達が閾値（走れる最低ライン）
  for (const race of mandatoryRaces) {
    const rSurface = getSurfaceName(race);
    const rDistance = DISTANCE_NAMES[race.distance];
    const surfNeeded = Math.max(0, -getSurfaceApt(race, uma));
    const distNeeded = Math.max(0, -getDistanceApt(race, uma));
    if (surfNeeded > 0)
      needed[rSurface] = Math.max(needed[rSurface] ?? 0, surfNeeded);
    if (distNeeded > 0)
      needed[rDistance] = Math.max(needed[rDistance] ?? 0, distNeeded);
  }

  return needed;
}

/** 必要因子数を優先属性順に戦略マップへ変換する（各属性上限3枚・合計6枚） */
function buildStrategyFromNeeded(
  needed: Record<string, number>,
  priorityKeys: string[],
): Record<string, number> {
  const strategy: Record<string, number> = {};
  let total = 0;

  for (const key of priorityKeys) {
    if (!needed[key]) continue;
    const v = Math.min(needed[key], 3);
    strategy[key] = v;
    total += v;
    delete needed[key];
  }
  for (const [key, val] of Object.entries(needed)) {
    if (total >= 6) break;
    const v = Math.min(val, 3, 6 - total);
    if (v > 0) {
      strategy[key] = v;
      total += v;
    }
  }

  return strategy;
}

/**
 * BCシナリオ最終レースおよび中間必須レースに向けた適性補修戦略を計算する
 *
 * BC最終レースはC適性（スコア=1）、中間必須レースはD適性（スコア=0）を閾値とし、
 * 全固定配置レースを走れるように必要な因子数を統合する。
 * BC最終レースの属性を優先し、合計6枠・属性ごと3枚上限で設定する。
 * 全属性が閾値を満たす場合は null（補修不要 = B パターン）を返す。
 *
 * @param bcRace - BC 最終レース (bc_flag=true のレース行)
 * @param uma - 対象ウマ娘の行データ
 * @param mandatoryRaces - BC 中間必須レースの RaceRow 配列（省略時は空）
 * @returns 補修戦略オブジェクト（A パターン）または null（B パターン）
 */
export function calcBCStrategy(
  bcRace: RaceRow,
  uma: UmamusumeRow,
  mandatoryRaces: RaceRow[] = [],
): Record<string, number> | null {
  const needed = collectNeededFactors(bcRace, uma, mandatoryRaces);

  if (Object.keys(needed).length === 0) return null; // B パターン: 補修不要

  const bcSurface = getSurfaceName(bcRace);
  const bcDistance = DISTANCE_NAMES[bcRace.distance];
  const strategy = buildStrategyFromNeeded(needed, [bcSurface, bcDistance]);

  return Object.keys(strategy).length > 0 ? strategy : null;
}

/**
 * ウマ娘の現在適性から AptitudeState を生成する
 * @param uma - 対象ウマ娘の行データ
 * @returns 現在の適性状態オブジェクト
 */
export function buildAptitudeState(uma: UmamusumeRow): AptitudeState {
  return {
    turf: uma.turf_aptitude,
    dirt: uma.dirt_aptitude,
    sprint: uma.sprint_aptitude,
    mile: uma.mile_aptitude,
    classic: uma.classic_aptitude,
    long: uma.long_distance_aptitude,
  };
}

/** 適性ランクを指定ステップ数だけ向上させる */
function improveRank(rank: string, steps: number): string {
  const idx = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]);
  return RANK_ORDER[Math.min(idx + steps, RANK_ORDER.length - 1)];
}

/** 因子名から AptitudeState キーへのマップ */
const FACTOR_TO_APT_KEY: Record<string, keyof AptitudeState> = {
  芝: 'turf',
  ダート: 'dirt',
  短距離: 'sprint',
  マイル: 'mile',
  中距離: 'classic',
  長距離: 'long',
};

/**
 * 因子戦略を適性オブジェクトに適用し、向上後の適性状態を返す
 * 因子一つにつき一段階向上（G→F, F→E, E→D, ...）
 * @param aptState - 適用前の適性状態
 * @param strategy - 適用する因子戦略（属性名 → 因子数のマップ）
 * @returns 因子適用後の新しい適性状態オブジェクト
 */
export function applyStrategyToAptitude(
  aptState: AptitudeState,
  strategy: Record<string, number>,
): AptitudeState {
  const result = { ...aptState };
  for (const [factor, steps] of Object.entries(strategy)) {
    const key = FACTOR_TO_APT_KEY[factor];
    if (key) result[key] = improveRank(result[key], steps);
  }
  return result;
}

/**
 * レースがパターンにとって「優先すべきレース」かどうか判定する
 *
 * BC パターンの場合（bcFinalRace 指定時）:
 *   BC 最終レースと同じ馬場・距離のレースのみ true とする。
 *
 * 非 BC パターン（bcFinalRace 未指定）:
 *   適性オブジェクトの芝/ダートと距離が両方 C 以上（スコア 1 以上）で true
 *
 * @param race - 判定対象のレース行データ
 * @param aptState - 現在の適性状態
 * @param bcFinalRace - BC 最終レース（BC パターンの場合に指定、省略可）
 * @returns 優先配置すべきレースの場合 true
 */
export function raceMatchesAptitude(
  race: RaceRow,
  aptState: AptitudeState,
  bcFinalRace?: RaceRow,
): boolean {
  if (bcFinalRace) {
    return (
      race.race_state === bcFinalRace.race_state &&
      race.distance === bcFinalRace.distance
    );
  }
  const distKey = DIST_KEYS[race.distance - 1];
  return (
    getApt(aptState[surfKeyOf(race)]) >= 1 && getApt(aptState[distKey]) >= 1
  );
}

/**
 * パターンの適性オブジェクトに対して、指定レースを走れるか（D 以上）を確認する
 * 馬場または距離適性が D 未満（E/F/G: スコア < 0）の場合は走っても勝てない
 * @param race - 判定対象のレース行データ
 * @param aptState - 現在の適性状態
 * @returns 馬場・距離ともに D 以上（スコア >= 0）の場合 true
 */
export function isRaceRunnable(
  race: RaceRow,
  aptState: AptitudeState,
): boolean {
  const distKey = DIST_KEYS[race.distance - 1];
  return (
    getApt(aptState[surfKeyOf(race)]) >= 0 && getApt(aptState[distKey]) >= 0
  );
}

/**
 * 適性不足のレースを因子スロットで補修して走れるようにする追加戦略を計算する
 *
 * @param race - 走れないレース
 * @param aptState - 現在の適性状態（既存因子戦略適用済み）
 * @param currentStrategy - 現在の因子戦略（null の場合は空き6スロット）
 * @returns 補修に必要な追加因子マップ、補修不可の場合は null
 */
export function calcRunnableEnhancement(
  race: RaceRow,
  aptState: AptitudeState,
  currentStrategy: Record<string, number> | null,
): Record<string, number> | null {
  const distKey = DIST_KEYS[race.distance - 1];
  const surfApt = getApt(aptState[surfKeyOf(race)]);
  const distApt = getApt(aptState[distKey]);

  if (surfApt >= 0 && distApt >= 0) return null;

  const usedSlots = currentStrategy
    ? Object.values(currentStrategy).reduce((sum, v) => sum + v, 0)
    : 0;
  const freeSlots = 6 - usedSlots;
  if (freeSlots <= 0) return null;

  const surfNeeded = Math.max(0, -surfApt);
  const distNeeded = Math.max(0, -distApt);
  if (surfNeeded + distNeeded > freeSlots) return null;

  const enhancement: Record<string, number> = {};
  if (surfNeeded > 0) enhancement[getSurfaceName(race)] = surfNeeded;
  if (distNeeded > 0) enhancement[DISTANCE_NAMES[race.distance]] = distNeeded;
  return enhancement;
}

// ============================================================
// 因子構成計算
// ============================================================

/** 因子名の表示順（芝・ダート優先、距離は短い順、自由は末尾） */
const FACTOR_SORT_ORDER: Record<string, number> = {
  芝: 0,
  ダート: 1,
  短距離: 2,
  マイル: 3,
  中距離: 4,
  長距離: 5,
  自由: 99,
};

/** 因子カウントと追加可否を管理するヘルパー */
class FactorCounter {
  private readonly counts: Record<string, number> = {};
  private static readonly A_APT = 3;
  private static readonly MAX_PER_TYPE = 4;

  constructor(
    factors: string[],
    private readonly baseAptMap: Record<string, number>,
  ) {
    for (const f of factors) {
      if (f !== '自由') this.counts[f] = (this.counts[f] ?? 0) + 1;
    }
  }

  getEffective(name: string): number {
    return (this.baseAptMap[name] ?? 0) + (this.counts[name] ?? 0);
  }

  canAdd(name: string): boolean {
    return (
      this.getEffective(name) < FactorCounter.A_APT &&
      (this.counts[name] ?? 0) < FactorCounter.MAX_PER_TYPE
    );
  }

  increment(name: string): void {
    this.counts[name] = (this.counts[name] ?? 0) + 1;
  }
}

/**
 * 残スロットを有用因子で補完する
 *
 * 優先度: ダート = 芝（交互）> 距離（有効適性の低い順）
 * 追加条件: 有効適性（基礎 + 既存因子数）が A 未満 かつ 同種因子数が 4 未満
 * パターン内に対象レースが存在する馬場・距離のみを候補にする
 */
function fillRemainingFactors(
  factors: string[],
  baseAptMap: Record<string, number>,
  maxSlots = 6,
  surfUsage?: Record<number, boolean>,
  distUsage?: Record<number, boolean>,
): void {
  const counter = new FactorCounter(factors, baseAptMap);
  const surfNames = filterSurfaceNames(surfUsage);
  const distanceNames = filterDistanceNames(distUsage);
  let surfRound = 0;

  while (factors.length < maxSlots) {
    const surfResult = trySurfaceFactor(surfNames, surfRound, counter);
    if (surfResult) {
      factors.push(surfResult.name);
      counter.increment(surfResult.name);
      surfRound = surfResult.nextRound;
      continue;
    }

    const distName = tryDistanceFactor(distanceNames, counter);
    if (distName) {
      factors.push(distName);
      counter.increment(distName);
      continue;
    }

    break;
  }
}

/** 表面適性因子を交互に追加する */
function trySurfaceFactor(
  surfNames: string[],
  surfRound: number,
  counter: FactorCounter,
): { name: string; nextRound: number } | null {
  for (let t = 0; t < surfNames.length; t++) {
    const name = surfNames[(surfRound + t) % surfNames.length];
    if (counter.canAdd(name)) {
      return { name, nextRound: (surfRound + 1) % surfNames.length };
    }
  }
  return null;
}

/** 距離適性因子を有効適性の低い順に追加する */
function tryDistanceFactor(
  distanceNames: string[],
  counter: FactorCounter,
): string | null {
  const candidates = distanceNames
    .filter((n) => counter.canAdd(n))
    .sort((a, b) => counter.getEffective(a) - counter.getEffective(b));
  return candidates.length > 0 ? candidates[0] : null;
}

/** パターン内に存在する馬場名のフィルタリング */
function filterSurfaceNames(surfUsage?: Record<number, boolean>): string[] {
  return ['ダート', '芝'].filter(
    (n) => !surfUsage || (n === 'ダート' ? surfUsage[1] : surfUsage[0]),
  );
}

/** パターン内に存在する距離名のフィルタリング */
function filterDistanceNames(distUsage?: Record<number, boolean>): string[] {
  const distMap: Record<string, number> = {
    長距離: 4,
    中距離: 3,
    マイル: 2,
    短距離: 1,
  };
  return ['長距離', '中距離', 'マイル', '短距離'].filter(
    (n) => !distUsage || distUsage[distMap[n]],
  );
}

/** パターン内のレースから馬場・距離の使用状況を集計する */
function collectUsage(patternRaces: RaceRow[]): {
  surfUsage: Record<number, boolean>;
  distUsage: Record<number, boolean>;
} {
  const surfUsage: Record<number, boolean> = { 0: false, 1: false };
  const distUsage: Record<number, boolean> = {
    1: false,
    2: false,
    3: false,
    4: false,
  };
  for (const r of patternRaces) {
    surfUsage[r.race_state] = true;
    distUsage[r.distance] = true;
  }
  return { surfUsage, distUsage };
}

/** 基礎適性マップを構築する（isLarc の場合は芝・中距離を A 扱い） */
function buildBaseAptMap(
  uma: UmamusumeRow,
  isLarc: boolean,
): Record<string, number> {
  return {
    芝: isLarc ? 3 : getApt(uma.turf_aptitude),
    ダート: getApt(uma.dirt_aptitude),
    短距離: getApt(uma.sprint_aptitude),
    マイル: getApt(uma.mile_aptitude),
    中距離: isLarc ? 3 : getApt(uma.classic_aptitude),
    長距離: getApt(uma.long_distance_aptitude),
  };
}

/** ラーク時の戦略調整（芝・中距離を除外し、G適性は3枚に補正） */
function adjustStrategyForLarc(
  strategy: Record<string, number>,
  uma: UmamusumeRow,
): Record<string, number> | null {
  const filtered = Object.fromEntries(
    Object.entries(strategy).filter(([k]) => k !== '芝' && k !== '中距離'),
  );
  const aptData: Record<string, string> = {
    芝: uma.turf_aptitude,
    ダート: uma.dirt_aptitude,
    短距離: uma.sprint_aptitude,
    マイル: uma.mile_aptitude,
    中距離: uma.classic_aptitude,
    長距離: uma.long_distance_aptitude,
  };
  const temp: Record<string, number> = {};
  let total = 0;
  for (const [factor, num] of Object.entries(filtered)) {
    const aptChar = aptData[factor] ?? 'A';
    const newNum = getApt(aptChar) <= -3 ? 3 : num;
    if (total + newNum <= 6) {
      temp[factor] = newNum;
      total += newNum;
    } else if (total + num <= 6) {
      temp[factor] = num;
      total += num;
    }
  }
  return Object.keys(temp).length > 0 ? temp : null;
}

/** 戦略ありの場合の因子構成を計算する */
function buildFactorsWithStrategy(
  currentStrategy: Record<string, number>,
  baseAptMap: Record<string, number>,
  isLarc: boolean,
  surfUsage: Record<number, boolean>,
  distUsage: Record<number, boolean>,
): string[] {
  const factors: string[] = [];
  for (const [factor, num] of Object.entries(currentStrategy)) {
    for (let i = 0; i < num; i++) factors.push(factor);
  }
  if (!isLarc)
    fillRemainingFactors(factors, baseAptMap, 6, surfUsage, distUsage);
  while (factors.length < 6) factors.push('自由');
  factors.sort(
    (a, b) => (FACTOR_SORT_ORDER[a] ?? 98) - (FACTOR_SORT_ORDER[b] ?? 98),
  );
  return factors.slice(0, 6);
}

/** 戦略なしの場合の因子構成を計算する（D未満の適性を補修） */
function buildFactorsWithoutStrategy(
  baseAptMap: Record<string, number>,
  isLarc: boolean,
  surfUsage: Record<number, boolean>,
  distUsage: Record<number, boolean>,
): string[] {
  const factors: string[] = [];
  const toFix: [number, string][] = [];

  const checkAndAdd = (usage: boolean, apt: number, name: string) => {
    if (usage && apt < 0) toFix.push([apt, name]);
  };
  checkAndAdd(distUsage[4], baseAptMap['長距離'], '長距離');
  checkAndAdd(distUsage[3], baseAptMap['中距離'], '中距離');
  checkAndAdd(distUsage[2], baseAptMap['マイル'], 'マイル');
  checkAndAdd(distUsage[1], baseAptMap['短距離'], '短距離');
  checkAndAdd(surfUsage[1], baseAptMap['ダート'], 'ダート');
  checkAndAdd(surfUsage[0], baseAptMap['芝'], '芝');
  toFix.sort((a, b) => a[0] - b[0]);

  for (const [aptitude, name] of toFix) {
    if (factors.length >= 6) break;
    if (factors.includes(name)) continue;
    const needed = -aptitude;
    const toAdd = Math.min(needed, 6 - factors.length);
    for (let i = 0; i < toAdd; i++) factors.push(name);
  }

  if (!isLarc)
    fillRemainingFactors(factors, baseAptMap, 6, surfUsage, distUsage);
  while (factors.length < 6) factors.push('自由');
  factors.sort(
    (a, b) => (FACTOR_SORT_ORDER[a] ?? 98) - (FACTOR_SORT_ORDER[b] ?? 98),
  );
  return factors.slice(0, 6);
}

/**
 * パターンのレース構成と適性から推奨因子構成（6枠分）を計算する
 *
 * @param uma - 対象ウマ娘の行データ
 * @param patternRaces - パターン内の全レース RaceRow 配列
 * @param strategy - 因子戦略（null の場合は自動計算）
 * @param isLarc - ラークシナリオの場合 true（芝・中距離適性を A として扱う）
 * @returns 6 要素の因子名配列（余りは '自由'）
 */
export function calculateFactorComposition(
  uma: UmamusumeRow,
  patternRaces: RaceRow[],
  strategy: Record<string, number> | null = null,
  isLarc = false,
): string[] {
  const baseAptMap = buildBaseAptMap(uma, isLarc);
  const { surfUsage, distUsage } = collectUsage(patternRaces);

  let currentStrategy = strategy ? { ...strategy } : null;
  if (isLarc && currentStrategy) {
    currentStrategy = adjustStrategyForLarc(currentStrategy, uma);
  }

  if (currentStrategy) {
    return buildFactorsWithStrategy(
      currentStrategy,
      baseAptMap,
      isLarc,
      surfUsage,
      distUsage,
    );
  }

  return buildFactorsWithoutStrategy(baseAptMap, isLarc, surfUsage, distUsage);
}
