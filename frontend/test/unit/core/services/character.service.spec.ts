import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CharacterService } from '../../../../src/app/core/services/character.service';

/**
 * 対象: src/app/core/services/character.service.ts
 */

describe('CharacterService', () => {
  let service: CharacterService;
  let httpMock: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = {
      get: vi.fn(),
      post: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpMock }],
    });

    service = TestBed.inject(CharacterService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─────────────────────────────────────────────
  // getUnregisteredUmamusumes
  // ─────────────────────────────────────────────
  describe('getUnregisteredUmamusumes', () => {
    it('未登録ウマ娘の一覧を返す', () => {
      const mockData = [{ umamusume_id: 1, umamusume_name: 'テスト' }];
      httpMock.get.mockReturnValue(of(mockData));

      let result: unknown;
      service.getUnregisteredUmamusumes().subscribe((data) => (result = data));

      expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/umamusumes/unregistered'));
      expect(result).toEqual(mockData);
    });

    it('APIエラー時にエラーを伝播する', () => {
      httpMock.get.mockReturnValue(throwError(() => new Error('Network error')));

      let error: unknown;
      service.getUnregisteredUmamusumes().subscribe({ error: (e) => (error = e) });

      expect(error).toBeInstanceOf(Error);
    });
  });

  // ─────────────────────────────────────────────
  // getRegisteredUmamusumes
  // ─────────────────────────────────────────────
  describe('getRegisteredUmamusumes', () => {
    it('登録済みウマ娘の一覧を返す', () => {
      const mockData = [{ umamusume: { umamusume_id: 1, umamusume_name: 'テスト' } }];
      httpMock.get.mockReturnValue(of(mockData));

      let result: unknown;
      service.getRegisteredUmamusumes().subscribe((data) => (result = data));

      expect(httpMock.get).toHaveBeenCalledWith(expect.stringContaining('/umamusumes/registered'));
      expect(result).toEqual(mockData);
    });

    it('APIエラー時にエラーを伝播する', () => {
      httpMock.get.mockReturnValue(throwError(() => new Error('Network error')));

      let error: unknown;
      service.getRegisteredUmamusumes().subscribe({ error: (e) => (error = e) });

      expect(error).toBeInstanceOf(Error);
    });
  });

  // ─────────────────────────────────────────────
  // registerCharacter
  // ─────────────────────────────────────────────
  describe('registerCharacter', () => {
    it('正しいリクエストボディでPOSTする', () => {
      httpMock.post.mockReturnValue(of({}));

      service.registerCharacter(1, [10, 20, 30]).subscribe();

      expect(httpMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/umamusumes/registrations'),
        { umamusumeId: 1, raceIdArray: [10, 20, 30] },
      );
    });

    it('APIエラー時にエラーを伝播する', () => {
      httpMock.post.mockReturnValue(throwError(() => new Error('Server error')));

      let error: unknown;
      service.registerCharacter(1, []).subscribe({ error: (e) => (error = e) });

      expect(error).toBeInstanceOf(Error);
    });
  });
});
