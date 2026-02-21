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

/** 適性ランク文字列→スコアのマッピング */
const APTITUDE_MAP: Record<string, number> = {
  S: 4, A: 3, B: 2, C: 1, D: 0, E: -1, F: -2, G: -3,
};
/** 距離区分番号→日本語名のマッピング */
const DISTANCE_MAP: Record<number, string> = {
  1: '短距離', 2: 'マイル', 3: '中距離', 4: '長距離',
};
/** 馬場番号→日本語名のマッピング */
const SURFACE_NAMES: Record<number, string> = { 0: '芝', 1: 'ダート' };
/** 距離区分番号→日本語名のマッピング（パターン出力用） */
const DISTANCE_NAMES: Record<number, string> = { 1: '短距離', 2: 'マイル', 3: '中距離', 4: '長距離' };

/** 適性ランク文字列をスコアに変換する
 * @param char - 適性ランク文字（S/A/B/C/D/E/F/G）
 * @returns 数値スコア（S=4, G=-3）
 */
function getApt(char: string): number {
  return APTITUDE_MAP[char] ?? 0;
}

/** 配列から k 個の組み合わせを生成する（現在は k=2 のみ対応）
 * @param arr - 入力配列
 * @param k - 選択する要素数
 * @returns 組み合わせの配列
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

/** レースのグレード（junior/classic/senior）を判定する
 * @param race - 判定対象のレース
 * @param scenarioInfo - シナリオレース情報（省略可）
 * @returns グレード名
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

// --- Helper functions ported from Python ---

/** 適性の低い属性を補強するための戦略候補リストを生成する
 * @param uma - 対象ウマ娘の適性データ
 * @param remainingRaces - 未出走レースの一覧
 * @returns 戦略オブジェクトの配列（戦略なしの場合は [null]）
 */
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

  const lowAptitudes = Object.entries(aptitudes)
    .filter(([, v]) => v <= 0)
    .map(([k]) => k);

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
        if (combo.includes(surface) && combo.includes(distance)) {
          comboNeeded = true;
          break;
        }
      }
      if (comboNeeded) {
        strategies.push({ [combo[0]]: 3, [combo[1]]: 3 });
      }
    }
  }

  return strategies.length > 0 ? strategies : [null];
}

/** 戦略に合わないレースを除外してフィルタリングする
 * @param races - フィルタ対象のレース一覧
 * @param strategy - 適用する戦略（null の場合はフィルタなし）
 * @param uma - 対象ウマ娘の適性データ
 * @returns フィルタ後のレース一覧
 */
function filterRacesByStrategy(
  races: RaceRow[],
  strategy: Record<string, number> | null,
  uma: UmamusumeRow,
): RaceRow[] {
  if (!strategy) return races;

  const aptitudes: Record<string, number> = {
    '芝': getApt(uma.turf_aptitude),
    'ダート': getApt(uma.dirt_aptitude),
    '短距離': getApt(uma.sprint_aptitude),
    'マイル': getApt(uma.mile_aptitude),
    '中距離': getApt(uma.classic_aptitude),
    '長距離': getApt(uma.long_distance_aptitude),
  };

  const unsupported = new Set(
    Object.entries(aptitudes)
      .filter(([name, value]) => value <= 0 && !(name in strategy))
      .map(([name]) => name),
  );

  if (unsupported.size === 0) return races;

  return races.filter((race) => {
    if (unsupported.has('芝') && race.race_state === 0) return false;
    if (unsupported.has('ダート') && race.race_state === 1) return false;
    const distName = DISTANCE_MAP[race.distance];
    if (distName && unsupported.has(distName)) return false;
    return true;
  });
}

/** シナリオレースと同月・同グレードで競合する未出走レースを抽出する
 * @param scenarioRaces - シナリオで固定されるレース一覧
 * @param remainingRaces - 未出走レース一覧
 * @returns 競合レース配列とシナリオレースIDセット
 */
function extractConflictingRaces(
  scenarioRaces: ScenarioRaceRow[],
  remainingRaces: RaceRow[],
): { conflicting: RaceRow[]; scenarioRaceIds: Set<number> } {
  const scenarioRaceIds = new Set(scenarioRaces.map((sr) => sr.race.race_id));
  const conflicting: RaceRow[] = [];
  const added = new Set<number>();

  for (const sr of scenarioRaces) {
    const race = sr.race;
    const gradeType = getRaceGrade(race, sr);
    for (const rem of remainingRaces) {
      const remGrade = getRaceGrade(rem);
      if (
        rem.race_months === race.race_months &&
        rem.half_flag === race.half_flag &&
        gradeType === remGrade &&
        !added.has(rem.race_id) &&
        !scenarioRaceIds.has(rem.race_id)
      ) {
        conflicting.push(rem);
        added.add(rem.race_id);
      }
    }
  }
  return { conflicting, scenarioRaceIds };
}

/** 使用済みレースIDセットを初期化する。シナリオレースとLarcレースを初期値として登録する
 * @param scenarioRaceIds - シナリオで使用するレースIDセット
 * @param remainingRaces - 未出走レース一覧
 * @returns 使用済みレースIDセット
 */
function initializeUsedRaces(scenarioRaceIds: Set<number>, remainingRaces: RaceRow[]): Set<number> {
  const used = new Set(scenarioRaceIds);
  const larcNames = new Set(['ニエル賞', 'フォワ賞', '凱旋門賞', '宝塚記念']);
  for (const race of remainingRaces) {
    if (larcNames.has(race.race_name)) used.add(race.race_id);
  }
  return used;
}

/** ウマ娘の適性と出走可能レース分布から最優先の馬場・距離を決定する
 * @param uma - 対象ウマ娘の適性データ
 * @param availableRaces - 使用可能なレース一覧
 * @returns 優先馬場番号と優先距離区分番号
 */
function determinePreferredConditions(
  uma: UmamusumeRow,
  availableRaces: RaceRow[],
): { preferredSurface: number; preferredDistance: number } {
  const surfCount: Record<number, number> = { 0: 0, 1: 0 };
  const distCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of availableRaces) {
    surfCount[r.race_state]++;
    distCount[r.distance]++;
  }

  const surfScore: Record<number, number> = {
    0: getApt(uma.turf_aptitude) * surfCount[0],
    1: getApt(uma.dirt_aptitude) * surfCount[1],
  };
  const distScore: Record<number, number> = {
    1: getApt(uma.sprint_aptitude) * distCount[1],
    2: getApt(uma.mile_aptitude) * distCount[2],
    3: getApt(uma.classic_aptitude) * distCount[3],
    4: getApt(uma.long_distance_aptitude) * distCount[4],
  };

  const maxByValue = (obj: Record<number, number>, fallback: number) => {
    let maxKey = fallback;
    let maxVal = -Infinity;
    for (const [k, v] of Object.entries(obj)) {
      if (v > maxVal) { maxVal = v; maxKey = Number(k); }
    }
    return maxKey;
  };

  return {
    preferredSurface: Object.values(surfScore).some((v) => v !== 0) ? maxByValue(surfScore, 0) : 0,
    preferredDistance: Object.values(distScore).some((v) => v !== 0) ? maxByValue(distScore, 1) : 1,
  };
}

/** 競合レースをベースに全グレードのパターン骨格を生成する
 * @param conflicting - シナリオと競合する未出走レース
 * @param used - 使用済みレースIDセット（破壊的更新）
 * @param prefSurface - 優先馬場番号
 * @param prefDistance - 優先距離区分番号
 * @returns 生成されたパターンと競合が存在したかどうかのフラグ
 */
function createBasePattern(
  conflicting: RaceRow[],
  used: Set<number>,
  prefSurface: number,
  prefDistance: number,
): { pattern: PatternData; hasConflicts: boolean } {
  const pattern: PatternData = { junior: [], classic: [], senior: [] };
  let hasConflicts = false;

  const racePriority = (r: RaceRow) => {
    const sm = r.race_state === prefSurface ? 1 : 0;
    const dm = r.distance === prefDistance ? 1 : 0;
    return [-sm, -dm, r.race_state, r.distance];
  };

  const sortByPriority = (a: RaceRow, b: RaceRow) => {
    const pa = racePriority(a);
    const pb = racePriority(b);
    for (let i = 0; i < pa.length; i++) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
  };

  const grades: [GradeName, number[]][] = [
    ['junior', Array.from({ length: 6 }, (_, i) => i + 7)],
    ['classic', Array.from({ length: 12 }, (_, i) => i + 1)],
    ['senior', Array.from({ length: 12 }, (_, i) => i + 1)],
  ];

  for (const [gradeName, months] of grades) {
    for (const month of months) {
      for (const half of [false, true]) {
        const candidates = conflicting.filter(
          (r) =>
            r.race_months === month &&
            r.half_flag === half &&
            getRaceGrade(r) === gradeName &&
            !used.has(r.race_id),
        );

        let match: RaceRow | null = null;
        if (candidates.length > 0) {
          if (gradeName !== 'junior') candidates.sort(sortByPriority);
          match = candidates[0];
          used.add(match.race_id);
          hasConflicts = true;
        }

        pattern[gradeName].push({
          race_name: match?.race_name ?? '',
          race_id: match?.race_id ?? null,
          distance: match?.distance ?? null,
          race_state: match?.race_state ?? null,
          month,
          half,
        });
      }
    }
  }
  return { pattern, hasConflicts };
}

/** パターンにラーク（凱旋門賞）シナリオを適用する
 * @param pattern - 適用対象のパターン（破壊的更新）
 * @param larcCreated - 既にラークパターンが生成済みかどうか
 * @param raceMap - レース名+月+前後半→race_idのマップ
 * @param used - 使用済みレースIDセット（破壊的更新）
 * @param allGRaces - 全G1~G3レースの一覧
 * @returns ラーク適用フラグと生成済みフラグ
 */
function applyLarcScenario(
  pattern: PatternData,
  larcCreated: boolean,
  raceMap: Map<string, number>,
  used: Set<number>,
  allGRaces: RaceRow[],
): { isLarc: boolean; larcCreated: boolean } {
  if (larcCreated) return { isLarc: false, larcCreated: true };

  const classicBlocked = pattern.classic.some(
    (r) => r.race_name && ([7, 8, 9].includes(r.month) || (r.month === 10 && !r.half)),
  );
  const seniorBlocked = pattern.senior.some(
    (r) => r.race_name && (r.month >= 7 || (r.month === 6 && r.half)),
  );
  const larcConflict = pattern.classic.some(
    (r) => r.month === 5 && r.half && r.race_name && r.race_name !== '日本ダービー',
  );

  if (classicBlocked || seniorBlocked || larcConflict) return { isLarc: false, larcCreated: false };

  const larcRaces: Record<string, [number, boolean, string][]> = {
    classic: [[5, true, '日本ダービー'], [9, false, 'ニエル賞'], [10, false, '凱旋門賞']],
    senior: [[6, true, '宝塚記念'], [9, false, 'フォワ賞'], [10, false, '凱旋門賞']],
  };

  for (const [grade, races] of Object.entries(larcRaces)) {
    for (let idx = 0; idx < pattern[grade].length; idx++) {
      const rd = pattern[grade][idx];
      for (const [month, half, name] of races) {
        if (rd.month === month && rd.half === half && !rd.race_name) {
          const key = `${name}|${month}|${half}`;
          const raceId = raceMap.get(key);
          if (raceId) {
            const raceObj = allGRaces.find((r) => r.race_id === raceId);
            pattern[grade][idx] = {
              ...rd,
              race_name: name,
              race_id: raceId,
              distance: raceObj?.distance ?? null,
              race_state: raceObj?.race_state ?? null,
            };
            used.add(raceId);
          }
          break;
        }
      }
    }
  }
  return { isLarc: true, larcCreated: true };
}

/** メイクラパターンがラークに変更可能か再チェックして適用する
 * @param pattern - チェック対象のパターン（破壊的更新）
 * @param raceMap - レース名+月+前後半→race_idのマップ
 * @param allGRaces - 全G1~G3レースの一覧
 * @returns ラーク適用後のパターン
 */
function applyCheckLarcScenario(
  pattern: PatternData,
  raceMap: Map<string, number>,
  allGRaces: RaceRow[],
): PatternData {
  const classicBlocked = pattern.classic.some(
    (r) => r.race_name && ([7, 8, 9].includes(r.month) || (r.month === 10 && !r.half)),
  );
  const seniorBlocked = pattern.senior.some(
    (r) => r.race_name && (r.month >= 7 || (r.month === 6 && r.half)),
  );
  const larcConflict = pattern.classic.some(
    (r) => r.month === 5 && r.half && r.race_name && r.race_name !== '日本ダービー',
  );

  if (classicBlocked || seniorBlocked || larcConflict) return pattern;

  pattern.scenario = 'ラーク';
  const larcRaces: Record<string, [number, boolean, string][]> = {
    classic: [[5, true, '日本ダービー'], [9, false, 'ニエル賞'], [10, false, '凱旋門賞']],
    senior: [[6, true, '宝塚記念'], [9, false, 'フォワ賞'], [10, false, '凱旋門賞']],
  };

  for (const [grade, races] of Object.entries(larcRaces)) {
    for (let idx = 0; idx < pattern[grade].length; idx++) {
      const rd = pattern[grade][idx];
      for (const [month, half, name] of races) {
        if (rd.month === month && rd.half === half && !rd.race_name) {
          const key = `${name}|${month}|${half}`;
          const raceId = raceMap.get(key);
          if (raceId) {
            const raceObj = allGRaces.find((r) => r.race_id === raceId);
            pattern[grade][idx] = {
              ...rd,
              race_name: name,
              race_id: raceId,
              distance: raceObj?.distance ?? null,
              race_state: raceObj?.race_state ?? null,
            };
          }
          break;
        }
      }
    }
  }
  return pattern;
}

/** パターン内に配置された全レースのRaceRowオブジェクトを取得する
 * @param pattern - 対象のパターン
 * @param allGRaces - 全G1~G3レースの一覧
 * @returns パターンに含まれるレースの配列
 */
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

/** パターン内のレースから主馬場・主距離を集計してパターンに設定する
 * @param pattern - 更新対象のパターン（破壊的更新）
 * @param racesInPattern - パターンに含まれるレース一覧
 */
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

/** パターンのジュニア期スロットに未出走レースを充填する
 * @param pattern - 充填対象のパターン（破壊的更新）
 * @param remaining - 未出走レース一覧
 * @param used - 使用済みレースIDセット（破壊的更新）
 */
function fillJuniorSlots(pattern: PatternData, remaining: RaceRow[], used: Set<number>) {
  for (let idx = 0; idx < pattern.junior.length; idx++) {
    const rd = pattern.junior[idx];
    if (!rd.race_name) {
      for (const race of remaining) {
        if (
          race.race_months === rd.month &&
          race.half_flag === rd.half &&
          race.junior_flag &&
          !used.has(race.race_id)
        ) {
          pattern.junior[idx] = {
            ...rd,
            race_name: race.race_name,
            race_id: race.race_id,
            distance: race.distance,
            race_state: race.race_state,
          };
          used.add(race.race_id);
          break;
        }
      }
    }
  }
}

/** 全グレードの空きスロットに戦略・ランクを考慮して未出走レースを充填する
 * @param pattern - 充填対象のパターン（破壊的更新）
 * @param remaining - 未出走レース一覧
 * @param used - 使用済みレースIDセット（破壊的更新）
 */
function fillEmptySlots(pattern: PatternData, remaining: RaceRow[], used: Set<number>) {
  const gradeMap: [GradeName, number][] = [['junior', 1], ['classic', 2], ['senior', 3]];
  const isLarc = pattern.scenario === 'ラーク';

  while (true) {
    let addedAny = false;
    for (const [gradeName, gradeNum] of gradeMap) {
      for (let idx = 0; idx < pattern[gradeName].length; idx++) {
        const rd = pattern[gradeName][idx] as RaceSlotData;
        if (rd.race_name) continue;

        if (isLarc) {
          if (gradeName === 'classic' && [7, 8, 9, 10].includes(rd.month)) continue;
          if (gradeName === 'senior' && ((rd.month === 6 && rd.half) || rd.month >= 7)) continue;
        }

        const matching: RaceRow[] = [];
        for (const race of remaining) {
          let gradeMatch = false;
          if (gradeNum === 1 && race.junior_flag) gradeMatch = true;
          else if (gradeNum === 2 && race.classic_flag) gradeMatch = true;
          else if (gradeNum === 3 && race.senior_flag) gradeMatch = true;

          if (race.race_months === rd.month && race.half_flag === rd.half && gradeMatch && !used.has(race.race_id)) {
            matching.push(race);
          }
        }

        if (matching.length > 0) {
          const strategy = pattern.strategy;
          matching.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            if (strategy) {
              const keys = Object.keys(strategy);
              const dA = DISTANCE_MAP[a.distance];
              const dB = DISTANCE_MAP[b.distance];
              const isDirt = keys.includes('ダート');
              if (isDirt && a.race_state === 1 && dA && keys.includes(dA)) scoreA = 2;
              else if ((isDirt && a.race_state === 1) || (dA && keys.includes(dA))) scoreA = 1;
              if (isDirt && b.race_state === 1 && dB && keys.includes(dB)) scoreB = 2;
              else if ((isDirt && b.race_state === 1) || (dB && keys.includes(dB))) scoreB = 1;
            }
            if (scoreA !== scoreB) return scoreB - scoreA;
            return a.race_rank - b.race_rank;
          });

          const sel = matching[0];
          pattern[gradeName][idx] = {
            ...rd,
            race_name: sel.race_name,
            race_id: sel.race_id,
            distance: sel.distance,
            race_state: sel.race_state,
          };
          used.add(sel.race_id);
          addedAny = true;
        }
      }
    }
    if (!addedAny) break;
  }
}

/** パターンのレース構成と適性から推奨因子構成を計算する
 * @param uma - 対象ウマ娘の適性データ
 * @param patternRaces - パターンに含まれるレース一覧
 * @param strategy - 補強戦略（null の場合は適性スコアから自動判定）
 * @param isLarc - ラークシナリオかどうか
 * @returns 因子名の配列（6枠分）
 */
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

// --- Main Service ---

/** ウマ娘ごとの育成パターン提案を生成するサービス */
@Injectable()
export class RacePatternService {
  constructor(private readonly prisma: PrismaService) {}

  /** 指定ウマ娘の育成パターン候補を生成して返す
   * @param userId - ユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @returns 生成されたパターン候補の配列
   */
  async getRacePattern(userId: string, umamusumeId: number) {
    // 1. データ取得
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

    // 2. 事前準備
    const strategies = getReinforcementStrategies(umaData, remainingRacesAll);
    const { scenarioRaceIds } = extractConflictingRaces(scenarioRaces, remainingRacesAll);

    const raceMap = new Map<string, number>();
    for (const r of allGRaces) {
      raceMap.set(`${r.race_name}|${r.race_months}|${r.half_flag}`, r.race_id);
    }

    // 3. パターン生成
    const patterns: PatternData[] = [];
    const larcKeyNames = new Set(['凱旋門賞', 'ニエル賞', 'フォワ賞']);
    const hasRemainingLarc = remainingRacesAll.some((r) => larcKeyNames.has(r.race_name));
    let larcCreated = !hasRemainingLarc;
    const usedRaces = initializeUsedRaces(scenarioRaceIds, remainingRacesAll);

    let patternIndex = 0;
    while (true) {
      const usedBefore = usedRaces.size;
      const strategy = strategies[patternIndex % strategies.length];

      const remaining = filterRacesByStrategy([...remainingRacesAll], strategy, umaData);
      const { conflicting } = extractConflictingRaces(scenarioRaces, remaining);
      const availableConflicts = conflicting.filter((r) => !usedRaces.has(r.race_id));

      const { preferredSurface, preferredDistance } = determinePreferredConditions(umaData, availableConflicts);
      const { pattern, hasConflicts } = createBasePattern(conflicting, usedRaces, preferredSurface, preferredDistance);
      pattern.strategy = strategy;

      const larcResult = applyLarcScenario(pattern, larcCreated, raceMap, usedRaces, allGRaces);
      larcCreated = larcResult.larcCreated;

      // シナリオ名決定
      if (larcResult.isLarc) pattern.scenario = 'ラーク';
      else pattern.scenario = 'メイクラ';

      // 空きスロット充填
      getAllRacesInPattern(pattern, allGRaces);
      calculateAndSetMainConditions(pattern, getAllRacesInPattern(pattern, allGRaces));
      fillJuniorSlots(pattern, remaining, usedRaces);
      fillEmptySlots(pattern, remaining, usedRaces);

      const finalRaces = getAllRacesInPattern(pattern, allGRaces);
      calculateAndSetMainConditions(pattern, finalRaces);
      pattern.factors = calculateFactorComposition(umaData, finalRaces, strategy, larcResult.isLarc);
      pattern.totalRaces = finalRaces.length;

      if (usedRaces.size > usedBefore || larcResult.isLarc) {
        patterns.push(pattern);
      } else {
        break;
      }
      patternIndex++;
      if (patternIndex >= 20) break;
    }

    // 4. シナリオレースの取り扱い
    let foundNonConflicting = false;

    if (scenarioRaces.length > 0) {
      for (let i = 0; i < patterns.length; i++) {
        const isConflicting = scenarioRaces.some((sr) => {
          const grade = getRaceGrade(sr.race, sr);
          return patterns[i][grade].some(
            (rd: RaceSlotData) =>
              rd.month === sr.race.race_months &&
              rd.half === sr.race.half_flag &&
              rd.race_name,
          );
        });

        if (!isConflicting) {
          for (const sr of scenarioRaces) {
            const race = sr.race;
            const grade = getRaceGrade(race, sr);
            for (const rd of patterns[i][grade]) {
              if (rd.month === race.race_months && rd.half === race.half_flag && !rd.race_name) {
                rd.race_name = race.race_name;
                rd.race_id = race.race_id;
                rd.distance = race.distance;
                rd.race_state = race.race_state;
                break;
              }
            }
          }
          patterns[i].scenario = '伝説';
          patterns[i].strategy = null;
          const fr = getAllRacesInPattern(patterns[i], allGRaces);
          calculateAndSetMainConditions(patterns[i], fr);
          patterns[i].factors = calculateFactorComposition(umaData, fr);
          patterns[i].totalRaces = fr.length;
          foundNonConflicting = true;
        }
      }
    }

    // メイクラパターンのラーク再チェック
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].scenario === 'メイクラ') {
        patterns[i] = applyCheckLarcScenario(patterns[i], raceMap, allGRaces);
      }
    }

    if (scenarioRaces.some((sr) => registRaceIds.has(sr.race.race_id))) {
      foundNonConflicting = true;
    }

    // シナリオレース専用パターン追加
    if (scenarioRaces.length > 0 && !foundNonConflicting) {
      const sp: PatternData = { scenario: '伝説', strategy: null, junior: [], classic: [], senior: [] };
      const grades: [GradeName, number[]][] = [
        ['junior', Array.from({ length: 6 }, (_, i) => i + 7)],
        ['classic', Array.from({ length: 12 }, (_, i) => i + 1)],
        ['senior', Array.from({ length: 12 }, (_, i) => i + 1)],
      ];
      for (const [g, months] of grades) {
        for (const m of months) {
          for (const h of [false, true]) {
            sp[g].push({ race_name: '', race_id: null, distance: null, race_state: null, month: m, half: h });
          }
        }
      }

      for (const sr of scenarioRaces) {
        const race = sr.race;
        const grade = getRaceGrade(race, sr);
        for (const rd of sp[grade]) {
          if (rd.month === race.race_months && rd.half === race.half_flag) {
            rd.race_name = race.race_name;
            rd.race_id = race.race_id;
            rd.distance = race.distance;
            rd.race_state = race.race_state;
            break;
          }
        }
      }

      fillEmptySlots(sp, [...remainingRacesAll], usedRaces);
      const fr = getAllRacesInPattern(sp, allGRaces);
      calculateAndSetMainConditions(sp, fr);
      sp.factors = calculateFactorComposition(umaData, fr);
      sp.totalRaces = fr.length;
      patterns.push(sp);
    }

    return { patterns, umamusumeName: umaData.umamusume_name };
  }
}
