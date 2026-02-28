// =============================================
// race-pattern 専用ヘルパー関数
// race-pattern.service.ts から分離した純粋関数群
// =============================================

import type { GradeName } from '@uma-crown/shared';
import type { RaceRow, UmamusumeRow, PatternData, AptitudeState } from '../race.types.js';
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
  if (race.junior_flag) slots.push({ grade: 'junior', month: race.race_months, half: race.half_flag });
  if (race.classic_flag) slots.push({ grade: 'classic', month: race.race_months, half: race.half_flag });
  if (race.senior_flag) slots.push({ grade: 'senior', month: race.race_months, half: race.half_flag });
  return slots;
}

/**
 * ラークシナリオで走行不可のスロットかどうか判定する
 * classic の 5月後半・7〜9月・10月前半、および senior の 6月後半以降は走行不可
 * @param grade - 育成期カテゴリ
 * @param month - 月（1〜12）
 * @param half - 後半フラグ
 * @returns 走行不可の場合 true
 */
export function isLarcRestrictedSlot(grade: GradeName, month: number, half: boolean): boolean {
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
 * @param grade - 育成期カテゴリ
 * @param month - 月（1〜12）
 * @param half - 後半フラグ
 * @returns 走行不可の場合 true
 */
export function isBCRestrictedSlot(grade: GradeName, month: number, half: boolean): boolean {
  if (grade === 'senior') {
    if (month === 11 && half) return true; // 11月後半以降走行不可
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
    if (patternGrid.has(key)) { runStart = i; i--; }
    else break;
  }

  let runEnd = idx;
  i = idx + 1;
  while (i < ORDERED_SLOTS.length) {
    const key = skFromIdx(i);
    if (patternGrid.has(key)) { runEnd = i; i++; }
    else break;
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

/**
 * グリッドから PatternData を構築する（全スロットを出力）
 * @param patternGrid - レースが配置されたスロットのグリッド
 * @returns 全スロット（空スロットは空文字列）を含む PatternData
 */
export function buildPatternFromGrid(patternGrid: Map<string, RaceRow>): PatternData {
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
          race_rank: race?.race_rank ?? null,
          month,
          half,
        });
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
export function getAllRacesInPattern(pattern: PatternData, allGRaces: RaceRow[]): RaceRow[] {
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
export function calculateAndSetMainConditions(pattern: PatternData, racesInPattern: RaceRow[]) {
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

// ============================================================
// 適性・戦略計算
// ============================================================

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
export function calcBCStrategy(bcRace: RaceRow, uma: UmamusumeRow): Record<string, number> | null {
  const surface = bcRace.race_state === 0 ? '芝' : 'ダート';
  const distance = DISTANCE_NAMES[bcRace.distance];

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

  const surfaceNeeded = Math.max(0, 1 - surfaceApt);
  const distanceNeeded = Math.max(0, 1 - distanceApt);

  if (surfaceNeeded === 0 && distanceNeeded === 0) {
    return null; // B パターン: 補修不要
  }

  // A パターン: 補修が必要な因子を戦略として返す（1属性あたり最大3因子に制限）
  const strategy: Record<string, number> = {};
  if (surfaceNeeded > 0) strategy[surface] = Math.min(surfaceNeeded, 3);
  if (distanceNeeded > 0 && distance) strategy[distance] = Math.min(distanceNeeded, 3);
  return strategy;
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
  const improve = (rank: string, steps: number): string => {
    const idx = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]);
    return RANK_ORDER[Math.min(idx + steps, RANK_ORDER.length - 1)];
  };
  const result = { ...aptState };
  if ('芝' in strategy) result.turf = improve(result.turf, strategy['芝']);
  if ('ダート' in strategy) result.dirt = improve(result.dirt, strategy['ダート']);
  if ('短距離' in strategy) result.sprint = improve(result.sprint, strategy['短距離']);
  if ('マイル' in strategy) result.mile = improve(result.mile, strategy['マイル']);
  if ('中距離' in strategy) result.classic = improve(result.classic, strategy['中距離']);
  if ('長距離' in strategy) result.long = improve(result.long, strategy['長距離']);
  return result;
}

/**
 * レースがパターンにとって「優先すべきレース」かどうか判定する
 *
 * BC パターンの場合（bcFinalRace 指定時）:
 *   BC 最終レースと同じ馬場・距離のレースのみ true とする。
 *   自然適性が高い別カテゴリ（例: 中距離 A のウマで短距離 BC パターン）に
 *   誤った高スコアが付かないようにするため。
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
    return race.race_state === bcFinalRace.race_state && race.distance === bcFinalRace.distance;
  }
  const surfKey: keyof AptitudeState = race.race_state === 0 ? 'turf' : 'dirt';
  const distKeys: (keyof AptitudeState)[] = ['sprint', 'mile', 'classic', 'long'];
  const distKey = distKeys[race.distance - 1];
  return getApt(aptState[surfKey]) >= 1 && getApt(aptState[distKey]) >= 1;
}

/**
 * パターンの適性オブジェクトに対して、指定レースを走れるか（D 以上）を確認する
 * 馬場または距離適性が D 未満（E/F/G: スコア < 0）の場合は走っても勝てない
 * @param race - 判定対象のレース行データ
 * @param aptState - 現在の適性状態
 * @returns 馬場・距離ともに D 以上（スコア >= 0）の場合 true
 */
export function isRaceRunnable(race: RaceRow, aptState: AptitudeState): boolean {
  const surfKey: keyof AptitudeState = race.race_state === 0 ? 'turf' : 'dirt';
  const distKeys: (keyof AptitudeState)[] = ['sprint', 'mile', 'classic', 'long'];
  const distKey = distKeys[race.distance - 1];
  return getApt(aptState[surfKey]) >= 0 && getApt(aptState[distKey]) >= 0;
}

/**
 * 適性不足のレースを因子スロットで補修して走れるようにする追加戦略を計算する
 *
 * 現在の因子戦略の空きスロット数（最大6から使用済みを引いた数）で
 * D 適性（スコア=0）への到達が可能かを判定し、必要な追加因子を返す。
 * 例: 長距離 G（スコア=-3）・空き3スロット → {'長距離': 3} を返し G→D に引き上げ
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
  const surfKey: keyof AptitudeState = race.race_state === 0 ? 'turf' : 'dirt';
  const distKeys: (keyof AptitudeState)[] = ['sprint', 'mile', 'classic', 'long'];
  const distKey = distKeys[race.distance - 1];
  const surfApt = getApt(aptState[surfKey]);
  const distApt = getApt(aptState[distKey]);

  if (surfApt >= 0 && distApt >= 0) return null; // 既に走れる場合はこの関数を呼ぶべきではない

  const usedSlots = currentStrategy
    ? Object.values(currentStrategy).reduce((sum, v) => sum + v, 0)
    : 0;
  const freeSlots = 6 - usedSlots;
  if (freeSlots <= 0) return null;

  // D（スコア=0）に到達するために必要な因子数（G=3枚, F=2枚, E=1枚）
  const surfNeeded = surfApt < 0 ? -surfApt : 0;
  const distNeeded = distApt < 0 ? -distApt : 0;
  if (surfNeeded + distNeeded > freeSlots) return null;

  const enhancement: Record<string, number> = {};
  if (surfNeeded > 0) enhancement[race.race_state === 0 ? '芝' : 'ダート'] = surfNeeded;
  if (distNeeded > 0) {
    const distName = DISTANCE_NAMES[race.distance];
    if (distName) enhancement[distName] = distNeeded;
  }
  return enhancement;
}

// ============================================================
// 因子構成計算
// ============================================================

/** 因子名の表示順（芝・ダート優先、距離は短い順、自由は末尾） */
const FACTOR_SORT_ORDER: Record<string, number> = {
  '芝': 0, 'ダート': 1, '短距離': 2, 'マイル': 3, '中距離': 4, '長距離': 5, '自由': 99,
};

/**
 * 残スロットを有用因子で補完する
 *
 * 優先度: ダート = 芝（交互）> 距離（有効適性の低い順）
 * 追加条件: 有効適性（基礎 + 既存因子数）が A 未満 かつ 同種因子数が 4 未満
 *
 * @param factors - 現在の因子配列（直接変更する）
 * @param baseAptMap - 因子名 → 基礎適性数値（S=4〜G=-3）のマップ
 * @param maxSlots - 最大スロット数（デフォルト 6）
 */
function fillRemainingFactors(
  factors: string[],
  baseAptMap: Record<string, number>,
  maxSlots = 6,
): void {
  const A_APT = 3; // getApt('A')
  const MAX_PER_TYPE = 4;
  const factorCounts: Record<string, number> = {};
  for (const f of factors) {
    if (f !== '自由') factorCounts[f] = (factorCounts[f] ?? 0) + 1;
  }

  const getEffective = (name: string): number =>
    (baseAptMap[name] ?? 0) + (factorCounts[name] ?? 0);
  const canAdd = (name: string): boolean =>
    getEffective(name) < A_APT && (factorCounts[name] ?? 0) < MAX_PER_TYPE;

  const surfNames = ['ダート', '芝'];
  const distanceNames = ['長距離', '中距離', 'マイル', '短距離'];
  let surfRound = 0;

  while (factors.length < maxSlots) {
    let added = false;

    // 表面適性（ダート・芝）を交互に優先
    for (let t = 0; t < surfNames.length; t++) {
      const name = surfNames[(surfRound + t) % surfNames.length];
      if (canAdd(name)) {
        factors.push(name);
        factorCounts[name] = (factorCounts[name] ?? 0) + 1;
        surfRound = (surfRound + 1) % surfNames.length;
        added = true;
        break;
      }
    }

    if (!added) {
      // 距離適性（有効適性の低い順）
      const distCandidates = distanceNames
        .filter(n => canAdd(n))
        .sort((a, b) => getEffective(a) - getEffective(b));
      if (distCandidates.length > 0) {
        const name = distCandidates[0];
        factors.push(name);
        factorCounts[name] = (factorCounts[name] ?? 0) + 1;
        added = true;
      }
    }

    if (!added) break;
  }
}

/**
 * パターンのレース構成と適性から推奨因子構成（6枠分）を計算する
 *
 * BC パターンで戦略あり → 戦略因子を配置後、残スロットを有用因子で補完する。
 * 戦略なし → 走行するレースの適性不足を補修する最低限の因子を算出し、
 * 残りスロットをダート・芝優先で有用因子を補完する。
 * いずれも補完できないスロットは '自由' で埋める。
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
  const factors: string[] = [];
  let currentStrategy = strategy ? { ...strategy } : null;

  let turfApt = getApt(uma.turf_aptitude);
  let dirtApt = getApt(uma.dirt_aptitude);
  let sprintApt = getApt(uma.sprint_aptitude);
  let mileApt = getApt(uma.mile_aptitude);
  let classicApt = getApt(uma.classic_aptitude);
  let longApt = getApt(uma.long_distance_aptitude);

  if (isLarc) { turfApt = 3; classicApt = 3; }

  const baseAptMap: Record<string, number> = {
    '芝': turfApt, 'ダート': dirtApt,
    '短距離': sprintApt, 'マイル': mileApt,
    '中距離': classicApt, '長距離': longApt,
  };

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
    if (!isLarc) fillRemainingFactors(factors, baseAptMap);
    while (factors.length < 6) factors.push('自由');
    factors.sort((a, b) => (FACTOR_SORT_ORDER[a] ?? 98) - (FACTOR_SORT_ORDER[b] ?? 98));
    return factors.slice(0, 6);
  }

  const surfUsage: Record<number, boolean> = { 0: false, 1: false };
  const distUsage: Record<number, boolean> = { 1: false, 2: false, 3: false, 4: false };
  for (const r of patternRaces) {
    surfUsage[r.race_state] = true;
    distUsage[r.distance] = true;
  }

  // D=0 が最低ライン。D未満（E=-1, F=-2, G=-3）のみ補修対象
  // needed = -aptitude で D到達に必要な枚数を算出（G→3枚, F→2枚, E→1枚）
  const toFix: [number, string][] = [];
  if (distUsage[4] && longApt < 0) toFix.push([longApt, '長距離']);
  if (distUsage[3] && classicApt < 0) toFix.push([classicApt, '中距離']);
  if (distUsage[2] && mileApt < 0) toFix.push([mileApt, 'マイル']);
  if (distUsage[1] && sprintApt < 0) toFix.push([sprintApt, '短距離']);
  if (surfUsage[1] && dirtApt < 0) toFix.push([dirtApt, 'ダート']);
  if (surfUsage[0] && turfApt < 0) toFix.push([turfApt, '芝']);
  toFix.sort((a, b) => a[0] - b[0]);

  for (const [aptitude, name] of toFix) {
    if (factors.length >= 6) break;
    if (factors.includes(name)) continue;
    const needed = -aptitude; // G=-3→3枚, F=-2→2枚, E=-1→1枚
    const toAdd = Math.min(needed, 6 - factors.length);
    for (let i = 0; i < toAdd; i++) factors.push(name);
  }
  // 残りスロットをパターン外の弱距離適性因子で D まで補完する（ラークはシナリオ補正があるため不要）
  if (!isLarc && factors.length < 6) {
    const supplementDist: [number, string][] = (
      [
        [longApt, '長距離'],
        [classicApt, '中距離'],
        [mileApt, 'マイル'],
        [sprintApt, '短距離'],
      ] as [number, string][]
    )
      .filter(([, name]) => !factors.includes(name))
      .filter(([apt]) => apt < 0)
      .sort((a, b) => a[0] - b[0]);
    for (const [apt, name] of supplementDist) {
      if (factors.length >= 6) break;
      const needed = -apt;
      const toAdd = Math.min(needed, 6 - factors.length);
      for (let i = 0; i < toAdd; i++) factors.push(name);
    }
  }
  // 残スロットをダート・芝優先で有用因子を補完する（ラークはシナリオ補正があるため不要）
  if (!isLarc) fillRemainingFactors(factors, baseAptMap);
  while (factors.length < 6) factors.push('自由');
  factors.sort((a, b) => (FACTOR_SORT_ORDER[a] ?? 98) - (FACTOR_SORT_ORDER[b] ?? 98));
  return factors.slice(0, 6);
}
