import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service.js';
import { DatabaseException } from '@common/exceptions/database.exception.js';
import { ErrorCode } from '@common/constants/error-code.constant.js';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { readFile } from 'node:fs/promises';
import * as path from 'path';
import type { Prisma } from '@prisma/client';

/** 1回のINSERTで処理するレコード数 */
const BATCH_SIZE = 100;

// ─── JSON データの型定義 ───

/** Race.json の1エントリ */
interface RaceJsonEntry {
  race_name: string;
  race_state: number;
  distance: number;
  distance_detail: number | null;
  num_fans: number;
  race_rank: number;
  senior_flag: boolean;
  classic_flag: boolean;
  junior_flag: boolean;
  race_months: number;
  half_flag: boolean;
  larc_flag: boolean;
  bc_flag: boolean;
}

/** Umamusume.json の1エントリ */
interface UmamusumeJsonEntry {
  umamusume_name: string;
  turf_aptitude: string;
  dirt_aptitude: string;
  front_runner_aptitude: string;
  early_foot_aptitude: string;
  midfield_aptitude: string;
  closer_aptitude: string;
  sprint_aptitude: string;
  mile_aptitude: string;
  classic_aptitude: string;
  long_distance_aptitude: string;
}

/** UmamusumeScenario.json のシナリオエントリ（再帰的な型） */
interface ScenarioNamedEntry {
  名前: string;
  時期?: string;
}

/** ネストされた選択肢グループ */
interface ScenarioChoiceGroup {
  [groupNum: string]: string | ScenarioNamedEntry | ScenarioChoiceGroup;
}

type ScenarioEntry = string | ScenarioNamedEntry | ScenarioChoiceGroup;

/** シナリオレースの投入レコード型 */
type ScenarioRaceRecord = Prisma.ScenarioRaceTableCreateManyInput;

/**
 * アプリ起動時にマスタデータをDBへ差分投入するサービス
 *
 * 担当: JSON ファイルの読み込み・DB との差分比較・新規レコードの一括投入
 * 禁止: HTTP の知識・ビジネスロジック
 */
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(SeedService.name) private readonly logger: PinoLogger,
  ) {}

  /** モジュール初期化時にJSONとDBを比較し、不足分のみ投入する */
  async onModuleInit(): Promise<void> {
    this.logger.info('マスタデータの差分チェックを開始します...');
    await this.upsertRaces();
    await this.upsertUmamusume();
    await this.upsertScenarioRaces();
    this.logger.info('マスタデータの差分チェックが完了しました');
  }

  /**
   * Race.json とDBを比較し、新規レースのみ投入する
   * @throws DatabaseException ファイル読み込み・DB操作の失敗時
   */
  private async upsertRaces(): Promise<void> {
    const dataPath = path.resolve(process.cwd(), 'data/Race.json');
    const raw = await this.loadJsonFile<Record<string, RaceJsonEntry>>(
      dataPath,
      'SeedService.upsertRaces',
    );

    const existing = await this.prisma.raceTable.findMany({
      select: { race_name: true },
    });
    const existingNames = new Set(existing.map((r) => r.race_name));

    const newRecords: Prisma.RaceTableCreateManyInput[] = [];
    for (const [name, data] of Object.entries(raw)) {
      if (existingNames.has(name)) continue;
      newRecords.push({
        race_name: name,
        race_state: data.race_state,
        distance: data.distance,
        distance_detail: data.distance_detail ?? null,
        num_fans: data.num_fans,
        race_months: data.race_months,
        half_flag: data.half_flag,
        race_rank: data.race_rank,
        junior_flag: data.junior_flag,
        classic_flag: data.classic_flag,
        senior_flag: data.senior_flag,
        larc_flag: data.larc_flag,
        bc_flag: data.bc_flag,
      });
    }

    if (newRecords.length === 0) {
      this.logger.info('race_table: 追加データなし');
      return;
    }

    await this.batchInsert(
      newRecords,
      (batch) => this.prisma.raceTable.createMany({ data: batch }),
      'SeedService.upsertRaces',
    );
    this.logger.info(`race_table: ${newRecords.length} 件を追加しました`);
  }

  /**
   * Umamusume.json とDBを比較し、新規ウマ娘のみ投入する
   * @throws DatabaseException ファイル読み込み・DB操作の失敗時
   */
  private async upsertUmamusume(): Promise<void> {
    const dataPath = path.resolve(process.cwd(), 'data/Umamusume.json');
    const raw = await this.loadJsonFile<Record<string, UmamusumeJsonEntry>>(
      dataPath,
      'SeedService.upsertUmamusume',
    );

    const existing = await this.prisma.umamusumeTable.findMany({
      select: { umamusume_name: true },
    });
    const existingNames = new Set(existing.map((u) => u.umamusume_name));

    const newRecords: Prisma.UmamusumeTableCreateManyInput[] = [];
    for (const [name, data] of Object.entries(raw)) {
      if (existingNames.has(name)) continue;
      newRecords.push({
        umamusume_name: name,
        turf_aptitude: data.turf_aptitude,
        dirt_aptitude: data.dirt_aptitude,
        front_runner_aptitude: data.front_runner_aptitude,
        early_foot_aptitude: data.early_foot_aptitude,
        midfield_aptitude: data.midfield_aptitude,
        closer_aptitude: data.closer_aptitude,
        sprint_aptitude: data.sprint_aptitude,
        mile_aptitude: data.mile_aptitude,
        classic_aptitude: data.classic_aptitude,
        long_distance_aptitude: data.long_distance_aptitude,
      });
    }

    if (newRecords.length === 0) {
      this.logger.info('umamusume_table: 追加データなし');
      return;
    }

    await this.batchInsert(
      newRecords,
      (batch) => this.prisma.umamusumeTable.createMany({ data: batch }),
      'SeedService.upsertUmamusume',
    );
    this.logger.info(`umamusume_table: ${newRecords.length} 件を追加しました`);
  }

  /**
   * UmamusumeScenario.json とDBを比較し、シナリオレース未登録のウマ娘分のみ投入する
   * @throws DatabaseException ファイル読み込み・DB操作の失敗時
   */
  private async upsertScenarioRaces(): Promise<void> {
    const dataPath = path.resolve(process.cwd(), 'data/UmamusumeScenario.json');
    const raw = await this.loadJsonFile<
      Record<string, Record<string, ScenarioEntry>>
    >(dataPath, 'SeedService.upsertScenarioRaces');

    const scenarioNames = Object.keys(raw);
    if (scenarioNames.length === 0) {
      this.logger.info('scenario_race_table: 追加データなし');
      return;
    }

    // シナリオJSONに載っているウマ娘のIDを取得
    const umamusumes = await this.prisma.umamusumeTable.findMany({
      where: { umamusume_name: { in: scenarioNames } },
      select: { umamusume_id: true, umamusume_name: true },
    });
    const umamusumeMap = new Map(
      umamusumes.map((u) => [u.umamusume_name, u.umamusume_id]),
    );

    // scenario_race_table に既に登録済みのウマ娘IDセットを取得
    const existing = await this.prisma.scenarioRaceTable.findMany({
      select: { umamusume_id: true },
    });
    const existingIds = new Set(existing.map((r) => r.umamusume_id));

    const races = await this.prisma.raceTable.findMany({
      select: { race_id: true, race_name: true },
    });
    const raceMap = new Map(races.map((r) => [r.race_name, r.race_id]));

    // 未登録のウマ娘のシナリオレースのみ生成
    const records: ScenarioRaceRecord[] = [];
    for (const name of scenarioNames) {
      const umamusumeId = umamusumeMap.get(name);
      if (!umamusumeId) {
        this.logger.warn(
          { umamusumeName: name },
          'シナリオ JSON に記載のウマ娘がマスタに存在しないためスキップしました',
        );
        continue;
      }
      if (existingIds.has(umamusumeId)) continue;

      for (const [raceNum, entry] of Object.entries(raw[name])) {
        this.processScenarioEntry(
          entry,
          parseInt(raceNum, 10),
          umamusumeId,
          raceMap,
          records,
        );
      }
    }

    if (records.length === 0) {
      this.logger.info('scenario_race_table: 追加データなし');
      return;
    }

    await this.batchInsert(
      records,
      (batch) => this.prisma.scenarioRaceTable.createMany({ data: batch }),
      'SeedService.upsertScenarioRaces',
    );
    this.logger.info(`scenario_race_table: ${records.length} 件を追加しました`);
  }

  /**
   * シナリオエントリを再帰的に処理してシナリオレースレコードを生成する
   * @param entry - シナリオJSONの1エントリ（文字列・名前付きオブジェクト・ネスト選択肢）
   * @param raceNumber - シナリオ内のレース番号
   * @param umamusumeId - 対象ウマ娘ID
   * @param raceMap - レース名→race_idのマップ
   * @param records - 投入対象レコードの蓄積配列
   * @param randomGroup - ランダム選択グループ番号（省略可）
   */
  private processScenarioEntry(
    entry: ScenarioEntry,
    raceNumber: number,
    umamusumeId: number,
    raceMap: Map<string, number>,
    records: ScenarioRaceRecord[],
    randomGroup?: number,
  ): void {
    if (typeof entry === 'string') {
      // 形式A: 単純な文字列（レース名のみ）
      const raceId = raceMap.get(entry);
      if (!raceId) {
        this.logger.warn(
          { raceName: entry, umamusumeId },
          'レース名がマスタに存在しないためスキップしました',
        );
        return;
      }
      records.push({
        umamusume_id: umamusumeId,
        race_id: raceId,
        race_number: raceNumber,
        random_group: randomGroup ?? null,
        senior_flag: null,
      });
    } else if (this.isNamedEntry(entry)) {
      // 形式B: { 名前, 時期 } オブジェクト
      const raceName = entry['名前'];
      const raceId = raceMap.get(raceName);
      if (!raceId) {
        this.logger.warn(
          { raceName, umamusumeId },
          'レース名がマスタに存在しないためスキップしました',
        );
        return;
      }
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
    } else {
      // 形式C/D: ネストされた選択肢 { "1": ..., "2": ... }
      for (const [groupNum, subEntry] of Object.entries(entry)) {
        this.processScenarioEntry(
          subEntry,
          raceNumber,
          umamusumeId,
          raceMap,
          records,
          parseInt(groupNum, 10),
        );
      }
    }
  }

  /**
   * エントリが名前付きシナリオ（{ 名前, 時期 }）かどうかを判定する型ガード
   * @param entry - 判定対象
   * @returns 名前付きエントリの場合 true
   */
  private isNamedEntry(entry: ScenarioEntry): entry is ScenarioNamedEntry {
    return typeof entry === 'object' && entry !== null && '名前' in entry;
  }

  /**
   * JSON ファイルを非同期で読み込みパースする
   * @param filePath - ファイルパス
   * @param location - 呼び出し元の位置情報
   * @returns パースされたデータ
   * @throws DatabaseException ファイル読み込み・パース失敗時
   */
  private async loadJsonFile<T>(
    filePath: string,
    location: string,
  ): Promise<T> {
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (err) {
      throw new DatabaseException(
        `シードデータの読み込みに失敗しました: ${filePath}`,
        location,
        ErrorCode.DB_DATA_INTEGRITY,
        err,
      );
    }
  }

  /**
   * レコードを BATCH_SIZE ごとに分割して一括投入する
   * @param records - 投入対象レコード配列
   * @param insertFn - バッチ投入関数
   * @param location - 呼び出し元の位置情報
   * @throws DatabaseException DB投入失敗時
   */
  private async batchInsert<T>(
    records: T[],
    insertFn: (batch: T[]) => Promise<unknown>,
    location: string,
  ): Promise<void> {
    try {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await insertFn(batch);
      }
    } catch (err) {
      throw new DatabaseException(
        'シードデータの DB 投入に失敗しました',
        location,
        ErrorCode.DB_QUERY_FAILED,
        err,
      );
    }
  }
}
