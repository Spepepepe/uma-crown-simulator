import { TestBed } from '@angular/core/testing';
import { ToastService } from '@ui/components/toast/toast.service';

/**
 * 対象: src/app/shared/components/toast/toast.service.ts
 */
describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // ─────────────────────────────────────────────
  // 初期状態
  // ─────────────────────────────────────────────
  describe('初期状態', () => {
    it('isVisible が false であること', () => {
      expect(service.toast().isVisible).toBe(false);
    });

    it('message が空文字であること', () => {
      expect(service.toast().message).toBe('');
    });
  });

  // ─────────────────────────────────────────────
  // show
  // ─────────────────────────────────────────────
  describe('show', () => {
    it('メッセージが設定され isVisible が true になる', () => {
      service.show('テストメッセージ');

      expect(service.toast().message).toBe('テストメッセージ');
      expect(service.toast().isVisible).toBe(true);
    });

    it('デフォルトの type は success', () => {
      service.show('成功メッセージ');

      expect(service.toast().type).toBe('success');
    });

    it('type に error を指定できる', () => {
      service.show('エラーメッセージ', 'error');

      expect(service.toast().type).toBe('error');
    });

    it('3秒後に isVisible が false になる', () => {
      vi.useFakeTimers();
      service.show('テスト');

      expect(service.toast().isVisible).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(service.toast().isVisible).toBe(false);
      expect(service.toast().message).toBe('');
    });

    it('3秒未満では isVisible が true のまま', () => {
      vi.useFakeTimers();
      service.show('テスト');

      vi.advanceTimersByTime(2999);

      expect(service.toast().isVisible).toBe(true);
    });

    it('show を連続呼び出すとタイマーがリセットされる', () => {
      vi.useFakeTimers();

      service.show('最初のメッセージ');
      vi.advanceTimersByTime(2000);

      // 2秒後に再度 show → タイマーがリセットされる
      service.show('2番目のメッセージ');
      vi.advanceTimersByTime(2000);

      // 合計4秒経過しているが、2回目のshowから3秒未満なのでまだ表示中
      expect(service.toast().isVisible).toBe(true);
      expect(service.toast().message).toBe('2番目のメッセージ');

      vi.advanceTimersByTime(1000);

      // 2回目showから3秒経過 → 非表示
      expect(service.toast().isVisible).toBe(false);
    });
  });
});
