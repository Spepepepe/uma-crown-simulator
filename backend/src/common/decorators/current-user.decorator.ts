import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** AuthGuardによってリクエストに設定されたユーザーIDを取得するパラメーターデコレーター */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    // AuthGuard が検証後に request.userId をセットしている前提
    const request = ctx.switchToHttp().getRequest<{ userId: string }>();
    return request.userId;
  },
);
