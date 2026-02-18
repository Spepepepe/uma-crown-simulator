import { SetMetadata } from '@nestjs/common';

/** AuthGuardをスキップするためのメタデータキー */
export const IS_PUBLIC_KEY = 'isPublic';

/** このデコレーターを付けたルートはJWT認証をスキップする */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
