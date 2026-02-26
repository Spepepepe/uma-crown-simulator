import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as fs from 'fs';
import * as path from 'path';

/** 1回のINSERTで処理するレコード数 */
const BATCH_SIZE = 100;

/** アプリ起動時にマスタデータをDBへ差分投入するサービス */
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(SeedService.name) private readonly logger: PinoLogger,
  ) {}

  /** モジュール初期化時にJSONとDBを比較し、不足分のみ投入する */
  async onModuleInit() {
    this.logger.info('マスタデータの差分チェックを開始します...');
    await this.upsertRaces();
    const newUmamusumeNames = await this.upsertUmamusume();
    if (newUmamusumeNames.length > 0) {
      await this.seedScenarioRacesForNames(newUmamusumeNames);
    }
    this.logger.info('マスタデータの差分チェックが完了しました');
  }

  /** Race.json とDBを比較し、新規レースのみ投入する */
  private async upsertRaces() {
    const dataPath = path.resolve(process.cwd(), 'data/Race.json');
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as Record<string, any>;

    const existing = await this.prisma.raceTable.findMany({
      select: { race_name: true },
    });
    const existingNames = new Set(existing.map((r) => r.race_name));

    const newRecords: any[] = [];
    for (const [name, data] of Object.entries(raw)) {
      if (existingNames.has(name)) continue;
      newRecords.push({
        race_name: name,
        race_state: data.race_state ?? 0,
        distance: data.distance ?? 1,
        distance_detail: data.distance_detail ?? null,
        num_fans: data.num_fans ?? 0,
        race_months: data.race_months ?? 1,
        half_flag: data.half_flag ?? false,
        race_rank: data.race_rank ?? 1,
        junior_flag: data.junior_flag ?? false,
        classic_flag: data.classic_flag ?? false,
        senior_flag: data.senior_flag ?? false,
        larc_flag: data.larc_flag ?? false,
        bc_flag: data.bc_flag ?? false,
      });
    }

    if (newRecords.length === 0) {
      this.logger.info('race_table: 追加データなし');
      return;
    }

    let inserted = 0;
    for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
      const batch = newRecords.slice(i, i + BATCH_SIZE);
      await this.prisma.raceTable.createMany({ data: batch });
      inserted += batch.length;
    }
    this.logger.info(`race_table: ${inserted} 件を追加しました`);
  }

  /** Umamusume.json とDBを比較し、新規ウマ娘のみ投入する。追加した名前一覧を返す */
  private async upsertUmamusume(): Promise<string[]> {
    const dataPath = path.resolve(process.cwd(), 'data/Umamusume.json');
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as Record<string, any>;

    const existing = await this.prisma.umamusumeTable.findMany({
      select: { umamusume_name: true },
    });
    const existingNames = new Set(existing.map((u) => u.umamusume_name));

    const newRecords: any[] = [];
    const newNames: string[] = [];
    for (const [name, data] of Object.entries(raw)) {
      if (existingNames.has(name)) continue;
      newNames.push(name);
      newRecords.push({
        umamusume_name: name,
        turf_aptitude: data.turf_aptitude ?? 'A',
        dirt_aptitude: data.dirt_aptitude ?? 'G',
        front_runner_aptitude: data.front_runner_aptitude ?? 'G',
        early_foot_aptitude: data.early_foot_aptitude ?? 'A',
        midfield_aptitude: data.midfield_aptitude ?? 'A',
        closer_aptitude: data.closer_aptitude ?? 'G',
        sprint_aptitude: data.sprint_aptitude ?? 'G',
        mile_aptitude: data.mile_aptitude ?? 'A',
        classic_aptitude: data.classic_aptitude ?? 'A',
        long_distance_aptitude: data.long_distance_aptitude ?? 'A',
      });
    }

    if (newRecords.length === 0) {
      this.logger.info('umamusume_table: 追加データなし');
      return [];
    }

    let inserted = 0;
    for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
      const batch = newRecords.slice(i, i + BATCH_SIZE);
      await this.prisma.umamusumeTable.createMany({ data: batch });
      inserted += batch.length;
    }
    this.logger.info(`umamusume_table: ${inserted} 件を追加しました`);
    return newNames;
  }

  /** 指定したウマ娘名のシナリオレースをDBに投入する */
  private async seedScenarioRacesForNames(targetNames: string[]) {
    const dataPath = path.resolve(process.cwd(), 'data/Umamusume.json');
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as Record<string, any>;

    const umamusumes = await this.prisma.umamusumeTable.findMany({
      where: { umamusume_name: { in: targetNames } },
      select: { umamusume_id: true, umamusume_name: true },
    });
    const umamusumeMap = new Map(umamusumes.map((u) => [u.umamusume_name, u.umamusume_id]));

    const races = await this.prisma.raceTable.findMany({
      select: { race_id: true, race_name: true },
    });
    const raceMap = new Map(races.map((r) => [r.race_name, r.race_id]));

    const records: any[] = [];
    for (const name of targetNames) {
      const umamusumeId = umamusumeMap.get(name);
      if (!umamusumeId) continue;

      const scenarios = raw[name]?.scenarios;
      if (!scenarios) continue;

      for (const [raceNum, entry] of Object.entries(scenarios) as [string, any][]) {
        const num = parseInt(raceNum);
        this.processScenarioEntry(entry, num, umamusumeId, raceMap, records);
      }
    }

    if (records.length === 0) {
      this.logger.info('scenario_race_table: 追加データなし');
      return;
    }

    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await this.prisma.scenarioRaceTable.createMany({ data: batch });
      inserted += batch.length;
    }
    this.logger.info(`scenario_race_table: ${inserted} 件を追加しました`);
  }

  /** シナリオエントリを再帰的に処理してシナリオレースレコードを生成する
   * @param entry - シナリオJSONの1エントリ（文字列またはオブジェクト）
   * @param raceNumber - シナリオ内のレース番号
   * @param umamusumeId - 対象ウマ娘ID
   * @param raceMap - レース名→race_idのマップ
   * @param records - 投入対象レコードの蓄積配列
   * @param randomGroup - ランダム選択グループ番号（省略可）
   */
  private processScenarioEntry(
    entry: any,
    raceNumber: number,
    umamusumeId: number,
    raceMap: Map<string, number>,
    records: any[],
    randomGroup?: number,
  ) {
    if (typeof entry === 'string') {
      // 形式A: 単純な文字列（レース名のみ）
      const raceId = raceMap.get(entry);
      if (raceId) {
        records.push({
          umamusume_id: umamusumeId,
          race_id: raceId,
          race_number: raceNumber,
          random_group: randomGroup ?? null,
          senior_flag: null,
        });
      }
    } else if (entry && typeof entry === 'object') {
      if ('名前' in entry) {
        // 形式B: { 名前, 時期 } オブジェクト
        const raceId = raceMap.get(entry['名前']);
        if (raceId) {
          const period = entry['時期'];
          let seniorFlag: boolean | null = null;
          if (period === 'シニア') seniorFlag = true;
          else if (period === 'クラシック') seniorFlag = false;

          records.push({
            umamusume_id: umamusumeId,
            race_id: raceId,
            race_number: raceNumber,
            random_group: randomGroup ?? null,
            senior_flag: seniorFlag,
          });
        }
      } else {
        // 形式C/D: ネストされた選択肢 { "1": ..., "2": ... }
        for (const [groupNum, subEntry] of Object.entries(entry) as [string, any][]) {
          this.processScenarioEntry(
            subEntry,
            raceNumber,
            umamusumeId,
            raceMap,
            records,
            parseInt(groupNum),
          );
        }
      }
    }
  }
}
