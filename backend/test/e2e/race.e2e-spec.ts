import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { APP_GUARD } from '@nestjs/core';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { RaceController } from '@src/race/race.controller';
import { RaceService } from '@src/race/race.service';
import { RacePatternService } from '@src/race/race-pattern.service';

/**
 * 対象: src/race/race.controller.ts
 *
 * 認証ガードをモックし、HTTPリクエスト→コントローラー→サービスの
 * レイヤー連携を検証するE2Eテスト。
 */

const TEST_USER_ID = 'e2e-test-user';

/** 認証済みユーザーIDをリクエストにセットするモックガード */
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.userId = TEST_USER_ID;
    return true;
  }
}

describe('RaceController (E2E)', () => {
  let app: INestApplication;
  let mockRaceService: {
    getRaceList: jest.Mock;
    getRegistRaceList: jest.Mock;
    getRemaining: jest.Mock;
    getRemainingToRace: jest.Mock;
    raceRun: jest.Mock;
    registerOne: jest.Mock;
    registerPattern: jest.Mock;
  };
  let mockRacePatternService: {
    getRacePattern: jest.Mock;
  };

  beforeAll(async () => {
    mockRaceService = {
      getRaceList: jest.fn().mockResolvedValue([]),
      getRegistRaceList: jest.fn().mockResolvedValue([]),
      getRemaining: jest.fn().mockResolvedValue([]),
      getRemainingToRace: jest.fn().mockResolvedValue({ data: [], Props: {} }),
      raceRun: jest.fn().mockResolvedValue({ message: '出走完了' }),
      registerOne: jest.fn().mockResolvedValue({ message: 'レースを出走登録しました。' }),
      registerPattern: jest.fn().mockResolvedValue({ message: 'レースパターンを登録しました。' }),
    };

    mockRacePatternService = {
      getRacePattern: jest.fn().mockResolvedValue({ patterns: [] }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RaceController],
      providers: [
        { provide: RaceService, useValue: mockRaceService },
        { provide: RacePatternService, useValue: mockRacePatternService },
        { provide: APP_GUARD, useClass: MockAuthGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // GET /races
  // ─────────────────────────────────────────────
  describe('GET /races', () => {
    it('200を返し、getRaceListを呼ぶ', async () => {
      const mockRaces = [{ race_id: 1, race_name: 'テストレース' }];
      mockRaceService.getRaceList.mockResolvedValue(mockRaces as any);

      const res = await request(app.getHttpServer()).get('/races').expect(200);

      expect(res.body).toEqual(mockRaces);
      expect(mockRaceService.getRaceList).toHaveBeenCalledWith(-1, -1);
    });

    it('state・distanceクエリパラメータをサービスに渡す', async () => {
      mockRaceService.getRaceList.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/races?state=0&distance=3').expect(200);

      expect(mockRaceService.getRaceList).toHaveBeenCalledWith(0, 3);
    });
  });

  // ─────────────────────────────────────────────
  // GET /races/registration-targets
  // ─────────────────────────────────────────────
  describe('GET /races/registration-targets', () => {
    it('200を返し、getRegistRaceListを呼ぶ', async () => {
      const mockRaces = [{ race_id: 1 }];
      mockRaceService.getRegistRaceList.mockResolvedValue(mockRaces as any);

      const res = await request(app.getHttpServer())
        .get('/races/registration-targets')
        .expect(200);

      expect(res.body).toEqual(mockRaces);
    });
  });

  // ─────────────────────────────────────────────
  // GET /races/remaining
  // ─────────────────────────────────────────────
  describe('GET /races/remaining', () => {
    it('200を返し、認証済みユーザーIDでgetRemainingを呼ぶ', async () => {
      const mockResult = [{ umamusume: { umamusume_id: 1 }, isAllCrown: false }];
      mockRaceService.getRemaining.mockResolvedValue(mockResult as any);

      const res = await request(app.getHttpServer()).get('/races/remaining').expect(200);

      expect(res.body).toEqual(mockResult);
      expect(mockRaceService.getRemaining).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  // ─────────────────────────────────────────────
  // GET /races/remaining/search
  // ─────────────────────────────────────────────
  describe('GET /races/remaining/search', () => {
    it('200を返し、クエリパラメータをサービスに渡す', async () => {
      const mockResult = { data: [], Props: { season: 2, month: 5, half: true } };
      mockRaceService.getRemainingToRace.mockResolvedValue(mockResult as any);

      const res = await request(app.getHttpServer())
        .get('/races/remaining/search?umamusumeId=1&season=2&month=5&half=true')
        .expect(200);

      expect(res.body).toEqual(mockResult);
      expect(mockRaceService.getRemainingToRace).toHaveBeenCalledWith(
        TEST_USER_ID, 1, 2, 5, true,
      );
    });
  });

  // ─────────────────────────────────────────────
  // POST /races/run
  // ─────────────────────────────────────────────
  describe('POST /races/run', () => {
    it('200を返し、raceRunを呼ぶ', async () => {
      mockRaceService.raceRun.mockResolvedValue({ message: '出走完了' });

      const res = await request(app.getHttpServer())
        .post('/races/run')
        .send({ umamusumeId: 1, raceId: 10 })
        .expect(201); // NestJSのPOSTはデフォルト201

      expect(res.body).toEqual({ message: '出走完了' });
      expect(mockRaceService.raceRun).toHaveBeenCalledWith(TEST_USER_ID, 1, 10);
    });
  });

  // ─────────────────────────────────────────────
  // POST /races/results
  // ─────────────────────────────────────────────
  describe('POST /races/results', () => {
    it('200を返し、registerOneを呼ぶ', async () => {
      const race = { race_id: 5, race_name: '天皇賞秋' };
      mockRaceService.registerOne.mockResolvedValue({ message: '天皇賞秋を出走登録しました。' });

      const res = await request(app.getHttpServer())
        .post('/races/results')
        .send({ umamusumeId: 1, race })
        .expect(201);

      expect(res.body).toEqual({ message: '天皇賞秋を出走登録しました。' });
      expect(mockRaceService.registerOne).toHaveBeenCalledWith(TEST_USER_ID, 1, race);
    });
  });

  // ─────────────────────────────────────────────
  // POST /races/results/batch
  // ─────────────────────────────────────────────
  describe('POST /races/results/batch', () => {
    it('200を返し、registerPatternを呼ぶ', async () => {
      const races = [{ race_id: 1 }, { race_id: 2 }];
      mockRaceService.registerPattern.mockResolvedValue({ message: 'レースパターンを登録しました。' });

      const res = await request(app.getHttpServer())
        .post('/races/results/batch')
        .send({ umamusumeId: 1, races })
        .expect(201);

      expect(res.body).toEqual({ message: 'レースパターンを登録しました。' });
      expect(mockRaceService.registerPattern).toHaveBeenCalledWith(TEST_USER_ID, 1, races);
    });
  });

  // ─────────────────────────────────────────────
  // GET /races/patterns/:umamusumeId
  // ─────────────────────────────────────────────
  describe('GET /races/patterns/:umamusumeId', () => {
    it('200を返し、getRacePatternを呼ぶ', async () => {
      const mockPatterns = { patterns: [{ scenario: 'メイクラ', junior: [], classic: [], senior: [], factors: [], totalRaces: 0 }] };
      mockRacePatternService.getRacePattern.mockResolvedValue(mockPatterns as any);

      const res = await request(app.getHttpServer())
        .get('/races/patterns/1')
        .expect(200);

      expect(res.body).toEqual(mockPatterns);
      expect(mockRacePatternService.getRacePattern).toHaveBeenCalledWith(TEST_USER_ID, 1);
    });
  });
});
