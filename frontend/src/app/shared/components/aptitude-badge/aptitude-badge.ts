import { Component, input } from '@angular/core';

@Component({
  selector: 'app-aptitude-badge',
  standalone: true,
  template: `
    <div
      class="flex items-center justify-between px-3 py-1.5 rounded-lg font-bold w-full shadow-sm bg-white/90"
    >
      <span class="text-base text-gray-800">{{ name() }}</span>
      <span class="text-lg font-black leading-none" [class]="getGradeColor()">{{
        aptitude() || '-'
      }}</span>
    </div>
  `,
})
/** 適性ランク（S~G）をランクに応じた色のバッジで表示するコンポーネント */
export class AptitudeBadgeComponent {
  /** バッジに表示するラベル名 */
  name = input.required<string>();
  /** 適性ランク文字（S/A/B/C/D/E/F/G） */
  aptitude = input<string>();

  /** 適性ランクに対応するテキスト色クラスを返す（ゲーム準拠配色）
   * @returns テキスト色クラス文字列
   */
  getGradeColor(): string {
    switch (this.aptitude()) {
      case 'S':
        return 'text-amber-500'; // 金
      case 'A':
        return 'text-rose-500'; // 赤
      case 'B':
        return 'text-orange-400'; // 橙
      case 'C':
        return 'text-lime-500'; // 黄緑
      case 'D':
        return 'text-cyan-500'; // 水色
      case 'E':
        return 'text-indigo-400'; // 青紫
      case 'F':
        return 'text-slate-500'; // スレート
      case 'G':
        return 'text-gray-400'; // グレー
      default:
        return 'text-gray-300';
    }
  }
}
