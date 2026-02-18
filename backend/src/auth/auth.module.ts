import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/** 認証機能モジュール。AuthControllerとAuthServiceを提供する */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
