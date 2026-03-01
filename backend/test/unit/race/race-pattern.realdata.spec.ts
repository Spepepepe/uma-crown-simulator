import * as fs from 'fs';
import * as path from 'path';
import { RacePatternService } from '@src/race/pattern/race-pattern.service';
import { BCPatternBuilderService } from '@src/race/pattern/bc-pattern-builder.service';
import { LarcPatternBuilderService } from '@src/race/pattern/larc-pattern-builder.service';
import type { RaceRow, ScenarioRaceRow, UmamusumeRow } from '@src/race/race.types';

/**
 * 実データ（Race.json / Umamusume.json）を使った結合テスト
 *
 * 以下のウマ娘で「全レース未走」前提のパターン生成を実行し、
 * 通常割り当てレースに適性違反（D未満の馬場・距離）が発生しないことを確認する。
 * BC必須中間レース・BC最終レース・ラーク必須レースはゲーム仕様で強制配置のため除外する。
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

/** getRacePattern が raceTable.findMany で取得する対象（rank1-3 + BC中間レース名） */
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

/** ラーク必須レース名（ゲーム仕様で強制配置） */
const LARC_MANDATORY_NAMES = new Set(['日本ダービー', 'ニエル賞', '凱旋門賞', '宝塚記念', 'フォワ賞']);

const mockAllGRaces: RaceRow[] = allRacesFromJson.filter(
  (r) => r.race_rank <= 3 || BC_MANDATORY_NAMES.has(r.race_name),
);

// ============================================================
// ヘルパー関数
// ============================================================

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

/**
 * Umamusume.json の scenarios フィールドから ScenarioRaceRow[] を構築する
 * 値が文字列 → senior_flag = null（レース自身のフラグで判定）
 * 値が {名前, 時期} → 時期="シニア" → true, "クラシック" → false
 */
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

/** 適性スコアマップ */
const APT_MAP: Record<string, number> = {
  S: 4, A: 3, B: 2, C: 1, D: 0, E: -1, F: -2, G: -3,
};
function getApt(char: string): number {
  return APT_MAP[char] ?? 0;
}

// ============================================================
// テスト対象ウマ娘
// ============================================================

const TARGET_UMAS = [
  'スペシャルウィーク',
  'ハルウララ',
  'サクラバクシンオー',
  'ホッコータルマエ',
  'キングヘイロー',
  'ジェンティルドンナ',
  'アーモンドアイ',
] as const;

// ============================================================
// テスト本体
// ============================================================

describe('RacePatternService - 実データ結合テスト（全レース未走前提）', () => {
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
      let umaRow: UmamusumeRow;
      let scenarioRaces: ScenarioRaceRow[];

      beforeEach(() => {
        const umaId = TARGET_UMAS.indexOf(umaName) + 1;
        umaRow = makeUmamusumeRow(umaName, umaId);
        scenarioRaces = buildScenarioRaces(umaName, umaId);

        mockPrisma.registUmamusumeTable.findUnique.mockResolvedValue({
          user_id: 'test-user',
          umamusume_id: umaId,
          umamusume: umaRow,
        });
        // 全レース未走（出走済みなし）
        mockPrisma.registUmamusumeRaceTable.findMany.mockResolvedValue([]);
        mockPrisma.raceTable.findMany.mockResolvedValue(mockAllGRaces);
        mockPrisma.scenarioRaceTable.findMany.mockResolvedValue(scenarioRaces);
      });

      it('パターン生成がエラーなく完了する', async () => {
        const userId = 'test-user';
        const umaId = TARGET_UMAS.indexOf(umaName) + 1;
        await expect(service.getRacePattern(userId, umaId)).resolves.not.toThrow();
      });

      it('1件以上のパターンが生成される', async () => {
        const umaId = TARGET_UMAS.indexOf(umaName) + 1;
        const result = await service.getRacePattern('test-user', umaId);

        expect(result.patterns.length).toBeGreaterThanOrEqual(1);
        expect(result.umamusumeName).toBe(umaName);
      });

      it('各パターンは必須フィールドを持つ（scenario / factors6枚 / totalRaces > 0）', async () => {
        const umaId = TARGET_UMAS.indexOf(umaName) + 1;
        const result = await service.getRacePattern('test-user', umaId);

        for (const pattern of result.patterns) {
          expect(pattern).toHaveProperty('scenario');
          expect(pattern).toHaveProperty('junior');
          expect(pattern).toHaveProperty('classic');
          expect(pattern).toHaveProperty('senior');
          expect(Array.isArray(pattern.factors)).toBe(true);
          expect(pattern.factors).toHaveLength(6);
          expect((pattern.totalRaces ?? 0)).toBeGreaterThan(0);
        }
      });

      it('BCパターンにBC最終レースが配置されている', async () => {
        const umaId = TARGET_UMAS.indexOf(umaName) + 1;
        const result = await service.getRacePattern('test-user', umaId);

        const bcPatterns = result.patterns.filter((p) => p.scenario === 'bc');
        const bcRaceNames = mockAllGRaces.filter((r) => r.bc_flag).map((r) => r.race_name);

        for (const pattern of bcPatterns) {
          const allSlots = [...pattern.junior, ...pattern.classic, ...pattern.senior];
          const hasBC = allSlots.some((s) => s.race_name && bcRaceNames.includes(s.race_name));
          expect(hasBC).toBe(true);
        }
      });

      it('通常割り当てレースに適性D未満（E/F/G）の馬場・距離が含まれない', async () => {
        const umaId = TARGET_UMAS.indexOf(umaName) + 1;
        const result = await service.getRacePattern('test-user', umaId);

        const distKeys = ['sprint', 'mile', 'classic', 'long'];

        for (const pattern of result.patterns) {
          if (!pattern.aptitudeState) continue;

          const apt = pattern.aptitudeState;
          const allSlots = [...pattern.junior, ...pattern.classic, ...pattern.senior];

          for (const slot of allSlots) {
            if (!slot.race_name || slot.race_id === null) continue;
            const race = raceByName.get(slot.race_name);
            if (!race) continue;

            // BC必須中間レース・BC最終レース・ラーク必須レースはゲーム仕様で強制配置のため除外
            if (BC_MANDATORY_NAMES.has(slot.race_name)) continue;
            if (race.bc_flag) continue;
            if (LARC_MANDATORY_NAMES.has(slot.race_name)) continue;

            const surfKey = race.race_state === 0 ? 'turf' : 'dirt';
            const distKey = distKeys[race.distance - 1];
            const surfApt = getApt(apt[surfKey as keyof typeof apt]);
            const distApt = getApt(apt[distKey as keyof typeof apt]);

            expect(surfApt).toBeGreaterThanOrEqual(0);
            expect(distApt).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });
  }
});
