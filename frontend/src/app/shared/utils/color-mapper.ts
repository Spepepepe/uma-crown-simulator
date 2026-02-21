/** グレードに対応する背景グラデーションクラスを返す */
export function gradeBg(rank: number): string {
  switch (rank) {
    case 1: return 'bg-gradient-to-b from-amber-400 to-amber-100';
    case 2: return 'bg-gradient-to-b from-slate-400 to-slate-100';
    case 3: return 'bg-gradient-to-b from-orange-400 to-orange-100';
    default: return 'bg-gradient-to-b from-gray-300 to-gray-100';
  }
}

/** グレードに対応するバッジクラスを返す */
export function gradeBadge(rank: number): string {
  switch (rank) {
    case 1: return 'bg-amber-400 text-white';
    case 2: return 'bg-slate-400 text-white';
    case 3: return 'bg-orange-400 text-white';
    default: return 'bg-gray-300 text-white';
  }
}

/** 適性ランクに対応するテキスト色クラスを返す */
export function gradeColor(grade: string): string {
  switch (grade) {
    case 'S': return 'text-amber-500';
    case 'A': return 'text-rose-500';
    case 'B': return 'text-orange-400';
    case 'C': return 'text-lime-500';
    case 'D': return 'text-cyan-500';
    case 'E': return 'text-indigo-400';
    case 'F': return 'text-slate-500';
    case 'G': return 'text-gray-400';
    default:  return 'text-gray-300';
  }
}

/** 距離コードに対応するTailwindCSSの背景色クラスを返す */
export function getDistanceBgColor(d: number): string {
  switch (d) {
    case 1: return 'bg-pink-300';
    case 2: return 'bg-green-500';
    case 3: return 'bg-yellow-300';
    case 4: return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
}

/** バ場コードに対応するTailwindCSSの背景色クラスを返す */
export function getSurfaceBgColor(raceState: number): string {
  return raceState === 0 ? 'bg-lime-400' : 'bg-amber-800';
}

/** 残レース数に応じたTailwindCSSクラスを返す */
export function getRaceCountClass(count: number): string {
  if (count === 0) return 'text-yellow-500 text-2xl font-bold';
  if (count <= 2) return 'text-green-600 text-xl font-bold';
  return 'text-red-600 text-xl font-bold';
}

/** 残レース数の表示文字列を返す（0の場合は王冠絵文字） */
export function getRaceCountDisplay(count: number): string {
  return count === 0 ? '\uD83D\uDC51' : count.toString();
}
