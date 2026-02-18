import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { RaceRow } from '@uma-crown/shared';

/** 全冠達成までの目安育成回数を計算するサービス */
@Injectable()
export class BreedingCountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 全冠までの目安育成数を計算する
   * @param remainingRaces - 残レース配列
   * @returns 目安育成回数
   */
  calculate(remainingRaces: RaceRow[]): number {
    return this.calculateFromRaces(remainingRaces);
  }

  /**
   * シナリオレース情報を含む完全版の計算
   * @param umamusumeId - 対象ウマ娘ID
   * @param remainingRaces - 残レース配列
   * @returns シナリオ競合を考慮した目安育成回数
   */
  async calculateAsync(
    umamusumeId: number,
    remainingRaces: RaceRow[],
  ): Promise<number> {
    // シナリオレースを取得
    const scenarioRaces = await this.prisma.scenarioRaceTable.findMany({
      where: { umamusume_id: umamusumeId },
      include: { race: true },
    });

    if (scenarioRaces.length === 0) {
      return this.calculateFromRaces(remainingRaces);
    }

    // シナリオレースと被るタイミングの残レースを抽出
    const conflictingRaces: RaceRow[] = [];
    const addedRaceIds = new Set<number>();

    for (const sr of scenarioRaces) {
      const sRace = sr.race;
      for (const remaining of remainingRaces) {
        if (
          remaining.race_months === sRace.race_months &&
          remaining.half_flag === sRace.half_flag &&
          !addedRaceIds.has(remaining.race_id)
        ) {
          conflictingRaces.push(remaining);
          addedRaceIds.add(remaining.race_id);
        }
      }
    }

    // 各ターンの残レース数を計算
    const turnRemaining = this.countByTurn(remainingRaces);
    const turnConflicts = this.countByTurn(conflictingRaces);

    // 最大育成回数を決定
    let maxBreedingCount = 1;
    const allKeys = new Set([
      ...Object.keys(turnRemaining),
      ...Object.keys(turnConflicts),
    ]);

    for (const key of allKeys) {
      const remainingCount = turnRemaining[key] || 0;
      const conflictCount = turnConflicts[key] || 0;
      const requiredCount = Math.max(remainingCount, conflictCount);
      maxBreedingCount = Math.max(maxBreedingCount, requiredCount);
    }

    return Math.ceil(maxBreedingCount);
  }

  /** ターン別レース数から育成回数を計算する
   * @param remainingRaces - 残レース配列
   * @returns 目安育成回数
   */
  private calculateFromRaces(remainingRaces: RaceRow[]): number {
    const turnRemaining = this.countByTurn(remainingRaces);

    let maxCount = 1;
    for (const count of Object.values(turnRemaining)) {
      maxCount = Math.max(maxCount, count);
    }

    return Math.ceil(maxCount);
  }

  /** ターンキー（時期-月-前後半）ごとにレース数を集計する
   * @param races - 集計対象のレース配列
   * @returns ターンキー→レース数（複数級の場合は0.5）のマップ
   */
  private countByTurn(races: RaceRow[]): Record<string, number> {
    const turnCounts: Record<string, number> = {};

    for (const race of races) {
      const grades: number[] = [];
      if (race.junior_flag) grades.push(1);
      if (race.classic_flag) grades.push(2);
      if (race.senior_flag) grades.push(3);

      for (const grade of grades) {
        const key = `${grade}-${race.race_months}-${race.half_flag}`;
        if (!turnCounts[key]) turnCounts[key] = 0;
        // 複数級の場合は各級で0.5、単一級の場合は1.0
        const raceScore = grades.length > 1 ? 0.5 : 1.0;
        turnCounts[key] += raceScore;
      }
    }

    return turnCounts;
  }
}
