import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { UmamusumeService } from './umamusume.service.js';
import { Public } from '@common/decorators/public.decorator.js';
import { CurrentUser } from '@common/decorators/current-user.decorator.js';

/** ウマ娘関連のエンドポイントを提供するコントローラー */
@Controller('umamusumes')
export class UmamusumeController {
  constructor(private readonly umamusumeService: UmamusumeService) {}

  /** 全ウマ娘一覧を取得する (GET /umamusumes) ※認証不要 */
  @Public()
  @Get()
  async list() {
    return this.umamusumeService.findAll();
  }

  /** ユーザーが未登録のウマ娘一覧を取得する (GET /umamusumes/unregistered)
   * @param userId - 認証済みユーザーID
   */
  @Get('unregistered')
  async unregistered(@CurrentUser() userId: string) {
    return this.umamusumeService.findUnregistered(userId);
  }

  /** ユーザーの登録済みウマ娘一覧を取得する (GET /umamusumes/registered)
   * @param userId - 認証済みユーザーID
   */
  @Get('registered')
  async registered(@CurrentUser() userId: string) {
    return this.umamusumeService.findRegistered(userId);
  }

  /** 登録済みウマ娘を削除する (DELETE /umamusumes/registrations/:umamusumeId)
   * @param userId - 認証済みユーザーID
   * @param umamusumeId - 削除するウマ娘ID
   */
  @Delete('registrations/:umamusumeId')
  async unregister(
    @CurrentUser() userId: string,
    @Param('umamusumeId', ParseIntPipe) umamusumeId: number,
  ) {
    return this.umamusumeService.unregister(userId, umamusumeId);
  }

  /** ウマ娘を登録する (POST /umamusumes/registrations)
   * @param userId - 認証済みユーザーID
   * @param body - 登録するウマ娘IDと初期出走レースIDの配列
   */
  @Post('registrations')
  async register(
    @CurrentUser() userId: string,
    @Body()
    body: {
      umamusumeId: number;
      raceIdArray: number[];
    },
  ) {
    return this.umamusumeService.register(
      userId,
      body.umamusumeId,
      body.raceIdArray,
    );
  }
}
