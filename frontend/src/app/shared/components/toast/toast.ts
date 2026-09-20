import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toastService.toast().isVisible) {
      <div
        class="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all flex items-center gap-4"
        [class]="toastService.toast().type === 'success' ? 'bg-green-500' : 'bg-red-500'"
      >
        <span>{{ toastService.toast().message }}</span>
        @if (toastService.toast().persistent) {
          <button class="underline whitespace-nowrap font-bold hover:opacity-80" (click)="reload()">
            更新する
          </button>
        }
      </div>
    }
  `,
})
/** トースト通知を画面に表示するコンポーネント */
export class ToastComponent {
  protected readonly toastService = inject(ToastService);

  protected reload() {
    location.reload();
  }
}
