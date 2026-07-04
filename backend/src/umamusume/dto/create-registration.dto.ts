import { IsInt, IsArray, Min } from 'class-validator';

/** ウマ娘登録リクエスト DTO */
export class CreateRegistrationDto {
  /** 登録するウマ娘 ID */
  @IsInt()
  @Min(1)
  umamusumeId!: number;

  /** 初期出走済みとして登録するレース ID の配列 */
  @IsArray()
  @IsInt({ each: true })
  raceIdArray!: number[];
}
