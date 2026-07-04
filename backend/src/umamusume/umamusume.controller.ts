import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { UmamusumeService } from './umamusume.service.js';
import { Public } from '@common/decorators/public.decorator.js';
import { CurrentUser } from '@common/decorators/current-user.decorator.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import type { UmamusumeResponse, RegisteredUmamusumeResponse } from '@uma-crown/shared';

/** ウマ娘関連のエンドポイントを提供するコントローラー */
@Controller('umamusumes')
export class UmamusumeController {
  constructor(private readonly umamusumeService: UmamusumeService) {}

  /**
   * 全ウマ娘一覧を取得する
   * @returns ウマ娘一覧
   */
  @Public() // 認証不要: 全ウマ娘一覧は未ログインユーザーも参照可能なマスタデータ
  @Get()
  async list(): Promise<UmamusumeResponse[]> {
    return this.umamusumeService.findAll();
  }

  /**
   * ユーザーが未登録のウマ娘一覧を取得する
   * @param userId - 認証済みユーザーID
   * @returns 未登録ウマ娘一覧
   */
  @Get('unregistered')
  async unregistered(@CurrentUser() userId: string): Promise<UmamusumeResponse[]> {
    return this.umamusumeService.findUnregistered(userId);
  }

  /**
   * ユーザーの登録済みウマ娘一覧を取得する
   * @param userId - 認証済みユーザーID
   * @returns 登録済みウマ娘一覧
   */
  @Get('registered')
  async registered(@CurrentUser() userId: string): Promise<RegisteredUmamusumeResponse[]> {
    return this.umamusumeService.findRegistered(userId);
  }

  /**
   * 登録済みウマ娘を削除する
   * @param userId - 認証済みユーザーID
   * @param umamusumeId - 削除するウマ娘ID
   */
  @Delete('registrations/:umamusumeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @CurrentUser() userId: string,
    @Param('umamusumeId', ParseIntPipe) umamusumeId: number,
  ): Promise<void> {
    await this.umamusumeService.unregister(userId, umamusumeId);
  }

  /**
   * ウマ娘を登録する
   * @param userId - 認証済みユーザーID
   * @param dto - 登録するウマ娘IDと初期出走レースIDの配列
   * @returns 登録されたウマ娘情報
   */
  @Post('registrations')
  async register(
    @CurrentUser() userId: string,
    @Body() dto: CreateRegistrationDto,
  ): Promise<UmamusumeResponse> {
    return this.umamusumeService.register(
      userId,
      dto.umamusumeId,
      dto.raceIdArray,
    );
  }
}
