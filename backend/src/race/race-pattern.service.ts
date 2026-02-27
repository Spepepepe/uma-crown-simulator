import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GradeName } from '@uma-crown/shared';
import type {
  RaceRow,
  ScenarioRaceRow,
  UmamusumeRow,
  PatternData,
  AptitudeState,
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

/** larc_flag を持たないがラーク残存判定に使うレース名 */
const LARC_SPECIFIC_NAMES = new Set(['凱旋門賞', 'ニエル賞', 'フォワ賞']);

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
          race_rank: race?.race_rank ?? null,
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

  // A パターン: 補修が必要な因子を戦略として返す（1属性あたり最大3因子に制限）
  const strategy: Record<string, number> = {};
  if (surfaceNeeded > 0) strategy[surface] = Math.min(surfaceNeeded, 3);
  if (distanceNeeded > 0 && distance) strategy[distance] = Math.min(distanceNeeded, 3);
  return strategy;
}

/** ウマ娘の現在適性から AptitudeState を生成する */
function buildAptitudeState(uma: UmamusumeRow): AptitudeState {
  return {
    turf: uma.turf_aptitude,
    dirt: uma.dirt_aptitude,
    sprint: uma.sprint_aptitude,
    mile: uma.mile_aptitude,
    classic: uma.classic_aptitude,
    long: uma.long_distance_aptitude,
  };
}

const RANK_ORDER = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;

/**
 * 因子戦略を適性オブジェクトに適用し、向上後の適性状態を返す
 * 因子一つにつき一段階向上（G→F, F→E, E→D, ...）
 */
function applyStrategyToAptitude(
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
 */
function raceMatchesAptitude(
  race: RaceRow,
  aptState: AptitudeState,
  bcFinalRace?: RaceRow,
): boolean {
  if (bcFinalRace) {
    // BC パターン: BC 最終レースと同じ馬場・距離のみ優先配置対象
    return race.race_state === bcFinalRace.race_state && race.distance === bcFinalRace.distance;
  }
  // 非 BC パターン（ラーク等）: 適性オブジェクトで判断
  const surfKey: keyof AptitudeState = race.race_state === 0 ? 'turf' : 'dirt';
  const distKeys: (keyof AptitudeState)[] = ['sprint', 'mile', 'classic', 'long'];
  const distKey = distKeys[race.distance - 1];
  return getApt(aptState[surfKey]) >= 1 && getApt(aptState[distKey]) >= 1;
}

/**
 * パターンの適性オブジェクトに対して、指定レースを走れるか（D 以上）を確認する
 * 馬場または距離適性が D 未満（E/F/G: スコア < 0）の場合は走っても勝てない
 */
function isRaceRunnable(race: RaceRow, aptState: AptitudeState): boolean {
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
function calcRunnableEnhancement(
  race: RaceRow,
  aptState: AptitudeState,
  currentStrategy: Record<string, number> | null,
): Record<string, number> | null {
  const surfKey: keyof AptitudeState = race.race_state === 0 ? 'turf' : 'dirt';
  const distKeys: (keyof AptitudeState)[] = ['sprint', 'mile', 'classic', 'long'];
  const distKey = distKeys[race.distance - 1];
  const surfApt = getApt(aptState[surfKey]);
  const distApt = getApt(aptState[distKey]);

  // 既に走れる場合はこの関数を呼ぶべきではない
  if (surfApt >= 0 && distApt >= 0) return null;

  // 現在の戦略が使用しているスロット数
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
    const distName = DISTANCE_MAP[race.distance];
    if (distName) enhancement[distName] = distNeeded;
  }
  return enhancement;
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
  // 残りスロットをパターン外の弱距離適性因子で補完する（D未満のみ、必要枚数ずつ）
  if (factors.length < 6) {
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
  while (factors.length < 6) factors.push('自由');
  return factors.slice(0, 6);
}

// ============================================================
// 中間データ型
// ============================================================

/** Phase 1 で取得した DB データをまとめた中間型 */
interface FetchedRaceData {
  umaData: UmamusumeRow;
  allGRaces: RaceRow[];
  remainingRacesAll: RaceRow[];
  scenarioRaces: ScenarioRaceRow[];
  scenarioSlotSet: Set<string>;
  hasRemainingLarc: boolean;
  registRaceIds: Set<number>;
}

/** Phase 3-5 で初期化した BC パターン構造をまとめた中間型 */
interface BCPatternsInit {
  sortedBCRaces: RaceRow[];
  grid: Map<string, RaceRow>[];
  patternStrategies: (Record<string, number> | null)[];
  aptitudeStates: AptitudeState[];
  bcMandatoryPrePlacedIds: Set<number>;
  racesToAssign: RaceRow[];
}

// ============================================================
// メインサービス
// ============================================================

/**
 * 育成ローテーションパターン生成サービス
 *
 * ウマ娘の残レースをグリッドベース一括割り当てアルゴリズムで複数の育成パターンに分配し、
 * 適性・シナリオ制約・連続出走制限を考慮した最適なローテーションを生成する。
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
   * Phase 1: 対象ウマ娘データ・出走済みレースデータ・残レースデータを取得
   * Phase 2: BCシナリオの残レース数を取得
   * Phase 3: BC数分のパターンを生成
   * Phase 4: BCシナリオの中間レースを設定し、出走済みに追加・残レースから除外
   * Phase 5: BC最終レースの適性を判断し、適性オブジェクトをパターンに設定
   * Phase 6: ジュニア7月頭から時系列で残レースを各パターンへ割り当て
   * Phase 7: ラークのレースが残レースに存在していればラークパターンを追加
   * Phase 8: Phase 7 後に未割り当て残レースが存在すればオーバーフロー BC パターンを追加
   * Phase 9: 各パターン後処理（因子計算・主馬場距離集計）
   *
   * @param userId - 対象ユーザーの UUID
   * @param umamusumeId - 対象ウマ娘 ID
   * @returns 育成パターン配列と対象ウマ娘名
   * @throws {InternalServerErrorException} 登録ウマ娘が見つからない場合
   */
  async getRacePattern(userId: string, umamusumeId: number) {
    this.logger.info({ userId, umamusumeId }, 'パターン生成開始');

    // Phase 1
    const fetched = await this.fetchRaceData(userId, umamusumeId);
    const { umaData, allGRaces, remainingRacesAll, scenarioRaces, scenarioSlotSet, hasRemainingLarc, registRaceIds } = fetched;

    if (remainingRacesAll.length === 0) {
      return { patterns: [], umamusumeName: umaData.umamusume_name };
    }

    // Phase 2: BCシナリオの残レース数を取得
    const remainingBCRaces = remainingRacesAll.filter((r) => r.bc_flag);
    const nBC = remainingBCRaces.length;

    this.logger.debug({ nBC, hasRemainingLarc }, 'Phase 2 完了: BC残レース数取得');

    // Phase 3-5
    const bcInit = this.initializeBCPatterns(
      umaData, remainingBCRaces, remainingRacesAll, hasRemainingLarc, scenarioRaces,
    );
    const { sortedBCRaces, grid, patternStrategies, aptitudeStates, racesToAssign } = bcInit;

    // Phase 6
    const assignedRaceIds = this.assignRacesToBCGrids(
      nBC, sortedBCRaces, grid, patternStrategies, aptitudeStates, racesToAssign, scenarioSlotSet, umaData,
    );

    // Phase 7
    const larcAptState = this.buildLarcAptitudeState(umaData);
    let larcAssignedIds = new Set<number>();
    if (hasRemainingLarc) {
      const larcGrid = this.buildLarcGrid(
        racesToAssign, assignedRaceIds, remainingRacesAll, larcAptState, scenarioSlotSet,
      );
      larcAssignedIds = new Set([...larcGrid.values()].map((r) => r.race_id));
      grid.push(larcGrid);
      patternStrategies.push(null);
      aptitudeStates.push(larcAptState);
      this.logger.info({ umamusumeId }, 'Phase 7 完了: ラークパターン追加');
    }
    const nLarc = hasRemainingLarc ? 1 : 0;

    // Phase 9: Phase 7 後に未割り当て残レースがあればオーバーフロー BC パターンを追加
    const allAssignedIds = new Set([...assignedRaceIds, ...larcAssignedIds]);
    const remainingAfterPhase7 = racesToAssign.filter((r) => !allAssignedIds.has(r.race_id));
    if (remainingAfterPhase7.length > 0) {
      const overflowResults = this.buildOverflowPatterns(
        remainingAfterPhase7, allGRaces, remainingRacesAll, umaData, scenarioSlotSet,
      );
      for (const { grid: og, strategy: os, aptState: oa } of overflowResults) {
        grid.push(og);
        patternStrategies.push(os);
        aptitudeStates.push(oa);
      }
      this.logger.info({ overflowCount: overflowResults.length }, 'Phase 9 完了: オーバーフローパターン追加');
    }

    // Phase 8
    const result = this.buildAndFinalizePatterns(
      grid, nBC, nLarc, patternStrategies, aptitudeStates, larcAptState, umaData, allGRaces,
    );
    return { ...result, registeredRaceIds: Array.from(registRaceIds) };
  }

  /**
   * Phase 1: DB からウマ娘・レースデータを取得し、中間データを返す
   */
  private async fetchRaceData(userId: string, umamusumeId: number): Promise<FetchedRaceData> {
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
    const registRaceIds = new Set<number>(registRaceRows.map((r) => r.race_id));

    // G1/G2/G3 に加え BC 必須中間レース名（rank=4 等）も取得する
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

    // シナリオスロットセット（連続出走カウント除外用）
    const scenarioSlotSet = new Set<string>();
    for (const sr of scenarioRaces) {
      const grade = getRaceGrade(sr.race, sr);
      scenarioSlotSet.add(sk(grade, sr.race.race_months, sr.race.half_flag));
    }

    // larc_flag またはラーク固有レース名でラーク残存を判定
    const hasRemainingLarc = remainingRacesAll.some(
      (r) => r.larc_flag || LARC_SPECIFIC_NAMES.has(r.race_name),
    );

    return { umaData, allGRaces, remainingRacesAll, scenarioRaces, scenarioSlotSet, hasRemainingLarc, registRaceIds };
  }

  /**
   * Phase 3-5: BCパターンのグリッド・戦略・適性を初期化し、割り当て対象レースを絞り込む
   * - Phase 3: A/B パターンのソートとグリッド生成
   * - Phase 4: BC最終・中間レースの強制配置
   * - Phase 5: 因子戦略を適性状態に適用
   */
  private initializeBCPatterns(
    umaData: UmamusumeRow,
    remainingBCRaces: RaceRow[],
    remainingRacesAll: RaceRow[],
    hasRemainingLarc: boolean,
    scenarioRaces: ScenarioRaceRow[],
  ): BCPatternsInit {
    const nBC = remainingBCRaces.length;

    // Phase 3: A パターン（補修あり）→ B パターン（補修なし）の順にソート
    const sortedBCRaces = nBC > 0
      ? [...remainingBCRaces].sort((a, b) => {
          const stratA = calcBCStrategy(a, umaData);
          const stratB = calcBCStrategy(b, umaData);
          if (stratA && !stratB) return -1;
          if (!stratA && stratB) return 1;
          return 0;
        })
      : [];

    const grid: Map<string, RaceRow>[] = Array.from({ length: nBC }, () => new Map());
    const patternStrategies: (Record<string, number> | null)[] = sortedBCRaces.map(
      (bc) => calcBCStrategy(bc, umaData),
    );
    const aptitudeStates: AptitudeState[] = sortedBCRaces.map(() => buildAptitudeState(umaData));

    this.logger.debug({ nBC }, 'Phase 3 完了: パターン生成');

    // Phase 4: BC最終レースをグリッドに配置し、中間レースを強制配置
    const bcMandatoryPrePlacedIds = new Set<number>();
    const bcFinalSlotKey = sk(BC_FINAL_SLOT.grade, BC_FINAL_SLOT.month, BC_FINAL_SLOT.half);

    for (let i = 0; i < nBC; i++) {
      grid[i].set(bcFinalSlotKey, sortedBCRaces[i]);
    }

    for (let i = 0; i < nBC; i++) {
      const bcFinalName = sortedBCRaces[i].race_name;
      const mandatory = BC_MANDATORY[bcFinalName] ?? [];
      for (const [grade, raceName, month, half] of mandatory) {
        const slotK = sk(grade, month, half);
        if (grid[i].has(slotK)) continue;
        const race = remainingRacesAll.find((r) => r.race_name === raceName);
        if (!race) continue; // 既に勝利済み
        grid[i].set(slotK, race);
        bcMandatoryPrePlacedIds.add(race.race_id);
      }
    }

    this.logger.debug({ bcMandatoryCount: bcMandatoryPrePlacedIds.size }, 'Phase 4 完了: BC中間レース配置・除外');

    // Phase 5: 因子戦略を適性状態に適用
    for (let i = 0; i < nBC; i++) {
      const strategy = patternStrategies[i];
      if (strategy) {
        aptitudeStates[i] = applyStrategyToAptitude(aptitudeStates[i], strategy);
      }
    }

    this.logger.debug({}, 'Phase 5 完了: 適性オブジェクト設定');

    // 割り当て対象レースの絞り込み（シナリオ・ラーク専用・BC・BC中間を除外）
    const scenarioRaceIds = new Set(scenarioRaces.map((sr) => sr.race.race_id));
    const racesToAssign = remainingRacesAll.filter(
      (r) =>
        !scenarioRaceIds.has(r.race_id) &&
        !(hasRemainingLarc && LARC_EXCLUSIVE_NAMES.has(r.race_name)) &&
        !r.bc_flag &&
        !bcMandatoryPrePlacedIds.has(r.race_id),
    );

    return { sortedBCRaces, grid, patternStrategies, aptitudeStates, bcMandatoryPrePlacedIds, racesToAssign };
  }

  /**
   * Phase 6: 時系列で残レースを各 BC パターンへ割り当てる
   * grid / patternStrategies / aptitudeStates を直接更新し、割り当て済みレース ID セットを返す
   */
  private assignRacesToBCGrids(
    nBC: number,
    sortedBCRaces: RaceRow[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    racesToAssign: RaceRow[],
    scenarioSlotSet: Set<string>,
    umaData: UmamusumeRow,
  ): Set<number> {
    const assignedRaceIds = new Set<number>();

    for (const slot of ORDERED_SLOTS) {
      // BC最終レース（シニア11月前半）より後のスロットはスキップ
      if (isBCRestrictedSlot(slot.grade, slot.month, slot.half)) continue;

      const slotK = sk(slot.grade, slot.month, slot.half);

      // このスロットに配置可能な未割り当てレース一覧
      const candidateRaces = racesToAssign.filter((race) => {
        if (assignedRaceIds.has(race.race_id)) return false;
        return getAvailableSlots(race).some(
          (s) => s.grade === slot.grade && s.month === slot.month && s.half === slot.half,
        );
      });

      if (candidateRaces.length === 0) continue;

      // (race, pattern) の割り当て候補リストをスコア付きで生成
      const candidates: {
        race: RaceRow;
        pi: number;
        score: number;
        needsStrategySet: boolean;
        enhancement: Record<string, number> | null;
      }[] = [];

      for (const race of candidateRaces) {
        for (let pi = 0; pi < nBC; pi++) {
          if (grid[pi].has(slotK)) continue;
          if (isConsecutiveViolation(grid[pi], slotK, scenarioSlotSet)) continue;

          // 馬場・距離適性が D 未満（E/F/G）の場合、因子補修で走れるようになるか確認
          let enhancement: Record<string, number> | null = null;
          if (!isRaceRunnable(race, aptitudeStates[pi])) {
            enhancement = calcRunnableEnhancement(race, aptitudeStates[pi], patternStrategies[pi]);
            if (!enhancement) continue; // 補修不可なら除外
          }

          const matchesApt = raceMatchesAptitude(race, aptitudeStates[pi], sortedBCRaces[pi]);
          const isNullStrategy = patternStrategies[pi] === null;
          let score = 0;
          let needsStrategySet = false;

          if (enhancement) {
            // 因子補修でのみ走れるレース（空きスロットを消費して D 適性に引き上げ）
            score += 1;
          } else if (matchesApt) {
            score += 10; // 適性オブジェクトとのマッチ（最優先）
          } else if (isNullStrategy) {
            // 因子戦略が未決定のパターン → 吸収可能
            const raceStrategy = calcBCStrategy(race, umaData);
            if (raceStrategy === null) {
              score += 5; // ウマ娘の自然適性でも走れる（因子不要）
            } else {
              score += 2; // 因子戦略を設定すれば走れる
              needsStrategySet = true;
            }
          }
          // else: score = 0（非マッチ・戦略確定済みパターン）→ フォールバックとして残す

          score -= getConsecutiveLength(grid[pi], slotK, scenarioSlotSet); // 連続出走ペナルティ
          score += (4 - race.race_rank); // G1=+3, G2=+2, G3=+1

          candidates.push({ race, pi, score, needsStrategySet, enhancement });
        }
      }

      if (candidates.length === 0) continue;

      candidates.sort((a, b) => b.score - a.score);

      const usedPatterns = new Set<number>();
      const usedRaces = new Set<number>();

      /** 因子補修戦略を既存 strategy にマージして適性状態を更新する */
      const applyEnhancement = (pi: number, enh: Record<string, number>) => {
        const merged: Record<string, number> = { ...(patternStrategies[pi] ?? {}) };
        for (const [key, val] of Object.entries(enh)) {
          merged[key] = (merged[key] ?? 0) + val;
        }
        patternStrategies[pi] = merged;
        aptitudeStates[pi] = applyStrategyToAptitude(buildAptitudeState(umaData), merged);
      };

      // まずスコア > 0 の候補で割り当て（適性マッチ・因子戦略未決定パターン優先）
      for (const { race, pi, score, needsStrategySet, enhancement } of candidates) {
        if (score <= 0) continue;
        if (usedPatterns.has(pi)) continue;
        if (usedRaces.has(race.race_id) || assignedRaceIds.has(race.race_id)) continue;

        // 因子戦略が未決定のパターンに戦略を設定し適性オブジェクトを更新
        if (needsStrategySet) {
          const newStrategy = calcBCStrategy(race, umaData);
          if (newStrategy) {
            patternStrategies[pi] = newStrategy;
            aptitudeStates[pi] = applyStrategyToAptitude(buildAptitudeState(umaData), newStrategy);
          }
        }
        if (enhancement) applyEnhancement(pi, enhancement);

        grid[pi].set(slotK, race);
        usedPatterns.add(pi);
        usedRaces.add(race.race_id);
        assignedRaceIds.add(race.race_id);
      }

      // スコア > 0 で割り当てられなかったレースをフォールバック割り当て（最後の手段）
      for (const { race, pi, enhancement } of candidates) {
        if (usedPatterns.has(pi)) continue;
        if (usedRaces.has(race.race_id) || assignedRaceIds.has(race.race_id)) continue;

        if (enhancement) applyEnhancement(pi, enhancement);

        grid[pi].set(slotK, race);
        usedPatterns.add(pi);
        usedRaces.add(race.race_id);
        assignedRaceIds.add(race.race_id);
      }
    }

    this.logger.debug({ assignedCount: assignedRaceIds.size }, 'Phase 6 完了: 時系列レース割り当て');
    return assignedRaceIds;
  }

  /**
   * ラークシナリオ補正後の適性状態を生成する
   * ラークシナリオでは芝・中距離適性がシナリオ補正により最低 A になる
   */
  private buildLarcAptitudeState(umaData: UmamusumeRow): AptitudeState {
    const base = buildAptitudeState(umaData);
    const maxRank = (rank: string, min: string): string =>
      RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]) >=
      RANK_ORDER.indexOf(min as (typeof RANK_ORDER)[number])
        ? rank
        : min;
    return { ...base, turf: maxRank(base.turf, 'A'), classic: maxRank(base.classic, 'A') };
  }

  /**
   * Phase 7: ラークパターンのグリッドを構築する
   * LARC_MANDATORY を強制配置し、未割り当て残レースをラーク制限を考慮して配置する
   */
  private buildLarcGrid(
    racesToAssign: RaceRow[],
    assignedRaceIds: Set<number>,
    remainingRacesAll: RaceRow[],
    larcAptState: AptitudeState,
    scenarioSlotSet: Set<string>,
  ): Map<string, RaceRow> {
    const larcGrid: Map<string, RaceRow> = new Map();

    // LARC_MANDATORY レースを配置
    for (const [grade, name, month, half] of LARC_MANDATORY) {
      const slotK = sk(grade, month, half);
      if (larcGrid.has(slotK)) continue;
      const larcRace = remainingRacesAll.find((r) => r.race_name === name);
      if (larcRace) larcGrid.set(slotK, larcRace);
    }

    // Phase 6 で未割り当ての残レースをラーク制限を考慮して配置
    for (const race of racesToAssign) {
      if (assignedRaceIds.has(race.race_id)) continue;
      // 馬場・距離適性が D 未満（E/F/G）では走れないため除外（ラーク補正適性で判定）
      if (!isRaceRunnable(race, larcAptState)) continue;
      let placed = false;
      for (const slot of getAvailableSlots(race)) {
        if (placed) break;
        const slotK = sk(slot.grade, slot.month, slot.half);
        if (larcGrid.has(slotK)) continue;
        if (isLarcRestrictedSlot(slot.grade, slot.month, slot.half)) continue;
        if (isConsecutiveViolation(larcGrid, slotK, scenarioSlotSet)) continue;
        larcGrid.set(slotK, race);
        placed = true;
      }
    }

    return larcGrid;
  }

  /**
   * Phase 9: 未割り当て残レースをオーバーフロー BC パターンに割り当てる
   *
   * Phase 7 後に残ったレースを、全 BC 最終レースをテンプレートとして
   * 残レースが最も多く走れるシナリオを順に選択し、パターンを追加する。
   * 自然適性で走れる BC シナリオを優先し、残レースがなくなるまでループする。
   */
  private buildOverflowPatterns(
    remainingRaces: RaceRow[],
    allGRaces: RaceRow[],
    remainingRacesAll: RaceRow[],
    umaData: UmamusumeRow,
    scenarioSlotSet: Set<string>,
  ): { grid: Map<string, RaceRow>; strategy: Record<string, number> | null; aptState: AptitudeState }[] {
    const results: { grid: Map<string, RaceRow>; strategy: Record<string, number> | null; aptState: AptitudeState }[] = [];
    const allBCFinalRaces = allGRaces.filter((r) => r.bc_flag);
    const usedBCTemplates = new Set<number>();
    let remaining = [...remainingRaces];

    while (remaining.length > 0) {
      // 残レースに最も適した BC シナリオを選択（未使用テンプレートのみ）
      let bestBC: RaceRow | null = null;
      let bestStrategy: Record<string, number> | null = null;
      let bestAptState: AptitudeState = buildAptitudeState(umaData);
      let bestScore = -Infinity;

      for (const bcRace of allBCFinalRaces) {
        if (usedBCTemplates.has(bcRace.race_id)) continue;
        const strategy = calcBCStrategy(bcRace, umaData);
        const aptState = strategy
          ? applyStrategyToAptitude(buildAptitudeState(umaData), strategy)
          : buildAptitudeState(umaData);
        // 自然適性で走れる BC シナリオを優先（+100）、走れる残レース数でスコア加算
        const runnableCount = remaining.filter(
          (r) => isRaceRunnable(r, aptState) || calcRunnableEnhancement(r, aptState, strategy) !== null,
        ).length;
        const score = (strategy === null ? 100 : 0) + runnableCount;
        if (score > bestScore) {
          bestScore = score;
          bestBC = bcRace;
          bestStrategy = strategy;
          bestAptState = aptState;
        }
      }

      if (!bestBC) break; // 全テンプレート使用済み

      usedBCTemplates.add(bestBC.race_id);

      // グリッドを生成し BC 最終レースを配置
      const newGrid = new Map<string, RaceRow>();
      const bcSlotKey = sk(BC_FINAL_SLOT.grade, BC_FINAL_SLOT.month, BC_FINAL_SLOT.half);
      newGrid.set(bcSlotKey, bestBC);

      // BC 必須中間レースを配置（未完走のもののみ）
      for (const [grade, raceName, month, half] of BC_MANDATORY[bestBC.race_name] ?? []) {
        const slotK = sk(grade, month, half);
        if (newGrid.has(slotK)) continue;
        const race = remainingRacesAll.find((r) => r.race_name === raceName);
        if (race) newGrid.set(slotK, race);
      }

      // 残レースをこのグリッドに割り当て
      const patternStrategiesLocal: (Record<string, number> | null)[] = [bestStrategy];
      const aptitudeStatesLocal: AptitudeState[] = [bestAptState];
      const newlyAssigned = this.assignRacesToBCGrids(
        1, [bestBC], [newGrid], patternStrategiesLocal, aptitudeStatesLocal,
        remaining, scenarioSlotSet, umaData,
      );

      if (newlyAssigned.size > 0) {
        results.push({
          grid: newGrid,
          strategy: patternStrategiesLocal[0],
          aptState: aptitudeStatesLocal[0],
        });
        remaining = remaining.filter((r) => !newlyAssigned.has(r.race_id));
      }
      // 0件割り当てでも usedBCTemplates に追加済みなので次のテンプレートへ
    }

    return results;
  }

  /**
   * Phase 8: グリッドから PatternData を構築し後処理（因子計算・主馬場距離集計）を実行する
   */
  private buildAndFinalizePatterns(
    grid: Map<string, RaceRow>[],
    nBC: number,
    nLarc: number,
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    larcAptState: AptitudeState,
    umaData: UmamusumeRow,
    allGRaces: RaceRow[],
  ): { patterns: PatternData[]; umamusumeName: string } {
    const patterns: PatternData[] = grid.map((patternGrid, pi) => {
      const pattern = buildPatternFromGrid(patternGrid);
      if (pi < nBC) {
        // BC パターン
        pattern.scenario = 'bc';
        pattern.strategy = patternStrategies[pi] ?? null;
        pattern.aptitudeState = aptitudeStates[pi];
      } else if (pi < nBC + nLarc) {
        // ラークパターン
        pattern.scenario = 'larc';
        pattern.strategy = null;
        pattern.aptitudeState = larcAptState;
      } else {
        // Phase 9 オーバーフロー BC パターン
        pattern.scenario = 'bc';
        pattern.strategy = patternStrategies[pi] ?? null;
        pattern.aptitudeState = aptitudeStates[pi];
      }
      return pattern;
    });

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
