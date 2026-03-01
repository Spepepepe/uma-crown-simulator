import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@src/common/guards/auth.guard';
import { Reflector } from '@nestjs/core';
import { RaceController } from '@src/race/race.controller';
import { RaceService } from '@src/race/race.service';
import { RacePatternService } from '@src/race/pattern/race-pattern.service';

/**
 * 対象: src/common/guards/auth.guard.ts
 *
 * 認証ガードの動作を E2E で検証するテスト。
 * - JWT なしリクエスト → 401 UnauthorizedException
 * - 無効な JWT → 401 UnauthorizedException
 * - 有効な JWT → 200 正常応答
 * - @Public() エンドポイント → 認証なしで 200
 */

const TEST_USER_ID = 'auth-e2e-test-user';
const VALID_TOKEN = 'valid-jwt-token';
const INVALID_TOKEN = 'invalid-jwt-token';

describe('AuthGuard (E2E)', () => {
  let app: INestApplication;
  let mockCognitoService: { verifyToken: jest.Mock };
  let mockRaceService: {
    getRaceList: jest.Mock;
    getRegistRaceList: jest.Mock;
    getRemaining: jest.Mock;
    getRemainingToRace: jest.Mock;
    raceRun: jest.Mock;
    registerOne: jest.Mock;
    registerPattern: jest.Mock;
  };
  let mockRacePatternService: { getRacePattern: jest.Mock };

  beforeAll(async () => {
    mockCognitoService = {
      verifyToken: jest.fn().mockImplementation((token: string) => {
        return token === VALID_TOKEN ? TEST_USER_ID : null;
      }),
    };

    mockRaceService = {
      getRaceList: jest.fn().mockResolvedValue([]),
      getRegistRaceList: jest.fn().mockResolvedValue([]),
      getRemaining: jest.fn().mockResolvedValue([]),
      getRemainingToRace: jest.fn().mockResolvedValue({ data: [], Props: {} }),
      raceRun: jest.fn().mockResolvedValue({ message: '出走完了' }),
      registerOne: jest.fn().mockResolvedValue({ message: '登録完了' }),
      registerPattern: jest.fn().mockResolvedValue({ message: '一括登録完了' }),
    };

    mockRacePatternService = {
      getRacePattern: jest.fn().mockResolvedValue({ patterns: [] }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RaceController],
      providers: [
        { provide: RaceService, useValue: mockRaceService },
        { provide: RacePatternService, useValue: mockRacePatternService },
        { provide: 'CognitoService', useValue: mockCognitoService },
        Reflector,
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => {
            const guard = new AuthGuard(
              { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
              mockCognitoService as any,
              reflector,
            );
            return guard;
          },
          inject: [Reflector],
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // 認証が必要なエンドポイント
  // ─────────────────────────────────────────────
  describe('認証必須エンドポイント (GET /races/remaining)', () => {
    it('Authorization ヘッダーなし → 401 を返す', async () => {
      await request(app.getHttpServer())
        .get('/races/remaining')
        .expect(401);
    });

    it('無効なトークン → 401 を返す', async () => {
      await request(app.getHttpServer())
        .get('/races/remaining')
        .set('Authorization', `Bearer ${INVALID_TOKEN}`)
        .expect(401);
    });

    it('有効なトークン → 200 を返す', async () => {
      mockRaceService.getRemaining.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/races/remaining')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .expect(200);

      expect(mockRaceService.getRemaining).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('"Bearer " プレフィックスなしのトークン → 401 を返す', async () => {
      await request(app.getHttpServer())
        .get('/races/remaining')
        .set('Authorization', VALID_TOKEN)
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────
  // @Public() エンドポイント
  // ─────────────────────────────────────────────
  describe('@Public() エンドポイント (GET /races)', () => {
    it('Authorization ヘッダーなしでも 200 を返す', async () => {
      mockRaceService.getRaceList.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/races')
        .expect(200);
    });
  });
});
