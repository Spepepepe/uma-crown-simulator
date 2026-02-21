import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { APP_GUARD } from '@nestjs/core';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { UmamusumeController } from '@src/umamusume/umamusume.controller';
import { UmamusumeService } from '@src/umamusume/umamusume.service';

/**
 * 対象: src/umamusume/umamusume.controller.ts
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

describe('UmamusumeController (E2E)', () => {
  let app: INestApplication;
  let mockUmamusumeService: {
    findAll: jest.Mock;
    findUnregistered: jest.Mock;
    findRegistered: jest.Mock;
    register: jest.Mock;
  };

  beforeAll(async () => {
    mockUmamusumeService = {
      findAll: jest.fn().mockResolvedValue([]),
      findUnregistered: jest.fn().mockResolvedValue([]),
      findRegistered: jest.fn().mockResolvedValue([]),
      register: jest.fn().mockResolvedValue({ message: 'ウマ娘を登録しました' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UmamusumeController],
      providers: [
        { provide: UmamusumeService, useValue: mockUmamusumeService },
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
  // GET /umamusumes
  // ─────────────────────────────────────────────
  describe('GET /umamusumes', () => {
    it('200を返し、全ウマ娘一覧を返す', async () => {
      const mockList = [
        { umamusume_id: 1, umamusume_name: 'ゴールドシップ' },
        { umamusume_id: 2, umamusume_name: 'スペシャルウィーク' },
      ];
      mockUmamusumeService.findAll.mockResolvedValue(mockList as any);

      const res = await request(app.getHttpServer()).get('/umamusumes').expect(200);

      expect(res.body).toEqual(mockList);
      expect(mockUmamusumeService.findAll).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // GET /umamusumes/unregistered
  // ─────────────────────────────────────────────
  describe('GET /umamusumes/unregistered', () => {
    it('200を返し、認証済みユーザーIDでfindUnregisteredを呼ぶ', async () => {
      const mockList = [{ umamusume_id: 3, umamusume_name: 'テスト馬' }];
      mockUmamusumeService.findUnregistered.mockResolvedValue(mockList as any);

      const res = await request(app.getHttpServer())
        .get('/umamusumes/unregistered')
        .expect(200);

      expect(res.body).toEqual(mockList);
      expect(mockUmamusumeService.findUnregistered).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  // ─────────────────────────────────────────────
  // GET /umamusumes/registered
  // ─────────────────────────────────────────────
  describe('GET /umamusumes/registered', () => {
    it('200を返し、認証済みユーザーIDでfindRegisteredを呼ぶ', async () => {
      const mockList = [{ umamusume: { umamusume_id: 1, umamusume_name: 'テスト馬' } }];
      mockUmamusumeService.findRegistered.mockResolvedValue(mockList as any);

      const res = await request(app.getHttpServer())
        .get('/umamusumes/registered')
        .expect(200);

      expect(res.body).toEqual(mockList);
      expect(mockUmamusumeService.findRegistered).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  // ─────────────────────────────────────────────
  // POST /umamusumes/registrations
  // ─────────────────────────────────────────────
  describe('POST /umamusumes/registrations', () => {
    it('201を返し、registerを呼んで登録メッセージを返す', async () => {
      mockUmamusumeService.register.mockResolvedValue({ message: 'ウマ娘を登録しました' });

      const body = { umamusumeId: 5, raceIdArray: [10, 20] };
      const res = await request(app.getHttpServer())
        .post('/umamusumes/registrations')
        .send(body)
        .expect(201);

      expect(res.body).toEqual({ message: 'ウマ娘を登録しました' });
      expect(mockUmamusumeService.register).toHaveBeenCalledWith(
        TEST_USER_ID, 5, [10, 20],
      );
    });

    it('raceIdArrayが空の場合でも201を返す', async () => {
      mockUmamusumeService.register.mockResolvedValue({ message: 'ウマ娘を登録しました' });

      const body = { umamusumeId: 3, raceIdArray: [] };
      const res = await request(app.getHttpServer())
        .post('/umamusumes/registrations')
        .send(body)
        .expect(201);

      expect(res.body).toEqual({ message: 'ウマ娘を登録しました' });
      expect(mockUmamusumeService.register).toHaveBeenCalledWith(
        TEST_USER_ID, 3, [],
      );
    });
  });
});
