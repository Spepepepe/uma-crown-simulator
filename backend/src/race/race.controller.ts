import { Controller, Get, Post, Param, Query, Body, ParseIntPipe } from '@nestjs/common';
import { RaceService } from './race.service.js';
import { RacePatternService } from './pattern/race-pattern.service.js';
import { Public } from '@common/decorators/public.decorator.js';
import { CurrentUser } from '@common/decorators/current-user.decorator.js';
import type { RaceInput } from './race.types.js';

/** レース関連のエンドポイントを提供するコントローラー */
@Controller('races')
export class RaceController {
  constructor(
    private readonly raceService: RaceService,
    private readonly racePatternService: RacePatternService,
  ) {}

  /** レース一覧を取得する (GET /races) ※認証不要
   * @param state - 馬場フィルタ（-1=全て）
   * @param distance - 距離フィルタ（-1=全て）
   */
  @Public()
  @Get()
  async list(
    @Query('state') state: string = '-1',
    @Query('distance') distance: string = '-1',
  ) {
    return this.raceService.getRaceList(Number(state), Number(distance));
  }

  /** ウマ娘登録用のG1~G3レース一覧を取得する (GET /races/registration-targets) */
  @Get('registration-targets')
  async registrationTargets() {
    return this.raceService.getRegistRaceList();
  }

  /** ユーザーの全ウマ娘の残レース一覧を取得する (GET /races/remaining)
   * @param userId - 認証済みユーザーID
   */
  @Get('remaining')
  async remaining(@CurrentUser() userId: string) {
    return this.raceService.getRemaining(userId);
  }

  /** 指定ウマ娘・月の残レースを検索する (GET /races/remaining/search)
   * @param userId - 認証済みユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   * @param season - 時期（1~3）
   * @param month - 月（1~12）
   * @param half - 後半フラグ（"true"/"false"）
   */
  @Get('remaining/search')
  async remainingSearch(
    @CurrentUser() userId: string,
    @Query('umamusumeId') umamusumeId: string,
    @Query('season') season: string,
    @Query('month') month: string,
    @Query('half') half: string,
  ) {
    return this.raceService.getRemainingToRace(
      userId,
      Number(umamusumeId),
      Number(season),
      Number(month),
      half === 'true',
    );
  }

  /** レースに出走登録する (POST /races/run)
   * @param userId - 認証済みユーザーID
   * @param body - ウマ娘IDとレースID
   */
  @Post('run')
  async run(
    @CurrentUser() userId: string,
    @Body() body: { umamusumeId: number; raceId: number },
  ) {
    return this.raceService.raceRun(userId, body.umamusumeId, body.raceId);
  }

  /** レース結果を1件登録する (POST /races/results)
   * @param userId - 認証済みユーザーID
   * @param body - ウマ娘IDとレース情報
   */
  @Post('results')
  async registerOne(
    @CurrentUser() userId: string,
    @Body() body: { umamusumeId: number; race: RaceInput },
  ) {
    return this.raceService.registerOne(userId, body.umamusumeId, body.race);
  }

  /** パターンのレースを一括登録する (POST /races/results/batch)
   * @param userId - 認証済みユーザーID
   * @param body - ウマ娘IDとレース情報の配列
   */
  @Post('results/batch')
  async registerPattern(
    @CurrentUser() userId: string,
    @Body() body: { umamusumeId: number; races: RaceInput[] },
  ) {
    return this.raceService.registerPattern(
      userId,
      body.umamusumeId,
      body.races,
    );
  }

  /** ウマ娘の育成パターン候補を取得する (GET /races/patterns/:umamusumeId)
   * @param userId - 認証済みユーザーID
   * @param umamusumeId - 対象ウマ娘ID
   */
  @Get('patterns/:umamusumeId')
  async pattern(
    @CurrentUser() userId: string,
    @Param('umamusumeId', ParseIntPipe) umamusumeId: number,
  ) {
    return this.racePatternService.getRacePattern(userId, umamusumeId);
  }
}
