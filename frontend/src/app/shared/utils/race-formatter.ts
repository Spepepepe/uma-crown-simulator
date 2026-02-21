import { Race } from '@shared/types';

/** レースランク番号をGI/GII/GIIIに変換する */
export function getRaceRank(rank: number): string {
  switch (rank) {
    case 1: return 'GI';
    case 2: return 'GII';
    case 3: return 'GIII';
    default: return '';
  }
}

/** 距離区分番号を日本語名に変換する */
export function getDistanceLabel(d: number): string {
  switch (d) {
    case 1: return '短距離';
    case 2: return 'マイル';
    case 3: return '中距離';
    case 4: return '長距離';
    default: return '';
  }
}

/** レースの出走可能時期を日本語スラッシュ区切りで返す */
export function getRunSeason(race: Race): string {
  const parts: string[] = [];
  if (race.junior_flag) parts.push('ジュニア');
  if (race.classic_flag) parts.push('クラシック');
  if (race.senior_flag) parts.push('シニア');
  return parts.join(' / ');
}
