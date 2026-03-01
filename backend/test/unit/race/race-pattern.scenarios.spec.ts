import * as fs from 'fs';
import * as path from 'path';
import { RacePatternService } from '@src/race/pattern/race-pattern.service';
import { BCPatternBuilderService } from '@src/race/pattern/bc-pattern-builder.service';
import { LarcPatternBuilderService } from '@src/race/pattern/larc-pattern-builder.service';
import { BC_MANDATORY } from '@src/race/pattern/pattern.constants';
import { isRaceRunnable, buildAptitudeState } from '@src/race/pattern/pattern.helpers';
import type { RaceRow, ScenarioRaceRow, UmamusumeRow } from '@src/race/race.types';

/**
 * BCシナリオ残レース数（1/3/5/7/9）× ラーク残存（あり/なし）の組み合わせシナリオテスト
 *
 * 各ウマ娘について以下を検証する:
 * - BC残レース数に応じた BC パターン数が正しい
 * - ラーク残存ありの場合に larc パターンが 1 件含まれる
 * - ラーク残存なしの場合に larc パターンが含まれない
 * - 各パターンに必須フィールドが揃っている
 * - 未出走レースが全件いずれかのパターンに含まれている（全レース収録検証）
 */

// ============================================================
// テストデータ読み込み
// ============================================================

const DATA_DIR = path.join(__dirname, '../../../data');

const raceJson: Record<string, any> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'Race.json'), 'utf8'),
);
const umaJson: Record<string, any> = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'Umamusume.json'), 'utf8'),
);

/** Race.json を RaceRow[] に変換（race_id を連番付与） */
const allRacesFromJson: RaceRow[] = Object.values(raceJson).map((r: any, idx: number) => ({
  race_id: idx + 1,
  race_name: r.race_name,
  race_state: r.race_state,
  distance: r.distance,
  distance_detail: r.distance_detail ?? null,
  num_fans: r.num_fans,
  race_months: r.race_months,
  half_flag: r.half_flag,
  race_rank: r.race_rank,
  junior_flag: r.junior_flag,
  classic_flag: r.classic_flag,
  senior_flag: r.senior_flag,
  larc_flag: r.larc_flag,
  bc_flag: r.bc_flag,
}));

const raceByName = new Map<string, RaceRow>(allRacesFromJson.map((r) => [r.race_name, r]));

/** BC中間レース名（getRacePattern が raceTable から取得するレールに含まれる） */
const BC_MANDATORY_NAMES = new Set([
  'ホープフルステークス', '日本ダービー', 'ジャパンカップ', '宝塚記念',
  '阪神ジュベナイルフィリーズ', 'オークス', 'エリザベス女王杯', 'ヴィクトリアマイル',
  '京王杯ジュニアステークス', '葵ステークス', 'スプリンターズステークス', '高松宮記念',
  '朝日杯フューチュリティステークス', 'NHKマイルカップ', 'マイルチャンピオンシップ', '安田記念',
  'オキザリス賞', '昇竜ステークス', 'JBCスプリント', '根岸ステークス',
  '全日本ジュニア優駿', 'ユニコーンステークス', 'マイルチャンピオンシップ南部杯', 'フェブラリーステークス',
  '関東オークス', 'JBCレディスクラシック', 'TCK女王盃',
  'ジャパンダートダービー', 'JBCクラシック', '帝王賞',
]);

/**
 * raceTable.findMany のモックに返すレースプール
 * rank1-3 + BC中間レース名を含む（ラーク関連レースも rank1-3 であれば含まれる）
 */
const allGRaces: RaceRow[] = allRacesFromJson.filter(
  (r) => r.race_rank <= 3 || BC_MANDATORY_NAMES.has(r.race_name),
);

/** BC最終レース一覧（bc_flag=true） */
const bcFinalRaces = allGRaces.filter((r) => r.bc_flag);

/** ラーク関連レース（larc_flag または固有名） */
const LARC_RACE_NAMES = new Set(['凱旋門賞', 'ニエル賞', 'フォワ賞']);
const larcRaceIds = new Set(
  allGRaces
    .filter((r) => r.larc_flag || LARC_RACE_NAMES.has(r.race_name))
    .map((r) => r.race_id),
);

// ============================================================
// ヘルパー関数
// ============================================================

/** Umamusume.json のエントリから UmamusumeRow を生成する */
function makeUmamusumeRow(name: string, id: number): UmamusumeRow {
  const d = umaJson[name];
  return {
    umamusume_id: id,
    umamusume_name: name,
    turf_aptitude: d.turf_aptitude,
    dirt_aptitude: d.dirt_aptitude,
    front_runner_aptitude: d.front_runner_aptitude,
    early_foot_aptitude: d.early_foot_aptitude,
    midfield_aptitude: d.midfield_aptitude,
    closer_aptitude: d.closer_aptitude,
    sprint_aptitude: d.sprint_aptitude,
    mile_aptitude: d.mile_aptitude,
    classic_aptitude: d.classic_aptitude,
    long_distance_aptitude: d.long_distance_aptitude,
  };
}

/** Umamusume.json のシナリオ定義から ScenarioRaceRow[] を生成する */
function buildScenarioRaces(umaName: string, umaId: number): ScenarioRaceRow[] {
  const uma = umaJson[umaName];
  if (!uma?.scenarios) return [];

  return Object.entries(uma.scenarios).flatMap(([key, val]: [string, any]) => {
    let raceName: string;
    let seniorFlag: boolean | null;

    if (typeof val === 'string') {
      raceName = val;
      seniorFlag = null;
    } else {
      raceName = val['名前'];
      if (val['時期'] === 'シニア') seniorFlag = true;
      else if (val['時期'] === 'クラシック') seniorFlag = false;
      else seniorFlag = null;
    }

    const race = raceByName.get(raceName);
    if (!race) return [];

    return [
      {
        umamusume_id: umaId,
        race_id: race.race_id,
        race_number: parseInt(key),
        random_group: null,
        senior_flag: seniorFlag,
        race,
      } as ScenarioRaceRow,
    ];
  });
}

// ============================================================
// テスト対象ウマ娘（10 体）
// ============================================================

const TARGET_UMAS = [
  'スペシャルウィーク',
  'ハルウララ',
  'サクラバクシンオー',
  'ホッコータルマエ',
  'キングヘイロー',
  'ジェンティルドンナ',
  'アーモンドアイ',
  'ゴールドシップ',
  'エアグルーヴ',
  'テイエムオペラオー',
] as const;

const BC_COUNTS = [1, 3, 5, 7, 9] as const;

// ============================================================
// シードありランダムシャッフル（決定論的テスト用）
// ============================================================

/**
 * LCG (Linear Congruential Generator) を使ったシードありシャッフル
 * 同じシード文字列から常に同じ順列を生成する
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr];
  let s = seed.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0;
    const j = Math.abs(s) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ============================================================
// テスト本体
// ============================================================

describe('RacePatternService - BCシナリオ残レース数 × ラーク有無 シナリオテスト', () => {
  let service: RacePatternService;
  let mockPrisma: any;
  const mockLogger: any = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    mockPrisma = {
      registUmamusumeTable: { findUnique: jest.fn() },
      registUmamusumeRaceTable: { findMany: jest.fn() },
      raceTable: { findMany: jest.fn() },
      scenarioRaceTable: { findMany: jest.fn() },
    };
    const bcBuilder = new BCPatternBuilderService(mockLogger);
    const larcBuilder = new LarcPatternBuilderService();
    service = new RacePatternService(mockPrisma, mockLogger, bcBuilder, larcBuilder);
  });

  for (const umaName of TARGET_UMAS) {
    describe(umaName, () => {
      for (const bcCount of BC_COUNTS) {
        // bcCount が実際の BC レース数を超える場合は実際の数に丸める
        const actualBCCount = Math.min(bcCount, bcFinalRaces.length);

        describe(`BC残${bcCount}件`, () => {
          /**
           * describe スコープで共有する出走済みレース ID セット
           * 「全レース収録」検証テストから参照するために外部に持つ
           */
          let currentRunRaceIds: Set<number>;
          /** 「全レース収録」検証テストで適性フィルタに使用するウマ娘行データ */
          let currentUmaRow: UmamusumeRow;

          /**
           * モックをセットアップし、getRacePattern 呼び出し用の umaId を返す
           * @param hasLarc - ラーク残存ありの場合 true
           * @returns テスト用ウマ娘 ID
           */
          function setupMocks(hasLarc: boolean): number {
            const umaId = TARGET_UMAS.indexOf(umaName) + 1;
            const umaRow = makeUmamusumeRow(umaName, umaId);
            const scenarioRaces = buildScenarioRaces(umaName, umaId);

            // BC出走済みレース: 後ろ側 (bcFinalRaces.length - actualBCCount) 件
            const runBCRaceIds = new Set(
              bcFinalRaces.slice(actualBCCount).map((r) => r.race_id),
            );

            const runRaceIds = new Set(runBCRaceIds);

            // 出走済み BC 最終レースの中間レースも出走済みにする
            // BC最終を完走済みならその前提中間レースも必ず完走済みのため
            for (const bcFinal of bcFinalRaces.slice(actualBCCount)) {
              const mandatoryDefs = BC_MANDATORY[bcFinal.race_name] ?? [];
              for (const [, name] of mandatoryDefs) {
                const r = raceByName.get(name);
                if (r) runRaceIds.add(r.race_id);
              }
            }

            // 残っているBC最終レース（先頭 actualBCCount 件）の中間レースも出走済みにする
            // 実際のユースケースでは中間レースは既に出走済みであることが多い
            const remainingBCFinals = bcFinalRaces.slice(0, actualBCCount);
            for (const bcFinal of remainingBCFinals) {
              const mandatoryDefs = BC_MANDATORY[bcFinal.race_name] ?? [];
              for (const [, name] of mandatoryDefs) {
                const r = raceByName.get(name);
                if (r) runRaceIds.add(r.race_id);
              }
            }

            // ラーク残存なしの場合はラーク関連レースも出走済みに追加
            if (!hasLarc) {
              larcRaceIds.forEach((id) => runRaceIds.add(id));
            }

            // describe スコープの変数に保存（「全レース収録」テストで参照）
            currentRunRaceIds = runRaceIds;
            currentUmaRow = umaRow;

            mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue({
              user_id: 'test-user',
              umamusume_id: umaId,
              umamusume: umaRow,
            });
            // 出走済みレースを返す（service 内で remainingRacesAll を絞り込む）
            mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue(
              Array.from(runRaceIds).map((id) => ({ race_id: id })),
            );
            // raceTable.findMany は全レースプールを返す（WHERE 句は無視）
            mockPrisma.raceTable.findMany.mockResolvedValue(allGRaces);
            mockPrisma.scenarioRaceTable.findMany.mockResolvedValue(scenarioRaces);

            return umaId;
          }

          describe('ラーク残存あり', () => {
            it(`BC${actualBCCount}件 + larcパターンが生成される`, async () => {
              const umaId = setupMocks(true);
              const result = await service.getRacePattern('test-user', umaId);

              expect(result.umamusumeName).toBe(umaName);

              const bcPatterns = result.patterns.filter((p) => p.scenario === 'bc');
              const larcPatterns = result.patterns.filter((p) => p.scenario === 'larc');

              expect(bcPatterns.length).toBeGreaterThanOrEqual(actualBCCount);
              expect(larcPatterns.length).toBe(1);
            });

            it('各パターンに必須フィールドがある', async () => {
              const umaId = setupMocks(true);
              const result = await service.getRacePattern('test-user', umaId);

              for (const pattern of result.patterns) {
                expect(pattern).toHaveProperty('scenario');
                expect(Array.isArray(pattern.factors)).toBe(true);
                expect(pattern.factors).toHaveLength(6);
                expect((pattern.totalRaces ?? 0)).toBeGreaterThan(0);
              }
            });

            it('未出走レースが全件いずれかのパターンに含まれる', async () => {
              const umaId = setupMocks(true);
              const result = await service.getRacePattern('test-user', umaId);

              // 全パターンのスロットから race_id を収集
              const assignedRaceIds = new Set<number>();
              for (const pattern of result.patterns) {
                for (const slot of [...pattern.junior, ...pattern.classic, ...pattern.senior]) {
                  if (slot.race_id !== null) assignedRaceIds.add(slot.race_id);
                }
              }

              // 未出走レースのうち基本適性で走れるもののみ収録検証（走れないレースは除外）
              const baseAptState = buildAptitudeState(currentUmaRow);
              const unrunRaceIds = allGRaces
                .filter((r) => !currentRunRaceIds.has(r.race_id) && isRaceRunnable(r, baseAptState))
                .map((r) => r.race_id);

              for (const raceId of unrunRaceIds) {
                expect(assignedRaceIds).toContain(raceId);
              }
            });
          });

          describe('ラーク残存なし', () => {
            it(`BC${actualBCCount}件パターンのみ生成される（larcなし）`, async () => {
              const umaId = setupMocks(false);
              const result = await service.getRacePattern('test-user', umaId);

              expect(result.umamusumeName).toBe(umaName);

              const bcPatterns = result.patterns.filter((p) => p.scenario === 'bc');
              const larcPatterns = result.patterns.filter((p) => p.scenario === 'larc');

              expect(bcPatterns.length).toBeGreaterThanOrEqual(actualBCCount);
              expect(larcPatterns.length).toBe(0);
            });

            it('各パターンに必須フィールドがある', async () => {
              const umaId = setupMocks(false);
              const result = await service.getRacePattern('test-user', umaId);

              for (const pattern of result.patterns) {
                expect(pattern).toHaveProperty('scenario');
                expect(Array.isArray(pattern.factors)).toBe(true);
                expect(pattern.factors).toHaveLength(6);
                expect((pattern.totalRaces ?? 0)).toBeGreaterThan(0);
              }
            });

            it('未出走レースが全件いずれかのパターンに含まれる', async () => {
              const umaId = setupMocks(false);
              const result = await service.getRacePattern('test-user', umaId);

              // 全パターンのスロットから race_id を収集
              const assignedRaceIds = new Set<number>();
              for (const pattern of result.patterns) {
                for (const slot of [...pattern.junior, ...pattern.classic, ...pattern.senior]) {
                  if (slot.race_id !== null) assignedRaceIds.add(slot.race_id);
                }
              }

              // 未出走レースのうち基本適性で走れるもののみ収録検証（走れないレースは除外）
              const baseAptState = buildAptitudeState(currentUmaRow);
              const unrunRaceIds = allGRaces
                .filter((r) => !currentRunRaceIds.has(r.race_id) && isRaceRunnable(r, baseAptState))
                .map((r) => r.race_id);

              for (const raceId of unrunRaceIds) {
                expect(assignedRaceIds).toContain(raceId);
              }
            });
          });
        });
      }
    });
  }
});

// ============================================================
// ランダムBC出走済み × 全レース収録検証
// ============================================================

/**
 * seededShuffle を使い、どの BC レースがランダムに選ばれても
 * 未出走レースが全件いずれかのパターンに収録されることを検証する
 *
 * 各ウマ娘 × 出走済み BC 件数（1/3/5/7/9）= 最大 50 シナリオ
 * シャッフルシード: "${umaName}-${runCount}" で決定論的に再現可能
 */
describe('RacePatternService - ランダムBC出走済み × 全レース収録検証', () => {
  let service: RacePatternService;
  let mockPrisma: any;
  const mockLogger: any = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    mockPrisma = {
      registUmamusumeTable: { findUnique: jest.fn() },
      registUmamusumeRaceTable: { findMany: jest.fn() },
      raceTable: { findMany: jest.fn() },
      scenarioRaceTable: { findMany: jest.fn() },
    };
    const bcBuilder = new BCPatternBuilderService(mockLogger);
    const larcBuilder = new LarcPatternBuilderService();
    service = new RacePatternService(mockPrisma, mockLogger, bcBuilder, larcBuilder);
  });

  for (const umaName of TARGET_UMAS) {
    describe(umaName, () => {
      for (const runCount of BC_COUNTS) {
        const actualRunCount = Math.min(runCount, bcFinalRaces.length);
        const seed = `${umaName}-${runCount}`;
        const shuffledBC = seededShuffle(bcFinalRaces, seed);
        // 出走済みとして選ぶ BC 最終レース（ランダム選択）
        const runBCFinals = shuffledBC.slice(0, actualRunCount);
        // まだ残っている BC 最終レース
        const remainBCFinals = shuffledBC.slice(actualRunCount);

        it(`ランダム${actualRunCount}件BC出走済みで残レース全件パターン収録`, async () => {
          const umaId = TARGET_UMAS.indexOf(umaName) + 1;
          const umaRow = makeUmamusumeRow(umaName, umaId);
          const scenarioRaces = buildScenarioRaces(umaName, umaId);

          const runRaceIds = new Set<number>();

          // 出走済み BC 最終レースとその中間レースをマーク
          for (const bcFinal of runBCFinals) {
            runRaceIds.add(bcFinal.race_id);
            const mandatoryDefs = BC_MANDATORY[bcFinal.race_name] ?? [];
            for (const [, name] of mandatoryDefs) {
              const r = raceByName.get(name);
              if (r) runRaceIds.add(r.race_id);
            }
          }

          // 残存 BC 最終レースの中間レースも出走済みとする
          // （実ユースケースでは BC 最終レースへの道中レースは先に消化済み）
          for (const bcFinal of remainBCFinals) {
            const mandatoryDefs = BC_MANDATORY[bcFinal.race_name] ?? [];
            for (const [, name] of mandatoryDefs) {
              const r = raceByName.get(name);
              if (r) runRaceIds.add(r.race_id);
            }
          }

          mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue({
            user_id: 'test-user',
            umamusume_id: umaId,
            umamusume: umaRow,
          });
          mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue(
            Array.from(runRaceIds).map((id) => ({ race_id: id })),
          );
          mockPrisma.raceTable.findMany.mockResolvedValue(allGRaces);
          mockPrisma.scenarioRaceTable.findMany.mockResolvedValue(scenarioRaces);

          const result = await service.getRacePattern('test-user', umaId);

          // 全パターンのスロットから race_id を収集
          const assignedRaceIds = new Set<number>();
          for (const pattern of result.patterns) {
            for (const slot of [...pattern.junior, ...pattern.classic, ...pattern.senior]) {
              if (slot.race_id !== null) assignedRaceIds.add(slot.race_id);
            }
          }

          // 未出走レースのうち基本適性で走れるもののみ収録検証（走れないレースは除外）
          const baseAptState = buildAptitudeState(umaRow);
          const unrunRaceIds = allGRaces
            .filter((r) => !runRaceIds.has(r.race_id) && isRaceRunnable(r, baseAptState))
            .map((r) => r.race_id);

          for (const raceId of unrunRaceIds) {
            expect(assignedRaceIds).toContain(raceId);
          }
        });
      }
    });
  }
});
