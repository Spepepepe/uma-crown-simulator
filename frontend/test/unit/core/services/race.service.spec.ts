import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { RaceService } from '@core/services/race.service';

/**
 * 対象: src/app/core/services/race.service.ts
 */

describe('RaceService', () => {
  let service: RaceService;
  let httpMock: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = {
      get: vi.fn(),
      post: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpMock }],
    });

    service = TestBed.inject(RaceService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─────────────────────────────────────────────
  // getRaces
  // ─────────────────────────────────────────────
  describe('getRaces', () => {
    it('フィルタなしでレース一覧を取得する', () => {
      const mockRaces = [{ race_id: 1, race_name: 'ジャパンカップ' }];
      httpMock.get.mockReturnValue(of(mockRaces));

      let result: unknown;
      service.getRaces().subscribe((data) => (result = data));

      expect(httpMock.get).toHaveBeenCalledWith(
        expect.stringContaining('/races'),
        expect.any(Object),
      );
      expect(result).toEqual(mockRaces);
    });

    it('馬場・距離フィルタ付きでレース一覧を取得する', () => {
      httpMock.get.mockReturnValue(of([]));

      service.getRaces(0, 3).subscribe();

      const [, options] = httpMock.get.mock.calls[0];
      const params = options.params;
      expect(params.get('state')).toBe('0');
      expect(params.get('distance')).toBe('3');
    });

    it('APIエラー時にエラーを伝播する', () => {
      httpMock.get.mockReturnValue(throwError(() => new Error('Network error')));

      let error: unknown;
      service.getRaces().subscribe({ error: (e) => (error = e) });

      expect(error).toBeInstanceOf(Error);
    });
  });

  // ─────────────────────────────────────────────
  // getRegistrationTargets
  // ─────────────────────────────────────────────
  describe('getRegistrationTargets', () => {
    it('登録用レース一覧を取得する', () => {
      const mockRaces = [{ race_id: 2, race_name: '有馬記念' }];
      httpMock.get.mockReturnValue(of(mockRaces));

      let result: unknown;
      service.getRegistrationTargets().subscribe((data) => (result = data));

      expect(httpMock.get).toHaveBeenCalledWith(
        expect.stringContaining('/races/registration-targets'),
      );
      expect(result).toEqual(mockRaces);
    });
  });

  // ─────────────────────────────────────────────
  // getRemainingRaces
  // ─────────────────────────────────────────────
  describe('getRemainingRaces', () => {
    it('残レース情報の一覧を取得する', () => {
      const mockData = [{ umamusume: { umamusume_id: 1 }, allCrownRace: 3 }];
      httpMock.get.mockReturnValue(of(mockData));

      let result: unknown;
      service.getRemainingRaces().subscribe((data) => (result = data));

      expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/races/remaining'));
      expect(result).toEqual(mockData);
    });
  });

  // ─────────────────────────────────────────────
  // getPatterns
  // ─────────────────────────────────────────────
  describe('getPatterns', () => {
    it('指定ウマ娘のパターンを取得する', () => {
      const mockResponse = { patterns: [], umamusumeName: 'テスト' };
      httpMock.get.mockReturnValue(of(mockResponse));

      let result: unknown;
      service.getPatterns(42).subscribe((data) => (result = data));

      expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/races/patterns/42'));
      expect(result).toEqual(mockResponse);
    });
  });

  // ─────────────────────────────────────────────
  // registerBatchResults
  // ─────────────────────────────────────────────
  describe('registerBatchResults', () => {
    it('全レースを一括登録する', () => {
      const mockRaces = [{ race_id: 1, race_name: 'ジャパンカップ', month: 11, half: false, race_state: 0, distance: 3 }];
      httpMock.post.mockReturnValue(of({}));

      service.registerBatchResults(1, mockRaces).subscribe();

      expect(httpMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/races/results/batch'),
        { umamusumeId: 1, races: mockRaces },
      );
    });
  });

  // ─────────────────────────────────────────────
  // registerOneResult
  // ─────────────────────────────────────────────
  describe('registerOneResult', () => {
    it('1件のレースを登録する', () => {
      const mockRace = { race_id: 1, race_name: '有馬記念', month: 12, half: true, race_state: 0, distance: 4 };
      httpMock.post.mockReturnValue(of({}));

      service.registerOneResult(1, mockRace).subscribe();

      expect(httpMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/races/results'),
        { umamusumeId: 1, race: mockRace },
      );
    });

    it('APIエラー時にエラーを伝播する', () => {
      const mockRace = { race_id: 1, race_name: '有馬記念', month: 12, half: true, race_state: 0, distance: 4 };
      httpMock.post.mockReturnValue(throwError(() => new Error('Server error')));

      let error: unknown;
      service.registerOneResult(1, mockRace).subscribe({ error: (e) => (error = e) });

      expect(error).toBeInstanceOf(Error);
    });
  });
});
