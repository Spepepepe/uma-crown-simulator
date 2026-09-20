import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RaceRow, UmamusumeRow, AptitudeState } from '../race.types.js';
import {
  LARC_EXCLUSIVE_NAMES,
  BC_FINAL_SLOT,
  BC_MANDATORY,
  ORDERED_SLOTS,
} from './pattern.constants.js';
import type { BCPatternsInit } from './pattern.types.js';
import {
  sk,
  getAvailableSlots,
  isBCRestrictedSlot,
  getConsecutiveLength,
  isConsecutiveViolation,
  calcBCStrategy,
  buildAptitudeState,
  applyStrategyToAptitude,
  raceMatchesAptitude,
  isRaceRunnable,
  calcRunnableEnhancement,
} from './pattern.helpers.js';

/** スロット候補のスコア情報 */
interface SlotCandidate {
  race: RaceRow;
  pi: number;
  score: number;
  needsStrategySet: boolean;
  enhancement: Record<string, number> | null;
}

/**
 * BC（ブリーダーズカップ）シナリオのパターン生成を担うサービス
 *
 * - `initializeBCPatterns`: Phase 3-5 の BC グリッド・戦略・適性の初期化
 * - `assignRacesToBCGrids`: Phase 6 の時系列レース割り当て
 * - `buildOverflowPatterns`: Phase 7 のオーバーフロー BC パターン追加
 *
 * PrismaService への依存はなく、純粋なアルゴリズムのみを扱うため単体テストが容易。
 */
@Injectable()
export class BCPatternBuilderService {
  constructor(
    @InjectPinoLogger(BCPatternBuilderService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Phase 3-5: BCパターンのグリッド・戦略・適性を初期化し、割り当て対象レースを絞り込む
   */
  initializeBCPatterns(
    umaData: UmamusumeRow,
    remainingBCRaces: RaceRow[],
    remainingRacesAll: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    hasRemainingLarc: boolean,
  ): BCPatternsInit {
    const nBC = remainingBCRaces.length;

    // Phase 3: A パターン（補修あり）→ B パターン（補修なし）の順にソート
    const sortedBCRaces =
      nBC > 0
        ? [...remainingBCRaces].sort((a, b) => {
            const stratA = calcBCStrategy(a, umaData);
            const stratB = calcBCStrategy(b, umaData);
            if (stratA && !stratB) return -1;
            if (!stratA && stratB) return 1;
            return 0;
          })
        : [];

    const grid: Map<string, RaceRow>[] = Array.from(
      { length: nBC },
      () => new Map<string, RaceRow>(),
    );
    const patternStrategies: (Record<string, number> | null)[] =
      sortedBCRaces.map((bc) => {
        const mandatory = (BC_MANDATORY[bc.race_name] ?? [])
          .map(([, name]) =>
            allBCMandatoryRaces.find((r) => r.race_name === name),
          )
          .filter((r): r is RaceRow => r !== undefined);
        return calcBCStrategy(bc, umaData, mandatory);
      });
    const aptitudeStates: AptitudeState[] = sortedBCRaces.map(() =>
      buildAptitudeState(umaData),
    );

    this.logger.debug({ nBC }, 'Phase 3 完了: パターン生成');

    // Phase 4: BC最終レースをグリッドに配置し、中間レースを強制配置
    const bcMandatoryPrePlacedIds = new Set<number>();
    const bcFinalSlotKey = sk(
      BC_FINAL_SLOT.grade,
      BC_FINAL_SLOT.month,
      BC_FINAL_SLOT.half,
    );

    for (let i = 0; i < nBC; i++) {
      grid[i].set(bcFinalSlotKey, sortedBCRaces[i]);
    }

    for (let i = 0; i < nBC; i++) {
      this.placeBCMandatoryRaces(
        grid[i],
        sortedBCRaces[i].race_name,
        allBCMandatoryRaces,
        bcMandatoryPrePlacedIds,
      );
    }

    this.logger.debug(
      { bcMandatoryCount: bcMandatoryPrePlacedIds.size },
      'Phase 4 完了: BC中間レース配置・除外',
    );

    // Phase 5: 因子戦略を適性状態に適用
    for (let i = 0; i < nBC; i++) {
      const strategy = patternStrategies[i];
      if (strategy) {
        aptitudeStates[i] = applyStrategyToAptitude(
          aptitudeStates[i],
          strategy,
        );
      }
    }

    this.logger.debug({}, 'Phase 5 完了: 適性オブジェクト設定');

    // 割り当て対象レースの絞り込み（ラーク専用・BC・BC中間を除外）
    const racesToAssign = remainingRacesAll.filter(
      (r) =>
        !(hasRemainingLarc && LARC_EXCLUSIVE_NAMES.has(r.race_name)) &&
        !r.bc_flag &&
        !bcMandatoryPrePlacedIds.has(r.race_id),
    );

    return {
      sortedBCRaces,
      grid,
      patternStrategies,
      aptitudeStates,
      bcMandatoryPrePlacedIds,
      racesToAssign,
    };
  }

  /**
   * Phase 6: 時系列で残レースを各 BC パターンへ割り当てる
   */
  assignRacesToBCGrids(
    nBC: number,
    sortedBCRaces: (RaceRow | undefined)[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    racesToAssign: RaceRow[],
    umaData: UmamusumeRow,
  ): Set<number> {
    const assignedRaceIds = new Set<number>();

    for (const slot of ORDERED_SLOTS) {
      if (isBCRestrictedSlot(slot.grade, slot.month, slot.half)) continue;

      const slotK = sk(slot.grade, slot.month, slot.half);
      const candidateRaces = this.findCandidateRaces(
        racesToAssign,
        assignedRaceIds,
        slot,
      );
      if (candidateRaces.length === 0) continue;

      const candidates = this.scoreCandidates(
        candidateRaces,
        nBC,
        sortedBCRaces,
        grid,
        patternStrategies,
        aptitudeStates,
        umaData,
        slotK,
      );
      if (candidates.length === 0) continue;

      candidates.sort((a, b) => b.score - a.score);
      this.assignBestCandidates(
        candidates,
        grid,
        patternStrategies,
        aptitudeStates,
        umaData,
        slotK,
        assignedRaceIds,
      );
    }

    this.logger.debug(
      { assignedCount: assignedRaceIds.size },
      'Phase 6 完了: 時系列レース割り当て',
    );
    return assignedRaceIds;
  }

  /**
   * Phase 7: 未割り当て残レースをオーバーフロー BC パターンに割り当てる
   */
  buildOverflowPatterns(
    remainingRaces: RaceRow[],
    allGRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
  ): {
    grid: Map<string, RaceRow>;
    strategy: Record<string, number> | null;
    aptState: AptitudeState;
  }[] {
    const bcFinalKey = sk(
      BC_FINAL_SLOT.grade,
      BC_FINAL_SLOT.month,
      BC_FINAL_SLOT.half,
    );
    const allBCFinalRaces = allGRaces.filter((r) => r.bc_flag);

    const intermediateNameToBCFinal = this.buildIntermediateNameMap();

    // フェーズ1-3: パターン数 N を算出
    const { racesToAssign, nBCFromIntermediate, sortedBCFinalNames, N } =
      this.calculateOverflowPatternCount(
        remainingRaces,
        intermediateNameToBCFinal,
        allBCFinalRaces,
        umaData,
      );

    if (N === 0) return [];

    // フェーズ4: N 個のパターンを初期化
    const grid: Map<string, RaceRow>[] = Array.from(
      { length: N },
      () => new Map<string, RaceRow>(),
    );
    const patternStrategies: (Record<string, number> | null)[] = Array<Record<
      string,
      number
    > | null>(N).fill(null);
    const aptitudeStates: AptitudeState[] = Array.from({ length: N }, () =>
      buildAptitudeState(umaData),
    );

    // 先頭 nBCFromIntermediate 個: 中間レースから逆引きした BC パターン
    const sortedBCRacesForAssign: (RaceRow | undefined)[] = [];
    this.initializeIntermediatePatterns(
      nBCFromIntermediate,
      sortedBCFinalNames,
      allBCFinalRaces,
      allBCMandatoryRaces,
      umaData,
      bcFinalKey,
      grid,
      patternStrategies,
      aptitudeStates,
      sortedBCRacesForAssign,
    );

    // 残りパターン: 初期適性で BC 最終を仮決定
    this.initializeRemainingPatterns(
      nBCFromIntermediate,
      N,
      allBCFinalRaces,
      allBCMandatoryRaces,
      umaData,
      racesToAssign,
      bcFinalKey,
      grid,
      patternStrategies,
      aptitudeStates,
      sortedBCRacesForAssign,
      new Set(sortedBCFinalNames),
    );

    // フェーズ5: 全パターンへ残レースを一括割り当て
    this.assignRacesToBCGrids(
      N,
      sortedBCRacesForAssign,
      grid,
      patternStrategies,
      aptitudeStates,
      racesToAssign,
      umaData,
    );

    // 未割り当てレースの緊急パターン追加
    this.addEmergencyPatterns(
      racesToAssign,
      allBCFinalRaces,
      allBCMandatoryRaces,
      umaData,
      bcFinalKey,
      grid,
      patternStrategies,
      aptitudeStates,
    );

    // フェーズ6: 未設定パターンの BC 補完
    this.completeMissingBCPatterns(
      nBCFromIntermediate,
      N,
      allBCFinalRaces,
      allBCMandatoryRaces,
      umaData,
      bcFinalKey,
      grid,
      patternStrategies,
      aptitudeStates,
    );

    return this.filterEmptyPatterns(
      grid,
      patternStrategies,
      aptitudeStates,
      allBCFinalRaces,
      allBCMandatoryRaces,
    );
  }

  // ==============================
  // Private helpers
  // ==============================

  /** BC 中間レースをグリッドに強制配置する */
  private placeBCMandatoryRaces(
    patternGrid: Map<string, RaceRow>,
    bcFinalName: string,
    allBCMandatoryRaces: RaceRow[],
    prePlacedIds: Set<number>,
  ): void {
    const mandatory = BC_MANDATORY[bcFinalName] ?? [];
    for (const [grade, raceName, month, half] of mandatory) {
      const slotK = sk(grade, month, half);
      if (patternGrid.has(slotK)) continue;
      const race = allBCMandatoryRaces.find((r) => r.race_name === raceName);
      if (!race) continue;
      patternGrid.set(slotK, race);
      prePlacedIds.add(race.race_id);
    }
  }

  /** 指定スロットの候補レースを取得する */
  private findCandidateRaces(
    racesToAssign: RaceRow[],
    assignedRaceIds: Set<number>,
    slot: { grade: string; month: number; half: boolean },
  ): RaceRow[] {
    return racesToAssign.filter((race) => {
      if (assignedRaceIds.has(race.race_id)) return false;
      return getAvailableSlots(race).some(
        (s) =>
          s.grade === slot.grade &&
          s.month === slot.month &&
          s.half === slot.half,
      );
    });
  }

  /** 候補レースにスコアを付ける */
  private scoreCandidates(
    candidateRaces: RaceRow[],
    nBC: number,
    sortedBCRaces: (RaceRow | undefined)[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
    slotK: string,
  ): SlotCandidate[] {
    const candidates: SlotCandidate[] = [];

    for (const race of candidateRaces) {
      for (let pi = 0; pi < nBC; pi++) {
        if (grid[pi].has(slotK)) continue;
        if (isConsecutiveViolation(grid[pi], slotK)) continue;

        const candidate = this.evaluateCandidate(
          race,
          pi,
          sortedBCRaces,
          grid,
          patternStrategies,
          aptitudeStates,
          umaData,
          slotK,
        );
        if (candidate) candidates.push(candidate);
      }
    }

    return candidates;
  }

  /** 単一候補のスコアを評価する */
  private evaluateCandidate(
    race: RaceRow,
    pi: number,
    sortedBCRaces: (RaceRow | undefined)[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
    slotK: string,
  ): SlotCandidate | null {
    let enhancement: Record<string, number> | null = null;
    if (!isRaceRunnable(race, aptitudeStates[pi])) {
      enhancement = calcRunnableEnhancement(
        race,
        aptitudeStates[pi],
        patternStrategies[pi],
      );
      if (!enhancement) return null;
    }

    const matchesApt = raceMatchesAptitude(
      race,
      aptitudeStates[pi],
      sortedBCRaces[pi],
    );
    const isNullStrategy = patternStrategies[pi] === null;
    let score = 0;
    let needsStrategySet = false;

    if (enhancement) {
      score += 1;
    } else if (matchesApt) {
      score += 10;
    } else if (isNullStrategy) {
      const raceStrategy = calcBCStrategy(race, umaData);
      score += raceStrategy === null ? 5 : 2;
      needsStrategySet = raceStrategy !== null;
    }

    score -= getConsecutiveLength(grid[pi], slotK);
    score += 4 - race.race_rank;

    return { race, pi, score, needsStrategySet, enhancement };
  }

  /** 因子補修戦略を既存 strategy にマージして適性状態を更新する */
  private applyEnhancement(
    pi: number,
    enh: Record<string, number>,
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
  ): void {
    const merged: Record<string, number> = {
      ...(patternStrategies[pi] ?? {}),
    };
    for (const [key, val] of Object.entries(enh)) {
      merged[key] = (merged[key] ?? 0) + val;
    }
    patternStrategies[pi] = merged;
    aptitudeStates[pi] = applyStrategyToAptitude(
      buildAptitudeState(umaData),
      merged,
    );
  }

  /** スコア順に候補をグリッドに割り当てる */
  private assignBestCandidates(
    candidates: SlotCandidate[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
    slotK: string,
    assignedRaceIds: Set<number>,
  ): void {
    const usedPatterns = new Set<number>();
    const usedRaces = new Set<number>();

    // スコア > 0 の候補で割り当て
    this.assignScoredCandidates(
      candidates,
      grid,
      patternStrategies,
      aptitudeStates,
      umaData,
      slotK,
      assignedRaceIds,
      usedPatterns,
      usedRaces,
    );

    // フォールバック割り当て
    this.assignFallbackCandidates(
      candidates,
      grid,
      patternStrategies,
      aptitudeStates,
      umaData,
      slotK,
      assignedRaceIds,
      usedPatterns,
      usedRaces,
    );
  }

  /** スコア > 0 の候補をグリッドに割り当てる */
  private assignScoredCandidates(
    candidates: SlotCandidate[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
    slotK: string,
    assignedRaceIds: Set<number>,
    usedPatterns: Set<number>,
    usedRaces: Set<number>,
  ): void {
    for (const c of candidates) {
      if (c.score <= 0) continue;
      if (this.isCandidateUsed(c, usedPatterns, usedRaces, assignedRaceIds))
        continue;

      this.applyCandidateToGrid(
        c,
        grid,
        patternStrategies,
        aptitudeStates,
        umaData,
        slotK,
      );
      this.markCandidateUsed(c, usedPatterns, usedRaces, assignedRaceIds);
    }
  }

  /** フォールバック候補をグリッドに割り当てる */
  private assignFallbackCandidates(
    candidates: SlotCandidate[],
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
    slotK: string,
    assignedRaceIds: Set<number>,
    usedPatterns: Set<number>,
    usedRaces: Set<number>,
  ): void {
    for (const c of candidates) {
      if (this.isCandidateUsed(c, usedPatterns, usedRaces, assignedRaceIds))
        continue;

      if (c.enhancement)
        this.applyEnhancement(
          c.pi,
          c.enhancement,
          patternStrategies,
          aptitudeStates,
          umaData,
        );

      grid[c.pi].set(slotK, c.race);
      this.markCandidateUsed(c, usedPatterns, usedRaces, assignedRaceIds);
    }
  }

  /** 候補が既に使用済みかチェックする */
  private isCandidateUsed(
    c: SlotCandidate,
    usedPatterns: Set<number>,
    usedRaces: Set<number>,
    assignedRaceIds: Set<number>,
  ): boolean {
    return (
      usedPatterns.has(c.pi) ||
      usedRaces.has(c.race.race_id) ||
      assignedRaceIds.has(c.race.race_id)
    );
  }

  /** 候補を使用済みとしてマークする */
  private markCandidateUsed(
    c: SlotCandidate,
    usedPatterns: Set<number>,
    usedRaces: Set<number>,
    assignedRaceIds: Set<number>,
  ): void {
    usedPatterns.add(c.pi);
    usedRaces.add(c.race.race_id);
    assignedRaceIds.add(c.race.race_id);
  }

  /** 候補をグリッドに適用し、必要に応じて戦略を設定する */
  private applyCandidateToGrid(
    c: SlotCandidate,
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    umaData: UmamusumeRow,
    slotK: string,
  ): void {
    if (c.needsStrategySet) {
      const newStrategy = calcBCStrategy(c.race, umaData);
      if (newStrategy) {
        patternStrategies[c.pi] = newStrategy;
        aptitudeStates[c.pi] = applyStrategyToAptitude(
          buildAptitudeState(umaData),
          newStrategy,
        );
      }
    }
    if (c.enhancement)
      this.applyEnhancement(
        c.pi,
        c.enhancement,
        patternStrategies,
        aptitudeStates,
        umaData,
      );

    grid[c.pi].set(slotK, c.race);
  }

  /** BC中間レース名 → BC最終レース名の逆引きマップを構築する */
  private buildIntermediateNameMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const [bcFinalName, entries] of Object.entries(BC_MANDATORY)) {
      for (const [, raceName] of entries) {
        map.set(raceName, bcFinalName);
      }
    }
    return map;
  }

  /** オーバーフローパターン数 N を算出する */
  private calculateOverflowPatternCount(
    remainingRaces: RaceRow[],
    intermediateNameToBCFinal: Map<string, string>,
    allBCFinalRaces: RaceRow[],
    umaData: UmamusumeRow,
  ) {
    // フェーズ1: 残レースから BC 中間レースを除外
    const bcIntermediateIds = new Set(
      remainingRaces
        .filter((r) => intermediateNameToBCFinal.has(r.race_name))
        .map((r) => r.race_id),
    );
    const racesToAssign = remainingRaces.filter(
      (r) => !bcIntermediateIds.has(r.race_id),
    );

    // フェーズ2: BC 中間レースが属する BC 最終レースの種類数
    const bcFinalNamesWithIntermediate = new Set<string>(
      remainingRaces
        .filter((r) => intermediateNameToBCFinal.has(r.race_name))
        .map((r) => intermediateNameToBCFinal.get(r.race_name)!),
    );
    const nBCFromIntermediate = bcFinalNamesWithIntermediate.size;

    // フェーズ3: スロット圧力からパターン数を算出
    const nFromWeight = this.calculateSlotPressure(racesToAssign);
    const N = Math.max(nBCFromIntermediate, nFromWeight);

    // A パターン → B パターン順にソート
    const sortedBCFinalNames = [...bcFinalNamesWithIntermediate].sort(
      (a, b) => {
        const raceA = allBCFinalRaces.find((r) => r.race_name === a);
        const raceB = allBCFinalRaces.find((r) => r.race_name === b);
        const stratA = raceA ? calcBCStrategy(raceA, umaData) : null;
        const stratB = raceB ? calcBCStrategy(raceB, umaData) : null;
        if (stratA && !stratB) return -1;
        if (!stratA && stratB) return 1;
        return 0;
      },
    );

    this.logger.debug(
      { nBCFromIntermediate, nFromWeight, N },
      'オーバーフロー: パターン数確定',
    );

    return { racesToAssign, nBCFromIntermediate, sortedBCFinalNames, N };
  }

  /** スロット圧力からパターン数を算出する */
  private calculateSlotPressure(racesToAssign: RaceRow[]): number {
    const slotPressure = new Map<string, number>();
    for (const race of racesToAssign) {
      const availableSlots = getAvailableSlots(race).filter(
        (s) => !isBCRestrictedSlot(s.grade, s.month, s.half),
      );
      if (availableSlots.length === 0) continue;
      const weight = 1.0 / availableSlots.length;
      for (const slot of availableSlots) {
        const key = sk(slot.grade, slot.month, slot.half);
        slotPressure.set(key, (slotPressure.get(key) ?? 0) + weight);
      }
    }
    const maxPressure =
      slotPressure.size > 0 ? Math.max(...slotPressure.values()) : 0;
    return Math.ceil(maxPressure);
  }

  /** 中間レースから逆引きした BC パターンを初期化する */
  private initializeIntermediatePatterns(
    nBCFromIntermediate: number,
    sortedBCFinalNames: string[],
    allBCFinalRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
    bcFinalKey: string,
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    sortedBCRacesForAssign: (RaceRow | undefined)[],
  ): void {
    for (let i = 0; i < nBCFromIntermediate; i++) {
      const bcFinalName = sortedBCFinalNames[i];
      const bcRace = allBCFinalRaces.find((r) => r.race_name === bcFinalName);
      sortedBCRacesForAssign.push(bcRace);
      if (!bcRace) continue;

      grid[i].set(bcFinalKey, bcRace);
      this.placeBCMandatoryRaces(
        grid[i],
        bcFinalName,
        allBCMandatoryRaces,
        new Set(),
      );
      this.setPatternStrategy(
        i,
        bcRace,
        bcFinalName,
        allBCMandatoryRaces,
        umaData,
        patternStrategies,
        aptitudeStates,
      );
    }
  }

  /** BC パターンの戦略と適性を設定する */
  private setPatternStrategy(
    index: number,
    bcRace: RaceRow,
    bcFinalName: string,
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
  ): void {
    const mandatory = (BC_MANDATORY[bcFinalName] ?? [])
      .map(([, name]) => allBCMandatoryRaces.find((r) => r.race_name === name))
      .filter((r): r is RaceRow => r !== undefined);
    const strategy = calcBCStrategy(bcRace, umaData, mandatory);
    patternStrategies[index] = strategy;
    if (strategy) {
      aptitudeStates[index] = applyStrategyToAptitude(
        buildAptitudeState(umaData),
        strategy,
      );
    }
  }

  /** 残りパターン（index >= nBCFromIntermediate）を初期化する */
  private initializeRemainingPatterns(
    nBCFromIntermediate: number,
    N: number,
    allBCFinalRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
    racesToAssign: RaceRow[],
    bcFinalKey: string,
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    sortedBCRacesForAssign: (RaceRow | undefined)[],
    usedBCFinalNames: Set<string>,
  ): void {
    const singleSlotKeys = this.collectSingleSlotKeys(racesToAssign);

    for (let i = nBCFromIntermediate; i < N; i++) {
      const runnable = this.findBestBCRace(
        allBCFinalRaces,
        usedBCFinalNames,
        aptitudeStates[i],
        singleSlotKeys,
      );
      sortedBCRacesForAssign.push(runnable);
      if (!runnable) continue;

      usedBCFinalNames.add(runnable.race_name);
      grid[i].set(bcFinalKey, runnable);
      this.placeBCMandatoryRaces(
        grid[i],
        runnable.race_name,
        allBCMandatoryRaces,
        new Set(),
      );
      this.setPatternStrategy(
        i,
        runnable,
        runnable.race_name,
        allBCMandatoryRaces,
        umaData,
        patternStrategies,
        aptitudeStates,
      );
    }
  }

  /** 有効スロットが1つしかないレースのスロットキーを収集する */
  private collectSingleSlotKeys(racesToAssign: RaceRow[]): Set<string> {
    return new Set(
      racesToAssign.flatMap((r) => {
        const usableSlots = getAvailableSlots(r).filter(
          (s) => !isBCRestrictedSlot(s.grade, s.month, s.half),
        );
        if (usableSlots.length !== 1) return [];
        const [s] = usableSlots;
        return [sk(s.grade, s.month, s.half)];
      }),
    );
  }

  /** シングルスロット競合なし・走れる BC を優先で探す */
  private findBestBCRace(
    allBCFinalRaces: RaceRow[],
    usedBCFinalNames: Set<string>,
    aptState: AptitudeState,
    singleSlotKeys: Set<string>,
  ): RaceRow | undefined {
    return (
      allBCFinalRaces.find(
        (bc) =>
          !usedBCFinalNames.has(bc.race_name) &&
          isRaceRunnable(bc, aptState) &&
          !(BC_MANDATORY[bc.race_name] ?? []).some(([g, , m, h]) =>
            singleSlotKeys.has(sk(g, m, h)),
          ),
      ) ??
      allBCFinalRaces.find(
        (bc) =>
          !usedBCFinalNames.has(bc.race_name) && isRaceRunnable(bc, aptState),
      )
    );
  }

  /** 未割り当てレースの緊急パターンを追加する */
  private addEmergencyPatterns(
    racesToAssign: RaceRow[],
    allBCFinalRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
    bcFinalKey: string,
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
  ): void {
    const assignedInGrid = new Set<number>();
    for (const g of grid)
      for (const r of g.values()) assignedInGrid.add(r.race_id);
    const unassignedRaces = racesToAssign.filter(
      (r) => !assignedInGrid.has(r.race_id),
    );
    if (unassignedRaces.length === 0) return;

    const slotGroups = this.groupBySlot(unassignedRaces);
    for (const [slotKey, races] of slotGroups) {
      const baseState = buildAptitudeState(umaData);
      const emergencyBC = this.findEmergencyBC(
        allBCFinalRaces,
        baseState,
        slotKey,
      );
      for (const race of races) {
        const eg = new Map<string, RaceRow>();
        if (emergencyBC) {
          eg.set(bcFinalKey, emergencyBC);
          this.placeMandatoryExcluding(
            eg,
            emergencyBC.race_name,
            allBCMandatoryRaces,
            slotKey,
          );
        }
        eg.set(slotKey, race);
        grid.push(eg);
        const strategy = emergencyBC
          ? calcBCStrategy(emergencyBC, umaData)
          : null;
        patternStrategies.push(strategy);
        aptitudeStates.push(
          strategy
            ? applyStrategyToAptitude(buildAptitudeState(umaData), strategy)
            : baseState,
        );
      }
    }
    this.logger.debug(
      { unassignedCount: unassignedRaces.length },
      'オーバーフロー: 未割り当て緊急パターン追加',
    );
  }

  /** レースをスロット単位にグループ化する */
  private groupBySlot(races: RaceRow[]): Map<string, RaceRow[]> {
    const groups = new Map<string, RaceRow[]>();
    for (const race of races) {
      const usable = getAvailableSlots(race).filter(
        (s) => !isBCRestrictedSlot(s.grade, s.month, s.half),
      );
      if (usable.length === 0) continue;
      const key = sk(usable[0].grade, usable[0].month, usable[0].half);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(race);
    }
    return groups;
  }

  /** 緊急パターン用の BC レースを探す */
  private findEmergencyBC(
    allBCFinalRaces: RaceRow[],
    baseState: AptitudeState,
    slotKey: string,
  ): RaceRow | undefined {
    return (
      allBCFinalRaces.find(
        (bc) =>
          isRaceRunnable(bc, baseState) &&
          !(BC_MANDATORY[bc.race_name] ?? []).some(
            ([g, , m, h]) => slotKey === sk(g, m, h),
          ),
      ) ?? allBCFinalRaces.find((bc) => isRaceRunnable(bc, baseState))
    );
  }

  /** BC 中間レースを配置する（指定スロットは除外） */
  private placeMandatoryExcluding(
    grid: Map<string, RaceRow>,
    bcFinalName: string,
    allBCMandatoryRaces: RaceRow[],
    excludeSlotKey: string,
  ): void {
    for (const [grade, raceName, month, half] of BC_MANDATORY[bcFinalName] ??
      []) {
      const k = sk(grade, month, half);
      if (k === excludeSlotKey) continue;
      const r = allBCMandatoryRaces.find((mr) => mr.race_name === raceName);
      if (r) grid.set(k, r);
    }
  }

  /** フェーズ6: 未設定パターンの BC を補完する */
  private completeMissingBCPatterns(
    nBCFromIntermediate: number,
    N: number,
    allBCFinalRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
    umaData: UmamusumeRow,
    bcFinalKey: string,
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
  ): void {
    for (let i = nBCFromIntermediate; i < N; i++) {
      if (grid[i].has(bcFinalKey)) continue;
      const runnable = allBCFinalRaces.find((bc) =>
        isRaceRunnable(bc, aptitudeStates[i]),
      );
      if (!runnable) continue;
      grid[i].set(bcFinalKey, runnable);
      patternStrategies[i] = calcBCStrategy(runnable, umaData);
      this.placeBCMandatoryRaces(
        grid[i],
        runnable.race_name,
        allBCMandatoryRaces,
        new Set(),
      );
    }
  }

  /** BC 最終・中間レース以外のレースを持たないパターンを除外する */
  private filterEmptyPatterns(
    grid: Map<string, RaceRow>[],
    patternStrategies: (Record<string, number> | null)[],
    aptitudeStates: AptitudeState[],
    allBCFinalRaces: RaceRow[],
    allBCMandatoryRaces: RaceRow[],
  ) {
    const bcMandatoryNames = new Set(
      Object.values(BC_MANDATORY)
        .flat()
        .map(([, name]) => name),
    );
    const bcMandatoryIdSet = new Set(
      allBCMandatoryRaces
        .filter((r) => bcMandatoryNames.has(r.race_name))
        .map((r) => r.race_id),
    );
    const bcFinalIdSet = new Set(allBCFinalRaces.map((r) => r.race_id));

    return grid
      .map((g, i) => ({
        grid: g,
        strategy: patternStrategies[i],
        aptState: aptitudeStates[i],
      }))
      .filter(({ grid: g }) => {
        for (const race of g.values()) {
          if (
            !bcMandatoryIdSet.has(race.race_id) &&
            !bcFinalIdSet.has(race.race_id)
          )
            return true;
        }
        return false;
      });
  }
}
