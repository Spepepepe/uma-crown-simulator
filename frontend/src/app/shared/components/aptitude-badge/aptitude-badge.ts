import { Component, input } from '@angular/core';

@Component({
  selector: 'app-aptitude-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white"
      [class]="getBadgeColor()"
    >
      {{ name() }}: {{ aptitude() || '-' }}
    </span>
  `,
})
export class AptitudeBadgeComponent {
  name = input.required<string>();
  aptitude = input<string>();

  getBadgeColor(): string {
    switch (this.aptitude()) {
      case 'S':
        return 'bg-yellow-500';
      case 'A':
        return 'bg-red-500';
      case 'B':
        return 'bg-orange-500';
      case 'C':
        return 'bg-blue-500';
      case 'D':
        return 'bg-green-500';
      case 'E':
        return 'bg-gray-500';
      case 'F':
        return 'bg-gray-400';
      case 'G':
        return 'bg-gray-300';
      default:
        return 'bg-gray-200';
    }
  }
}
