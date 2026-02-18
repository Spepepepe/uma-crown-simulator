import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** AuthGuardによってリクエストに設定されたユーザーIDを取得するパラメーターデコレーター */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.userId;
  },
);
