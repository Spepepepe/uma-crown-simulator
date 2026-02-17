import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  type: 'success' | 'error';
  isVisible: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toast = signal<Toast>({ message: '', type: 'success', isVisible: false });

  private timerId: ReturnType<typeof setTimeout> | null = null;

  show(message: string, type: 'success' | 'error' = 'success') {
    if (this.timerId) {
      clearTimeout(this.timerId);
    }

    this.toast.set({ message, type, isVisible: true });

    this.timerId = setTimeout(() => {
      this.toast.set({ message: '', type: 'success', isVisible: false });
      this.timerId = null;
    }, 3000);
  }
}
