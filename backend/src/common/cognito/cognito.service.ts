import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/** AWS CognitoのJWTトークン検証を行うサービス */
@Injectable()
export class CognitoService {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(
    @InjectPinoLogger(CognitoService.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: this.config.getOrThrow<string>('COGNITO_USER_POOL_ID'),
      tokenUse: 'id',
      clientId: this.config.getOrThrow<string>('COGNITO_CLIENT_ID'),
    });
  }

  /**
   * CognitoのIDトークンを検証してユーザーIDを返す
   * @param token - BearerトークンからスライスしたJWT文字列
   * @returns 検証成功時はCognitoユーザーID (sub)、失敗時は null
   */
  async verifyToken(token: string): Promise<string | null> {
    try {
      const payload = await this.verifier.verify(token);
      return payload.sub;
    } catch (err: unknown) {
      this.logger.debug({ err }, 'トークン検証に失敗しました');
      return null;
    }
  }
}
